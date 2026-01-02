/**
 * Category hierarchy order options
 */
export enum CategoryHierarchyOrder {
  FIRST_IS_PARENT = 'first-is-parent',
  LAST_IS_PARENT = 'last-is-parent',
}

/**
 * Log level options
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

/**
 * Default configuration values
 */
export enum DefaultConfig {
  WORKER_COUNT = 4,
  RATE_LIMIT_PER_WORKER = 1000,
  OUTPUT_DIR = './output',
  LOG_LEVEL = LogLevel.INFO,
  CATEGORY_HIERARCHY_ORDER = CategoryHierarchyOrder.FIRST_IS_PARENT,

  MIGRATION_DB_PATH = './data/migration.db',
  MAX_RETRY_ATTEMPTS = 3,
  RETRY_INITIAL_DELAY_MS = 500,
  RETRY_MAX_DELAY_MS = 10000,
  RETRY_BACKOFF_MULTIPLIER = 2,
}
