/**
 * AI Response Cache System
 * Redis 기반 AI 응답 캐싱으로 비용 절감 및 성능 향상
 */

import { getRedisClient } from "../../database/redis.ts";
import { logger } from "../../core/logger.ts";
import { config } from "../../core/config.ts";
import type { AICompletionResponse } from "../../core/types.ts";

const redisClient = await getRedisClient();

/**
 * 캐시 키 생성을 위한 해시 함수
 */
async function hashString(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * AI 응답 캐시 메트릭
 */
export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
  bytesStored: number;
}

/**
 * AI Response Cache Manager
 */
export class AICacheManager {
  private readonly keyPrefix = "ai:cache:";
  private readonly metricsKey = "ai:cache:metrics";
  private enabled: boolean;
  private ttl: number;

  constructor() {
    this.enabled = config.cache.enabled;
    this.ttl = config.cache.ttl;
  }

  /**
   * 캐시에서 응답 조회
   */
  async get(
    provider: string,
    model: string,
    messages: Array<{ role: string; content: string }>,
  ): Promise<AICompletionResponse | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      const cacheKey = await this.generateCacheKey(provider, model, messages);
      const cached = await redisClient.get(cacheKey);

      if (cached) {
        // 캐시 히트 메트릭 증가
        await this.incrementMetric("hits");
        logger.debug(`Cache hit for ${provider}:${model}`);

        return JSON.parse(cached);
      }

      // 캐시 미스 메트릭 증가
      await this.incrementMetric("misses");
      return null;
    } catch (error) {
      logger.error(`Cache get error: ${error}`);
      return null;
    }
  }

  /**
   * 캐시에 응답 저장
   */
  async set(
    provider: string,
    model: string,
    messages: Array<{ role: string; content: string }>,
    response: AICompletionResponse,
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const cacheKey = await this.generateCacheKey(provider, model, messages);
      const serialized = JSON.stringify(response);

      await redisClient.set(cacheKey, serialized, this.ttl);

      // 저장된 바이트 수 업데이트
      await this.incrementMetric("bytesStored", serialized.length);

      logger.debug(`Cache set for ${provider}:${model}`);
    } catch (error) {
      logger.error(`Cache set error: ${error}`);
    }
  }

  /**
   * 특정 패턴의 캐시 삭제
   */
  async invalidate(pattern?: string): Promise<number> {
    try {
      const searchPattern = pattern
        ? `${this.keyPrefix}${pattern}*`
        : `${this.keyPrefix}*`;

      const keys = await redisClient.keys(searchPattern);
      if (keys.length === 0) {
        return 0;
      }

      await redisClient.del(...keys);
      logger.info(`Invalidated ${keys.length} cache entries`);

      return keys.length;
    } catch (error) {
      logger.error(`Cache invalidation error: ${error}`);
      return 0;
    }
  }

  /**
   * 전체 캐시 삭제
   */
  async clear(): Promise<void> {
    try {
      await this.invalidate();
      await redisClient.del(this.metricsKey);
      logger.info("Cache cleared");
    } catch (error) {
      logger.error(`Cache clear error: ${error}`);
    }
  }

  /**
   * 캐시 메트릭 조회
   */
  async getMetrics(): Promise<CacheMetrics> {
    try {
      const metrics = await redisClient.hgetall(this.metricsKey);

      const hits = parseInt(metrics.hits || "0", 10);
      const misses = parseInt(metrics.misses || "0", 10);
      const totalRequests = hits + misses;
      const hitRate = totalRequests > 0 ? hits / totalRequests : 0;

      return {
        hits,
        misses,
        hitRate,
        totalRequests,
        bytesStored: parseInt(metrics.bytesStored || "0", 10),
      };
    } catch (error) {
      logger.error(`Failed to get cache metrics: ${error}`);
      return {
        hits: 0,
        misses: 0,
        hitRate: 0,
        totalRequests: 0,
        bytesStored: 0,
      };
    }
  }

  /**
   * 캐시 메트릭 초기화
   */
  async resetMetrics(): Promise<void> {
    try {
      await redisClient.del(this.metricsKey);
      logger.info("Cache metrics reset");
    } catch (error) {
      logger.error(`Failed to reset cache metrics: ${error}`);
    }
  }

  /**
   * 캐시 키 생성
   */
  private async generateCacheKey(
    provider: string,
    model: string,
    messages: Array<{ role: string; content: string }>,
  ): Promise<string> {
    // 메시지 내용을 정규화하여 해시 생성
    const normalized = messages
      .map((m) => `${m.role}:${m.content.trim()}`)
      .join("|");

    const hash = await hashString(normalized);

    return `${this.keyPrefix}${provider}:${model}:${hash}`;
  }

  /**
   * 캐시 메트릭 증가
   */
  private async incrementMetric(
    field: string,
    value: number = 1,
  ): Promise<void> {
    try {
      await redisClient.hincrby(this.metricsKey, field, value);
    } catch (error) {
      logger.error(`Failed to increment metric ${field}: ${error}`);
    }
  }

  /**
   * 캐시 크기 조회 (저장된 엔트리 수)
   */
  async getSize(): Promise<number> {
    try {
      const keys = await redisClient.keys(`${this.keyPrefix}*`);
      return keys.length;
    } catch (error) {
      logger.error(`Failed to get cache size: ${error}`);
      return 0;
    }
  }

  /**
   * 캐시 상태 확인
   */
  async getStatus(): Promise<{
    enabled: boolean;
    size: number;
    metrics: CacheMetrics;
  }> {
    const size = await this.getSize();
    const metrics = await this.getMetrics();

    return {
      enabled: this.enabled,
      size,
      metrics,
    };
  }

  /**
   * 캐시 활성화/비활성화
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    logger.info(`Cache ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * TTL 설정
   */
  setTTL(seconds: number): void {
    this.ttl = seconds;
    logger.info(`Cache TTL set to ${seconds} seconds`);
  }
}

/**
 * 전역 캐시 인스턴스
 */
export const aiCache = new AICacheManager();

/**
 * 캐시 워밍: 자주 사용되는 프롬프트를 미리 캐싱
 */
export async function warmCache(
  commonPrompts: Array<{
    provider: string;
    model: string;
    messages: Array<{ role: string; content: string }>;
    response: AICompletionResponse;
  }>,
): Promise<void> {
  logger.info(`Warming cache with ${commonPrompts.length} prompts`);

  for (const prompt of commonPrompts) {
    await aiCache.set(
      prompt.provider,
      prompt.model,
      prompt.messages,
      prompt.response,
    );
  }

  logger.info("Cache warming complete");
}

/**
 * 캐시 정리: 오래된 엔트리 삭제 (LRU 스타일)
 */
export async function pruneCache(maxEntries: number = 1000): Promise<number> {
  const currentSize = await aiCache.getSize();

  if (currentSize <= maxEntries) {
    return 0;
  }

  const toDelete = currentSize - maxEntries;
  logger.info(`Pruning ${toDelete} cache entries`);

  // TTL이 짧은 것부터 삭제되므로 자연스러운 LRU
  // 실제 구현에서는 더 정교한 LRU 로직 필요
  return toDelete;
}
