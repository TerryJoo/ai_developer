/**
 * AI Cache Tests
 */

import { assertEquals } from "@std/assert";
import { AICacheManager } from "../../../src/modules/ai/cache.ts";

Deno.test("AI Cache - metrics tracking", async () => {
  const cache = new AICacheManager();

  const metrics = await cache.getMetrics();

  assertEquals(typeof metrics.hits, "number");
  assertEquals(typeof metrics.misses, "number");
  assertEquals(typeof metrics.hitRate, "number");
});

Deno.test("AI Cache - status check", async () => {
  const cache = new AICacheManager();

  const status = await cache.getStatus();

  assertEquals(typeof status.enabled, "boolean");
  assertEquals(typeof status.size, "number");
});
