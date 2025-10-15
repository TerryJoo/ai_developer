/**
 * Enhanced AI Service with Multi-Provider Orchestration
 * OpenAI, Anthropic provider 통합 및 스마트 라우팅
 */

import { logger } from "../../core/logger.ts";
import { config } from "../../core/config.ts";
import type {
  AICompletionRequest,
  AICompletionResponse,
  CodeGenerationRequest,
  CodeGenerationResponse,
  CodeReview,
  IssueAnalysis,
} from "../../core/types.ts";
import { BaseAIProvider } from "./providers/base.provider.ts";
import {
  createOpenAIProvider,
  OpenAIProvider,
} from "./providers/openai.provider.ts";
import {
  AnthropicProvider,
  createAnthropicProvider,
} from "./providers/anthropic.provider.ts";
import { aiCache } from "./cache.ts";
import { costTracker } from "./cost-tracker.ts";

/**
 * Provider 선택 전략
 */
type ProviderStrategy =
  | "primary" // 기본 provider 사용
  | "cost-optimized" // 비용 최적화
  | "performance" // 성능 최적화
  | "fallback"; // 실패시 대체 provider

/**
 * Enhanced AI Service
 */
export class EnhancedAIService {
  private providers: Map<string, BaseAIProvider>;
  private primaryProvider: string;
  private fallbackProvider?: string;

  constructor() {
    this.providers = new Map();
    this.primaryProvider = config.ai.provider;

    this.initializeProviders();
  }

  /**
   * Provider 초기화
   */
  private initializeProviders(): void {
    // OpenAI Provider 초기화
    if (config.ai.openai.apiKey) {
      const openai = createOpenAIProvider({
        apiKey: config.ai.openai.apiKey,
        model: config.ai.openai.model,
        maxTokens: config.ai.openai.maxTokens,
        temperature: config.ai.openai.temperature,
      });
      this.providers.set("openai", openai);
      logger.info("OpenAI provider initialized");
    }

    // Anthropic Provider 초기화
    if (config.ai.anthropic.apiKey) {
      const anthropic = createAnthropicProvider({
        apiKey: config.ai.anthropic.apiKey,
        model: config.ai.anthropic.model,
        maxTokens: config.ai.anthropic.maxTokens,
        temperature: config.ai.anthropic.temperature,
      });
      this.providers.set("anthropic", anthropic);
      logger.info("Anthropic provider initialized");
    }

    // Primary provider 검증
    if (!this.providers.has(this.primaryProvider)) {
      // Fallback to available provider
      const available = Array.from(this.providers.keys())[0];
      if (available) {
        logger.warn(
          `Primary provider '${this.primaryProvider}' not available, using '${available}'`,
        );
        this.primaryProvider = available;
      } else {
        throw new Error("No AI providers configured");
      }
    }

    // Fallback provider 설정
    const providerList = Array.from(this.providers.keys());
    this.fallbackProvider = providerList.find(
      (p) => p !== this.primaryProvider,
    );

    logger.info(
      `AI Service initialized with primary: ${this.primaryProvider}${
        this.fallbackProvider ? `, fallback: ${this.fallbackProvider}` : ""
      }`,
    );
  }

  /**
   * Provider 선택
   */
  private selectProvider(
    strategy: ProviderStrategy = "primary",
    task?: string,
  ): BaseAIProvider {
    let selectedProvider: string;

    switch (strategy) {
      case "cost-optimized":
        // 비용이 저렴한 provider 선택
        selectedProvider = this.providers.has("anthropic")
          ? "anthropic"
          : this.primaryProvider;
        break;

      case "performance":
        // 성능이 좋은 provider 선택
        selectedProvider = this.providers.has("openai")
          ? "openai"
          : this.primaryProvider;
        break;

      case "fallback":
        selectedProvider = this.fallbackProvider || this.primaryProvider;
        break;

      case "primary":
      default:
        selectedProvider = this.primaryProvider;
        break;
    }

    const provider = this.providers.get(selectedProvider);
    if (!provider) {
      throw new Error(`Provider '${selectedProvider}' not available`);
    }

    logger.debug(
      `Selected provider: ${selectedProvider} (strategy: ${strategy})`,
    );
    return provider;
  }

