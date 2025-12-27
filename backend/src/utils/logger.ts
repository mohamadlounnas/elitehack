/**
 * Simple but comprehensive logging utility
 * Provides structured logging with timestamps, log levels, and context
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: any;
}

class Logger {
  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = this.formatTimestamp();
    const contextStr = context ? ` ${JSON.stringify(context)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    // Only log errors and exceptions
    if (level !== "error") {
      return;
    }
    
    const formatted = this.formatMessage(level, message, context);
    console.error(formatted);
  }

  debug(message: string, context?: LogContext): void {
    // Silently ignore debug logs
  }

  info(message: string, context?: LogContext): void {
    // Silently ignore info logs
  }

  warn(message: string, context?: LogContext): void {
    // Silently ignore warn logs
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    let errorDetails: LogContext = {};
    
    if (error instanceof Error) {
      errorDetails = {
        error: error.message,
        stack: error.stack,
        name: error.name,
      };
    } else if (error && typeof error === 'object') {
      // Handle Supabase and other structured error objects
      const err = error as any;
      errorDetails = {
        error: err.message || err.error || JSON.stringify(err),
        code: err.code,
        details: err.details,
        hint: err.hint,
        // Include all enumerable properties
        ...Object.fromEntries(
          Object.entries(err).filter(([key]) => 
            !['message', 'code', 'details', 'hint'].includes(key)
          )
        ),
      };
    } else {
      errorDetails = { error: String(error) };
    }
    
    const errorContext: LogContext = {
      ...context,
      ...errorDetails,
    };
    this.log("error", message, errorContext);
  }

  /**
   * Log HTTP request
   */
  request(method: string, path: string, statusCode?: number, duration?: number, context?: LogContext): void {
    const msg = `${method} ${path}${statusCode ? ` ${statusCode}` : ""}${duration ? ` ${duration}ms` : ""}`;
    this.info(msg, context);
  }

  /**
   * Log database operation
   */
  db(operation: string, table: string, context?: LogContext): void {
    this.debug(`DB ${operation} on ${table}`, context);
  }

  /**
   * Log AI operation
   */
  ai(operation: string, model?: string, context?: LogContext): void {
    this.info(`AI ${operation}${model ? ` (${model})` : ""}`, context);
  }

  /**
   * Log workflow step
   */
  workflow(step: string, projectId: string, context?: LogContext): void {
    this.info(`Workflow: ${step}`, { projectId, ...context });
  }
}

export const logger = new Logger();

