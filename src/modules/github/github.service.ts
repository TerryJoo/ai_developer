import { Octokit } from "https://esm.sh/@octokit/rest@20.1.1";
import { logger } from "../../core/logger.ts";

export interface Repository {
  owner: string;
  name: string;
}

export interface IssueData {
  number: number;
  title: string;
  body: string;
  labels: string[];
}

export interface PullRequestData {
  number: number;
  title: string;
  body: string;
  head: string;
  base: string;
}

export class GitHubService {
  private octokit: Octokit;
  private defaultOwner: string;
  private defaultRepo: string;

  constructor() {
    const token = Deno.env.get("GITHUB_TOKEN");
    if (!token) {
      throw new Error("GITHUB_TOKEN is required");
    }

    this.octokit = new Octokit({ auth: token });
    this.defaultOwner = Deno.env.get("GITHUB_OWNER") || "";
    this.defaultRepo = Deno.env.get("GITHUB_REPO") || "";
  }

  async createIssueComment(
    issueNumber: number,
    comment: string,
    repository?: Repository
  ): Promise<void> {
    const owner = repository?.owner || this.defaultOwner;
    const repo = repository?.name || this.defaultRepo;

    try {
      await this.octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: comment
      });

      logger.info(`Comment added to issue #${issueNumber}`);
    } catch (error) {
      logger.error(`Failed to create comment on issue #${issueNumber}:`, error);
      throw error;
    }
  }

  async createPullRequest(
    data: {
      title: string;
      body: string;
      head: string;
      base: string;
    },
    repository?: Repository
  ): Promise<number> {
    const owner = repository?.owner || this.defaultOwner;
    const repo = repository?.name || this.defaultRepo;

    try {
      const response = await this.octokit.pulls.create({
        owner,
        repo,
        title: data.title,
        body: data.body,
        head: data.head,
        base: data.base
      });

      logger.info(`Pull request #${response.data.number} created`);
      return response.data.number;
    } catch (error) {
      logger.error("Failed to create pull request:", error);
      throw error;
    }
  }

  async createBranch(
    branchName: string,
    baseBranch: string = "main",
    repository?: Repository
  ): Promise<void> {
    const owner = repository?.owner || this.defaultOwner;
    const repo = repository?.name || this.defaultRepo;

    try {
      // Get the SHA of the base branch
      const { data: refData } = await this.octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${baseBranch}`
      });

      // Create the new branch
      await this.octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha: refData.object.sha
      });

      logger.info(`Branch '${branchName}' created from '${baseBranch}'`);
    } catch (error) {
      logger.error(`Failed to create branch '${branchName}':`, error);
      throw error;
    }
  }

  async commitFile(
    path: string,
    content: string,
    message: string,
    branch: string,
    repository?: Repository
  ): Promise<void> {
    const owner = repository?.owner || this.defaultOwner;
    const repo = repository?.name || this.defaultRepo;

    try {
      // Check if file exists
      let sha: string | undefined;
      try {
        const { data: fileData } = await this.octokit.repos.getContent({
          owner,
          repo,
          path,
          ref: branch
        });

        if (!Array.isArray(fileData) && "sha" in fileData) {
          sha = fileData.sha;
        }
      } catch {
        // File doesn't exist, will create new
      }

      // Create or update file
      await this.octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: btoa(content), // Base64 encode
        branch,
        sha
      });

      logger.info(`File '${path}' committed to branch '${branch}'`);
    } catch (error) {
      logger.error(`Failed to commit file '${path}':`, error);
      throw error;
    }
  }

  async getIssue(
    issueNumber: number,
    repository?: Repository
  ): Promise<IssueData> {
    const owner = repository?.owner || this.defaultOwner;
    const repo = repository?.name || this.defaultRepo;

    try {
      const { data } = await this.octokit.issues.get({
        owner,
        repo,
        issue_number: issueNumber
      });

      return {
        number: data.number,
        title: data.title,
        body: data.body || "",
        labels: data.labels.map((l: any) =>
          typeof l === "string" ? l : l.name
        )
      };
    } catch (error) {
      logger.error(`Failed to get issue #${issueNumber}:`, error);
      throw error;
    }
  }

  async addLabels(
    issueNumber: number,
    labels: string[],
    repository?: Repository
  ): Promise<void> {
    const owner = repository?.owner || this.defaultOwner;
    const repo = repository?.name || this.defaultRepo;

    try {
      await this.octokit.issues.addLabels({
        owner,
        repo,
        issue_number: issueNumber,
        labels
      });

      logger.info(`Labels added to issue #${issueNumber}: ${labels.join(", ")}`);
    } catch (error) {
      logger.error(`Failed to add labels to issue #${issueNumber}:`, error);
      throw error;
    }
  }

  async createReview(
    prNumber: number,
    comments: Array<{ path: string; line: number; body: string }>,
    event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT",
    repository?: Repository
  ): Promise<void> {
    const owner = repository?.owner || this.defaultOwner;
    const repo = repository?.name || this.defaultRepo;

    try {
      await this.octokit.pulls.createReview({
        owner,
        repo,
        pull_number: prNumber,
        event,
        comments
      });

      logger.info(`Review submitted for PR #${prNumber}`);
    } catch (error) {
      logger.error(`Failed to create review for PR #${prNumber}:`, error);
      throw error;
    }
  }
}