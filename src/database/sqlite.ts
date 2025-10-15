import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";
import { ensureDir } from "@std/fs/ensure_dir.ts";
import { dirname } from "@std/path/mod.ts";
import { config } from "../core/config.ts";
import { DatabaseError } from "../core/errors.ts";
import { logger } from "../core/logger.ts";
import type {
  WorkflowExecution,
  AIRequestLog,
  MetricRecord,
  WorkflowType,
} from "../core/types.ts";

/**
 * SQLite 데이터베이스 클래스
 */
export class SQLiteDatabase {
  private db: DB | null = null;
  private readonly dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || config.database.sqlite.path;
  }

  /**
   * 데이터베이스 초기화 및 연결
   */
  async initialize(): Promise<void> {
    try {
      // 데이터베이스 디렉토리 생성
      const dir = dirname(this.dbPath);
      await ensureDir(dir);

      // SQLite 데이터베이스 열기
      this.db = new DB(this.dbPath);

      // WAL 모드 활성화 (동시성 향상)
      if (config.database.sqlite.walMode) {
        this.db.query("PRAGMA journal_mode = WAL");
      }

      // 외래 키 제약 조건 활성화
      this.db.query("PRAGMA foreign_keys = ON");

      // 테이블 생성
      await this.createTables();

      logger.info(`SQLite database initialized at ${this.dbPath}`);
    } catch (error) {
      throw new DatabaseError(
        `Failed to initialize SQLite database: ${error instanceof Error ? error.message : "Unknown error"}`,
        "initialize"
      );
    }
  }

  /**
   * 테이블 생성
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new DatabaseError("Database not initialized");

    // 워크플로우 실행 기록 테이블
    this.db.query(`
      CREATE TABLE IF NOT EXISTS workflow_executions (
        id TEXT PRIMARY KEY,
        workflow_type TEXT NOT NULL,
        repository_id INTEGER NOT NULL,
        issue_number INTEGER,
        pr_number INTEGER,
        status TEXT NOT NULL DEFAULT 'pending',
        started_at DATETIME NOT NULL,
        completed_at DATETIME,
        duration INTEGER,
        result TEXT,
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_workflow_status (status),
        INDEX idx_workflow_type (workflow_type),
        INDEX idx_repository (repository_id)
      )
    `);

    // AI 요청 로그 테이블
    this.db.query(`
      CREATE TABLE IF NOT EXISTS ai_request_logs (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        operation TEXT NOT NULL,
        prompt_tokens INTEGER NOT NULL DEFAULT 0,
        completion_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        cost REAL NOT NULL DEFAULT 0.0,
        duration INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT,
        INDEX idx_provider (provider),
        INDEX idx_created_at (created_at)
      )
    `);

    // 메트릭 기록 테이블
    this.db.query(`
      CREATE TABLE IF NOT EXISTS metric_records (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        value REAL NOT NULL,
        unit TEXT NOT NULL,
        tags TEXT,
        timestamp DATETIME NOT NULL,
        INDEX idx_name (name),
        INDEX idx_timestamp (timestamp)
      )
    `);

    // Rate limit 추적 테이블
    this.db.query(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        identifier TEXT NOT NULL,
        window_start DATETIME NOT NULL,
        request_count INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (identifier, window_start)
      )
    `);

    // 작업 큐 상태 테이블 (영구 저장용)
    this.db.query(`
      CREATE TABLE IF NOT EXISTS job_queue (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        data TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'waiting',
        priority INTEGER NOT NULL DEFAULT 0,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME,
        failed_at DATETIME,
        error TEXT,
        result TEXT,
        INDEX idx_status (status),
        INDEX idx_priority (priority DESC),
        INDEX idx_created_at (created_at)
      )
    `);
  }

  /**
   * 워크플로우 실행 저장
   */
  async saveWorkflowExecution(execution: Omit<WorkflowExecution, "id">): Promise<string> {
    if (!this.db) throw new DatabaseError("Database not initialized");

    const id = crypto.randomUUID();

    try {
      this.db.query(
        `INSERT INTO workflow_executions
        (id, workflow_type, repository_id, issue_number, pr_number, status, started_at, completed_at, duration, result, error)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          execution.workflowType,
          execution.repositoryId,
          execution.issueNumber || null,
          execution.prNumber || null,
          execution.status,
          execution.startedAt.toISOString(),
          execution.completedAt?.toISOString() || null,
          execution.duration || null,
          execution.result ? JSON.stringify(execution.result) : null,
          execution.error || null,
        ]
      );

      return id;
    } catch (error) {
      throw new DatabaseError(
        `Failed to save workflow execution: ${error instanceof Error ? error.message : "Unknown error"}`,
        "insert"
      );
    }
  }

  /**
   * 워크플로우 실행 업데이트
   */
  async updateWorkflowExecution(
    id: string,
    updates: Partial<Omit<WorkflowExecution, "id">>
  ): Promise<void> {
    if (!this.db) throw new DatabaseError("Database not initialized");

    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.status) {
      fields.push("status = ?");
      values.push(updates.status);
    }
    if (updates.completedAt) {
      fields.push("completed_at = ?");
      values.push(updates.completedAt.toISOString());
    }
    if (updates.duration !== undefined) {
      fields.push("duration = ?");
      values.push(updates.duration);
    }
    if (updates.result) {
      fields.push("result = ?");
      values.push(JSON.stringify(updates.result));
    }
    if (updates.error) {
      fields.push("error = ?");
      values.push(updates.error);
    }

    if (fields.length === 0) return;

    values.push(id);

    try {
      this.db.query(
        `UPDATE workflow_executions SET ${fields.join(", ")} WHERE id = ?`,
        values as (string | number | boolean | null)[]
      );
    } catch (error) {
      throw new DatabaseError(
        `Failed to update workflow execution: ${error instanceof Error ? error.message : "Unknown error"}`,
        "update"
      );
    }
  }

  /**
   * 워크플로우 실행 조회
   */
  getWorkflowExecution(id: string): WorkflowExecution | null {
    if (!this.db) throw new DatabaseError("Database not initialized");

    try {
      const rows = this.db.query(
        `SELECT * FROM workflow_executions WHERE id = ?`,
        [id]
      );

      if (rows.length === 0) return null;

      const row = rows[0];
      return this.mapToWorkflowExecution(row);
    } catch (error) {
      throw new DatabaseError(
        `Failed to get workflow execution: ${error instanceof Error ? error.message : "Unknown error"}`,
        "select"
      );
    }
  }

  /**
   * 워크플로우 실행 목록 조회
   */
  getWorkflowExecutions(filters?: {
    workflowType?: WorkflowType;
    status?: string;
    limit?: number;
  }): WorkflowExecution[] {
    if (!this.db) throw new DatabaseError("Database not initialized");

    let query = "SELECT * FROM workflow_executions WHERE 1=1";
    const params: unknown[] = [];

    if (filters?.workflowType) {
      query += " AND workflow_type = ?";
      params.push(filters.workflowType);
    }

    if (filters?.status) {
      query += " AND status = ?";
      params.push(filters.status);
    }

    query += " ORDER BY started_at DESC";

    if (filters?.limit) {
      query += " LIMIT ?";
      params.push(filters.limit);
    }

    try {
      const rows = this.db.query(query, params as (string | number | boolean | null)[]);
      return rows.map((row) => this.mapToWorkflowExecution(row));
    } catch (error) {
      throw new DatabaseError(
        `Failed to get workflow executions: ${error instanceof Error ? error.message : "Unknown error"}`,
        "select"
      );
    }
  }

  /**
   * AI 요청 로그 저장
   */
  async saveAIRequestLog(log: Omit<AIRequestLog, "id">): Promise<string> {
    if (!this.db) throw new DatabaseError("Database not initialized");

    const id = crypto.randomUUID();

    try {
      this.db.query(
        `INSERT INTO ai_request_logs
        (id, provider, model, operation, prompt_tokens, completion_tokens, total_tokens, cost, duration, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          log.provider,
          log.model,
          log.operation,
          log.promptTokens,
          log.completionTokens,
          log.totalTokens,
          log.cost,
          log.duration,
          log.metadata ? JSON.stringify(log.metadata) : null,
        ]
      );

      return id;
    } catch (error) {
      throw new DatabaseError(
        `Failed to save AI request log: ${error instanceof Error ? error.message : "Unknown error"}`,
        "insert"
      );
    }
  }

  /**
   * AI 비용 통계 조회
   */
  getAICostStats(days: number = 30): {
    totalCost: number;
    totalTokens: number;
    totalRequests: number;
    byProvider: Record<string, { cost: number; tokens: number; requests: number }>;
  } {
    if (!this.db) throw new DatabaseError("Database not initialized");

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    try {
      const totalRow = this.db.query(
        `SELECT
          COALESCE(SUM(cost), 0) as total_cost,
          COALESCE(SUM(total_tokens), 0) as total_tokens,
          COUNT(*) as total_requests
        FROM ai_request_logs
        WHERE created_at >= ?`,
        [cutoffDate.toISOString()]
      )[0];

      const providerRows = this.db.query(
        `SELECT
          provider,
          COALESCE(SUM(cost), 0) as cost,
          COALESCE(SUM(total_tokens), 0) as tokens,
          COUNT(*) as requests
        FROM ai_request_logs
        WHERE created_at >= ?
        GROUP BY provider`,
        [cutoffDate.toISOString()]
      );

      const byProvider: Record<string, { cost: number; tokens: number; requests: number }> = {};
      for (const row of providerRows) {
        byProvider[row[0] as string] = {
          cost: row[1] as number,
          tokens: row[2] as number,
          requests: row[3] as number,
        };
      }

      return {
        totalCost: totalRow[0] as number,
        totalTokens: totalRow[1] as number,
        totalRequests: totalRow[2] as number,
        byProvider,
      };
    } catch (error) {
      throw new DatabaseError(
        `Failed to get AI cost stats: ${error instanceof Error ? error.message : "Unknown error"}`,
        "select"
      );
    }
  }

  /**
   * 메트릭 저장
   */
  async saveMetric(metric: Omit<MetricRecord, "id">): Promise<string> {
    if (!this.db) throw new DatabaseError("Database not initialized");

    const id = crypto.randomUUID();

    try {
      this.db.query(
        `INSERT INTO metric_records (id, name, value, unit, tags, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          id,
          metric.name,
          metric.value,
          metric.unit,
          JSON.stringify(metric.tags),
          metric.timestamp.toISOString(),
        ]
      );

      return id;
    } catch (error) {
      throw new DatabaseError(
        `Failed to save metric: ${error instanceof Error ? error.message : "Unknown error"}`,
        "insert"
      );
    }
  }

  /**
   * Rate limit 체크 및 업데이트
   */
  async checkRateLimit(identifier: string, limit: number, windowMs: number): Promise<{
    allowed: boolean;
    remaining: number;
    reset: Date;
  }> {
    if (!this.db) throw new DatabaseError("Database not initialized");

    const now = new Date();
    const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);

    try {
      // 현재 윈도우의 요청 수 조회
      const rows = this.db.query(
        `SELECT request_count FROM rate_limits WHERE identifier = ? AND window_start = ?`,
        [identifier, windowStart.toISOString()]
      );

      const currentCount = rows.length > 0 ? (rows[0][0] as number) : 0;

      if (currentCount >= limit) {
        const reset = new Date(windowStart.getTime() + windowMs);
        return {
          allowed: false,
          remaining: 0,
          reset,
        };
      }

      // 요청 수 증가
      if (rows.length > 0) {
        this.db.query(
          `UPDATE rate_limits SET request_count = request_count + 1
          WHERE identifier = ? AND window_start = ?`,
          [identifier, windowStart.toISOString()]
        );
      } else {
        this.db.query(
          `INSERT INTO rate_limits (identifier, window_start, request_count) VALUES (?, ?, 1)`,
          [identifier, windowStart.toISOString()]
        );
      }

      const reset = new Date(windowStart.getTime() + windowMs);
      return {
        allowed: true,
        remaining: limit - currentCount - 1,
        reset,
      };
    } catch (error) {
      throw new DatabaseError(
        `Failed to check rate limit: ${error instanceof Error ? error.message : "Unknown error"}`,
        "rate_limit"
      );
    }
  }

  /**
   * 오래된 데이터 정리
   */
  async cleanup(daysToKeep: number = 30): Promise<void> {
    if (!this.db) throw new DatabaseError("Database not initialized");

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    try {
      // 오래된 워크플로우 실행 삭제
      this.db.query(
        `DELETE FROM workflow_executions WHERE started_at < ?`,
        [cutoffDate.toISOString()]
      );

      // 오래된 AI 로그 삭제
      this.db.query(
        `DELETE FROM ai_request_logs WHERE created_at < ?`,
        [cutoffDate.toISOString()]
      );

      // 오래된 메트릭 삭제
      this.db.query(
        `DELETE FROM metric_records WHERE timestamp < ?`,
        [cutoffDate.toISOString()]
      );

      // 오래된 rate limit 기록 삭제
      this.db.query(
        `DELETE FROM rate_limits WHERE window_start < ?`,
        [cutoffDate.toISOString()]
      );

      logger.info(`Cleaned up records older than ${daysToKeep} days`);
    } catch (error) {
      throw new DatabaseError(
        `Failed to cleanup old data: ${error instanceof Error ? error.message : "Unknown error"}`,
        "cleanup"
      );
    }
  }

  /**
   * 데이터베이스 연결 종료
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.info("SQLite database connection closed");
    }
  }

  /**
   * Row를 WorkflowExecution 객체로 변환
   */
  private mapToWorkflowExecution(row: unknown[]): WorkflowExecution {
    return {
      id: row[0] as string,
      workflowType: row[1] as WorkflowType,
      repositoryId: row[2] as number,
      issueNumber: row[3] as number | undefined,
      prNumber: row[4] as number | undefined,
      status: row[5] as "pending" | "running" | "completed" | "failed",
      startedAt: new Date(row[6] as string),
      completedAt: row[7] ? new Date(row[7] as string) : undefined,
      duration: row[8] as number | undefined,
      result: row[9] ? JSON.parse(row[9] as string) : undefined,
      error: row[10] as string | undefined,
    };
  }
}

// 싱글톤 인스턴스
let dbInstance: SQLiteDatabase | null = null;

/**
 * SQLite 데이터베이스 인스턴스 가져오기
 */
export async function getDatabase(): Promise<SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = new SQLiteDatabase();
    await dbInstance.initialize();
  }
  return dbInstance;
}
