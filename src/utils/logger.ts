import * as fs from 'fs';
import * as path from 'path';

/**
 * Log level enumeration
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  logFile?: string;
}

/**
 * Log level priority for filtering
 */
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Logger utility for console and file logging
 * Supports log levels: debug, info, warn, error
 */
export class Logger {
  private level: LogLevel;
  private logFile?: string;
  private fileStream?: fs.WriteStream;

  constructor(config: LoggerConfig) {
    this.level = config.level;
    this.logFile = config.logFile;

    // Initialize file stream if logFile is provided
    if (this.logFile) {
      this.initFileStream();
    }
  }

  /**
   * Initialize file stream for logging
   * Creates parent directory if it doesn't exist
   */
  private initFileStream(): void {
    if (!this.logFile) return;

    try {
      // Ensure parent directory exists
      const dir = path.dirname(this.logFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Create append stream
      this.fileStream = fs.createWriteStream(this.logFile, { flags: 'a' });
    } catch (error) {
      console.error(`Failed to initialize log file: ${this.logFile}`, error);
    }
  }

  /**
   * Check if a log level should be logged based on current log level
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  /**
   * Format log message with timestamp and level
   */
  private formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs =
      args.length > 0 ? ' ' + args.map((arg) => JSON.stringify(arg)).join(' ') : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${formattedArgs}`;
  }

  /**
   * Write log message to console and file
   */
  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, ...args);

    // Console output
    switch (level) {
      case 'debug':
        console.debug(formattedMessage);
        break;
      case 'info':
        console.info(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'error':
        console.error(formattedMessage);
        break;
    }

    // File output
    if (this.fileStream) {
      this.fileStream.write(formattedMessage + '\n');
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, ...args);
  }

  /**
   * Log info message
   */
  info(message: string, ...args: unknown[]): void {
    this.log('info', message, ...args);
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, ...args);
  }

  /**
   * Log error message
   */
  error(message: string, ...args: unknown[]): void {
    this.log('error', message, ...args);
  }

  /**
   * Close file stream (call on application exit)
   */
  close(): void {
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = undefined;
    }
  }
}

/**
 * Global logger instance
 */
let globalLogger: Logger | null = null;

/**
 * Initialize global logger with configuration
 */
export function initLogger(config: LoggerConfig): Logger {
  if (globalLogger) {
    globalLogger.close();
  }
  globalLogger = new Logger(config);
  return globalLogger;
}

/**
 * Get global logger instance
 * @throws Error if logger is not initialized
 */
export function getLogger(): Logger {
  if (!globalLogger) {
    throw new Error('Logger not initialized. Call initLogger() first.');
  }
  return globalLogger;
}

/**
 * Close global logger (call on application exit)
 */
export function closeLogger(): void {
  if (globalLogger) {
    globalLogger.close();
    globalLogger = null;
  }
}
