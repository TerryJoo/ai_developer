import { format } from "@std/datetime/mod.ts";
import { ensureDir } from "@std/fs/ensure_dir.ts";
import { dirname } from "@std/path/mod.ts";

/**
 * 로그 레벨
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * 로그 엔트리
 */
export interface LogEntry {
  timestamp: Date;
  level: string;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
}

/**
 * 로거 설정
 */
export interface LoggerConfig {
  level: LogLevel;
  filePath?: string;
  maxSize?: number; // 바이트
  maxFiles?: number;
  enableConsole?: boolean;
  enableFile?: boolean;
  structured?: boolean; // JSON 형식
}

/**
 * 강화된 로거 클래스
 */
export class Logger {
  private config: LoggerConfig;
  private fileHandle: Deno.FsFile | null = null;
  private currentFileSize = 0;
  private fileIndex = 0;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableFile: false,
      structured: false,
      maxSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      ...config,
    };
  }

  /**
   * 로거 초기화 (파일 로깅 활성화 시)
   */
  async initialize(): Promise<void> {
    if (this.config.enableFile && this.config.filePath) {
      await this.openLogFile();
    }
  }

  /**
   * 로그 파일 열기
   */
  private async openLogFile(): Promise<void> {
    if (!this.config.filePath) return;

    try {
      const dir = dirname(this.config.filePath);
      await ensureDir(dir);

      // 기존 파일 크기 확인
      try {
        const stat = await Deno.stat(this.config.filePath);
        this.currentFileSize = stat.size;

        // 파일 크기가 최대치를 초과하면 로테이션
        if (this.currentFileSize >= (this.config.maxSize || 0)) {
          await this.rotateLogFile();
        }
      } catch {
        // 파일이 없으면 새로 생성
        this.currentFileSize = 0;
      }

      // 파일 핸들 열기 (append 모드)
      this.fileHandle = await Deno.open(this.config.filePath, {
        create: true,
        append: true,
        write: true,
      });
    } catch (error) {
      console.error("Failed to open log file:", error);
    }
  }

  /**
   * 로그 파일 로테이션
   */
  private async rotateLogFile(): Promise<void> {
    if (!this.config.filePath) return;

    try {
      // 기존 파일 핸들 닫기
      if (this.fileHandle) {
        this.fileHandle.close();
        this.fileHandle = null;
      }

      // 최대 파일 수만큼만 유지
      const maxFiles = this.config.maxFiles || 5;
      for (let i = maxFiles - 1; i > 0; i--) {
        const oldPath = `${this.config.filePath}.${i}`;
        const newPath = `${this.config.filePath}.${i + 1}`;

        try {
          await Deno.rename(oldPath, newPath);
        } catch {
          // 파일이 없으면 무시
        }
      }

      // 현재 파일을 .1로 이동
      await Deno.rename(this.config.filePath, `${this.config.filePath}.1`);

      // 새 파일 열기
      this.currentFileSize = 0;
      this.fileHandle = await Deno.open(this.config.filePath, {
        create: true,
        write: true,
        truncate: true,
      });
    } catch (error) {
      console.error("Failed to rotate log file:", error);
    }
  }

  /**
   * 로그 메시지 포맷팅
   */
  private formatMessage(entry: LogEntry): string {
    const timestamp = format(entry.timestamp, "yyyy-MM-dd HH:mm:ss.SSS");

    if (this.config.structured) {
      // JSON 형식
      return JSON.stringify({
        timestamp: entry.timestamp.toISOString(),
        level: entry.level,
        message: entry.message,
        context: entry.context,
        error: entry.error ? {
          name: entry.error.name,
          message: entry.error.message,
          stack: entry.error.stack,
        } : undefined,
      });
    } else {
      // 텍스트 형식
      let formatted = `[${timestamp}] [${entry.level}] ${entry.message}`;

      if (entry.context && Object.keys(entry.context).length > 0) {
        formatted += ` ${JSON.stringify(entry.context)}`;
      }

      if (entry.error) {
        formatted += `\n  Error: ${entry.error.message}`;
        if (entry.error.stack) {
          formatted += `\n${entry.error.stack}`;
        }
      }

      return formatted;
    }
  }

  /**
   * 로그 출력
   */
  private async log(level: LogLevel, levelName: string, message: string, context?: Record<string, unknown>, error?: Error): Promise<void> {
    // 로그 레벨 필터링
    if (level < this.config.level) return;

    const entry: LogEntry = {
      timestamp: new Date(),
      level: levelName,
      message,
      context,
      error,
    };

    const formatted = this.formatMessage(entry);

    // 콘솔 출력
    if (this.config.enableConsole) {
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formatted);
          break;
        case LogLevel.INFO:
          console.log(formatted);
          break;
        case LogLevel.WARN:
          console.warn(formatted);
          break;
        case LogLevel.ERROR:
          console.error(formatted);
          break;
      }
    }

    // 파일 출력
    if (this.config.enableFile && this.fileHandle) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(formatted + "\n");

        await this.fileHandle.write(data);
        this.currentFileSize += data.length;

        // 파일 크기 확인 및 로테이션
        if (this.currentFileSize >= (this.config.maxSize || 0)) {
          await this.rotateLogFile();
        }
      } catch (error) {
        console.error("Failed to write to log file:", error);
      }
    }
  }

  /**
   * Debug 로그
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, "DEBUG", message, context);
  }

  /**
   * Info 로그
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, "INFO", message, context);
  }

  /**
   * Warning 로그
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, "WARN", message, context);
  }

  /**
   * Error 로그
   */
  error(message: string, errorOrContext?: Error | Record<string, unknown>, context?: Record<string, unknown>): void {
    let error: Error | undefined;
    let ctx: Record<string, unknown> | undefined;

    if (errorOrContext instanceof Error) {
      error = errorOrContext;
      ctx = context;
    } else {
      ctx = errorOrContext;
    }

    this.log(LogLevel.ERROR, "ERROR", message, ctx, error);
  }

  /**
   * 로그 레벨 설정
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * 로거 종료 (파일 핸들 닫기)
   */
  async close(): Promise<void> {
    if (this.fileHandle) {
      this.fileHandle.close();
      this.fileHandle = null;
    }
  }
}

/**
 * 기본 로거 인스턴스
 */
export const logger = new Logger({
  level: LogLevel.INFO,
  enableConsole: true,
  enableFile: false,
});

/**
 * 환경 변수에서 로그 레벨 파싱
 */
export function parseLogLevel(level: string): LogLevel {
  switch (level.toLowerCase()) {
    case "debug":
      return LogLevel.DEBUG;
    case "info":
      return LogLevel.INFO;
    case "warn":
    case "warning":
      return LogLevel.WARN;
    case "error":
      return LogLevel.ERROR;
    default:
      return LogLevel.INFO;
  }
}