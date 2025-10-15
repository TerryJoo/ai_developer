import { JobQueue } from "./job-queue.ts";
import { config } from "../core/config.ts";
import { QueueError, TimeoutError } from "../core/errors.ts";
import { logger } from "../core/logger.ts";
import type { Job } from "../core/types.ts";

/**
 * Job 처리 핸들러 타입
 */
export type JobHandler<T = unknown> = (job: Job<T>) => Promise<unknown>;

/**
 * 워커 상태
 */
export type WorkerStatus = "idle" | "busy" | "stopped" | "error";

/**
 * 워커 통계
 */
export interface WorkerStats {
  workerId: string;
  status: WorkerStatus;
  processedJobs: number;
  failedJobs: number;
  currentJob?: string;
  uptime: number;
  lastActive: Date;
}

/**
 * 단일 워커 클래스
 */
class Worker {
  private readonly workerId: string;
  private readonly queue: JobQueue;
  private readonly handlers: Map<string, JobHandler>;
  private status: WorkerStatus = "idle";
  private processedJobs = 0;
  private failedJobs = 0;
  private currentJob: Job | null = null;
  private running = false;
  private readonly startTime: Date;
  private lastActive: Date;
  private readonly maxJobsPerWorker: number;
  private readonly pollInterval = 1000; // 1초

  constructor(workerId: string, queue: JobQueue) {
    this.workerId = workerId;
    this.queue = queue;
    this.handlers = new Map();
    this.startTime = new Date();
    this.lastActive = new Date();
    this.maxJobsPerWorker = config.worker.maxJobsPerWorker;
  }

  /**
   * Job 핸들러 등록
   */
  registerHandler(jobName: string, handler: JobHandler): void {
    this.handlers.set(jobName, handler);
  }

  /**
   * 워커 시작
   */
  async start(): Promise<void> {
    if (this.running) {
      logger.warn(`Worker ${this.workerId} is already running`);
      return;
    }

    this.running = true;
    this.status = "idle";
    logger.info(`Worker ${this.workerId} started`);

    await this.processLoop();
  }

  /**
   * 작업 처리 루프
   */
  private async processLoop(): Promise<void> {
    while (this.running) {
      try {
        // 최대 작업 수 확인
        if (this.processedJobs >= this.maxJobsPerWorker) {
          logger.info(`Worker ${this.workerId} reached max jobs limit`);
          await this.stop();
          break;
        }

        // 다음 작업 가져오기
        const job = await this.queue.getNextJob();

        if (job) {
          await this.processJob(job);
        } else {
          // 작업이 없으면 대기
          await this.sleep(this.pollInterval);
        }
      } catch (error) {
        logger.error(`Worker ${this.workerId} loop error:`, error instanceof Error ? error : new Error(String(error)));
        this.status = "error";
        await this.sleep(this.pollInterval * 5); // 에러 시 더 오래 대기
      }
    }
  }

  /**
   * 작업 처리
   */
  private async processJob(job: Job): Promise<void> {
    this.currentJob = job;
    this.status = "busy";
    this.lastActive = new Date();

    logger.info(`Worker ${this.workerId} processing job ${job.id} (${job.name})`);

    try {
      // 핸들러 찾기
      const handler = this.handlers.get(job.name);
      if (!handler) {
        throw new QueueError(`No handler registered for job type: ${job.name}`, job.id);
      }

      // 타임아웃 설정
      const timeoutMs = config.queue.jobTimeout;
      const result = await this.executeWithTimeout(
        handler(job),
        timeoutMs,
        job.name
      );

      // 작업 완료
      await this.queue.completeJob(job.id, result);
      this.processedJobs++;

      logger.info(`Worker ${this.workerId} completed job ${job.id}`);
    } catch (error) {
      logger.error(`Worker ${this.workerId} failed to process job ${job.id}:`, error instanceof Error ? error : new Error(String(error)));

      // 작업 실패 처리
      await this.queue.failJob(job.id, error as Error);
      this.failedJobs++;
    } finally {
      this.currentJob = null;
      this.status = "idle";
    }
  }

  /**
   * 타임아웃과 함께 작업 실행
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operation: string
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(operation, timeoutMs));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * 워커 중지
   */
  async stop(): Promise<void> {
    logger.info(`Worker ${this.workerId} stopping...`);
    this.running = false;
    this.status = "stopped";

    // 현재 처리 중인 작업이 완료될 때까지 대기 (최대 30초)
    const maxWaitTime = 30000;
    const startTime = Date.now();

    while (this.currentJob && Date.now() - startTime < maxWaitTime) {
      await this.sleep(500);
    }

    logger.info(`Worker ${this.workerId} stopped (processed: ${this.processedJobs}, failed: ${this.failedJobs})`);
  }

