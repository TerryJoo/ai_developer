import { Context, Next } from "@oak/oak";
import { getDatabase } from "../database/sqlite.ts";
import { config } from "../core/config.ts";
import { RateLimitError } from "../core/errors.ts";
import { logger } from "../core/logger.ts";
import type { RateLimitInfo } from "../core/types.ts";

/**
 * Rate Limit 설정
 */
export interface RateLimitOptions {
  windowMs?: number; // 윈도우 시간 (밀리초)
  maxRequests?: number; // 최대 요청 수
  skipSuccessfulRequests?: boolean; // 성공한 요청 건너뛰기
  skipFailedRequests?: boolean; // 실패한 요청 건너뛰기
  keyGenerator?: (ctx: Context) => string; // 식별자 생성 함수
  handler?: (ctx: Context, info: RateLimitInfo) => void; // 커스텀 에러 핸들러
}

/**
 * Rate Limiting 미들웨어
 */
export function rateLimitMiddleware(options: RateLimitOptions = {}) {
  // 기본 설정
  const opts: Required<RateLimitOptions> = {
    windowMs: options.windowMs || config.rateLimit.window,
    maxRequests: options.maxRequests || config.rateLimit.maxRequests,
    skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
    skipFailedRequests: options.skipFailedRequests ?? false,
    keyGenerator: options.keyGenerator || defaultKeyGenerator,
    handler: options.handler || defaultHandler,
  };

  return async (ctx: Context, next: Next) => {
    // Rate Limiting이 비활성화된 경우 스킵
    if (!config.rateLimit.enabled) {
      await next();
      return;
    }

    const identifier = opts.keyGenerator(ctx);

    try {
      const db = await getDatabase();

      // Rate Limit 체크
      const result = await db.checkRateLimit(
        identifier,
        opts.maxRequests,
        opts.windowMs
      );

      // Rate Limit 정보를 헤더에 추가
      ctx.response.headers.set("X-RateLimit-Limit", opts.maxRequests.toString());
      ctx.response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
      ctx.response.headers.set("X-RateLimit-Reset", result.reset.toISOString());

      if (!result.allowed) {
        // Rate Limit 초과
        const retryAfter = Math.ceil((result.reset.getTime() - Date.now()) / 1000);
        ctx.response.headers.set("Retry-After", retryAfter.toString());

        const info: RateLimitInfo = {
          limit: opts.maxRequests,
          remaining: 0,
          reset: result.reset,
          identifier,
        };

        opts.handler(ctx, info);
        return;
      }

      // 다음 미들웨어 실행
      await next();

      // 성공한 요청을 건너뛰는 경우
      if (opts.skipSuccessfulRequests && ctx.response.status < 400) {
        // 카운트 롤백 (실제 구현에서는 더 복잡할 수 있음)
        logger.debug(`Skipping rate limit count for successful request: ${identifier}`);
      }
    } catch (error) {
      logger.error("Rate limit middleware error:", error instanceof Error ? error : new Error(String(error)));
      // 에러 발생 시 요청 통과 (fail-open)
      await next();
    }
  };
}

/**
 * 기본 식별자 생성 함수 (IP 주소 기반)
 */
function defaultKeyGenerator(ctx: Context): string {
  // X-Forwarded-For 헤더에서 IP 추출 (프록시 환경)
  const forwarded = ctx.request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  // 직접 연결된 클라이언트 IP
  return ctx.request.ip || "unknown";
}

/**
 * 기본 에러 핸들러
 */
function defaultHandler(ctx: Context, info: RateLimitInfo): void {
  logger.warn(`Rate limit exceeded for ${info.identifier}`);

  const retryAfter = Math.ceil((info.reset.getTime() - Date.now()) / 1000);

  ctx.response.status = 429;
  ctx.response.body = {
    error: "Too Many Requests",
    message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
    limit: info.limit,
    remaining: info.remaining,
    reset: info.reset.toISOString(),
  };
}

