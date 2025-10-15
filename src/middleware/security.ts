import { Context, Next } from "@oak/oak";
import { config } from "../core/config.ts";
import { AuthenticationError, AuthorizationError } from "../core/errors.ts";
import { logger } from "../core/logger.ts";
import { stripHtmlTags } from "../core/validation.ts";

/**
 * CORS 미들웨어
 */
export function corsMiddleware() {
  const allowedOrigins = config.security.corsOrigins;

  return async (ctx: Context, next: Next) => {
    const origin = ctx.request.headers.get("origin");

    if (origin && allowedOrigins.includes(origin)) {
      ctx.response.headers.set("Access-Control-Allow-Origin", origin);
    } else if (allowedOrigins.includes("*")) {
      ctx.response.headers.set("Access-Control-Allow-Origin", "*");
    }

    ctx.response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    ctx.response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-API-Key, X-Hub-Signature-256, X-GitHub-Event"
    );
    ctx.response.headers.set("Access-Control-Max-Age", "86400");

    // OPTIONS 프리플라이트 요청 처리
    if (ctx.request.method === "OPTIONS") {
      ctx.response.status = 204;
      return;
    }

    await next();
  };
}

/**
 * Helmet 스타일 보안 헤더
 */
export function securityHeadersMiddleware() {
  return async (ctx: Context, next: Next) => {
    // XSS 보호
    ctx.response.headers.set("X-Content-Type-Options", "nosniff");
    ctx.response.headers.set("X-Frame-Options", "DENY");
    ctx.response.headers.set("X-XSS-Protection", "1; mode=block");

    // Content Security Policy
    ctx.response.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
    );

    // HTTPS 강제 (프로덕션)
    if (config.server.env === "production") {
      ctx.response.headers.set(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains"
      );
    }

    // Referrer 정책
    ctx.response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    // Permissions Policy
    ctx.response.headers.set(
      "Permissions-Policy",
      "geolocation=(), microphone=(), camera=()"
    );

    await next();
  };
}

/**
 * API 키 인증 미들웨어
 */
export function apiKeyAuth() {
  return async (ctx: Context, next: Next) => {
    if (!config.security.apiKeyRequired) {
      await next();
      return;
    }

    const apiKey = ctx.request.headers.get("x-api-key") ||
      ctx.request.headers.get("authorization")?.replace("Bearer ", "");

    if (!apiKey) {
      throw new AuthenticationError("API key is required");
    }

    if (apiKey !== config.security.apiKey) {
      throw new AuthenticationError("Invalid API key");
    }

    await next();
  };
}

/**
 * GitHub Webhook 서명 검증
 */
