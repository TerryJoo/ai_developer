import { assertEquals, assertExists } from "@std/assert/mod.ts";
import { config, validateConfig } from "../../../src/core/config.ts";

Deno.test("Config - should load configuration from environment", () => {
  assertExists(config);
  assertExists(config.server);
  assertExists(config.github);
  assertExists(config.ai);
});

Deno.test("Config - server configuration", () => {
  assertEquals(typeof config.server.port, "number");
  assertEquals(typeof config.server.host, "string");
  assertEquals(["development", "production", "test"].includes(config.server.env), true);
});

Deno.test("Config - validation", () => {
  const result = validateConfig();
  assertExists(result);
  assertEquals(typeof result.valid, "boolean");
  assertExists(result.errors);
  assertEquals(Array.isArray(result.errors), true);
});

Deno.test("Config - AI provider configuration", () => {
  assertEquals(["openai", "anthropic", "multi"].includes(config.ai.provider), true);
});

Deno.test("Config - database configuration", () => {
  assertExists(config.database.sqlite);
  assertExists(config.database.redis);
  assertEquals(typeof config.database.sqlite.path, "string");
  assertEquals(typeof config.database.redis.url, "string");
});
