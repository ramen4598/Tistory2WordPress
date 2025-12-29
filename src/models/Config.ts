/**
 * Application configuration interface
 * Loaded from environment variables via dotenv
 */
export interface Config {
  /**
   * Tistory blog URL (required)
   * @example "https://yourblog.tistory.com"
   */
  blogUrl: string;

  /**
   * Number of concurrent workers for parallel processing
   * @default 4
   * @min 1
   * @max 16
   */
  workerCount: number;

  /**
   * Rate limit per worker in milliseconds
   * @default 1000 (1 request per second)
   */
  rateLimitPerWorker: number;

  /**
   * Output directory path for generated files
   * @default "./output"
   */
  outputDir: string;

  /**
   * Downloads directory path for attachments
   * @default "./output/downloads"
   */
  downloadsDir: string;

  /**
   * Log level for logging
   * @default "info"
   */
  logLevel: 'debug' | 'info' | 'warn' | 'error';

  /**
   * Log file path (optional)
   * If not set, logs only to console
   */
  logFile?: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Partial<Config> = {
  workerCount: 4,
  rateLimitPerWorker: 1000,
  outputDir: './output',
  downloadsDir: './output/downloads',
  logLevel: 'info',
};