export async function verifyGitHubSignature(
  payload: string,
  signature: string
): Promise<boolean> {
  if (!config.github.webhookSecret) {
    logger.warn("GitHub webhook secret not configured");
    return false;
  }

  try {
    const secret = config.github.webhookSecret;
    const algorithm = config.security.webhookSignatureAlgorithm;

    // 서명 형식: sha256=<hash>
    const [alg, providedHash] = signature.split("=");

    if (alg !== algorithm) {
      logger.warn(`Unexpected signature algorithm: ${alg}`);
      return false;
    }

    // HMAC 계산
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const payloadData = encoder.encode(payload);

    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign("HMAC", key, payloadData);

    // Hex 변환
    const computedHash = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // 타이밍 공격 방지를 위한 안전한 비교
    return secureCompare(computedHash, providedHash);
  } catch (error) {
    logger.error("Signature verification error:", error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * 타이밍 공격에 안전한 문자열 비교
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * GitHub Webhook 검증 미들웨어
 */
export function githubWebhookAuth() {
  return async (ctx: Context, next: Next) => {
    const signature = ctx.request.headers.get("x-hub-signature-256");

    if (!signature) {
      throw new AuthenticationError("Missing GitHub signature");
    }

    // 요청 본문 읽기
    const body = await ctx.request.body.text();

    // 서명 검증
    const isValid = await verifyGitHubSignature(body, signature);

    if (!isValid) {
      throw new AuthenticationError("Invalid GitHub signature");
    }

    // 검증된 본문을 state에 저장
    ctx.state.body = body;

    await next();
  };
}

/**
 * 입력 sanitization 미들웨어
 */
export function sanitizeInput() {
  return async (ctx: Context, next: Next) => {
    // Query parameters sanitization
    if (ctx.request.url.searchParams) {
      const sanitized = new URLSearchParams();
      for (const [key, value] of ctx.request.url.searchParams.entries()) {
        sanitized.set(key, stripHtmlTags(value));
      }
      // searchParams는 읽기 전용이므로 state에 저장
      ctx.state.sanitizedParams = Object.fromEntries(sanitized);
    }

    await next();
  };
}

/**
 * Request ID 추가 (요청 추적용)
 */
export function requestIdMiddleware() {
  return async (ctx: Context, next: Next) => {
    const requestId = crypto.randomUUID();
    ctx.state.requestId = requestId;
    ctx.response.headers.set("X-Request-ID", requestId);

    await next();
  };
}

/**
 * Request 로깅 미들웨어
 */
export function requestLoggingMiddleware() {
  return async (ctx: Context, next: Next) => {
    const start = Date.now();
    const requestId = ctx.state.requestId || "unknown";

    logger.info(`[${requestId}] ${ctx.request.method} ${ctx.request.url.pathname}`);

    try {
      await next();

      const duration = Date.now() - start;
      logger.info(
        `[${requestId}] ${ctx.response.status} ${ctx.request.method} ${ctx.request.url.pathname} - ${duration}ms`
      );
    } catch (error) {
      const duration = Date.now() - start;
      logger.error(
        `[${requestId}] Error ${ctx.request.method} ${ctx.request.url.pathname} - ${duration}ms:`,
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  };
}

/**
 * IP 화이트리스트 미들웨어
 */
export function ipWhitelist(allowedIps: string[]) {
  return async (ctx: Context, next: Next) => {
    const clientIp = ctx.request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      ctx.request.ip ||
      "unknown";

    if (!allowedIps.includes(clientIp)) {
      throw new AuthorizationError(`IP ${clientIp} is not allowed`);
    }

    await next();
  };
}

/**
 * IP 블랙리스트 미들웨어
 */
export function ipBlacklist(blockedIps: string[]) {
  return async (ctx: Context, next: Next) => {
    const clientIp = ctx.request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      ctx.request.ip ||
      "unknown";

    if (blockedIps.includes(clientIp)) {
      throw new AuthorizationError(`IP ${clientIp} is blocked`);
    }

    await next();
  };
}

/**
 * Basic Auth 미들웨어
 */
export function basicAuth(username: string, password: string) {
  return async (ctx: Context, next: Next) => {
    const authHeader = ctx.request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Basic ")) {
      ctx.response.headers.set("WWW-Authenticate", 'Basic realm="Secure Area"');
      throw new AuthenticationError("Authentication required");
    }

    try {
      const base64Credentials = authHeader.slice(6);
      const decoder = new TextDecoder();
      const credentials = decoder.decode(
        Uint8Array.from(atob(base64Credentials), (c) => c.charCodeAt(0))
      );

      const [user, pass] = credentials.split(":");

      if (user !== username || pass !== password) {
        throw new AuthenticationError("Invalid credentials");
      }

      await next();
    } catch (error) {
      ctx.response.headers.set("WWW-Authenticate", 'Basic realm="Secure Area"');
      throw new AuthenticationError("Invalid credentials");
    }
  };
}

/**
 * Content-Type 검증 미들웨어
 */
export function validateContentType(allowedTypes: string[]) {
  return async (ctx: Context, next: Next) => {
    if (ctx.request.method === "GET" || ctx.request.method === "HEAD") {
      await next();
      return;
    }

    const contentType = ctx.request.headers.get("content-type");

    if (!contentType || !allowedTypes.some((type) => contentType.includes(type))) {
      ctx.response.status = 415;
      ctx.response.body = {
        error: "Unsupported Media Type",
        message: `Content-Type must be one of: ${allowedTypes.join(", ")}`,
      };
      return;
    }

    await next();
  };
}

/**
 * Request 크기 제한 미들웨어
 */
export function requestSizeLimit(maxBytes: number) {
  return async (ctx: Context, next: Next) => {
    const contentLength = ctx.request.headers.get("content-length");

    if (contentLength && parseInt(contentLength, 10) > maxBytes) {
      ctx.response.status = 413;
      ctx.response.body = {
        error: "Payload Too Large",
        message: `Request body must be less than ${maxBytes} bytes`,
      };
      return;
    }

    await next();
  };
}

/**
 * 보안 미들웨어 조합 (통합)
 */
export function securityMiddlewareStack() {
  return [
    requestIdMiddleware(),
    requestLoggingMiddleware(),
    corsMiddleware(),
    securityHeadersMiddleware(),
    sanitizeInput(),
    validateContentType(["application/json", "application/x-www-form-urlencoded"]),
  ];
}
