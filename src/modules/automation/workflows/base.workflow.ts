/**
 * Base Workflow Abstract Class
 * 모든 워크플로우가 상속받아야 하는 기본 클래스
 */

import { logger } from "../../../core/logger.ts";
import type {
  WorkflowContext,
  WorkflowResult,
  WorkflowStepResult,
  WorkflowType,
} from "../../../core/types.ts";

/**
 * Workflow Step Interface
 */
export interface WorkflowStep {
  name: string;
  description: string;
  execute: (context: WorkflowContext) => Promise<WorkflowStepResult>;
}

/**
 * Base Workflow Class
 */
export abstract class BaseWorkflow {
  protected workflowType: WorkflowType;
  protected steps: WorkflowStep[] = [];

  constructor(type: WorkflowType) {
    this.workflowType = type;
  }

  /**
   * 워크플로우 실행
   */
  async execute(context: WorkflowContext): Promise<WorkflowResult> {
    const startTime = Date.now();
    logger.info(`Starting ${this.workflowType} workflow`);

    const stepResults: WorkflowResult["steps"] = [];

    try {
      // 분석 단계
      await this.analyze(context);

      // 계획 단계
      await this.plan(context);

      // 실행 단계
      for (const step of this.steps) {
        const stepStart = Date.now();
        logger.info(`Executing step: ${step.name}`);

        try {
          const result = await step.execute(context);
          const stepDuration = Date.now() - stepStart;

          stepResults.push({
            name: step.name,
            status: result.success ? "success" : "failed",
            message: result.message,
            duration: stepDuration,
          });

          if (!result.success) {
            throw result.error || new Error(result.message);
          }
        } catch (error) {
          const stepDuration = Date.now() - stepStart;
          stepResults.push({
            name: step.name,
            status: "failed",
            message: error instanceof Error ? error.message : String(error),
            duration: stepDuration,
          });
          throw error;
        }
      }

      // 검증 단계
      await this.verify(context);

      const totalDuration = Date.now() - startTime;
      logger.info(`${this.workflowType} workflow completed in ${totalDuration}ms`);

      return {
        success: true,
        workflow: this.workflowType,
        steps: stepResults,
        totalDuration,
      };
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      logger.error(`${this.workflowType} workflow failed: ${error}`);

      // 롤백 시도
      await this.rollback(context);

      return {
        success: false,
        workflow: this.workflowType,
        steps: stepResults,
        totalDuration,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * 분석 단계 (abstract - 각 워크플로우에서 구현)
   */
  protected abstract analyze(context: WorkflowContext): Promise<void>;

  /**
   * 계획 단계 (abstract - 각 워크플로우에서 구현)
   */
  protected abstract plan(context: WorkflowContext): Promise<void>;

  /**
   * 검증 단계 (abstract - 각 워크플로우에서 구현)
   */
  protected abstract verify(context: WorkflowContext): Promise<void>;

  /**
   * 롤백 단계 (실패시 호출)
   */
  protected async rollback(context: WorkflowContext): Promise<void> {
    logger.warn(`Rolling back ${this.workflowType} workflow`);
    // 기본 구현은 없음, 필요한 경우 각 워크플로우에서 오버라이드
  }

  /**
   * 워크플로우 타입 반환
   */
  getType(): WorkflowType {
    return this.workflowType;
  }
}
