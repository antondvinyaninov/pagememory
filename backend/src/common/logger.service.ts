/**
 * Простой структурированный логгер для приложения
 * В будущем можно заменить на Winston или Pino
 */
export class LoggerService {
  private formatMessage(level: string, message: string, context?: string, error?: Error): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? `[${context}]` : "";
    const errorStr = error ? `\nError: ${error.message}\nStack: ${error.stack}` : "";
    return `${timestamp} ${level} ${contextStr} ${message}${errorStr}`;
  }

  log(message: string, context?: string): void {
    console.log(this.formatMessage("LOG", message, context));
  }

  error(message: string, error?: Error, context?: string): void {
    console.error(this.formatMessage("ERROR", message, context, error));
  }

  warn(message: string, context?: string): void {
    console.warn(this.formatMessage("WARN", message, context));
  }

  debug(message: string, context?: string): void {
    if (process.env.NODE_ENV === "development") {
      console.debug(this.formatMessage("DEBUG", message, context));
    }
  }
}

export const logger = new LoggerService();
