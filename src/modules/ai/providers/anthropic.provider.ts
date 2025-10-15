/**
 * Anthropic Provider Implementation
 * Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku 지원
 */

import type {
  AICompletionRequest,
  AICompletionResponse,
  CodeGenerationRequest,
  CodeGenerationResponse,
  CodeReview,
  IssueAnalysis,
} from "../../../core/types.ts";
import {
  BaseAIProvider,
  type CostInfo,
  type ProviderConfig,
  type StreamChunk,
  type TokenUsage,
} from "./base.provider.ts";
import { logger } from "../../../core/logger.ts";

/**
 * Anthropic 가격표 (2024년 10월 기준, USD per 1M tokens)
 */
const ANTHROPIC_PRICING: Record<
  string,
  { prompt: number; completion: number }
> = {
  "claude-3-5-sonnet-20241022": { prompt: 3.0, completion: 15.0 },
  "claude-3-5-sonnet-20240620": { prompt: 3.0, completion: 15.0 },
  "claude-3-opus-20240229": { prompt: 15.0, completion: 75.0 },
  "claude-3-sonnet-20240229": { prompt: 3.0, completion: 15.0 },
  "claude-3-haiku-20240307": { prompt: 0.25, completion: 1.25 },
};

/**
 * Anthropic API 요청/응답 타입
 */
interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  temperature?: number;
  system?: string;
  stream?: boolean;
}

interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Anthropic Provider
 */
export class AnthropicProvider extends BaseAIProvider {
  private apiEndpoint = "https://api.anthropic.com/v1/messages";
  private apiVersion = "2023-06-01";

  constructor(config: ProviderConfig) {
    super(config, "Anthropic");
  }

  /**
   * 채팅 완료 요청
   */
  async chat(request: AICompletionRequest): Promise<AICompletionResponse> {
    logger.debug(
      `Anthropic chat request: ${request.messages.length} messages`,
    );

    const response = await this.retry(() => this.makeRequest(request));

    const usage: TokenUsage = {
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    };

    const costInfo = this.calculateCost(usage);

    return {
      content: response.content[0].text,
      model: response.model,
      usage,
      cost: costInfo.cost,
    };
  }

