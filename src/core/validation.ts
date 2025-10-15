import { ValidationError } from "./errors.ts";

/**
 * 검증 규칙 타입
 */
export type ValidationRule<T> = (value: T) => boolean | string;

/**
 * 검증 결과
 */
export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string[]>;
}

/**
 * 스키마 검증을 위한 기본 클래스
 */
export class Validator<T extends Record<string, unknown>> {
  private rules: Map<keyof T, ValidationRule<unknown>[]> = new Map();

  /**
   * 필드에 검증 규칙 추가
   */
  addRule<K extends keyof T>(field: K, rule: ValidationRule<T[K]>): this {
    const existingRules = this.rules.get(field) || [];
    this.rules.set(field, [...existingRules, rule as ValidationRule<unknown>]);
    return this;
  }

  /**
   * 데이터 검증
   */
  validate(data: T): ValidationResult {
    const errors: Record<string, string[]> = {};

    for (const [field, rules] of this.rules.entries()) {
      const value = data[field];
      const fieldErrors: string[] = [];

      for (const rule of rules) {
        const result = rule(value);
        if (result !== true) {
          fieldErrors.push(typeof result === "string" ? result : `Invalid ${String(field)}`);
        }
      }

      if (fieldErrors.length > 0) {
        errors[String(field)] = fieldErrors;
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * 검증 후 에러가 있으면 예외 발생
   */
  validateOrThrow(data: T): void {
    const result = this.validate(data);
    if (!result.valid) {
      throw new ValidationError("Validation failed", { errors: result.errors });
    }
  }
}

// ===== 공통 검증 규칙 =====

/**
 * 필수 값 검증
 */
export function required<T>(message?: string): ValidationRule<T> {
  return (value: T): boolean | string => {
    if (value === null || value === undefined || value === "") {
      return message || "This field is required";
    }
    return true;
  };
}

/**
 * 문자열 길이 검증
 */
export function stringLength(
  min?: number,
  max?: number,
  message?: string
): ValidationRule<string> {
  return (value: string): boolean | string => {
    if (typeof value !== "string") return "Must be a string";

    const length = value.length;

    if (min !== undefined && length < min) {
      return message || `Must be at least ${min} characters`;
    }

    if (max !== undefined && length > max) {
      return message || `Must be at most ${max} characters`;
    }

    return true;
  };
}

/**
 * 이메일 형식 검증
 */
export function email(message?: string): ValidationRule<string> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return (value: string): boolean | string => {
    if (typeof value !== "string") return "Must be a string";
    if (!emailRegex.test(value)) {
      return message || "Invalid email format";
    }
    return true;
  };
}

/**
 * URL 형식 검증
 */
export function url(message?: string): ValidationRule<string> {
  return (value: string): boolean | string => {
    if (typeof value !== "string") return "Must be a string";
    try {
      new URL(value);
      return true;
    } catch {
      return message || "Invalid URL format";
    }
  };
}

/**
 * 정규식 패턴 검증
 */
export function pattern(regex: RegExp, message?: string): ValidationRule<string> {
  return (value: string): boolean | string => {
    if (typeof value !== "string") return "Must be a string";
    if (!regex.test(value)) {
      return message || "Invalid format";
    }
    return true;
  };
}

/**
 * 숫자 범위 검증
 */
export function numberRange(
  min?: number,
  max?: number,
  message?: string
): ValidationRule<number> {
  return (value: number): boolean | string => {
    if (typeof value !== "number" || isNaN(value)) {
      return "Must be a number";
    }

    if (min !== undefined && value < min) {
      return message || `Must be at least ${min}`;
    }

    if (max !== undefined && value > max) {
      return message || `Must be at most ${max}`;
    }

    return true;
  };
}

/**
 * 배열 길이 검증
 */
export function arrayLength(
  min?: number,
  max?: number,
  message?: string
): ValidationRule<unknown[]> {
  return (value: unknown[]): boolean | string => {
    if (!Array.isArray(value)) return "Must be an array";

    const length = value.length;

    if (min !== undefined && length < min) {
      return message || `Must have at least ${min} items`;
    }

    if (max !== undefined && length > max) {
      return message || `Must have at most ${max} items`;
    }

    return true;
  };
}

/**
 * 열거형 값 검증
 */
export function oneOf<T>(values: T[], message?: string): ValidationRule<T> {
  return (value: T): boolean | string => {
    if (!values.includes(value)) {
      return message || `Must be one of: ${values.join(", ")}`;
    }
    return true;
  };
}

/**
 * 커스텀 검증 함수
 */
export function custom<T>(
  fn: (value: T) => boolean,
  message: string
): ValidationRule<T> {
  return (value: T): boolean | string => {
    return fn(value) ? true : message;
  };
}

// ===== 특정 도메인 검증 =====

/**
 * GitHub 토큰 형식 검증
 */
export function githubToken(message?: string): ValidationRule<string> {
  return (value: string): boolean | string => {
    if (typeof value !== "string") return "Must be a string";

    // GitHub Personal Access Token: ghp_...
    // GitHub App Installation Token: ghs_...
    // GitHub OAuth Token: gho_...
    const tokenRegex = /^(ghp|ghs|gho)_[A-Za-z0-9]{36,}$/;

    if (!tokenRegex.test(value)) {
      return message || "Invalid GitHub token format";
    }

    return true;
  };
}

/**
 * Webhook secret 검증
 */
export function webhookSecret(message?: string): ValidationRule<string> {
  return stringLength(16, undefined, message || "Webhook secret must be at least 16 characters");
}

/**
 * API 키 검증
 */
export function apiKey(message?: string): ValidationRule<string> {
  return stringLength(20, undefined, message || "API key must be at least 20 characters");
}

/**
 * 워크플로우 타입 검증
 */
export function workflowType(message?: string): ValidationRule<string> {
  const validTypes = [
    "bug-fix",
    "feature",
    "code-review",
    "performance",
    "security",
    "documentation",
    "migration",
    "dependency-update",
    "generic",
  ];

  return oneOf(validTypes, message || `Invalid workflow type. Must be one of: ${validTypes.join(", ")}`);
}

/**
 * AI Provider 검증
 */
export function aiProvider(message?: string): ValidationRule<string> {
  const validProviders = ["openai", "anthropic", "multi"];
  return oneOf(
    validProviders,
    message || `Invalid AI provider. Must be one of: ${validProviders.join(", ")}`
  );
}

// ===== 복합 검증 유틸리티 =====

/**
 * 여러 객체 검증
 */
export function validateMultiple<T extends Record<string, unknown>>(
  data: T[],
  validator: Validator<T>
): { valid: boolean; errors: Array<{ index: number; errors: Record<string, string[]> }> } {
  const errors: Array<{ index: number; errors: Record<string, string[]> }> = [];

  data.forEach((item, index) => {
    const result = validator.validate(item);
    if (!result.valid) {
      errors.push({ index, errors: result.errors });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 부분 검증 (일부 필드만 검증)
 */
export function validatePartial<T extends Record<string, unknown>>(
  data: Partial<T>,
  validator: Validator<T>
): ValidationResult {
  // 존재하는 필드만 검증
  return validator.validate(data as T);
}

/**
 * 안전한 JSON 파싱
 */
export function safeJsonParse<T>(
  json: string
): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = JSON.parse(json);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}

/**
 * 객체 정리 (undefined, null 값 제거)
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const sanitized: Partial<T> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      sanitized[key as keyof T] = value as T[keyof T];
    }
  }

  return sanitized;
}

/**
 * HTML 태그 제거 (XSS 방지)
 */
export function stripHtmlTags(str: string): string {
  return str.replace(/<[^>]*>/g, "");
}

/**
 * SQL Injection 방지를 위한 문자열 이스케이프
 */
export function escapeSql(str: string): string {
  return str.replace(/'/g, "''");
}
