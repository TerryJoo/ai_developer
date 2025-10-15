import { logger } from "../../core/logger.ts";
import { GitHubService, Repository } from "../github/github.service.ts";
import { AIService } from "../ai/ai.service.ts";
import { CodeGenerator } from "../code-gen/code-generator.ts";

export interface IssuePayload {
  issueNumber: number;
  title: string;
  body: string;
  labels: string[];
  repository: Repository;
}

export interface CommandPayload {
  command: string;
  issueNumber: number;
  repository: Repository;
}

export interface WorkflowResult {
  success: boolean;
  message: string;
  artifacts?: any;
}

export class AutomationService {
  private githubService: GitHubService;
  private aiService: AIService;
  private codeGenerator: CodeGenerator;

  constructor() {
    this.githubService = new GitHubService();
    this.aiService = new AIService();
    this.codeGenerator = new CodeGenerator();
  }

  async processIssue(payload: IssuePayload): Promise<void> {
    logger.info(`Processing issue #${payload.issueNumber}: ${payload.title}`);

    try {
      // Post initial acknowledgment
      await this.githubService.createIssueComment(
        payload.issueNumber,
        "🤖 **AI Developer Bot** is analyzing this issue...\n\n" +
        "I'll start working on this task and will update you with my progress.",
        payload.repository
      );

      // Analyze the issue with AI
      const analysis = await this.aiService.analyzeIssue({
        title: payload.title,
        body: payload.body,
        labels: payload.labels
      });

      // Determine the workflow based on labels and analysis
      const workflow = this.determineWorkflow(payload.labels, analysis);

      // Execute the appropriate workflow
      switch (workflow) {
        case "bug-fix":
          await this.executeBugFixWorkflow(payload, analysis);
          break;
        case "feature":
          await this.executeFeatureWorkflow(payload, analysis);
          break;
        case "refactor":
          await this.executeRefactorWorkflow(payload, analysis);
          break;
        case "test":
          await this.executeTestWorkflow(payload, analysis);
          break;
        default:
          await this.executeGenericWorkflow(payload, analysis);
      }
    } catch (error) {
      logger.error(`Failed to process issue #${payload.issueNumber}:`, error);

      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.githubService.createIssueComment(
        payload.issueNumber,
        "❌ **Error processing this issue:**\n\n" +
        `\`\`\`\n${errorMessage}\n\`\`\`\n\n` +
        "Please check the issue description and try again.",
        payload.repository
      );
    }
  }

  async executeCommand(payload: CommandPayload): Promise<void> {
    logger.info(`Executing command: ${payload.command} for issue #${payload.issueNumber}`);

    try {
      // Parse and execute specific commands
      const [action, ...args] = payload.command.split(" ");

      switch (action.toLowerCase()) {
        case "generate-tests":
          await this.generateTests(payload.issueNumber, payload.repository);
          break;
        case "fix-bug":
          await this.fixBug(payload.issueNumber, args.join(" "), payload.repository);
          break;
        case "implement":
          await this.implementFeature(payload.issueNumber, args.join(" "), payload.repository);
          break;
        case "refactor":
          await this.refactorCode(payload.issueNumber, args.join(" "), payload.repository);
          break;
        case "review":
          await this.reviewCode(payload.issueNumber, payload.repository);
          break;
        default:
          await this.githubService.createIssueComment(
            payload.issueNumber,
            `❓ Unknown command: \`${action}\`\n\n` +
            "Available commands:\n" +
            "- `generate-tests` - Generate tests for the code\n" +
            "- `fix-bug <description>` - Fix a specific bug\n" +
            "- `implement <feature>` - Implement a new feature\n" +
            "- `refactor <target>` - Refactor code\n" +
            "- `review` - Review the current code",
            payload.repository
          );
      }
    } catch (error) {
      logger.error(`Failed to execute command:`, error);

      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.githubService.createIssueComment(
        payload.issueNumber,
        `❌ Command execution failed: ${errorMessage}`,
        payload.repository
      );
    }
  }