  /**
   * 스트리밍 채팅 완료 요청
   */
  async *chatStream(
    request: AICompletionRequest,
  ): AsyncIterableIterator<StreamChunk> {
    logger.debug(
      `Anthropic stream request: ${request.messages.length} messages`,
    );

    const anthropicRequest = this.convertToAnthropicRequest(request, true);

    const response = await fetch(this.apiEndpoint, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(anthropicRequest),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === "content_block_delta") {
                yield {
                  content: parsed.delta.text || "",
                  finished: false,
                };
              } else if (parsed.type === "message_stop") {
                yield {
                  content: "",
                  finished: true,
                };
                return;
              }
            } catch {
              // 파싱 에러 무시
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * 코드 생성
   */
  async generateCode(
    request: CodeGenerationRequest,
  ): Promise<CodeGenerationResponse> {
    logger.info(`Generating ${request.language} code: ${request.task}`);

    const systemPrompt =
      `You are an expert software engineer specializing in ${request.language}${
        request.framework ? ` and ${request.framework}` : ""
      }.
Generate clean, production-ready code with proper error handling, type safety, and comprehensive comments.
Include tests when appropriate.`;

    const userPrompt = `Task: ${request.task}

Context: ${request.context}

${
      request.requirements?.length
        ? `Requirements:\n${
          request.requirements.map((r) => `- ${r}`).join("\n")
        }`
        : ""
    }

Generate complete, working code. Include:
1. Implementation code
2. Explanation of the approach
3. Unit tests (if applicable)

Format your response as JSON:
{
  "code": "the actual code here",
  "explanation": "detailed explanation",
  "tests": "test code here (optional)"
}`;

    const response = await this.chat({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
    });

    try {
      const parsed = JSON.parse(response.content);
      return {
        code: parsed.code,
        explanation: parsed.explanation,
        language: request.language,
        tests: parsed.tests,
      };
    } catch {
      return {
        code: response.content,
        explanation: "Generated code",
        language: request.language,
      };
    }
  }

  /**
   * 이슈 분석
   */
  async analyzeIssue(issue: {
    title: string;
    body: string;
    labels: string[];
  }): Promise<IssueAnalysis> {
    logger.info(`Analyzing issue: ${issue.title}`);

    const systemPrompt =
      `You are an expert software project analyst. Analyze GitHub issues and provide structured insights.`;

    const userPrompt = `Analyze this GitHub issue:

Title: ${issue.title}
Labels: ${issue.labels.join(", ")}
Body:
${issue.body}

Provide analysis in JSON format:
{
  "summary": "concise summary",
  "suggestedWorkflow": "bug-fix|feature|code-review|performance|security|documentation|migration|dependency-update|generic",
  "suggestions": "step-by-step suggestions",
  "complexity": "low|medium|high",
  "estimatedEffort": "estimated time",
  "requiredFiles": ["file1.ts", "file2.ts"],
  "dependencies": ["dependency1", "dependency2"],
  "confidence": 0.0-1.0
}`;

    const response = await this.chat({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
    });

    try {
      return JSON.parse(response.content);
    } catch (error) {
      logger.error(`Failed to parse issue analysis: ${error}`);

      return {
        summary: issue.title,
        suggestedWorkflow: issue.labels.includes("bug") ? "bug-fix" : "generic",
        suggestions: "Unable to generate detailed suggestions",
        complexity: "medium",
        estimatedEffort: "Unknown",
        requiredFiles: [],
        dependencies: [],
        confidence: 0.5,
      };
    }
  }

  /**
   * 코드 리뷰
   */
  async reviewCode(params: {
    diff: string;
    language: string;
    context?: string;
  }): Promise<CodeReview> {
    logger.info(`Reviewing ${params.language} code`);

    const systemPrompt =
      `You are an expert code reviewer. Provide constructive, specific feedback.
Focus on:
- Bugs and logical errors
- Security vulnerabilities
- Performance issues
- Code quality and best practices
- Readability and maintainability`;

    const userPrompt = `Review this ${params.language} code change:

${params.context ? `Context: ${params.context}\n\n` : ""}Diff:
\`\`\`diff
${params.diff}
\`\`\`

Provide review in JSON format:
{
  "approved": true/false,
  "summary": "overall assessment",
  "comments": [
    {
      "path": "file/path.ts",
      "line": 10,
      "body": "specific comment",
      "severity": "info|warning|error"
    }
  ],
  "suggestions": ["improvement 1", "improvement 2"]
}`;

    const response = await this.chat({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
    });

    try {
      return JSON.parse(response.content);
    } catch (error) {
      logger.error(`Failed to parse code review: ${error}`);

      return {
        approved: true,
        comments: [],
        summary: "Unable to generate detailed review",
        suggestions: [],
      };
    }
  }

  /**
   * 비용 계산
   */
  calculateCost(usage: TokenUsage): CostInfo {
    const pricing = ANTHROPIC_PRICING[this.config.model] ||
      ANTHROPIC_PRICING["claude-3-5-sonnet-20241022"];

    const promptCost = (usage.promptTokens / 1_000_000) * pricing.prompt;
    const completionCost = (usage.completionTokens / 1_000_000) *
      pricing.completion;
    const totalCost = promptCost + completionCost;

    return {
      provider: this.providerName,
      model: this.config.model,
      usage,
      cost: totalCost,
      currency: "USD",
    };
  }

  /**
   * Anthropic API 요청
   */
  private async makeRequest(
    request: AICompletionRequest,
  ): Promise<AnthropicResponse> {
    const anthropicRequest = this.convertToAnthropicRequest(request, false);

    const response = await fetch(this.apiEndpoint, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(anthropicRequest),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  /**
   * AICompletionRequest를 Anthropic 형식으로 변환
   */
  private convertToAnthropicRequest(
    request: AICompletionRequest,
    stream: boolean,
  ): AnthropicRequest {
    // system 메시지 분리
    const systemMessage = request.messages.find((m) => m.role === "system");
    const userMessages = request.messages.filter((m) => m.role !== "system");

    // Anthropic은 user/assistant 메시지만 지원
    const messages: AnthropicMessage[] = userMessages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));

    return {
      model: request.model || this.config.model,
      messages,
      max_tokens: request.maxTokens || this.config.maxTokens,
      temperature: request.temperature ?? this.config.temperature,
      system: systemMessage?.content,
      stream,
    };
  }

  /**
   * HTTP 헤더 생성
   */
  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-api-key": this.config.apiKey,
      "anthropic-version": this.apiVersion,
    };
  }
}

/**
 * Anthropic Provider 팩토리 함수
 */
export function createAnthropicProvider(
  config: ProviderConfig,
): AnthropicProvider {
  return new AnthropicProvider(config);
}
