import { format } from "@std/datetime/mod.ts";

export class Logger {
  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss");
    const formattedArgs = args.length > 0 ? JSON.stringify(args) : "";
    return `[${timestamp}] [${level}] ${message} ${formattedArgs}`;
  }

  info(message: string, ...args: any[]) {
    console.log(this.formatMessage("INFO", message, ...args));
  }

  error(message: string, ...args: any[]) {
    console.error(this.formatMessage("ERROR", message, ...args));
  }

  warn(message: string, ...args: any[]) {
    console.warn(this.formatMessage("WARN", message, ...args));
  }

  debug(message: string, ...args: any[]) {
    if (Deno.env.get("ENV") === "development") {
      console.debug(this.formatMessage("DEBUG", message, ...args));
    }
  }
}

export const logger = new Logger();