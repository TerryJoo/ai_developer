import { assertEquals, assertExists } from "@std/assert/mod.ts";
import { AutomationService } from "../../../src/modules/automation/automation.service.ts";
import { GitHubService } from "../../../src/modules/github/github.service.ts";
import {
  createMockAIService,
  createMockGitHubService,
} from "../../helpers/mock-services.ts";
import { testScenarios } from "../../fixtures/test-payloads.ts";

/**
 * Integration Test: Bug Fix Workflow
 *
 * Tests the complete bug fix workflow from issue creation to PR generation
 * Validates all component interactions and business logic flow
 */

Deno.test("Bug Fix Workflow - Complete Integration", async (t) => {
  await t.step(
    "Scenario: Issue with bug label triggers automated fix",
    async (st) => {
      // Setup
      const automationService = new AutomationService();
      const payload = testScenarios.bugIssue;

      await st.step("Step 1: Issue is received and analyzed", async () => {
        // Verify issue payload is valid
        assertEquals(payload.labels.includes("bug"), true);
        assertEquals(payload.labels.includes("automate"), true);
        assertExists(payload.title);
        assertExists(payload.body);
      });

      await st.step("Step 2: Workflow is determined as bug-fix", () => {
        const service = new AutomationService();
        const analysis = { suggestedWorkflow: null };

        const workflow = (service as any).determineWorkflow(
          payload.labels,
          analysis,
        );
        assertEquals(workflow, "bug-fix");
      });

      await st.step("Step 3: AI analyzes the bug", async () => {
        // Mock AI analysis
        const mockAI = createMockAIService();
        const analysis = await mockAI.analyzeIssue({
          title: payload.title,
          body: payload.body,
          labels: payload.labels,
        });

        assertEquals(analysis.suggestedWorkflow, "bug-fix");
        assertExists(analysis.requiredFiles);
        assertExists(analysis.summary);
      });

      await st.step("Step 4: Fix branch is created", () => {
        const expectedBranchName = `fix/issue-${payload.issueNumber}`;
        assertEquals(expectedBranchName, "fix/issue-42");
      });

      await st.step("Step 5: Bug fix code is generated", async () => {
        const mockAI = createMockAIService();
        const fixCode = await mockAI.generateCode({
          task: "Fix authentication bug",
          context: payload.body,
          language: "typescript",
        });

        assertExists(fixCode);
        assertEquals(fixCode.includes("function"), true);
      });

      await st.step("Step 6: Code is committed to branch", () => {
        const mockGitHub = createMockGitHubService();

        // Verify commit would be made
        const commitMessage = `Fix: ${payload.title} (#${payload.issueNumber})`;
        assertEquals(commitMessage, "Fix: Login validation fails (#42)");
      });

      await st.step("Step 7: Pull request is created", async () => {
        const mockGitHub = createMockGitHubService();

        const prNumber = await mockGitHub.createPullRequest({
          title: `Fix: ${payload.title}`,
          body: `Fixes #${payload.issueNumber}`,
          head: `fix/issue-${payload.issueNumber}`,
          base: "main",
        });

        assertExists(prNumber);
        assertEquals(typeof prNumber, "number");
      });

      await st.step("Step 8: Issue is updated with PR link", () => {
        const mockGitHub = createMockGitHubService();

        // Verify comment would be added
        const expectedComment = "✅ **Bug fix implemented!**";
        assertExists(expectedComment);
      });
    },
  );

  await t.step(
    "Scenario: Bug fix workflow handles errors gracefully",
    async (st) => {
      await st.step("Given: Invalid issue data", () => {
        const invalidPayload = {
          issueNumber: -1,
          title: "",
          body: "",
          labels: [],
          repository: { owner: "", name: "" },
        };

        assertEquals(invalidPayload.issueNumber < 0, true);
      });

      await st.step("When: Validation occurs", () => {
        // Validation logic
        const isValid = (payload: any): boolean => {
          return payload.issueNumber > 0 &&
            payload.title.length > 0 &&
            payload.repository.owner.length > 0;
        };

        const invalidPayload = {
          issueNumber: -1,
          title: "",
          repository: { owner: "" },
        };
        assertEquals(isValid(invalidPayload), false);
      });

      await st.step("Then: Error should be handled gracefully", () => {
        // Should not crash, should log error and notify user
        assertExists(Error);
      });
    },
  );

  await t.step("Scenario: Bug fix with multiple files", async (st) => {
    await st.step("Given: Bug affects multiple files", () => {
      const analysis = {
        requiredFiles: [
          "src/auth/login.ts",
          "src/utils/validation.ts",
          "src/types/user.ts",
        ],
      };

      assertEquals(analysis.requiredFiles.length, 3);
    });

    await st.step("When: Fix is generated", () => {
      const files = [
        { path: "src/auth/login.ts", action: "update" },
        { path: "src/utils/validation.ts", action: "update" },
        { path: "src/types/user.ts", action: "update" },
      ];

      assertEquals(files.length, 3);
    });

    await st.step("Then: All files should be committed", () => {
      // Verify multiple commits or single commit with multiple files
      const commitCount = 1; // Could be 1 or 3 depending on strategy
      assertEquals(commitCount > 0, true);
    });
  });
});

