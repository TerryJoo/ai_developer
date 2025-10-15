import { assertEquals, assertInstanceOf } from "@std/assert/mod.ts";
import {
  AppError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  GitHubError,
  AIProviderError,
  isOperationalError,
  formatErrorResponse,
} from "../../../src/core/errors.ts";

Deno.test("Errors - AppError creation", () => {
  const error = new AppError("Test error", 500);

  assertInstanceOf(error, Error);
  assertInstanceOf(error, AppError);
  assertEquals(error.message, "Test error");
  assertEquals(error.statusCode, 500);
  assertEquals(error.isOperational, true);
  assertInstanceOf(error.timestamp, Date);
});

Deno.test("Errors - ValidationError", () => {
  const error = new ValidationError("Invalid input");

  assertEquals(error.statusCode, 400);
  assertEquals(error.isOperational, true);
});

Deno.test("Errors - AuthenticationError", () => {
  const error = new AuthenticationError();

  assertEquals(error.statusCode, 401);
  assertEquals(error.message, "Authentication failed");
});

Deno.test("Errors - NotFoundError", () => {
  const error = new NotFoundError("User", "123");

  assertEquals(error.statusCode, 404);
  assertEquals(error.message, "User with identifier '123' not found");
});

Deno.test("Errors - RateLimitError", () => {
  const error = new RateLimitError("Rate limit exceeded", 60);

  assertEquals(error.statusCode, 429);
  assertEquals(error.retryAfter, 60);
});

Deno.test("Errors - GitHubError", () => {
  const error = new GitHubError("API rate limit exceeded", 403);

  assertEquals(error.service, "GitHub");
  assertEquals(error.statusCode, 403);
});

Deno.test("Errors - AIProviderError", () => {
  const error = new AIProviderError("openai", "Token limit exceeded");

  assertInstanceOf(error, AIProviderError);
  assertEquals(error.service, "openai");
});

Deno.test("Errors - isOperationalError", () => {
  const operationalError = new ValidationError("Test");
  const nonOperationalError = new Error("Test");

  assertEquals(isOperationalError(operationalError), true);
  assertEquals(isOperationalError(nonOperationalError), false);
});

Deno.test("Errors - formatErrorResponse", () => {
  const error = new ValidationError("Invalid input");
  const response = formatErrorResponse(error);

  assertEquals(response.error.name, "ValidationError");
  assertEquals(response.error.message, "Invalid input");
  assertEquals(response.error.statusCode, 400);
});

Deno.test("Errors - formatErrorResponse for unknown error", () => {
  const error = new Error("Unknown error");
  const response = formatErrorResponse(error);

  assertEquals(response.error.name, "InternalServerError");
  assertEquals(response.error.statusCode, 500);
});
