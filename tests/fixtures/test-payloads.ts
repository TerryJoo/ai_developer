// Test Fixture Factories

import type {
  CommandPayload,
  IssuePayload,
} from "../../src/modules/automation/automation.service.ts";
import type { Repository } from "../../src/modules/github/github.service.ts";

export interface IssuePayloadOptions {
  issueNumber?: number;
  title?: string;
  body?: string;
  labels?: string[];
  repository?: Repository;
}

export interface CommandPayloadOptions {
  command?: string;
  issueNumber?: number;
  repository?: Repository;
}

// Default test repository
const defaultRepository: Repository = {
  owner: "test-owner",
  name: "test-repo",
};

// Create test issue payload
export function createIssuePayload(
  options: IssuePayloadOptions = {},
): IssuePayload {
  return {
    issueNumber: options.issueNumber ?? 1,
    title: options.title ?? "Test Issue",
    body: options.body ?? "This is a test issue",
    labels: options.labels ?? ["automate"],
    repository: options.repository ?? defaultRepository,
  };
}

// Create test command payload
export function createCommandPayload(
  options: CommandPayloadOptions = {},
): CommandPayload {
  return {
    command: options.command ?? "generate-tests",
    issueNumber: options.issueNumber ?? 1,
    repository: options.repository ?? defaultRepository,
  };
}

// Predefined test scenarios
export const testScenarios = {
  bugIssue: createIssuePayload({
    issueNumber: 42,
    title: "Login validation fails",
    body: "Users can login with invalid email addresses",
    labels: ["bug", "automate"],
  }),

  featureIssue: createIssuePayload({
    issueNumber: 43,
    title: "Add user profile page",
    body: "Users should be able to view and edit their profile",
    labels: ["feature", "automate"],
  }),

  refactorIssue: createIssuePayload({
    issueNumber: 44,
    title: "Refactor authentication module",
    body: "Split auth.ts into smaller modules",
    labels: ["refactor", "automate"],
  }),

  testIssue: createIssuePayload({
    issueNumber: 45,
    title: "Add tests for payment module",
    body: "Need comprehensive test coverage",
    labels: ["test", "automate"],
  }),

  generateTestsCommand: createCommandPayload({
    command: "generate-tests",
    issueNumber: 100,
  }),

  fixBugCommand: createCommandPayload({
    command: "fix-bug authentication error",
    issueNumber: 101,
  }),

  implementCommand: createCommandPayload({
    command: "implement user-settings",
    issueNumber: 102,
  }),

  refactorCommand: createCommandPayload({
    command: "refactor database-queries",
    issueNumber: 103,
  }),

  reviewCommand: createCommandPayload({
    command: "review",
    issueNumber: 104,
  }),
};

// GitHub webhook payloads
export const webhookPayloads = {
  issueOpened: {
    action: "opened",
    issue: {
      number: 1,
      title: "Test issue",
      body: "Test body",
      labels: [{ name: "bug" }],
      user: { login: "testuser" },
    },
    repository: {
      owner: { login: "test-owner" },
      name: "test-repo",
    },
  },

  issueLabeled: {
    action: "labeled",
    label: { name: "automate" },
    issue: {
      number: 1,
      title: "Test issue",
      body: "Test body",
      labels: [{ name: "bug" }, { name: "automate" }],
    },
    repository: {
      owner: { login: "test-owner" },
      name: "test-repo",
    },
  },

  issueCommentCreated: {
    action: "created",
    issue: {
      number: 1,
      title: "Test issue",
      body: "Test body",
      labels: [{ name: "bug" }],
    },
    comment: {
      body: "@ai-dev generate-tests",
      user: { login: "testuser" },
    },
    repository: {
      owner: { login: "test-owner" },
      name: "test-repo",
    },
  },

  pullRequestOpened: {
    action: "opened",
    pull_request: {
      number: 1,
      title: "Fix: Authentication bug",
      body: "Fixes #42",
      labels: [{ name: "auto-review" }],
      head: { ref: "fix/issue-42" },
      base: { ref: "main" },
    },
    repository: {
      owner: { login: "test-owner" },
      name: "test-repo",
    },
  },

  pushEvent: {
    ref: "refs/heads/main",
    commits: [
      {
        id: "abc123",
        message: "Fix: User validation [automate]",
        author: { name: "Test User" },
      },
    ],
    repository: {
      owner: { login: "test-owner" },
      name: "test-repo",
    },
  },
};

// AI service response fixtures
export const aiResponses = {
  issueAnalysis: {
    summary: "Authentication validation error in login flow",
    suggestedWorkflow: "bug-fix",
    suggestions:
      "1. Identify validation logic\n2. Add email format check\n3. Add tests",
    complexity: "medium",
    estimatedEffort: "2-3 hours",
    requiredFiles: ["src/auth/login.ts", "src/utils/validation.ts"],
    dependencies: ["validator"],
  },

  codeGeneration: {
    language: "typescript",
    code: `export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
}`,
    explanation: "Email validation function using regex pattern",
  },

  codeReview: {
    approved: true,
    comments: [
      {
        path: "src/auth/login.ts",
        line: 15,
        body: "Consider adding input sanitization before validation",
      },
      {
        path: "src/auth/login.ts",
        line: 23,
        body: "Add error handling for network failures",
      },
    ],
    summary: "Overall code quality is good with minor suggestions",
  },
};

// Generated code fixtures
export const generatedCode = {
  bugFix: {
    files: [
      {
        path: "src/auth/login.ts",
        content: `import { validateEmail } from "../utils/validation.ts";

export async function login(email: string, password: string) {
  if (!validateEmail(email)) {
    throw new Error("Invalid email format");
  }

  // Rest of login logic
}`,
        action: "update",
      },
    ],
    description: "Added email validation to login function",
    testFiles: [
      {
        path: "tests/auth/login.test.ts",
        content:
          `import { assertEquals, assertThrows } from "@std/assert/mod.ts";
import { login } from "../../src/auth/login.ts";

Deno.test("login rejects invalid email", () => {
  assertThrows(() => login("invalid-email", "password"), Error, "Invalid email format");
});`,
        action: "create",
      },
    ],
  },

  feature: {
    files: [
      {
        path: "src/features/user-profile.ts",
        content: `export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export class UserProfileService {
  async getProfile(userId: string): Promise<UserProfile> {
    // Implementation
  }

  async updateProfile(userId: string, data: Partial<UserProfile>): Promise<void> {
    // Implementation
  }
}`,
        action: "create",
      },
    ],
    description: "Implemented user profile feature",
    testFiles: [
      {
        path: "tests/features/user-profile.test.ts",
        content: `import { assertEquals } from "@std/assert/mod.ts";
import { UserProfileService } from "../../src/features/user-profile.ts";

Deno.test("UserProfileService tests", async (t) => {
  await t.step("getProfile returns user data", async () => {
    const service = new UserProfileService();
    const profile = await service.getProfile("user-123");
    assertEquals(profile.id, "user-123");
  });
});`,
        action: "create",
      },
    ],
  },
};
