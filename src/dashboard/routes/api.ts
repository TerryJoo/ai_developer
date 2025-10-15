/**
 * Dashboard API Routes
 */

import { Router } from "@oak/oak";
import { aiCache } from "../../modules/ai/cache.ts";
import { costTracker } from "../../modules/ai/cost-tracker.ts";
import { getMetricsCollector } from "../../metrics/collector.ts";

const metricsCollector = getMetricsCollector();

export const apiRouter = new Router();

// System status
apiRouter.get("/api/status", async (ctx) => {
  const cacheStatus = await aiCache.getStatus();
  const budgetStatus = await costTracker.getBudgetStatus();

  ctx.response.body = {
    status: "ok",
    cache: cacheStatus,
    budget: budgetStatus,
    timestamp: new Date().toISOString(),
  };
});

// Metrics
apiRouter.get("/api/metrics", async (ctx) => {
  const metrics = await metricsCollector.getMetrics();
  ctx.response.body = metrics;
});

// Cost summary
apiRouter.get("/api/costs", async (ctx) => {
  const start = new Date();
  start.setDate(1); // Start of month
  const end = new Date();

  const summary = await costTracker.getSummary(start, end);
  const budget = await costTracker.getBudgetStatus();

  ctx.response.body = {
    summary,
    budget,
  };
});
