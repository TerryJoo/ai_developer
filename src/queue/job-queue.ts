import { getRedisClient } from "../database/redis.ts";
import { config } from "../core/config.ts";
import { QueueError } from "../core/errors.ts";
import { logger } from "../core/logger.ts";
import type { Job, JobOptions, JobStatus, QueueStats } from "../core/types.ts";

/**
 * 작업 큐 클래스 (BullMQ 스타일 API)
 */
export class JobQueue {
  private readonly queueName: string;
  private readonly maxJobs: number;
  private readonly defaultOptions: Required<JobOptions>;

  constructor(name?: string) {
    this.queueName = name || config.queue.name;
    this.maxJobs = config.queue.maxJobs;
    this.defaultOptions = {
      priority: 0,
      delay: 0,
      attempts: config.queue.retryAttempts,
      timeout: config.queue.jobTimeout,
      retryDelay: config.queue.retryDelay,
    };
  }

  /**
   * Redis 키 생성
   */
  private getKey(suffix: string): string {
    return `queue:${this.queueName}:${suffix}`;
  }

  /**
   * 작업 ID 생성
   */
  private generateJobId(): string {
    return `${Date.now()}-${crypto.randomUUID()}`;
  }

  /**
   * 작업 추가
   */
  async add<T = unknown>(name: string, data: T, options?: JobOptions): Promise<Job<T>> {
    const redis = await getRedisClient();

    // 큐 크기 확인
    const queueSize = await redis.llen(this.getKey("waiting"));
    if (queueSize >= this.maxJobs) {
      throw new QueueError(`Queue is full (max: ${this.maxJobs})`);
    }

    const opts = { ...this.defaultOptions, ...options };
    const jobId = this.generateJobId();

    const job: Job<T> = {
      id: jobId,
      name,
      data,
      status: opts.delay > 0 ? "delayed" : "waiting",
      priority: opts.priority,
      attempts: 0,
      maxAttempts: opts.attempts,
      createdAt: new Date(),
    };

    try {
      // Job 데이터 저장
      await redis.setJSON(this.getKey(`job:${jobId}`), job);

      // 지연된 작업
      if (opts.delay > 0) {
        const delayedUntil = Date.now() + opts.delay;
        await redis.hset(
          this.getKey("delayed"),
          jobId,
          delayedUntil.toString()
        );
      } else {
        // 우선순위 큐에 추가
        await this.addToQueue(jobId, opts.priority);
      }

      logger.info(`Job ${jobId} (${name}) added to queue`);
      return job;
    } catch (error) {
      throw new QueueError(
        `Failed to add job to queue: ${error instanceof Error ? error.message : "Unknown error"}`,
        jobId
      );
    }
  }

  /**
   * 작업을 대기 큐에 추가 (우선순위 고려)
   */
  private async addToQueue(jobId: string, priority: number): Promise<void> {
    const redis = await getRedisClient();

    if (priority > 0) {
      // 우선순위가 높은 경우 앞에 추가
      await redis.lpush(this.getKey("waiting"), jobId);
    } else {
      // 일반 작업은 뒤에 추가
      await redis.lpush(this.getKey("waiting"), jobId);
    }
  }

