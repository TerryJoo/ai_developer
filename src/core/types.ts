/**
 * 공통 타입 정의
 */

// ===== GitHub 관련 타입 =====
export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: GitHubUser;
  html_url: string;
  description: string | null;
  private: boolean;
  default_branch: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  labels: Array<{ name: string; color: string }>;
  user: GitHubUser;
  assignees: GitHubUser[];
  created_at: string;
  updated_at: string;
  html_url: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  state: "open" | "closed" | "merged";
  user: GitHubUser;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  created_at: string;
  updated_at: string;
  html_url: string;
  draft: boolean;
  mergeable: boolean | null;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  url: string;
}

// ===== 웹훅 이벤트 타입 =====
export interface WebhookEvent {
  action: string;
  repository: GitHubRepository;
  sender: GitHubUser;
}

export interface IssueWebhookEvent extends WebhookEvent {
  issue: GitHubIssue;
}

export interface PullRequestWebhookEvent extends WebhookEvent {
  pull_request: GitHubPullRequest;
}

export interface PushWebhookEvent extends WebhookEvent {
  ref: string;
  commits: GitHubCommit[];
}

// ===== AI 관련 타입 =====
export type AIProvider = "openai" | "anthropic" | "multi";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AICompletionRequest {
  messages: AIMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AICompletionResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost?: number;
}

export interface IssueAnalysis {
  summary: string;
  suggestedWorkflow: string;
  suggestions: string;
  complexity: "low" | "medium" | "high";
  estimatedEffort: string;
  requiredFiles: string[];
  dependencies: string[];
  confidence: number;
}

export interface CodeReview {
  approved: boolean;
  comments: CodeReviewComment[];
  summary: string;
  suggestions: string[];
}

export interface CodeReviewComment {
  path: string;
  line: number;
  body: string;
  severity: "info" | "warning" | "error";
}

export interface CodeGenerationRequest {
  task: string;
  context: string;
  language: string;
  framework?: string;
  requirements?: string[];
}

export interface CodeGenerationResponse {
  code: string;
  explanation: string;
  language: string;
  tests?: string;
}

// ===== 워크플로우 관련 타입 =====
export type WorkflowType =
  | "bug-fix"
  | "feature"
  | "code-review"
  | "performance"
  | "security"
  | "documentation"
  | "migration"
  | "dependency-update"
  | "generic";

export interface WorkflowContext {
  type: WorkflowType;
  repository: GitHubRepository;
  issue?: GitHubIssue;
  pullRequest?: GitHubPullRequest;
  metadata?: Record<string, unknown>;
}

export interface WorkflowStep {
  name: string;
  description: string;
  execute: (context: WorkflowContext) => Promise<WorkflowStepResult>;
}

export interface WorkflowStepResult {
  success: boolean;
  message: string;
  data?: unknown;
  error?: Error;
}

export interface WorkflowResult {
  success: boolean;
  workflow: WorkflowType;
  steps: Array<{
    name: string;
    status: "success" | "failed" | "skipped";
    message: string;
    duration: number;
  }>;
  totalDuration: number;
  error?: Error;
}

// ===== 작업 큐 관련 타입 =====
export type JobStatus = "waiting" | "active" | "completed" | "failed" | "delayed";

export interface Job<T = unknown> {
  id: string;
  name: string;
  data: T;
  status: JobStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: Error;
  result?: unknown;
}

export interface JobOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  timeout?: number;
  retryDelay?: number;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
}

// ===== 데이터베이스 스키마 =====
export interface WorkflowExecution {
  id: string;
  workflowType: WorkflowType;
  repositoryId: number;
  issueNumber?: number;
  prNumber?: number;
  status: "pending" | "running" | "completed" | "failed";
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  result?: WorkflowResult;
  error?: string;
}

export interface AIRequestLog {
  id: string;
  provider: AIProvider;
  model: string;
  operation: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  duration: number;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface MetricRecord {
  id: string;
  name: string;
  value: number;
  unit: string;
  tags: Record<string, string>;
  timestamp: Date;
}

// ===== Rate Limiting =====
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  identifier: string;
}

// ===== 캐시 관련 =====
export interface CacheEntry<T> {
  key: string;
  value: T;
  expiresAt: Date;
  createdAt: Date;
}

// ===== 알림 관련 =====
export type NotificationType = "info" | "success" | "warning" | "error";

export interface Notification {
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// ===== 메트릭 관련 =====
export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  timestamp: Date;
}

export interface ApplicationMetrics {
  requests: {
    total: number;
    success: number;
    failed: number;
    avgDuration: number;
  };
  workflows: {
    total: number;
    success: number;
    failed: number;
    avgDuration: number;
  };
  ai: {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    avgDuration: number;
  };
  queue: QueueStats;
  timestamp: Date;
}

// ===== 유틸리티 타입 =====
export type Awaitable<T> = T | Promise<T>;

export type Maybe<T> = T | null | undefined;

export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// ===== 설정 타입 (config.ts와 동기화) =====
export interface Config {
  server: {
    port: number;
    host: string;
    env: "development" | "production" | "test";
  };
  github: {
    token: string;
    webhookSecret: string;
    appId?: string;
    privateKey?: string;
    owner?: string;
    repo?: string;
  };
  ai: {
    provider: AIProvider;
    openai: {
      apiKey: string;
      model: string;
      maxTokens: number;
      temperature: number;
    };
    anthropic: {
      apiKey: string;
      model: string;
      maxTokens: number;
      temperature: number;
    };
  };
}
