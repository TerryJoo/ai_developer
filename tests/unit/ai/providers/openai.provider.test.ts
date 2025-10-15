/**
 * OpenAI Provider Unit Tests
 */

import { assertEquals, assertExists } from "@std/assert";
import { createOpenAIProvider } from "../../../../src/modules/ai/providers/openai.provider.ts";

Deno.test("OpenAI Provider - initialization", () => {
  const provider = createOpenAIProvider({
    apiKey: "test-key",
    model: "gpt-4-turbo-preview",
    maxTokens: 4096,
    temperature: 0.7,
  });

  assertEquals(provider.getProviderName(), "OpenAI");
  assertEquals(provider.getModel(), "gpt-4-turbo-preview");
});

Deno.test("OpenAI Provider - token counting", () => {
  const provider = createOpenAIProvider({
    apiKey: "test-key",
    model: "gpt-4-turbo-preview",
    maxTokens: 4096,
    temperature: 0.7,
  });

  const text = "Hello, world!";
  const tokens = provider.countTokens(text);

  assertExists(tokens);
  assertEquals(typeof tokens, "number");
});

Deno.test("OpenAI Provider - cost calculation", () => {
  const provider = createOpenAIProvider({
    apiKey: "test-key",
    model: "gpt-4-turbo-preview",
    maxTokens: 4096,
    temperature: 0.7,
  });

  const costInfo = provider.calculateCost({
    promptTokens: 100,
    completionTokens: 200,
    totalTokens: 300,
  });

  assertEquals(costInfo.provider, "OpenAI");
  assertEquals(costInfo.model, "gpt-4-turbo-preview");
  assertExists(costInfo.cost);
  assertEquals(costInfo.currency, "USD");
});
