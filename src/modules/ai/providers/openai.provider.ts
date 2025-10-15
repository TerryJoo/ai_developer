/**
 * OpenAI Provider Implementation
 * GPT-4, GPT-4 Turbo, GPT-3.5 Turbo 지원
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
 * OpenAI 가격표 (2024년 1월 기준, USD per 1M tokens)
 */
const OPENAI_PRICING: Record<string, { prompt: number; completion: number }> = {
  "gpt-4-turbo-preview": { prompt: 10.0, completion: 30.0 },
  "gpt-4-turbo": { prompt: 10.0, completion: 30.0 },
  "gpt-4": { prompt: 30.0, completion: 60.0 },
  "gpt-4-32k": { prompt: 60.0, completion: 120.0 },
  "gpt-3.5-turbo": { prompt: 0.5, completion: 1.5 },
  "gpt-3.5-turbo-16k": { prompt: 3.0, completion: 4.0 },
};

/**
 * OpenAI API 응답 타입
 */
interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "function";
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

interface OpenAIChatCompletion {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: OpenAIMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI Provider
 */
export class OpenAIProvider extends BaseAIProvider {
  private apiEndpoint = "https://api.openai.com/v1/chat/completions";

  constructor(config: ProviderConfig) {
    super(config, "OpenAI");
  }

  /**
   * 채팅 완료 요청
   */
  async chat(request: AICompletionRequest): Promise<AICompletionResponse> {
    logger.debug(`OpenAI chat request: ${request.messages.length} messages`);

    const response = await this.retry(() => this.makeRequest(request));

    const usage: TokenUsage = {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    };

    const costInfo = this.calculateCost(usage);

    return {
      content: response.choices[0].message.content,
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
      `OpenAI stream request: ${request.messages.length} messages`,
    );

    const response = await fetch(this.apiEndpoint, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: request.model || this.config.model,
        messages: request.messages,
        max_tokens: request.maxTokens || this.config.maxTokens,
        temperature: request.temperature ?? this.config.temperature,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
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
            if (data === "[DONE]") {
              yield {
                content: "",
                finished: true,
              };
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || "";

              yield {
                content,
                finished: false,
              };
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
      model: request.framework ? this.config.model : "gpt-3.5-turbo",
      temperature: 0.3, // 낮은 temperature로 일관성 있는 코드 생성
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
      // JSON 파싱 실패 시 전체 응답을 코드로 반환
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

      // 폴백 분석
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
    const pricing = OPENAI_PRICING[this.config.model] ||
      OPENAI_PRICING["gpt-3.5-turbo"];

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
   * OpenAI API 요청
   */
  private async makeRequest(
    request: AICompletionRequest,
  ): Promise<OpenAIChatCompletion> {
    const response = await fetch(this.apiEndpoint, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: request.model || this.config.model,
        messages: request.messages,
        max_tokens: request.maxTokens || this.config.maxTokens,
        temperature: request.temperature ?? this.config.temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  /**
   * HTTP 헤더 생성
   */
  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.config.apiKey}`,
    };
  }
}

/**
 * OpenAI Provider 팩토리 함수
 */
export function createOpenAIProvider(config: ProviderConfig): OpenAIProvider {
  return new OpenAIProvider(config);
}