  /**
   * 워커 통계
   */
  getStats(): WorkerStats {
    return {
      workerId: this.workerId,
      status: this.status,
      processedJobs: this.processedJobs,
      failedJobs: this.failedJobs,
      currentJob: this.currentJob?.id,
      uptime: Date.now() - this.startTime.getTime(),
      lastActive: this.lastActive,
    };
  }

  /**
   * 대기
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * 워커 풀 클래스
 */
export class WorkerPool {
  private readonly queue: JobQueue;
  private readonly workers: Map<string, Worker> = new Map();
  private readonly poolSize: number;
  private readonly handlers: Map<string, JobHandler> = new Map();
  private running = false;

  constructor(queue: JobQueue, poolSize?: number) {
    this.queue = queue;
    this.poolSize = poolSize || config.worker.poolSize;
  }

  /**
   * Job 핸들러 등록
   */
  registerHandler(jobName: string, handler: JobHandler): void {
    this.handlers.set(jobName, handler);
    logger.info(`Registered handler for job type: ${jobName}`);
  }

  /**
   * 여러 핸들러 한 번에 등록
   */
  registerHandlers(handlers: Record<string, JobHandler>): void {
    for (const [jobName, handler] of Object.entries(handlers)) {
      this.registerHandler(jobName, handler);
    }
  }

  /**
   * 워커 풀 시작
   */
  async start(): Promise<void> {
    if (this.running) {
      logger.warn("Worker pool is already running");
      return;
    }

    this.running = true;
    logger.info(`Starting worker pool with ${this.poolSize} workers`);

    // 워커 생성 및 시작
    for (let i = 0; i < this.poolSize; i++) {
      const workerId = `worker-${i + 1}`;
      const worker = new Worker(workerId, this.queue);

      // 핸들러 등록
      for (const [jobName, handler] of this.handlers.entries()) {
        worker.registerHandler(jobName, handler);
      }

      this.workers.set(workerId, worker);

      // 워커 시작 (비동기)
      worker.start().catch((error) => {
        logger.error(`Worker ${workerId} failed to start:`, error);
      });
    }

    logger.info(`Worker pool started with ${this.workers.size} workers`);
  }

  /**
   * 워커 풀 중지
   */
  async stop(): Promise<void> {
    if (!this.running) {
      logger.warn("Worker pool is not running");
      return;
    }

    logger.info("Stopping worker pool...");
    this.running = false;

    // 모든 워커 중지
    const stopPromises = Array.from(this.workers.values()).map((worker) =>
      worker.stop()
    );

    await Promise.all(stopPromises);

    this.workers.clear();
    logger.info("Worker pool stopped");
  }

  /**
   * 워커 풀 통계
   */
  getStats(): {
    poolSize: number;
    activeWorkers: number;
    totalProcessed: number;
    totalFailed: number;
    workers: WorkerStats[];
  } {
    const workerStats = Array.from(this.workers.values()).map((worker) =>
      worker.getStats()
    );

    return {
      poolSize: this.poolSize,
      activeWorkers: workerStats.filter((s) => s.status === "busy").length,
      totalProcessed: workerStats.reduce((sum, s) => sum + s.processedJobs, 0),
      totalFailed: workerStats.reduce((sum, s) => sum + s.failedJobs, 0),
      workers: workerStats,
    };
  }

  /**
   * 워커 상태 확인
   */
  isHealthy(): boolean {
    if (!this.running) return false;

    const stats = this.getStats();

    // 모든 워커가 에러 상태가 아닌지 확인
    const healthyWorkers = stats.workers.filter(
      (w) => w.status !== "error" && w.status !== "stopped"
    ).length;

    return healthyWorkers >= this.poolSize * 0.5; // 최소 50% 워커가 정상이어야 함
  }
}

/**
 * 기본 워커 풀 인스턴스
 */
let defaultWorkerPool: WorkerPool | null = null;

/**
 * 기본 워커 풀 가져오기
 */
export function getWorkerPool(queue: JobQueue): WorkerPool {
  if (!defaultWorkerPool) {
    defaultWorkerPool = new WorkerPool(queue);
  }
  return defaultWorkerPool;
}

/**
 * 워커 풀 중지
 */
export async function stopWorkerPool(): Promise<void> {
  if (defaultWorkerPool) {
    await defaultWorkerPool.stop();
    defaultWorkerPool = null;
  }
}