  async triggerWorkflow(params: any): Promise<WorkflowResult> {
    logger.info("Manual workflow trigger:", params);

    try {
      // Process manual workflow triggers
      // This could be extended to support various workflow types
      return {
        success: true,
        message: "Workflow triggered successfully",
        artifacts: {
          workflowId: crypto.randomUUID(),
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error("Workflow trigger failed:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Workflow failed: ${errorMessage}`
      };
    }
  }

  async reviewPullRequest(payload: {
    prNumber: number;
    repository: Repository;
  }): Promise<void> {
    logger.info(`Reviewing PR #${payload.prNumber}`);

    try {
      // AI-powered code review
      const review = await this.aiService.reviewCode({
        prNumber: payload.prNumber,
        repository: payload.repository
      });

      // Post review comments
      await this.githubService.createReview(
        payload.prNumber,
        review.comments,
        review.approved ? "APPROVE" : "REQUEST_CHANGES",
        payload.repository
      );
    } catch (error) {
      logger.error(`Failed to review PR #${payload.prNumber}:`, error);
    }
  }

  async processCommit(payload: {
    sha: string;
    message: string;
    repository: Repository;
  }): Promise<void> {
    logger.info(`Processing commit ${payload.sha}: ${payload.message}`);

    // Extract automation instructions from commit message
    // This could trigger various automated tasks
  }

  private determineWorkflow(labels: string[], analysis: any): string {
    if (labels.includes("bug")) return "bug-fix";
    if (labels.includes("feature")) return "feature";
    if (labels.includes("refactor")) return "refactor";
    if (labels.includes("test")) return "test";

    // Use AI analysis to determine workflow if no clear label
    return analysis.suggestedWorkflow || "generic";
  }

  private async executeBugFixWorkflow(
    payload: IssuePayload,
    analysis: any
  ): Promise<void> {
    logger.info(`Executing bug fix workflow for issue #${payload.issueNumber}`);

    // Create a branch for the fix
    const branchName = `fix/issue-${payload.issueNumber}`;
    await this.githubService.createBranch(branchName, "main", payload.repository);

    // Generate the fix using AI
    const fix = await this.codeGenerator.generateBugFix(analysis);

    // Commit the fix
    for (const file of fix.files) {
      await this.githubService.commitFile(
        file.path,
        file.content,
        `Fix: ${payload.title} (#${payload.issueNumber})`,
        branchName,
        payload.repository
      );
    }

    // Create a pull request
    const prNumber = await this.githubService.createPullRequest(
      {
        title: `Fix: ${payload.title}`,
        body: `Fixes #${payload.issueNumber}\n\n## Changes\n${fix.description}\n\n## AI Analysis\n${analysis.summary}`,
        head: branchName,
        base: "main"
      },
      payload.repository
    );

    // Update the issue
    await this.githubService.createIssueComment(
      payload.issueNumber,
      `✅ **Bug fix implemented!**\n\n` +
      `A pull request has been created: #${prNumber}\n\n` +
      `**Changes made:**\n${fix.description}`,
      payload.repository
    );
  }

  private async executeFeatureWorkflow(
    payload: IssuePayload,
    analysis: any
  ): Promise<void> {
    logger.info(`Executing feature workflow for issue #${payload.issueNumber}`);

    // Create feature branch
    const branchName = `feature/issue-${payload.issueNumber}`;
    await this.githubService.createBranch(branchName, "main", payload.repository);

    // Generate feature implementation
    const feature = await this.codeGenerator.generateFeature(analysis);

    // Commit the implementation
    for (const file of feature.files) {
      await this.githubService.commitFile(
        file.path,
        file.content,
        `Feature: ${payload.title} (#${payload.issueNumber})`,
        branchName,
        payload.repository
      );
    }

    // Create PR
    const prNumber = await this.githubService.createPullRequest(
      {
        title: `Feature: ${payload.title}`,
        body: `Implements #${payload.issueNumber}\n\n## Feature Description\n${feature.description}`,
        head: branchName,
        base: "main"
      },
      payload.repository
    );

    await this.githubService.createIssueComment(
      payload.issueNumber,
      `🚀 **Feature implemented!**\n\nPR: #${prNumber}`,
      payload.repository
    );
  }

  private async executeRefactorWorkflow(
    payload: IssuePayload,
    analysis: any
  ): Promise<void> {
    logger.info(`Executing refactor workflow for issue #${payload.issueNumber}`);
    // Similar to feature workflow but focused on refactoring
  }

  private async executeTestWorkflow(
    payload: IssuePayload,
    analysis: any
  ): Promise<void> {
    logger.info(`Executing test workflow for issue #${payload.issueNumber}`);
    // Generate and commit tests
  }

  private async executeGenericWorkflow(
    payload: IssuePayload,
    analysis: any
  ): Promise<void> {
    logger.info(`Executing generic workflow for issue #${payload.issueNumber}`);

    await this.githubService.createIssueComment(
      payload.issueNumber,
      `📋 **Analysis Complete**\n\n${analysis.summary}\n\n` +
      `**Suggested actions:**\n${analysis.suggestions}`,
      payload.repository
    );
  }

  // Helper methods for specific commands
  private async generateTests(issueNumber: number, repository: Repository): Promise<void> {
    logger.info(`Generating tests for issue #${issueNumber}`);
    // Implementation
  }

  private async fixBug(issueNumber: number, description: string, repository: Repository): Promise<void> {
    logger.info(`Fixing bug for issue #${issueNumber}: ${description}`);
    // Implementation
  }

  private async implementFeature(issueNumber: number, feature: string, repository: Repository): Promise<void> {
    logger.info(`Implementing feature for issue #${issueNumber}: ${feature}`);
    // Implementation
  }

  private async refactorCode(issueNumber: number, target: string, repository: Repository): Promise<void> {
    logger.info(`Refactoring code for issue #${issueNumber}: ${target}`);
    // Implementation
  }

  private async reviewCode(issueNumber: number, repository: Repository): Promise<void> {
    logger.info(`Reviewing code for issue #${issueNumber}`);
    // Implementation
  }
}