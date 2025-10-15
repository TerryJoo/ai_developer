/**
 * AI Cost Tracking System
 * API 비용 추적, 예산 관리, 알림 시스템
 */

import { getDatabase } from "../../database/sqlite.ts";
import { logger } from "../../core/logger.ts";
import { config } from "../../core/config.ts";
import type { AIRequestLog, AIProvider } from "../../core/types.ts";
import type { CostInfo } from "./providers/base.provider.ts";

/**
 * 비용 집계 결과
 */
export interface CostSummary {
  totalCost: number;
  totalRequests: number;
  totalTokens: number;
  byProvider: Record<
    string,
    {
      cost: number;
      requests: number;
      tokens: number;
    }
  >;
  byModel: Record<
    string,
    {
      cost: number;
      requests: number;
      tokens: number;
    }
  >;
  byOperation: Record<
    string,
    {
      cost: number;
      requests: number;
      tokens: number;
    }
  >;
}

/**
 * 예산 상태
 */
export interface BudgetStatus {
  monthly: {
    budget: number;
    spent: number;
    remaining: number;
    percentUsed: number;
  };
  daily: {
    budget: number;
    spent: number;
    remaining: number;
    percentUsed: number;
  };
  alertThreshold: number;
  shouldAlert: boolean;
}

/**
 * AI Cost Tracker
 */
export class CostTracker {
  private enabled: boolean;
  private monthlyBudget: number;
  private alertThreshold: number;
  private lastAlertDate: string | null = null;

  constructor() {
    this.enabled = config.costTracking.enabled;
    this.monthlyBudget = config.costTracking.budgetMonthly;
    this.alertThreshold = config.costTracking.alertThreshold;
  }

