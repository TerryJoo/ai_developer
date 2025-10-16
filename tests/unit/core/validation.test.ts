import { assertEquals } from "@std/assert/mod.ts";
import {
  Validator,
  required,
  stringLength,
  email,
  numberRange,
  oneOf,
} from "../../../src/core/validation.ts";

Deno.test("Validation - required rule", () => {
  const rule = required();

  assertEquals(rule("test"), true);
  assertEquals(typeof rule(""), "string");
  assertEquals(typeof rule(null), "string");
  assertEquals(typeof rule(undefined), "string");
});

Deno.test("Validation - stringLength rule", () => {
  const rule = stringLength(3, 10);

  assertEquals(rule("test"), true);
  assertEquals(typeof rule("ab"), "string");
  assertEquals(typeof rule("12345678901"), "string");
});

Deno.test("Validation - email rule", () => {
  const rule = email();

  assertEquals(rule("test@example.com"), true);
  assertEquals(typeof rule("invalid-email"), "string");
  assertEquals(typeof rule("@example.com"), "string");
});

Deno.test("Validation - numberRange rule", () => {
  const rule = numberRange(1, 10);

  assertEquals(rule(5), true);
  assertEquals(typeof rule(0), "string");
  assertEquals(typeof rule(11), "string");
});

Deno.test("Validation - oneOf rule", () => {
  const rule = oneOf(["red", "green", "blue"]);

  assertEquals(rule("red"), true);
  assertEquals(rule("green"), true);
  assertEquals(typeof rule("yellow"), "string");
});

Deno.test("Validation - Validator class", () => {
  interface TestData extends Record<string, unknown> {
    name: string;
    age: number;
    email: string;
  }

  const validator = new Validator<TestData>();
  validator.addRule("name", required());
  validator.addRule("name", stringLength(2, 50));
  validator.addRule("age", numberRange(0, 120));
  validator.addRule("email", email());

  const validData: TestData = {
    name: "John Doe",
    age: 30,
    email: "john@example.com",
  };

  const result = validator.validate(validData);
  assertEquals(result.valid, true);
  assertEquals(Object.keys(result.errors).length, 0);
});

Deno.test("Validation - Validator with invalid data", () => {
  interface TestData extends Record<string, unknown> {
    name: string;
    age: number;
  }

  const validator = new Validator<TestData>();
  validator.addRule("name", required());
  validator.addRule("age", numberRange(0, 120));

  const invalidData: TestData = {
    name: "",
    age: 150,
  };

  const result = validator.validate(invalidData);
  assertEquals(result.valid, false);
  assertEquals(Object.keys(result.errors).length, 2);
});
