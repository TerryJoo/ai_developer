/**
 * AI Provider Base Interface
 * 모든 AI provider가 구현해야 하는 기본 인터페이스
 */

import type {
  AICompletionRequest,
  AICompletionResponse,
  CodeGenerationRequest,
  CodeGenerationResponse,
  CodeReview,
  IssueAnalysis,
} from "../../../core/types.ts";

/**
 * 스트리밍 응답 청크
 */
export interface StreamChunk {
  content: string;
  finished: boolean;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * AI Provider 설정
 */
export interface ProviderConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Token 사용량 정보
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * 비용 계산 정보
 */
export interface CostInfo {
  provider: string;
  model: string;
  usage: TokenUsage;
  cost: number;
  currency: string;
}

/**
 * AI Provider 추상 기본 클래스
 */
export abstract class BaseAIProvider {
  protected config: ProviderConfig;
  protected providerName: string;

  constructor(config: ProviderConfig, providerName: string) {
    this.config = config;
    this.providerName = providerName;
  }

  /**
   * 일반 채팅 완료 요청
   */
  abstract chat(request: AICompletionRequest): Promise<AICompletionResponse>;

  /**
   * 스트리밍 채팅 완료 요청
   */
  abstract chatStream(
    request: AICompletionRequest,
  ): AsyncIterableIterator<StreamChunk>;

  /**
   * 코드 생성
   */
  abstract generateCode(
    request: CodeGenerationRequest,
  ): Promise<CodeGenerationResponse>;

  /**
   * 이슈 분석
   */
  abstract analyzeIssue(issue: {
    title: string;
    body: string;
    labels: string[];
  }): Promise<IssueAnalysis>;

  /**
   * 코드 리뷰
   */
  abstract reviewCode(params: {
    diff: string;
    language: string;
    context?: string;
  }): Promise<CodeReview>;

  /**
   * Token 수 계산 (근사값)
   */
  countTokens(text: string): number {
    // 간단한 토큰 계산 (실제로는 tiktoken 같은 라이브러리 사용)
    // 영어: 약 4자당 1토큰, 한글: 약 2자당 1토큰
    const englishChars = text.match(/[a-zA-Z0-9]/g)?.length || 0;
    const otherChars = text.length - englishChars;

    return Math.ceil(englishChars / 4 + otherChars / 2);
  }

  /**
   * 비용 계산
   */
  abstract calculateCost(usage: TokenUsage): CostInfo;

  /**
   * 요청 재시도 로직
   */
  protected async retry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000,
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // 재시도 가능한 에러인지 확인
        if (!this.isRetryableError(error)) {
          throw error;
        }

        // 마지막 시도면 에러를 던짐
        if (attempt === maxRetries) {
          throw error;
        }

        // 지수 백오프로 대기
        const backoffDelay = delay * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      }
    }

    throw lastError!;
  }

  /**
   * 재시도 가능한 에러인지 확인
   */
  protected isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Rate limit, timeout, 네트워크 에러는 재시도
      return (
        message.includes("rate limit") ||
        message.includes("timeout") ||
        message.includes("network") ||
        message.includes("econnreset") ||
        message.includes("503") ||
        message.includes("429")
      );
    }

    return false;
  }

  /**
   * API 에러 처리
   */
  protected handleApiError(error: unknown): never {
    if (error instanceof Error) {
      throw new Error(`${this.providerName} API Error: ${error.message}`);
    }
    throw new Error(`${this.providerName} API Error: Unknown error`);
  }

  /**
   * Provider 이름 반환
   */
  getProviderName(): string {
    return this.providerName;
  }

  /**
   * 현재 모델 반환
   */
  getModel(): string {
    return this.config.model;
  }
}