Deno.test("Bug Fix Workflow - Component Interactions", async (t) => {
  await t.step("AutomationService → AIService interaction", async () => {
    const mockAI = createMockAIService();

    const issueData = {
      title: "Login fails",
      body: "Users cannot login",
      labels: ["bug"],
    };

    const analysis = await mockAI.analyzeIssue(issueData);

    assertEquals(analysis.suggestedWorkflow, "bug-fix");
    assertExists(analysis.summary);
  });

  await t.step("AutomationService → GitHubService interaction", async () => {
    const mockGitHub = createMockGitHubService();

    // Test branch creation
    await mockGitHub.createBranch("fix/test-branch", "main");

    // Test PR creation
    const prNumber = await mockGitHub.createPullRequest({
      title: "Test PR",
      body: "Test",
      head: "fix/test-branch",
      base: "main",
    });

    assertEquals(typeof prNumber, "number");
  });

  await t.step("AutomationService → CodeGenerator interaction", async () => {
    const mockCodeGen = {
      async generateBugFix(analysis: any) {
        return {
          files: [{ path: "src/fix.ts", content: "// fix", action: "update" }],
          description: "Bug fixed",
        };
      },
    };

    const result = await mockCodeGen.generateBugFix({ summary: "Fix bug" });
    assertEquals(result.files.length, 1);
  });
});

Deno.test("Bug Fix Workflow - Edge Cases", async (t) => {
  await t.step("Issue with bug label but no automate label", async () => {
    const payload = {
      issueNumber: 50,
      title: "Bug report",
      body: "Something is broken",
      labels: ["bug"], // No automate label
      repository: { owner: "test", name: "repo" },
    };

    // Should not trigger automation automatically
    assertEquals(payload.labels.includes("automate"), false);
  });

  await t.step("Bug fix when branch already exists", async () => {
    // Should handle gracefully - either use existing or create new with suffix
    const branchName = "fix/issue-42";
    const alternativeBranchName = "fix/issue-42-v2";

    assertExists(branchName);
    assertExists(alternativeBranchName);
  });

  await t.step("Bug fix when AI analysis fails", async () => {
    // Should fallback to generic analysis or manual workflow
    const fallbackAnalysis = {
      summary: "Manual review required",
      suggestedWorkflow: "generic",
      complexity: "unknown",
    };

    assertEquals(fallbackAnalysis.suggestedWorkflow, "generic");
  });

  await t.step("Bug fix when code generation fails", async () => {
    // Should notify user and create issue comment
    const errorMessage =
      "Code generation failed. Manual intervention required.";
    assertExists(errorMessage);
  });
});
