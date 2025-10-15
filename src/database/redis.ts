import { connect, Redis } from "https://deno.land/x/redis@v0.25.5/mod.ts";
import { config } from "../core/config.ts";
import { DatabaseError } from "../core/errors.ts";
import { logger } from "../core/logger.ts";

/**
 * Redis 클라이언트 래퍼 클래스
 */
export class RedisClient {
  private client: Redis | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts: number;
  private readonly reconnectDelay: number;

  constructor() {
    this.maxReconnectAttempts = config.database.redis.retryAttempts;
    this.reconnectDelay = config.database.redis.retryDelay;
  }

  /**
   * Redis 연결
   */
  async connect(): Promise<void> {
    try {
      // Redis URL 파싱
      const url = new URL(config.database.redis.url);

      this.client = await connect({
        hostname: url.hostname,
        port: parseInt(url.port) || 6379,
        password: config.database.redis.password || undefined,
        db: config.database.redis.db,
      });

      this.reconnectAttempts = 0;
      logger.info(`Connected to Redis at ${config.database.redis.url}`);
    } catch (error) {
      throw new DatabaseError(
        `Failed to connect to Redis: ${error instanceof Error ? error.message : "Unknown error"}`,
        "connect"
      );
    }
  }

  /**
   * 재연결 시도
   */
  private async reconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      throw new DatabaseError(
        `Failed to reconnect to Redis after ${this.maxReconnectAttempts} attempts`,
        "reconnect"
      );
    }

    this.reconnectAttempts++;
    logger.warn(`Attempting to reconnect to Redis (attempt ${this.reconnectAttempts})`);

    await new Promise((resolve) => setTimeout(resolve, this.reconnectDelay));

    try {
      await this.connect();
    } catch (error) {
      logger.error("Reconnection failed:", error instanceof Error ? error : new Error(String(error)));
      await this.reconnect();
    }
  }

  /**
   * Redis 클라이언트 가져오기
   */
  private getClient(): Redis {
    if (!this.client) {
      throw new DatabaseError("Redis client not connected");
    }
    return this.client;
  }

  // ===== String 작업 =====

  /**
   * 키-값 설정
   */
  async set(key: string, value: string, expirySeconds?: number): Promise<void> {
    try {
      const client = this.getClient();
      if (expirySeconds) {
        await client.setex(key, expirySeconds, value);
      } else {
        await client.set(key, value);
      }
    } catch (error) {
      throw new DatabaseError(
        `Failed to set key '${key}': ${error instanceof Error ? error.message : "Unknown error"}`,
        "set"
      );
    }
  }

  /**
   * 값 가져오기
   */
  async get(key: string): Promise<string | null> {
    try {
      const client = this.getClient();
      const value = await client.get(key);
      return value || null;
    } catch (error) {
      throw new DatabaseError(
        `Failed to get key '${key}': ${error instanceof Error ? error.message : "Unknown error"}`,
        "get"
      );
    }
  }

  /**
   * 키 삭제
   */
  async delete(key: string): Promise<number> {
    try {
      const client = this.getClient();
      return await client.del(key);
    } catch (error) {
      throw new DatabaseError(
        `Failed to delete key '${key}': ${error instanceof Error ? error.message : "Unknown error"}`,
        "delete"
      );
    }
  }

  /**
   * 키 존재 여부 확인
   */
  async exists(key: string): Promise<boolean> {
    try {
      const client = this.getClient();
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      throw new DatabaseError(
        `Failed to check existence of key '${key}': ${error instanceof Error ? error.message : "Unknown error"}`,
        "exists"
      );
    }
  }

  /**
   * TTL 설정
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const client = this.getClient();
      const result = await client.expire(key, seconds);
      return result === 1;
    } catch (error) {
      throw new DatabaseError(
        `Failed to set expiry for key '${key}': ${error instanceof Error ? error.message : "Unknown error"}`,
        "expire"
      );
    }
  }

  // ===== JSON 작업 =====

  /**
   * JSON 객체 저장
   */
  async setJSON<T>(key: string, value: T, expirySeconds?: number): Promise<void> {
    const json = JSON.stringify(value);
    await this.set(key, json, expirySeconds);
  }

  /**
   * JSON 객체 가져오기
   */
  async getJSON<T>(key: string): Promise<T | null> {
    const json = await this.get(key);
    if (!json) return null;

    try {
      return JSON.parse(json) as T;
    } catch (error) {
      throw new DatabaseError(
        `Failed to parse JSON for key '${key}': ${error instanceof Error ? error.message : "Unknown error"}`,
        "getJSON"
      );
    }
  }

  // ===== Hash 작업 =====

  /**
   * Hash 필드 설정
   */
  async hset(key: string, field: string, value: string): Promise<number> {
    try {
      const client = this.getClient();
      return await client.hset(key, field, value);
    } catch (error) {
      throw new DatabaseError(
        `Failed to set hash field '${field}' for key '${key}': ${error instanceof Error ? error.message : "Unknown error"}`,
        "hset"
      );
    }
  }

  /**
   * Hash 필드 가져오기
   */
  async hget(key: string, field: string): Promise<string | null> {
    try {
      const client = this.getClient();
      const value = await client.hget(key, field);
      return value || null;
    } catch (error) {
      throw new DatabaseError(
        `Failed to get hash field '${field}' for key '${key}': ${error instanceof Error ? error.message : "Unknown error"}`,
        "hget"
      );
    }
  }

  /**
   * 모든 Hash 필드 가져오기
   */
  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      const client = this.getClient();
      const result = await client.hgetall(key);

      // 배열을 객체로 변환
      const obj: Record<string, string> = {};
      for (let i = 0; i < result.length; i += 2) {
        obj[result[i]] = result[i + 1];
      }
      return obj;
    } catch (error) {
      throw new DatabaseError(
        `Failed to get all hash fields for key '${key}': ${error instanceof Error ? error.message : "Unknown error"}`,
        "hgetall"
      );
    }
  }

  /**
   * Hash 필드 삭제
   */
  async hdel(key: string, field: string): Promise<number> {
    try {
      const client = this.getClient();
      return await client.hdel(key, field);
    } catch (error) {
      throw new DatabaseError(
        `Failed to delete hash field '${field}' for key '${key}': ${error instanceof Error ? error.message : "Unknown error"}`,
        "hdel"
      );
    }
  }

  /**
   * Hash 필드 값 증가
   */
  async hincrby(key: string, field: string, increment: number): Promise<number> {
    try {
      const client = this.getClient();
      return await client.hincrby(key, field, increment);
    } catch (error) {
      throw new DatabaseError(
        `Failed to increment hash field '${field}' for key '${key}': ${error instanceof Error ? error.message : "Unknown error"}`,
        "hincrby"
      );
    }
  }

  /**
   * 여러 키 삭제
   */
  async del(...keys: string[]): Promise<number> {
    try {
      const client = this.getClient();
      let deleted = 0;
      for (const key of keys) {
        deleted += await client.del(key);
      }
      return deleted;
    } catch (error) {
      throw new DatabaseError(
        `Failed to delete keys: ${error instanceof Error ? error.message : "Unknown error"}`,
        "del"
      );
    }
  }

  // ===== List 작업 =====

  /**
   * List에 요소 추가 (왼쪽)
   */
  async lpush(key: string, ...values: string[]): Promise<number> {
    try {
      const client = this.getClient();
      return await client.lpush(key, ...values);
    } catch (error) {
      throw new DatabaseError(
        `Failed to push to list '${key}': ${error instanceof Error ? error.message : "Unknown error"}`,
        "lpush"
      );
    }
  }

  /**
   * List에서 요소 제거 (왼쪽)
   */
  async lpop(key: string): Promise<string | null> {
    try {
      const client = this.getClient();
      const value = await client.lpop(key);
      return value || null;
    } catch (error) {
      throw new DatabaseError(
        `Failed to pop from list '${key}': ${error instanceof Error ? error.message : "Unknown error"}`,
        "lpop"
      );
    }
  }

  /**
   * List 범위 가져오기
   */
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      const client = this.getClient();
      return await client.lrange(key, start, stop);
    } catch (error) {
      throw new DatabaseError(
        `Failed to get range from list '${key}': ${error instanceof Error ? error.message : "Unknown error"}`,
        "lrange"
      );
    }
  }

  /**
   * List 길이 가져오기
   */
  async llen(key: string): Promise<number> {
    try {
      const client = this.getClient();
      return await client.llen(key);
    } catch (error) {
      throw new DatabaseError(
        `Failed to get length of list '${key}': ${error instanceof Error ? error.message : "Unknown error"}`,
        "llen"
      );
    }
  }

  // ===== Set 작업 =====

  /**
   * Set에 멤버 추가
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    try {
      const client = this.getClient();
      return await client.sadd(key, ...members);
    } catch (error) {
      throw new DatabaseError(
        `Failed to add members to set '${key}': ${error instanceof Error ? error.message : "Unknown error"}`,
        "sadd"
      );
    }
  }

  /**
   * Set의 모든 멤버 가져오기
   */
  async smembers(key: string): Promise<string[]> {
    try {
      const client = this.getClient();
      return await client.smembers(key);
    } catch (error) {
      throw new DatabaseError(
        `Failed to get members of set '${key}': ${error instanceof Error ? error.message : "Unknown error"}`,
        "smembers"
      );
    }
  }

  /**
   * Set에서 멤버 제거
   */
  async srem(key: string, ...members: string[]): Promise<number> {
    try {
      const client = this.getClient();
      return await client.srem(key, ...members);
    } catch (error) {
      throw new DatabaseError(
        `Failed to remove members from set '${key}': ${error instanceof Error ? error.message : "Unknown error"}`,
        "srem"
      );
    }
  }

  // ===== 카운터 작업 =====

  /**
   * 값 증가
   */
  async incr(key: string): Promise<number> {
    try {
      const client = this.getClient();
      return await client.incr(key);
    } catch (error) {
      throw new DatabaseError(
        `Failed to increment key '${key}': ${error instanceof Error ? error.message : "Unknown error"}`,
        "incr"
      );
    }
  }

  /**
   * 값 감소
   */
  async decr(key: string): Promise<number> {
    try {
      const client = this.getClient();
      return await client.decr(key);
    } catch (error) {
      throw new DatabaseError(
        `Failed to decrement key '${key}': ${error instanceof Error ? error.message : "Unknown error"}`,
        "decr"
      );
    }
  }

  /**
   * 특정 값만큼 증가
   */
  async incrby(key: string, increment: number): Promise<number> {
    try {
      const client = this.getClient();
      return await client.incrby(key, increment);
    } catch (error) {
      throw new DatabaseError(
        `Failed to increment key '${key}' by ${increment}: ${error instanceof Error ? error.message : "Unknown error"}`,
        "incrby"
      );
    }
  }

  // ===== 패턴 매칭 =====

  /**
   * 패턴과 일치하는 모든 키 가져오기
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      const client = this.getClient();
      return await client.keys(pattern);
    } catch (error) {
      throw new DatabaseError(
        `Failed to get keys matching pattern '${pattern}': ${error instanceof Error ? error.message : "Unknown error"}`,
        "keys"
      );
    }
  }

  // ===== 데이터베이스 작업 =====

  /**
   * 데이터베이스 비우기
   */
  async flushdb(): Promise<void> {
    try {
      const client = this.getClient();
      await client.flushdb();
      logger.warn("Redis database flushed");
    } catch (error) {
      throw new DatabaseError(
        `Failed to flush database: ${error instanceof Error ? error.message : "Unknown error"}`,
        "flushdb"
      );
    }
  }

  /**
   * Ping
   */
  async ping(): Promise<boolean> {
    try {
      const client = this.getClient();
      const result = await client.ping();
      return result === "PONG";
    } catch (error) {
      logger.error("Redis ping failed:", error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * 연결 종료
   */
  close(): void {
    if (this.client) {
      this.client.close();
      this.client = null;
      logger.info("Redis connection closed");
    }
  }
}

// 싱글톤 인스턴스
let redisInstance: RedisClient | null = null;

/**
 * Redis 클라이언트 인스턴스 가져오기
 */
export async function getRedisClient(): Promise<RedisClient> {
  if (!redisInstance) {
    redisInstance = new RedisClient();
    await redisInstance.connect();
  }
  return redisInstance;
}

/**
 * Redis 연결 종료
 */
export function closeRedisClient(): void {
  if (redisInstance) {
    redisInstance.close();
    redisInstance = null;
  }
}
