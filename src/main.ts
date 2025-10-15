import { Application, Router } from "@oak/oak";
import { load } from "@std/dotenv/mod.ts";
import { GitHubWebhookHandler } from "./modules/github/webhook.handler.ts";
import { AutomationService } from "./modules/automation/automation.service.ts";
import { logger } from "./core/logger.ts";
import { generateOverviewHTML } from "./core/overview.template.ts";
import { config, validateConfig } from "./core/config.ts";
import { enhancedAI } from "./modules/ai/ai.service.enhanced.ts";
import { aiCache } from "./modules/ai/cache.ts";
import { costTracker } from "./modules/ai/cost-tracker.ts";
import { apiRouter } from "./dashboard/routes/api.ts";
import { getWorkerPool } from "./queue/workers.ts";
import { getQueue } from "./queue/job-queue.ts";

// Load environment variables
await load({ export: true, allowEmptyValues: true });

// Validate configuration
const validation = validateConfig();
if (!validation.valid) {
  logger.error("Configuration validation failed:");
  validation.errors.forEach((error) => logger.error(`  - ${error}`));
  Deno.exit(1);
}

const app = new Application();
const router = new Router();

// Initialize services
const githubHandler = new GitHubWebhookHandler();
const automationService = new AutomationService();

// Start worker pool
logger.info("Starting worker pool...");
const queue = getQueue();
const workerPool = getWorkerPool(queue);
await workerPool.start();

// Log AI service configuration
logger.info(`AI Service: ${JSON.stringify(enhancedAI.getConfiguration())}`);

// Overview page endpoint
router.get("/", (ctx) => {
  ctx.response.headers.set("Content-Type", "text/html; charset=utf-8");
  ctx.response.body = generateOverviewHTML();
});

// Health check endpoint
router.get("/health", (ctx) => {
  ctx.response.body = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "AI Developer Automation"
  };
});

// GitHub webhook endpoint
router.post("/webhook/github", async (ctx) => {
  try {
    const body = await ctx.request.body.json();
    const signature = ctx.request.headers.get("x-hub-signature-256") || "";
    const event = ctx.request.headers.get("x-github-event") || "";

    // Verify webhook signature
    const isValid = await githubHandler.verifySignature(
      JSON.stringify(body),
      signature
    );

    if (!isValid) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Invalid signature" };
      return;
    }

    // Process the webhook event
    logger.info(`Received GitHub ${event} event`);
    await githubHandler.handleEvent(event, body);

    ctx.response.status = 200;
    ctx.response.body = { message: "Webhook processed successfully" };
  } catch (error) {
    logger.error("Webhook processing error:", error instanceof Error ? error : new Error(String(error)));
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
});

// API endpoints for manual triggers
router.post("/api/automation/trigger", async (ctx) => {
  try {
    const body = await ctx.request.body.json();
    const result = await automationService.triggerWorkflow(body);

    ctx.response.body = result;
  } catch (error) {
    logger.error("Automation trigger error:", error instanceof Error ? error : new Error(String(error)));
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to trigger automation" };
  }
});

// Apply routes
app.use(router.routes());
app.use(router.allowedMethods());
app.use(apiRouter.routes());
app.use(apiRouter.allowedMethods());

// Global error handling
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    logger.error("Unhandled error:", err instanceof Error ? err : new Error(String(err)));
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
});

// Start server
const port = parseInt(Deno.env.get("PORT") || "8000");
const host = Deno.env.get("HOST") || "localhost";

logger.info(`🚀 AI Developer Automation Server starting on http://${host}:${port}`);
await app.listen({ port, hostname: host });