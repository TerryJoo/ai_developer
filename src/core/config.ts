import { load } from "@std/dotenv/mod.ts";

// 환경 변수 로드 - 테스트 환경에서는 .env.example 검증 건너뛰기
const envFile = Deno.env.get("ENV") === "test" ? ".env.test" : ".env";
try {
  await load({
    export: true,
    allowEmptyValues: true,
    envPath: envFile,
    examplePath: Deno.env.get("ENV") === "test" ? undefined : ".env.example",
  });
} catch (error) {
  // 테스트 환경에서는 .env 파일이 없어도 계속 진행
  if (Deno.env.get("ENV") !== "test") {
    console.warn("Failed to load .env file:", error);
  }
}

/**
 * 환경 변수를 가져오며, 없으면 기본값 반환
 */
function getEnv(key: string, defaultValue: string = ""): string {
  return Deno.env.get(key) || defaultValue;
}

/**
 * 환경 변수를 숫자로 변환
 */
function getEnvNumber(key: string, defaultValue: number): number {
  const value = Deno.env.get(key);
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 환경 변수를 boolean으로 변환
 */
function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = Deno.env.get(key);
  if (!value) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

/**
 * 중앙 집중식 설정 관리
 */
export const config = {
  // 서버 설정
  server: {
    port: getEnvNumber("PORT", 8000),
    host: getEnv("HOST", "localhost"),
    env: getEnv("ENV", "development") as "development" | "production" | "test",
  },

  // GitHub 설정
  github: {
    token: getEnv("GITHUB_TOKEN"),
    webhookSecret: getEnv("GITHUB_WEBHOOK_SECRET"),
    appId: getEnv("GITHUB_APP_ID"),
    privateKey: getEnv("GITHUB_APP_PRIVATE_KEY"),
    owner: getEnv("GITHUB_OWNER"),
    repo: getEnv("GITHUB_REPO"),
  },

  // AI Provider 설정
  ai: {
    provider: getEnv("AI_PROVIDER", "openai") as "openai" | "anthropic" | "multi",

    openai: {
      apiKey: getEnv("OPENAI_API_KEY"),
      model: getEnv("OPENAI_MODEL", "gpt-4-turbo-preview"),
      maxTokens: getEnvNumber("OPENAI_MAX_TOKENS", 4096),
      temperature: parseFloat(getEnv("OPENAI_TEMPERATURE", "0.7")),
    },

    anthropic: {
      apiKey: getEnv("ANTHROPIC_API_KEY"),
      model: getEnv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022"),
      maxTokens: getEnvNumber("ANTHROPIC_MAX_TOKENS", 4096),
      temperature: parseFloat(getEnv("ANTHROPIC_TEMPERATURE", "0.7")),
    },
  },

  // 데이터베이스 설정
  database: {
    sqlite: {
      path: getEnv("SQLITE_PATH", "./data/automation.db"),
      walMode: getEnvBoolean("SQLITE_WAL_MODE", true),
    },

    redis: {
      url: getEnv("REDIS_URL", "redis://localhost:6379"),
      password: getEnv("REDIS_PASSWORD"),
      db: getEnvNumber("REDIS_DB", 0),
      retryAttempts: getEnvNumber("REDIS_RETRY_ATTEMPTS", 3),
      retryDelay: getEnvNumber("REDIS_RETRY_DELAY", 1000),
    },
  },

  // 작업 큐 설정
  queue: {
    name: getEnv("QUEUE_NAME", "ai-developer-tasks"),
    maxJobs: getEnvNumber("QUEUE_MAX_JOBS", 1000),
    concurrency: getEnvNumber("QUEUE_CONCURRENCY", 5),
    retryAttempts: getEnvNumber("QUEUE_RETRY_ATTEMPTS", 3),
    retryDelay: getEnvNumber("QUEUE_RETRY_DELAY", 60000),
    jobTimeout: getEnvNumber("QUEUE_JOB_TIMEOUT", 600000),
  },

  // 워커 설정
  worker: {
    poolSize: getEnvNumber("WORKER_POOL_SIZE", 3),
    maxJobsPerWorker: getEnvNumber("WORKER_MAX_JOBS_PER_WORKER", 10),
  },

  // Rate Limiting 설정
  rateLimit: {
    enabled: getEnvBoolean("RATE_LIMIT_ENABLED", true),
    window: getEnvNumber("RATE_LIMIT_WINDOW", 60000),
    maxRequests: getEnvNumber("RATE_LIMIT_MAX_REQUESTS", 100),
  },

  // 보안 설정
  security: {
    webhookSignatureAlgorithm: getEnv("WEBHOOK_SIGNATURE_ALGORITHM", "sha256"),
    apiKeyRequired: getEnvBoolean("API_KEY_REQUIRED", false),
    apiKey: getEnv("API_KEY"),
    corsOrigins: getEnv("CORS_ORIGINS", "http://localhost:3000,http://localhost:8000")
      .split(",")
      .map(origin => origin.trim()),
    enableHelmet: getEnvBoolean("ENABLE_HELMET", true),
  },

  // 로깅 설정
  logging: {
    level: getEnv("LOG_LEVEL", "info") as "debug" | "info" | "warn" | "error",
    filePath: getEnv("LOG_FILE_PATH", "./logs/app.log"),
    maxSize: getEnvNumber("LOG_MAX_SIZE", 10485760), // 10MB
    maxFiles: getEnvNumber("LOG_MAX_FILES", 5),
    rotation: getEnv("LOG_ROTATION", "daily") as "daily" | "size" | "none",
  },

  // 메트릭 설정
  metrics: {
    enabled: getEnvBoolean("METRICS_ENABLED", true),
    port: getEnvNumber("METRICS_PORT", 9090),
    path: getEnv("METRICS_PATH", "/metrics"),
  },

  // AI 비용 추적
  costTracking: {
    enabled: getEnvBoolean("COST_TRACKING_ENABLED", true),
    alertThreshold: parseFloat(getEnv("COST_ALERT_THRESHOLD", "100.00")),
    budgetMonthly: parseFloat(getEnv("COST_BUDGET_MONTHLY", "1000.00")),
  },

  // AI 응답 캐싱
  cache: {
    enabled: getEnvBoolean("AI_CACHE_ENABLED", true),
    ttl: getEnvNumber("AI_CACHE_TTL", 3600), // 1시간
    maxSize: getEnvNumber("AI_CACHE_MAX_SIZE", 1000),
  },

  // 워크플로우 설정
  workflow: {
    timeout: getEnvNumber("WORKFLOW_TIMEOUT", 900000), // 15분
    maxRetries: getEnvNumber("WORKFLOW_MAX_RETRIES", 2),
    autoMerge: getEnvBoolean("WORKFLOW_AUTO_MERGE", false),
    requireTests: getEnvBoolean("WORKFLOW_REQUIRE_TESTS", true),
  },

  // 대시보드 설정
  dashboard: {
    enabled: getEnvBoolean("DASHBOARD_ENABLED", true),
    port: getEnvNumber("DASHBOARD_PORT", 3000),
    authEnabled: getEnvBoolean("DASHBOARD_AUTH_ENABLED", false),
    username: getEnv("DASHBOARD_USERNAME", "admin"),
    password: getEnv("DASHBOARD_PASSWORD", "changeme"),
  },

  // 알림 설정
  notifications: {
    slack: {
      webhookUrl: getEnv("SLACK_WEBHOOK_URL"),
    },
    discord: {
      webhookUrl: getEnv("DISCORD_WEBHOOK_URL"),
    },
    email: {
      enabled: getEnvBoolean("EMAIL_ENABLED", false),
      smtpHost: getEnv("EMAIL_SMTP_HOST", "smtp.gmail.com"),
      smtpPort: getEnvNumber("EMAIL_SMTP_PORT", 587),
      from: getEnv("EMAIL_FROM", "noreply@example.com"),
      to: getEnv("EMAIL_TO", "admin@example.com"),
    },
  },

  // 성능 튜닝
  performance: {
    maxConcurrentRequests: getEnvNumber("MAX_CONCURRENT_REQUESTS", 50),
    requestTimeout: getEnvNumber("REQUEST_TIMEOUT", 30000),
    bodyParserLimit: getEnv("BODY_PARSER_LIMIT", "10mb"),
  },

  // 개발 설정
  development: {
    debug: getEnvBoolean("DEBUG", false),
    verboseLogging: getEnvBoolean("VERBOSE_LOGGING", false),
    dryRun: getEnvBoolean("DRY_RUN", false),
  },
};

/**
 * 필수 설정값 검증
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // GitHub 토큰 검증
  if (!config.github.token) {
    errors.push("GITHUB_TOKEN is required");
  }

  // AI API 키 검증 (적어도 하나는 필요)
  if (!config.ai.openai.apiKey && !config.ai.anthropic.apiKey) {
    errors.push("At least one AI API key (OPENAI_API_KEY or ANTHROPIC_API_KEY) is required");
  }

  // 선택된 AI Provider에 해당하는 API 키가 있는지 확인
  if (config.ai.provider === "openai" && !config.ai.openai.apiKey) {
    errors.push("OPENAI_API_KEY is required when AI_PROVIDER is set to 'openai'");
  }

  if (config.ai.provider === "anthropic" && !config.ai.anthropic.apiKey) {
    errors.push("ANTHROPIC_API_KEY is required when AI_PROVIDER is set to 'anthropic'");
  }

  // Webhook secret 검증 (프로덕션 환경)
  if (config.server.env === "production" && !config.github.webhookSecret) {
    errors.push("GITHUB_WEBHOOK_SECRET is required in production");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 설정 정보를 안전하게 출력 (민감한 정보 마스킹)
 */
export function printConfig(): void {
  const maskSecret = (value: string | undefined): string => {
    if (!value) return "[not set]";
    if (value.length <= 8) return "***";
    return value.substring(0, 4) + "..." + value.substring(value.length - 4);
  };

  console.log("\n=== Configuration ===");
  console.log(`Environment: ${config.server.env}`);
  console.log(`Server: ${config.server.host}:${config.server.port}`);
  console.log(`AI Provider: ${config.ai.provider}`);
  console.log(`OpenAI API Key: ${maskSecret(config.ai.openai.apiKey)}`);
  console.log(`Anthropic API Key: ${maskSecret(config.ai.anthropic.apiKey)}`);
  console.log(`GitHub Token: ${maskSecret(config.github.token)}`);
  console.log(`Rate Limiting: ${config.rateLimit.enabled ? "enabled" : "disabled"}`);
  console.log(`Metrics: ${config.metrics.enabled ? "enabled" : "disabled"}`);
  console.log(`Dashboard: ${config.dashboard.enabled ? "enabled" : "disabled"}`);
  console.log("====================\n");
}