  /**
   * 채팅 완료 요청 (캐싱 및 비용 추적 포함)
   */
  async chat(
    request: AICompletionRequest,
    strategy: ProviderStrategy = "primary",
  ): Promise<AICompletionResponse> {
    const provider = this.selectProvider(strategy);
    const providerName = provider.getProviderName().toLowerCase();
    const model = provider.getModel();

    // 캐시 확인
    const cached = await aiCache.get(providerName, model, request.messages);
    if (cached) {
      logger.debug("Cache hit - returning cached response");
      return cached;
    }

    // AI 요청 실행
    const startTime = Date.now();
    try {
      const response = await provider.chat(request);
      const duration = Date.now() - startTime;

      // 캐시 저장
      await aiCache.set(providerName, model, request.messages, response);

      // 비용 추적
      const costInfo = provider.calculateCost(response.usage);
      await costTracker.trackRequest(costInfo, "chat", duration, {
        messageCount: request.messages.length,
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Chat request failed with ${providerName}: ${error}`);

      // Fallback provider 시도
      if (strategy !== "fallback" && this.fallbackProvider) {
        logger.info("Attempting fallback provider");
        return await this.chat(request, "fallback");
      }

      throw error;
    }
  }

  /**
   * 코드 생성 (task에 따라 최적 provider 선택)
   */
  async generateCode(
    request: CodeGenerationRequest,
  ): Promise<CodeGenerationResponse> {
    // 복잡한 코드 생성은 성능 우선, 간단한 코드는 비용 우선
    const isComplex = request.requirements && request.requirements.length > 3;
    const strategy: ProviderStrategy = isComplex
      ? "performance"
      : "cost-optimized";

    const provider = this.selectProvider(strategy, "code-generation");
    const startTime = Date.now();

    try {
      const response = await provider.generateCode(request);
      const duration = Date.now() - startTime;

      // 비용 추적 (토큰 수 추정)
      const estimatedTokens = provider.countTokens(
        JSON.stringify(request) + response.code,
      );
      await costTracker.trackRequest(
        provider.calculateCost({
          promptTokens: Math.floor(estimatedTokens * 0.3),
          completionTokens: Math.floor(estimatedTokens * 0.7),
          totalTokens: estimatedTokens,
        }),
        "code-generation",
        duration,
        {
          language: request.language,
          framework: request.framework,
          complexity: isComplex ? "high" : "low",
        },
      );

      return response;
    } catch (error) {
      logger.error(`Code generation failed: ${error}`);

      // Fallback 시도
      if (this.fallbackProvider) {
        logger.info("Attempting fallback provider for code generation");
        const fallbackProvider = this.selectProvider("fallback");
        return await fallbackProvider.generateCode(request);
      }

      throw error;
    }
  }

  /**
   * 이슈 분석 (빠른 응답이 중요하므로 비용 최적화)
   */
  async analyzeIssue(issue: {
    title: string;
    body: string;
    labels: string[];
  }): Promise<IssueAnalysis> {
    const provider = this.selectProvider("cost-optimized", "issue-analysis");
    const startTime = Date.now();

    try {
      const response = await provider.analyzeIssue(issue);
      const duration = Date.now() - startTime;

      // 비용 추적
      const estimatedTokens = provider.countTokens(
        issue.title + issue.body + JSON.stringify(response),
      );
      await costTracker.trackRequest(
        provider.calculateCost({
          promptTokens: Math.floor(estimatedTokens * 0.4),
          completionTokens: Math.floor(estimatedTokens * 0.6),
          totalTokens: estimatedTokens,
        }),
        "issue-analysis",
        duration,
        {
          labels: issue.labels,
          complexity: response.complexity,
        },
      );

      return response;
    } catch (error) {
      logger.error(`Issue analysis failed: ${error}`);

      // Fallback 시도
      if (this.fallbackProvider) {
        logger.info("Attempting fallback provider for issue analysis");
        const fallbackProvider = this.selectProvider("fallback");
        return await fallbackProvider.analyzeIssue(issue);
      }

      throw error;
    }
  }

  /**
   * 코드 리뷰 (정확도가 중요하므로 성능 우선)
   */
  async reviewCode(params: {
    diff: string;
    language: string;
    context?: string;
  }): Promise<CodeReview> {
    const provider = this.selectProvider("performance", "code-review");
    const startTime = Date.now();

    try {
      const response = await provider.reviewCode(params);
      const duration = Date.now() - startTime;

      // 비용 추적
      const estimatedTokens = provider.countTokens(
        params.diff + (params.context || "") + JSON.stringify(response),
      );
      await costTracker.trackRequest(
        provider.calculateCost({
          promptTokens: Math.floor(estimatedTokens * 0.5),
          completionTokens: Math.floor(estimatedTokens * 0.5),
          totalTokens: estimatedTokens,
        }),
        "code-review",
        duration,
        {
          language: params.language,
          approved: response.approved,
          commentCount: response.comments.length,
        },
      );

      return response;
    } catch (error) {
      logger.error(`Code review failed: ${error}`);

      // Fallback 시도
      if (this.fallbackProvider) {
        logger.info("Attempting fallback provider for code review");
        const fallbackProvider = this.selectProvider("fallback");
        return await fallbackProvider.reviewCode(params);
      }

      throw error;
    }
  }

  /**
   * 에러 수정 제안
   */
  async suggestFix(error: {
    message: string;
    stack?: string;
    file?: string;
    line?: number;
  }): Promise<{
    explanation: string;
    suggestedFix: string;
    confidence: number;
  }> {
    const provider = this.selectProvider("primary");

    const prompt = `Analyze this error and suggest a fix:

Error: ${error.message}
${error.file ? `File: ${error.file}` : ""}
${error.line ? `Line: ${error.line}` : ""}
${error.stack ? `\nStack trace:\n${error.stack}` : ""}

Provide response in JSON format:
{
  "explanation": "what causes this error",
  "suggestedFix": "how to fix it",
  "confidence": 0.0-1.0
}`;

    const response = await this.chat({
      messages: [
        { role: "system", content: "You are an expert debugger." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    });

    try {
      return JSON.parse(response.content);
    } catch {
      return {
        explanation: response.content,
        suggestedFix: "See explanation for details",
        confidence: 0.5,
      };
    }
  }

  /**
   * 코드 설명
   */
  async explainCode(code: string, language: string): Promise<string> {
    const provider = this.selectProvider("cost-optimized");

    const response = await this.chat({
      messages: [
        {
          role: "system",
          content:
            `You are an expert ${language} developer. Explain code clearly and concisely.`,
        },
        {
          role: "user",
          content:
            `Explain this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``,
        },
      ],
      temperature: 0.3,
    });

    return response.content;
  }

  /**
   * 사용 가능한 provider 목록
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * 현재 설정 정보
   */
  getConfiguration(): {
    primary: string;
    fallback?: string;
    available: string[];
  } {
    return {
      primary: this.primaryProvider,
      fallback: this.fallbackProvider,
      available: this.getAvailableProviders(),
    };
  }
}

/**
 * 전역 AI Service 인스턴스
 */
export const enhancedAI = new EnhancedAIService();