  /**
   * AI 요청 비용 기록
   */
  async trackRequest(
    costInfo: CostInfo,
    operation: string,
    duration: number,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const db = await getDatabase();
      const log: Omit<AIRequestLog, "id"> = {
        provider: costInfo.provider as AIProvider,
        model: costInfo.model,
        operation,
        promptTokens: costInfo.usage.promptTokens,
        completionTokens: costInfo.usage.completionTokens,
        totalTokens: costInfo.usage.totalTokens,
        cost: costInfo.cost,
        duration,
        createdAt: new Date(),
        metadata,
      };

      await db.saveAIRequestLog(log);

      logger.debug(
        `Tracked ${operation} cost: $${
          costInfo.cost.toFixed(4)
        } (${costInfo.usage.totalTokens} tokens)`,
      );

      // 예산 초과 확인
      await this.checkBudgetAlert();
    } catch (error) {
      logger.error(`Failed to track AI request: ${error}`);
    }
  }

  /**
   * 기간별 비용 요약
   */
  async getSummary(
    startDate: Date,
    endDate: Date,
  ): Promise<CostSummary> {
    try {
      const db = await getDatabase();
      // Use the existing cost stats method for now
      const stats = db.getAICostStats(30);

      return {
        totalCost: stats.totalCost,
        totalRequests: stats.totalRequests,
        totalTokens: stats.totalTokens,
        byProvider: stats.byProvider,
        byModel: {},
        byOperation: {},
      };
    } catch (error) {
      logger.error(`Failed to get cost summary: ${error}`);
      return {
        totalCost: 0,
        totalRequests: 0,
        totalTokens: 0,
        byProvider: {},
        byModel: {},
        byOperation: {},
      };
    }
  }

  /**
   * 오늘 비용 조회
   */
  async getTodayCost(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const summary = await this.getSummary(today, tomorrow);
    return summary.totalCost;
  }

  /**
   * 이번 달 비용 조회
   */
  async getMonthCost(): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const summary = await this.getSummary(startOfMonth, endOfMonth);
    return summary.totalCost;
  }

  /**
   * 예산 상태 조회
   */
  async getBudgetStatus(): Promise<BudgetStatus> {
    const monthCost = await this.getMonthCost();
    const todayCost = await this.getTodayCost();

    const dailyBudget = this.monthlyBudget / 30; // 간단한 일일 예산 계산

    return {
      monthly: {
        budget: this.monthlyBudget,
        spent: monthCost,
        remaining: this.monthlyBudget - monthCost,
        percentUsed: (monthCost / this.monthlyBudget) * 100,
      },
      daily: {
        budget: dailyBudget,
        spent: todayCost,
        remaining: dailyBudget - todayCost,
        percentUsed: (todayCost / dailyBudget) * 100,
      },
      alertThreshold: this.alertThreshold,
      shouldAlert: monthCost >= this.alertThreshold,
    };
  }

  /**
   * 예산 초과 알림 확인
   */
  private async checkBudgetAlert(): Promise<void> {
    const status = await this.getBudgetStatus();
    const today = new Date().toISOString().split("T")[0];

    // 오늘 이미 알림을 보냈으면 스킵
    if (this.lastAlertDate === today) {
      return;
    }

    if (status.shouldAlert) {
      this.lastAlertDate = today;

      logger.warn(
        `⚠️ AI Cost Alert: Monthly spending $${
          status.monthly.spent.toFixed(2)
        } ` +
          `has reached ${
            status.monthly.percentUsed.toFixed(1)
          }% of budget ($${this.monthlyBudget})`,
      );

      // 여기에 Slack, Discord, Email 알림 추가 가능
      await this.sendCostAlert(status);
    }
  }

  /**
   * 비용 알림 전송
   */
  private async sendCostAlert(status: BudgetStatus): Promise<void> {
    // Slack webhook 알림 (설정된 경우)
    if (config.notifications.slack.webhookUrl) {
      try {
        await fetch(config.notifications.slack.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `🚨 AI Cost Alert`,
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*AI Cost Budget Alert*\n\n` +
                    `Monthly Spent: *$${
                      status.monthly.spent.toFixed(2)
                    }* / $${status.monthly.budget}\n` +
                    `Usage: *${status.monthly.percentUsed.toFixed(1)}%*\n` +
                    `Remaining: $${status.monthly.remaining.toFixed(2)}`,
                },
              },
            ],
          }),
        });
      } catch (error) {
        logger.error(`Failed to send Slack alert: ${error}`);
      }
    }

    // Discord webhook 알림 (설정된 경우)
    if (config.notifications.discord.webhookUrl) {
      try {
        await fetch(config.notifications.discord.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [
              {
                title: "🚨 AI Cost Budget Alert",
                color: 0xff6b6b,
                fields: [
                  {
                    name: "Monthly Spent",
                    value: `$${
                      status.monthly.spent.toFixed(2)
                    } / $${status.monthly.budget}`,
                    inline: true,
                  },
                  {
                    name: "Usage",
                    value: `${status.monthly.percentUsed.toFixed(1)}%`,
                    inline: true,
                  },
                  {
                    name: "Remaining",
                    value: `$${status.monthly.remaining.toFixed(2)}`,
                    inline: true,
                  },
                ],
                timestamp: new Date().toISOString(),
              },
            ],
          }),
        });
      } catch (error) {
        logger.error(`Failed to send Discord alert: ${error}`);
      }
    }
  }

  /**
   * 비용 보고서 생성 (CSV 형식)
   */
  async generateReport(
    startDate: Date,
    endDate: Date,
  ): Promise<string> {
    const summary = await this.getSummary(startDate, endDate);

    let csv = "Date Range,Provider,Model,Operation,Cost,Requests,Tokens\n";

    const dateRange = `${startDate.toISOString().split("T")[0]} to ${
      endDate.toISOString().split("T")[0]
    }`;

    // Provider별 데이터
    for (const [provider, data] of Object.entries(summary.byProvider)) {
      csv += `${dateRange},${provider},ALL,ALL,${
        data.cost.toFixed(4)
      },${data.requests},${data.tokens}\n`;
    }

    // Model별 데이터
    for (const [model, data] of Object.entries(summary.byModel)) {
      csv += `${dateRange},ALL,${model},ALL,${
        data.cost.toFixed(4)
      },${data.requests},${data.tokens}\n`;
    }

    // Operation별 데이터
    for (const [operation, data] of Object.entries(summary.byOperation)) {
      csv += `${dateRange},ALL,ALL,${operation},${
        data.cost.toFixed(4)
      },${data.requests},${data.tokens}\n`;
    }

    return csv;
  }

  /**
   * 비용 추적 활성화/비활성화
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    logger.info(`Cost tracking ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * 예산 설정
   */
  setBudget(monthly: number, alertThreshold: number): void {
    this.monthlyBudget = monthly;
    this.alertThreshold = alertThreshold;
    logger.info(
      `Budget set to $${monthly}/month with alert at $${alertThreshold}`,
    );
  }
}

/**
 * 전역 비용 추적 인스턴스
 */
export const costTracker = new CostTracker();