/**
 * API 키 기반 Rate Limiting
 */
export function apiKeyRateLimit(options: Omit<RateLimitOptions, "keyGenerator"> = {}) {
  return rateLimitMiddleware({
    ...options,
    keyGenerator: (ctx: Context) => {
      const apiKey = ctx.request.headers.get("x-api-key") ||
        ctx.request.headers.get("authorization")?.replace("Bearer ", "");

      return apiKey || defaultKeyGenerator(ctx);
    },
  });
}

/**
 * 사용자 기반 Rate Limiting
 */
export function userRateLimit(
  getUserId: (ctx: Context) => string | undefined,
  options: Omit<RateLimitOptions, "keyGenerator"> = {}
) {
  return rateLimitMiddleware({
    ...options,
    keyGenerator: (ctx: Context) => {
      const userId = getUserId(ctx);
      return userId ? `user:${userId}` : defaultKeyGenerator(ctx);
    },
  });
}

/**
 * 엔드포인트별 Rate Limiting
 */
export function endpointRateLimit(options: Omit<RateLimitOptions, "keyGenerator"> = {}) {
  return rateLimitMiddleware({
    ...options,
    keyGenerator: (ctx: Context) => {
      const identifier = defaultKeyGenerator(ctx);
      const endpoint = ctx.request.url.pathname;
      return `${identifier}:${endpoint}`;
    },
  });
}

/**
 * Sliding Window Rate Limiting (더 정확한 제한)
 */
export class SlidingWindowRateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly requests: Map<string, number[]> = new Map();

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // 주기적으로 오래된 요청 정리
    setInterval(() => this.cleanup(), this.windowMs);
  }

  /**
   * Rate Limit 체크
   */
  check(identifier: string): RateLimitInfo {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // 현재 윈도우 내의 요청만 필터링
    let timestamps = this.requests.get(identifier) || [];
    timestamps = timestamps.filter((ts) => ts > windowStart);

    const allowed = timestamps.length < this.maxRequests;

    if (allowed) {
      timestamps.push(now);
      this.requests.set(identifier, timestamps);
    }

    const reset = new Date(now + this.windowMs);
    const remaining = Math.max(0, this.maxRequests - timestamps.length);

    return {
      limit: this.maxRequests,
      remaining,
      reset,
      identifier,
    };
  }

  /**
   * 오래된 요청 데이터 정리
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [identifier, timestamps] of this.requests.entries()) {
      const filtered = timestamps.filter((ts) => ts > windowStart);

      if (filtered.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, filtered);
      }
    }
  }

  /**
   * 특정 식별자 리셋
   */
  reset(identifier: string): void {
    this.requests.delete(identifier);
  }

  /**
   * 모든 제한 리셋
   */
  resetAll(): void {
    this.requests.clear();
  }
}

/**
 * Sliding Window 기반 미들웨어
 */
export function slidingWindowRateLimit(
  limiter: SlidingWindowRateLimiter,
  options: Omit<RateLimitOptions, "windowMs" | "maxRequests"> = {}
) {
  const keyGenerator = options.keyGenerator || defaultKeyGenerator;
  const handler = options.handler || defaultHandler;

  return async (ctx: Context, next: Next) => {
    if (!config.rateLimit.enabled) {
      await next();
      return;
    }

    const identifier = keyGenerator(ctx);
    const info = limiter.check(identifier);

    // Rate Limit 정보를 헤더에 추가
    ctx.response.headers.set("X-RateLimit-Limit", info.limit.toString());
    ctx.response.headers.set("X-RateLimit-Remaining", info.remaining.toString());
    ctx.response.headers.set("X-RateLimit-Reset", info.reset.toISOString());

    if (info.remaining === 0) {
      const retryAfter = Math.ceil((info.reset.getTime() - Date.now()) / 1000);
      ctx.response.headers.set("Retry-After", retryAfter.toString());
      handler(ctx, info);
      return;
    }

    await next();
  };
}
