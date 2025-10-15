// Mock Service Factories for Testing

import type { Repository } from "../../src/modules/github/github.service.ts";

export interface MockGitHubService {
  createIssueComment: (
    issueNumber: number,
    comment: string,
    repo?: Repository,
  ) => Promise<void>;
  createPullRequest: (data: any, repo?: Repository) => Promise<number>;
  createBranch: (
    branchName: string,
    baseBranch?: string,
    repo?: Repository,
  ) => Promise<void>;
  commitFile: (
    path: string,
    content: string,
    message: string,
    branch: string,
    repo?: Repository,
  ) => Promise<void>;
  addLabels: (
    issueNumber: number,
    labels: string[],
    repo?: Repository,
  ) => Promise<void>;
  createReview: (
    prNumber: number,
    comments: any[],
    event: string,
    repo?: Repository,
  ) => Promise<void>;
}

export interface MockAIService {
  analyzeIssue: (issue: any) => Promise<any>;
  generateCode: (prompt: any) => Promise<string>;
  reviewCode: (params: any) => Promise<any>;
  suggestFix: (error: any) => Promise<any>;
}

export interface MockCodeGenerator {
  generateBugFix: (analysis: any) => Promise<any>;
  generateFeature: (analysis: any) => Promise<any>;
  generateTests: (targetFile: string, context?: any) => Promise<any>;
}

// Mock GitHub Service
export function createMockGitHubService(): MockGitHubService {
  const calls: Record<string, any[]> = {
    createIssueComment: [],
    createPullRequest: [],
    createBranch: [],
    commitFile: [],
    addLabels: [],
    createReview: [],
  };

  return {
    async createIssueComment(
      issueNumber: number,
      comment: string,
      repo?: Repository,
    ) {
      calls.createIssueComment.push({ issueNumber, comment, repo });
    },

    async createPullRequest(data: any, repo?: Repository) {
      calls.createPullRequest.push({ data, repo });
      return 123; // Mock PR number
    },

    async createBranch(
      branchName: string,
      baseBranch?: string,
      repo?: Repository,
    ) {
      calls.createBranch.push({ branchName, baseBranch, repo });
    },

    async commitFile(
      path: string,
      content: string,
      message: string,
      branch: string,
      repo?: Repository,
    ) {
      calls.commitFile.push({ path, content, message, branch, repo });
    },

    async addLabels(issueNumber: number, labels: string[], repo?: Repository) {
      calls.addLabels.push({ issueNumber, labels, repo });
    },

    async createReview(
      prNumber: number,
      comments: any[],
      event: string,
      repo?: Repository,
    ) {
      calls.createReview.push({ prNumber, comments, event, repo });
    },
  };
}

// Mock AI Service
export function createMockAIService(): MockAIService {
  return {
    async analyzeIssue(issue: any) {
      return {
        summary: `Analysis of: ${issue.title}`,
        suggestedWorkflow: "bug-fix",
        suggestions: "1. Analyze\n2. Fix\n3. Test",
        complexity: "medium",
        estimatedEffort: "2-3 hours",
        requiredFiles: ["src/auth.ts"],
        dependencies: [],
      };
    },

    async generateCode(prompt: any) {
      return `// Generated code for: ${prompt.task}\n\nexport function fixBug() {\n  // Implementation\n}`;
    },

    async reviewCode(params: any) {
      return {
        approved: true,
        comments: [{
          path: "src/main.ts",
          line: 10,
          body: "Consider adding error handling",
        }],
        summary: "Code looks good",
      };
    },

    async suggestFix(error: any) {
      return {
        explanation: `The error "${error.message}" can be fixed by...`,
        suggestedFix: "Add null check before accessing property",
        confidence: 0.85,
      };
    },
  };
}

// Mock Code Generator
export function createMockCodeGenerator(): MockCodeGenerator {
  return {
    async generateBugFix(analysis: any) {
      return {
        files: [{
          path: "src/auth.ts",
          content: "// Fixed auth code",
          action: "update",
        }],
        description: "Fixed authentication bug",
        testFiles: [{
          path: "tests/auth.test.ts",
          content: "// Test for fix",
          action: "create",
        }],
      };
    },

    async generateFeature(analysis: any) {
      return {
        files: [{
          path: "src/features/new-feature.ts",
          content: "// Feature implementation",
          action: "create",
        }],
        description: "Implemented new feature",
        testFiles: [{
          path: "tests/features/new-feature.test.ts",
          content: "// Feature tests",
          action: "create",
        }],
      };
    },

    async generateTests(targetFile: string, context?: any) {
      return {
        files: [{
          path: `tests/${
            targetFile.replace("src/", "").replace(".ts", ".test.ts")
          }`,
          content: `// Tests for ${targetFile}`,
          action: "create",
        }],
        description: `Generated tests for ${targetFile}`,
      };
    },
  };
}

// Spy Logger for testing
export class SpyLogger {
  private logs: Array<{ level: string; message: string; args: any[] }> = [];

  info(message: string, ...args: any[]) {
    this.logs.push({ level: "INFO", message, args });
  }

  error(message: string, ...args: any[]) {
    this.logs.push({ level: "ERROR", message, args });
  }

  warn(message: string, ...args: any[]) {
    this.logs.push({ level: "WARN", message, args });
  }

  debug(message: string, ...args: any[]) {
    this.logs.push({ level: "DEBUG", message, args });
  }

  getLogs() {
    return this.logs;
  }

  getLogsByLevel(level: string) {
    return this.logs.filter((log) => log.level === level);
  }

  clearLogs() {
    this.logs = [];
  }

  hasLog(message: string): boolean {
    return this.logs.some((log) => log.message.includes(message));
  }
}

// Test Data Assertions
export function assertWorkflowExecuted(
  mockGitHub: MockGitHubService,
  expectedSteps: string[],
) {
  // Verify workflow steps were executed in order
  // This would inspect the mock calls
}

export function assertIssueUpdated(
  mockGitHub: MockGitHubService,
  issueNumber: number,
  expectedComment: string,
) {
  // Verify issue was updated with expected comment
}

export function assertBranchCreated(
  mockGitHub: MockGitHubService,
  branchName: string,
) {
  // Verify branch was created
}

export function assertPRCreated(
  mockGitHub: MockGitHubService,
  expectedTitle: string,
) {
  // Verify PR was created with expected title
}
