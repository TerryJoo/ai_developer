/**
 * 베이스 애플리케이션 에러 클래스
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date();
    this.context = context;

    // V8 스택 트레이스 캡처
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      context: this.context,
    };
  }
}

/**
 * 검증 에러 - 잘못된 입력값
 */
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 400, true, context);
  }
}

/**
 * 인증 에러 - 인증 실패
 */
export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication failed", context?: Record<string, unknown>) {
    super(message, 401, true, context);
  }
}

/**
 * 인가 에러 - 권한 부족
 */
export class AuthorizationError extends AppError {
  constructor(message: string = "Insufficient permissions", context?: Record<string, unknown>) {
    super(message, 403, true, context);
  }
}

/**
 * 리소스 미발견 에러
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string | number) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 404, true, { resource, identifier });
  }
}

/**
 * 충돌 에러 - 리소스 중복
 */
export class ConflictError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 409, true, context);
  }
}

/**
 * Rate Limit 초과 에러
 */
export class RateLimitError extends AppError {
  public readonly retryAfter?: number;

  constructor(message: string = "Rate limit exceeded", retryAfter?: number) {
    super(message, 429, true, { retryAfter });
    this.retryAfter = retryAfter;
  }
}

/**
 * 외부 서비스 에러 (GitHub, AI API 등)
 */
export class ExternalServiceError extends AppError {
  public readonly service: string;

  constructor(
    service: string,
    message: string,
    statusCode: number = 502,
    context?: Record<string, unknown>
  ) {
    super(`${service} error: ${message}`, statusCode, true, context);
    this.service = service;
  }
}

/**
 * GitHub API 에러
 */
export class GitHubError extends ExternalServiceError {
  constructor(message: string, statusCode: number = 502, context?: Record<string, unknown>) {
    super("GitHub", message, statusCode, context);
  }
}

/**
 * AI Provider 에러
 */
export class AIProviderError extends ExternalServiceError {
  constructor(
    provider: "openai" | "anthropic",
    message: string,
    statusCode: number = 502,
    context?: Record<string, unknown>
  ) {
    super(provider, message, statusCode, { ...context, provider });
  }
}

/**
 * 데이터베이스 에러
 */
export class DatabaseError extends AppError {
  public readonly operation?: string;

  constructor(message: string, operation?: string, context?: Record<string, unknown>) {
    super(message, 500, true, { ...context, operation });
    this.operation = operation;
  }
}

/**
 * 작업 큐 에러
 */
export class QueueError extends AppError {
  public readonly jobId?: string;

  constructor(message: string, jobId?: string, context?: Record<string, unknown>) {
    super(message, 500, true, { ...context, jobId });
    this.jobId = jobId;
  }
}

/**
 * 워크플로우 실행 에러
 */
export class WorkflowError extends AppError {
  public readonly workflowName: string;
  public readonly step?: string;

  constructor(
    workflowName: string,
    message: string,
    step?: string,
    context?: Record<string, unknown>
  ) {
    super(message, 500, true, { ...context, workflowName, step });
    this.workflowName = workflowName;
    this.step = step;
  }
}

/**
 * 타임아웃 에러
 */
export class TimeoutError extends AppError {
  public readonly operation: string;
  public readonly timeout: number;

  constructor(operation: string, timeout: number) {
    super(`Operation '${operation}' timed out after ${timeout}ms`, 504, true, {
      operation,
      timeout,
    });
    this.operation = operation;
    this.timeout = timeout;
  }
}

/**
 * 설정 에러
 */
export class ConfigurationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 500, false, context);
  }
}

/**
 * 에러가 운영 가능한 에러인지 확인
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * 에러를 HTTP 응답 형식으로 변환
 */
export function formatErrorResponse(error: Error): {
  error: {
    name: string;
    message: string;
    statusCode: number;
    timestamp?: Date;
    context?: Record<string, unknown>;
  };
} {
  if (error instanceof AppError) {
    return {
      error: {
        name: error.name,
        message: error.message,
        statusCode: error.statusCode,
        timestamp: error.timestamp,
        context: error.context,
      },
    };
  }

  // 알 수 없는 에러는 500으로 처리
  return {
    error: {
      name: "InternalServerError",
      message: "An unexpected error occurred",
      statusCode: 500,
    },
  };
}

/**
 * 에러 로그용 포맷터
 */
export function formatErrorForLogging(error: Error): {
  name: string;
  message: string;
  stack?: string;
  statusCode?: number;
  isOperational?: boolean;
  context?: Record<string, unknown>;
} {
  const formatted: {
    name: string;
    message: string;
    stack?: string;
    statusCode?: number;
    isOperational?: boolean;
    context?: Record<string, unknown>;
  } = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };

  if (error instanceof AppError) {
    formatted.statusCode = error.statusCode;
    formatted.isOperational = error.isOperational;
    formatted.context = error.context;
  }

  return formatted;
}
