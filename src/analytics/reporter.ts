/**
 * Analytics Reporter
 * 일일/주간/월간 보고서 생성
 */

import { costTracker } from "../modules/ai/cost-tracker.ts";
import { logger } from "../core/logger.ts";

export class AnalyticsReporter {
  async generateDailyReport(): Promise<string> {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const summary = await costTracker.getSummary(yesterday, today);

    return `# Daily Report - ${today.toISOString().split("T")[0]}

## AI Usage
- Total Requests: ${summary.totalRequests}
- Total Tokens: ${summary.totalTokens}
- Total Cost: $${summary.totalCost.toFixed(2)}

## By Provider
${Object.entries(summary.byProvider).map(([provider, data]) => `
- ${provider}: $${data.cost.toFixed(2)} (${data.requests} requests)
`).join("")}
`;
  }

  async generateMonthlyReport(): Promise<string> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const summary = await costTracker.getSummary(startOfMonth, now);
    const budget = await costTracker.getBudgetStatus();

    return `# Monthly Report - ${now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}

## Budget Status
- Budget: $${budget.monthly.budget}
- Spent: $${budget.monthly.spent.toFixed(2)}
- Remaining: $${budget.monthly.remaining.toFixed(2)}
- Usage: ${budget.monthly.percentUsed.toFixed(1)}%

## Total Usage
- Requests: ${summary.totalRequests}
- Tokens: ${summary.totalTokens}
- Cost: $${summary.totalCost.toFixed(2)}
`;
  }
}

export const reporter = new AnalyticsReporter();