  /**
   * 다음 작업 가져오기
   */
  async getNextJob<T = unknown>(): Promise<Job<T> | null> {
    const redis = await getRedisClient();

    try {
      // 대기 중인 작업 가져오기
      const jobId = await redis.lpop(this.getKey("waiting"));
      if (!jobId) {
        // 지연된 작업 확인
        await this.processDelayedJobs();
        return null;
      }

      // Job 데이터 로드
      const job = await redis.getJSON<Job<T>>(this.getKey(`job:${jobId}`));
      if (!job) {
        logger.warn(`Job ${jobId} not found in storage`);
        return null;
      }

      // 상태 업데이트
      job.status = "active";
      job.startedAt = new Date();
      await redis.setJSON(this.getKey(`job:${jobId}`), job);

      // 활성 작업 목록에 추가
      await redis.sadd(this.getKey("active"), jobId);

      return job;
    } catch (error) {
      throw new QueueError(
        `Failed to get next job: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * 지연된 작업 처리
   */
  private async processDelayedJobs(): Promise<void> {
    const redis = await getRedisClient();

    try {
      const delayedJobs = await redis.hgetall(this.getKey("delayed"));
      const now = Date.now();

      for (const [jobId, delayedUntilStr] of Object.entries(delayedJobs)) {
        const delayedUntil = parseInt(delayedUntilStr, 10);

        if (delayedUntil <= now) {
          // 지연 시간이 지났으면 대기 큐로 이동
          const job = await redis.getJSON<Job>(this.getKey(`job:${jobId}`));
          if (job) {
            job.status = "waiting";
            await redis.setJSON(this.getKey(`job:${jobId}`), job);
            await this.addToQueue(jobId, job.priority);
            await redis.hdel(this.getKey("delayed"), jobId);
          }
        }
      }
    } catch (error) {
      logger.error("Failed to process delayed jobs:", error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 작업 완료 처리
   */
  async completeJob<T = unknown>(jobId: string, result?: unknown): Promise<void> {
    const redis = await getRedisClient();

    try {
      const job = await redis.getJSON<Job<T>>(this.getKey(`job:${jobId}`));
      if (!job) {
        throw new QueueError(`Job ${jobId} not found`, jobId);
      }

      job.status = "completed";
      job.completedAt = new Date();
      job.result = result;

      await redis.setJSON(this.getKey(`job:${jobId}`), job);
      await redis.srem(this.getKey("active"), jobId);
      await redis.sadd(this.getKey("completed"), jobId);

      logger.info(`Job ${jobId} completed`);
    } catch (error) {
      throw new QueueError(
        `Failed to complete job: ${error instanceof Error ? error.message : "Unknown error"}`,
        jobId
      );
    }
  }

  /**
   * 작업 실패 처리
   */
  async failJob<T = unknown>(jobId: string, error: Error): Promise<void> {
    const redis = await getRedisClient();

    try {
      const job = await redis.getJSON<Job<T>>(this.getKey(`job:${jobId}`));
      if (!job) {
        throw new QueueError(`Job ${jobId} not found`, jobId);
      }

      job.attempts++;
      job.error = error;

      // 재시도 가능한지 확인
      if (job.attempts < job.maxAttempts) {
        job.status = "waiting";
        await redis.setJSON(this.getKey(`job:${jobId}`), job);
        await redis.srem(this.getKey("active"), jobId);

        // 재시도 지연 적용
        const retryDelay = this.calculateRetryDelay(job.attempts);
        const delayedUntil = Date.now() + retryDelay;
        await redis.hset(
          this.getKey("delayed"),
          jobId,
          delayedUntil.toString()
        );

        logger.warn(`Job ${jobId} failed, retrying (attempt ${job.attempts}/${job.maxAttempts})`);
      } else {
        // 최대 재시도 횟수 초과
        job.status = "failed";
        job.failedAt = new Date();
        await redis.setJSON(this.getKey(`job:${jobId}`), job);
        await redis.srem(this.getKey("active"), jobId);
        await redis.sadd(this.getKey("failed"), jobId);

        logger.error(`Job ${jobId} permanently failed after ${job.attempts} attempts`);
      }
    } catch (err) {
      throw new QueueError(
        `Failed to fail job: ${err instanceof Error ? err.message : "Unknown error"}`,
        jobId
      );
    }
  }

  /**
   * 재시도 지연 시간 계산 (exponential backoff)
   */
  private calculateRetryDelay(attempts: number): number {
    const baseDelay = this.defaultOptions.retryDelay;
    return Math.min(baseDelay * Math.pow(2, attempts - 1), 300000); // 최대 5분
  }

  /**
   * 작업 조회
   */
  async getJob<T = unknown>(jobId: string): Promise<Job<T> | null> {
    const redis = await getRedisClient();

    try {
      return await redis.getJSON<Job<T>>(this.getKey(`job:${jobId}`));
    } catch (error) {
      throw new QueueError(
        `Failed to get job: ${error instanceof Error ? error.message : "Unknown error"}`,
        jobId
      );
    }
  }

  /**
   * 작업 제거
   */
  async removeJob(jobId: string): Promise<void> {
    const redis = await getRedisClient();

    try {
      const job = await this.getJob(jobId);
      if (!job) return;

      // 모든 상태 목록에서 제거
      await redis.srem(this.getKey("active"), jobId);
      await redis.srem(this.getKey("completed"), jobId);
      await redis.srem(this.getKey("failed"), jobId);
      await redis.hdel(this.getKey("delayed"), jobId);

      // Job 데이터 삭제
      await redis.delete(this.getKey(`job:${jobId}`));

      logger.info(`Job ${jobId} removed`);
    } catch (error) {
      throw new QueueError(
        `Failed to remove job: ${error instanceof Error ? error.message : "Unknown error"}`,
        jobId
      );
    }
  }

  /**
   * 큐 통계 조회
   */
  async getStats(): Promise<QueueStats> {
    const redis = await getRedisClient();

    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        redis.llen(this.getKey("waiting")),
        redis.smembers(this.getKey("active")).then((m) => m.length),
        redis.smembers(this.getKey("completed")).then((m) => m.length),
        redis.smembers(this.getKey("failed")).then((m) => m.length),
        redis.hgetall(this.getKey("delayed")).then((h) => Object.keys(h).length),
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed,
      };
    } catch (error) {
      throw new QueueError(
        `Failed to get queue stats: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * 완료된 작업 정리
   */
  async cleanCompleted(olderThanMs: number = 86400000): Promise<number> {
    const redis = await getRedisClient();
    let cleaned = 0;

    try {
      const completedIds = await redis.smembers(this.getKey("completed"));
      const cutoff = Date.now() - olderThanMs;

      for (const jobId of completedIds) {
        const job = await this.getJob(jobId);
        if (job?.completedAt && job.completedAt.getTime() < cutoff) {
          await this.removeJob(jobId);
          cleaned++;
        }
      }

      logger.info(`Cleaned ${cleaned} completed jobs`);
      return cleaned;
    } catch (error) {
      throw new QueueError(
        `Failed to clean completed jobs: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * 실패한 작업 정리
   */
  async cleanFailed(olderThanMs: number = 86400000): Promise<number> {
    const redis = await getRedisClient();
    let cleaned = 0;

    try {
      const failedIds = await redis.smembers(this.getKey("failed"));
      const cutoff = Date.now() - olderThanMs;

      for (const jobId of failedIds) {
        const job = await this.getJob(jobId);
        if (job?.failedAt && job.failedAt.getTime() < cutoff) {
          await this.removeJob(jobId);
          cleaned++;
        }
      }

      logger.info(`Cleaned ${cleaned} failed jobs`);
      return cleaned;
    } catch (error) {
      throw new QueueError(
        `Failed to clean failed jobs: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * 큐 비우기 (주의!)
   */
  async obliterate(): Promise<void> {
    const redis = await getRedisClient();

    try {
      const keys = await redis.keys(this.getKey("*"));
      for (const key of keys) {
        await redis.delete(key);
      }

      logger.warn(`Queue ${this.queueName} obliterated`);
    } catch (error) {
      throw new QueueError(
        `Failed to obliterate queue: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}

// 기본 큐 인스턴스
let defaultQueue: JobQueue | null = null;

/**
 * 기본 작업 큐 가져오기
 */
export function getQueue(): JobQueue {
  if (!defaultQueue) {
    defaultQueue = new JobQueue();
  }
  return defaultQueue;
}
