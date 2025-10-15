import { crypto } from "@std/crypto/mod.ts";
import { logger } from "../../core/logger.ts";
import { GitHubService } from "./github.service.ts";
import { AutomationService } from "../automation/automation.service.ts";

export class GitHubWebhookHandler {
  private githubService: GitHubService;
  private automationService: AutomationService;

  constructor() {
    this.githubService = new GitHubService();
    this.automationService = new AutomationService();
  }

  async verifySignature(payload: string, signature: string): Promise<boolean> {
    const secret = Deno.env.get("GITHUB_WEBHOOK_SECRET");
    if (!secret) {
      logger.error("GITHUB_WEBHOOK_SECRET not configured");
      return false;
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(payload)
    );

    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    const expectedSignature = `sha256=${hashHex}`;

    return signature === expectedSignature;
  }

  async handleEvent(eventType: string, payload: any): Promise<void> {
    logger.info(`Processing GitHub event: ${eventType}`);

    switch (eventType) {
      case "issues":
        await this.handleIssueEvent(payload);
        break;
      case "issue_comment":
        await this.handleIssueCommentEvent(payload);
        break;
      case "pull_request":
        await this.handlePullRequestEvent(payload);
        break;
      case "push":
        await this.handlePushEvent(payload);
        break;
      default:
        logger.debug(`Unhandled event type: ${eventType}`);
    }
  }

  private async handleIssueEvent(payload: any): Promise<void> {
    const { action, issue, repository } = payload;

    if (action === "opened") {
      logger.info(`New issue opened: #${issue.number} - ${issue.title}`);

      // Check if issue has automation labels
      const hasAutomationLabel = issue.labels?.some(
        (label: any) => label.name === "automate" || label.name === "ai-task"
      );

      if (hasAutomationLabel) {
        logger.info(`Triggering automation for issue #${issue.number}`);

        await this.automationService.processIssue({
          issueNumber: issue.number,
          title: issue.title,
          body: issue.body,
          labels: issue.labels.map((l: any) => l.name),
          repository: {
            owner: repository.owner.login,
            name: repository.name
          }
        });
      }
    }

    if (action === "labeled") {
      const newLabel = payload.label.name;

      if (newLabel === "automate" || newLabel === "ai-task") {
        logger.info(`Automation label added to issue #${issue.number}`);

        await this.automationService.processIssue({
          issueNumber: issue.number,
          title: issue.title,
          body: issue.body,
          labels: issue.labels.map((l: any) => l.name),
          repository: {
            owner: repository.owner.login,
            name: repository.name
          }
        });
      }
    }
  }

  private async handleIssueCommentEvent(payload: any): Promise<void> {
    const { action, issue, comment, repository } = payload;

    if (action === "created") {
      const commentBody = comment.body.toLowerCase();

      // Check for bot commands in comments
      if (commentBody.includes("@ai-dev") || commentBody.includes("/automate")) {
        logger.info(`Bot command detected in issue #${issue.number}`);

        // Parse command from comment
        const command = this.parseCommand(comment.body);

        if (command) {
          await this.automationService.executeCommand({
            command,
            issueNumber: issue.number,
            repository: {
              owner: repository.owner.login,
              name: repository.name
            }
          });
        }
      }
    }
  }

  private async handlePullRequestEvent(payload: any): Promise<void> {
    const { action, pull_request, repository } = payload;

    if (action === "opened" || action === "synchronize") {
      logger.info(`Pull request #${pull_request.number} ${action}`);

      // Auto-review if requested
      const hasAutoReviewLabel = pull_request.labels?.some(
        (label: any) => label.name === "auto-review"
      );

      if (hasAutoReviewLabel) {
        await this.automationService.reviewPullRequest({
          prNumber: pull_request.number,
          repository: {
            owner: repository.owner.login,
            name: repository.name
          }
        });
      }
    }
  }

  private async handlePushEvent(payload: any): Promise<void> {
    const { ref, commits, repository } = payload;

    logger.info(`Push to ${ref} with ${commits.length} commits`);

    // Check for automation triggers in commit messages
    for (const commit of commits) {
      if (commit.message.includes("[automate]") || commit.message.includes("[ai]")) {
        logger.info(`Automation trigger found in commit: ${commit.id}`);

        await this.automationService.processCommit({
          sha: commit.id,
          message: commit.message,
          repository: {
            owner: repository.owner.login,
            name: repository.name
          }
        });
      }
    }
  }

  private parseCommand(text: string): string | null {
    // Extract commands like "/automate fix-bug" or "@ai-dev generate-tests"
    const commandPatterns = [
      /\/automate\s+(.+)/i,
      /@ai-dev\s+(.+)/i
    ];

    for (const pattern of commandPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }
}