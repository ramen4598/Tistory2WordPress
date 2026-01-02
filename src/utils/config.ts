import { config as dotenvConfig } from 'dotenv';
import { Config } from '../models/Config';
import { CategoryHierarchyOrder, LogLevel, DefaultConfig } from '../enums/config.enum';

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Loads and validates application configuration from environment variables
 * @throws {ConfigurationError} When required configuration is missing or invalid
 * @returns {Config} Validated configuration object
 */
export function loadConfig(): Config {
  // Load .env file into process.env
  dotenvConfig();

  // Validate and load required field: blogUrl
  const blogUrl = process.env['TISTORY_BLOG_URL'];
  if (!blogUrl) {
    throw new ConfigurationError(
      'TISTORY_BLOG_URL is required. Please set it in .env file or environment variables.'
    );
  }

  // Validate URL format
  try {
    new URL(blogUrl);
  } catch {
    throw new ConfigurationError(`TISTORY_BLOG_URL must be a valid URL. Got: ${blogUrl}`);
  }

  // Load optional fields with defaults
  const workerCount: number = process.env['WORKER_COUNT']
    ? parseInt(process.env['WORKER_COUNT'], 10)
    : DefaultConfig.WORKER_COUNT;

  const rateLimitPerWorker: number = process.env['RATE_LIMIT_PER_WORKER']
    ? parseInt(process.env['RATE_LIMIT_PER_WORKER'], 10)
    : DefaultConfig.RATE_LIMIT_PER_WORKER;
  const outputDir: string = process.env['OUTPUT_DIR'] || DefaultConfig.OUTPUT_DIR;

  const logLevel: LogLevel = (process.env['LOG_LEVEL'] as LogLevel) || DefaultConfig.LOG_LEVEL;

  const logFile: string | undefined = process.env['LOG_FILE'];

  // Optional fields for WP REST migration mode (005)
  const wpBaseUrl: string | undefined = process.env['WP_BASE_URL'];
  const wpAppUser: string | undefined = process.env['WP_APP_USER'];
  const wpAppPassword: string | undefined = process.env['WP_APP_PASSWORD'];

  const migrationDbPath: string = process.env['MIGRATION_DB_PATH'] || DefaultConfig.MIGRATION_DB_PATH;

  const maxRetryAttempts: number = process.env['MAX_RETRY_ATTEMPTS']
    ? parseInt(process.env['MAX_RETRY_ATTEMPTS'], 10)
    : DefaultConfig.MAX_RETRY_ATTEMPTS;
  const retryInitialDelayMs: number = process.env['RETRY_INITIAL_DELAY_MS']
    ? parseInt(process.env['RETRY_INITIAL_DELAY_MS'], 10)
    : DefaultConfig.RETRY_INITIAL_DELAY_MS;

  const retryMaxDelayMs: number = process.env['RETRY_MAX_DELAY_MS']
    ? parseInt(process.env['RETRY_MAX_DELAY_MS'], 10)
    : DefaultConfig.RETRY_MAX_DELAY_MS;
  const retryBackoffMultiplier: number = process.env['RETRY_BACKOFF_MULTIPLIER']
    ? parseFloat(process.env['RETRY_BACKOFF_MULTIPLIER'])
    : DefaultConfig.RETRY_BACKOFF_MULTIPLIER;

  // Load required CSS selectors for post metadata
  const postTitleSelector: string | undefined = process.env['TISTORY_SELECTOR_TITLE'];
  const postPublishDateSelector: string | undefined = process.env['TISTORY_SELECTOR_PUBLISH_DATE'];
  const postModifiedDateSelector: string | undefined = process.env['TISTORY_SELECTOR_MODIFIED_DATE'];
  const postCategorySelector: string | undefined = process.env['TISTORY_SELECTOR_CATEGORY'];
  const postTagSelector: string | undefined = process.env['TISTORY_SELECTOR_TAG'];
  const postListLinkSelector: string | undefined = process.env['TISTORY_SELECTOR_POST_LINK'];
  const postContentSelector: string | undefined = process.env['TISTORY_SELECTOR_CONTENT'];
  let categoryHierarchyOrder: CategoryHierarchyOrder;
  const rawCategoryHierarchyOrder: string | undefined = process.env['CATEGORY_HIERARCHY_ORDER'];
  if (rawCategoryHierarchyOrder === CategoryHierarchyOrder.FIRST_IS_PARENT) {
    categoryHierarchyOrder = CategoryHierarchyOrder.FIRST_IS_PARENT;
  } else if (rawCategoryHierarchyOrder === CategoryHierarchyOrder.LAST_IS_PARENT) {
    categoryHierarchyOrder = CategoryHierarchyOrder.LAST_IS_PARENT;
  } else {
    console.warn(
      `Invalid or missing CATEGORY_HIERARCHY_ORDER. Defaulting to "${CategoryHierarchyOrder.FIRST_IS_PARENT}".`
    );
    categoryHierarchyOrder =
      (DefaultConfig.CATEGORY_HIERARCHY_ORDER as unknown as CategoryHierarchyOrder) ||
      CategoryHierarchyOrder.FIRST_IS_PARENT;
  }

  if (!postTitleSelector) {
    throw new ConfigurationError(
      'TISTORY_SELECTOR_TITLE is required. Please set it in .env or environment variables.'
    );
  }

  if (!postPublishDateSelector) {
    throw new ConfigurationError(
      'TISTORY_SELECTOR_PUBLISH_DATE is required. Please set it in .env or environment variables.'
    );
  }

  if (!postModifiedDateSelector) {
    throw new ConfigurationError(
      'TISTORY_SELECTOR_MODIFIED_DATE is required. Please set it in .env or environment variables.'
    );
  }

  if (!postCategorySelector) {
    throw new ConfigurationError(
      'TISTORY_SELECTOR_CATEGORY is required. Please set it in .env or environment variables.'
    );
  }

  if (!postTagSelector) {
    throw new ConfigurationError(
      'TISTORY_SELECTOR_TAG is required. Please set it in .env or environment variables.'
    );
  }

  if (!postListLinkSelector) {
    throw new ConfigurationError(
      'TISTORY_SELECTOR_POST_LINK is required. Please set it in .env or environment variables.'
    );
  }

  if (!postContentSelector) {
    throw new ConfigurationError(
      'TISTORY_SELECTOR_CONTENT is required. Please set it in .env or environment variables.'
    );
  }

  // Validate numeric fields

  if (isNaN(workerCount) || workerCount < 1 || workerCount > 16) {
    throw new ConfigurationError(
      `WORKER_COUNT must be a number between 1 and 16. Got: ${process.env['WORKER_COUNT']}`
    );
  }

  if (isNaN(rateLimitPerWorker) || rateLimitPerWorker < 0) {
    throw new ConfigurationError(
      `RATE_LIMIT_PER_WORKER must be a positive number. Got: ${process.env['RATE_LIMIT_PER_WORKER']}`
    );
  }

  // Validate log level
  const validLogLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLogLevels.includes(logLevel)) {
    throw new ConfigurationError(
      `LOG_LEVEL must be one of: ${validLogLevels.join(', ')}. Got: ${logLevel}`
    );
  }

  // Validate retry config
  if (isNaN(maxRetryAttempts) || maxRetryAttempts < 0) {
    throw new ConfigurationError(
      `MAX_RETRY_ATTEMPTS must be a positive number. Got: ${process.env['MAX_RETRY_ATTEMPTS']}`
    );
  }

  if (isNaN(retryInitialDelayMs) || retryInitialDelayMs < 0) {
    throw new ConfigurationError(
      `RETRY_INITIAL_DELAY_MS must be a positive number. Got: ${process.env['RETRY_INITIAL_DELAY_MS']}`
    );
  }

  if (isNaN(retryMaxDelayMs) || retryMaxDelayMs < 0) {
    throw new ConfigurationError(
      `RETRY_MAX_DELAY_MS must be a positive number. Got: ${process.env['RETRY_MAX_DELAY_MS']}`
    );
  }

  if (isNaN(retryBackoffMultiplier) || retryBackoffMultiplier < 1) {
    throw new ConfigurationError(
      `RETRY_BACKOFF_MULTIPLIER must be a number >= 1. Got: ${process.env['RETRY_BACKOFF_MULTIPLIER']}`
    );
  }

  // If any WP_* variable is set, require all of them.
  if (!wpBaseUrl) {
    throw new ConfigurationError('WP_BASE_URL is required when using REST mode.');
  }
  try {
    new URL(wpBaseUrl);
  } catch {
    throw new ConfigurationError(`WP_BASE_URL must be a valid URL. Got: ${wpBaseUrl}`);
  }

  if (!wpAppUser) {
    throw new ConfigurationError('WP_APP_USER is required when using REST mode.');
  }

  if (!wpAppPassword) {
    throw new ConfigurationError('WP_APP_PASSWORD is required when using REST mode.');
  }

  return {
    blogUrl,
    workerCount,
    rateLimitPerWorker,
    outputDir,
    logLevel,
    logFile,

    wpBaseUrl,
    wpAppUser,
    wpAppPassword,
    migrationDbPath,

    maxRetryAttempts,
    retryInitialDelayMs,
    retryMaxDelayMs,
    retryBackoffMultiplier,

    postTitleSelector,
    postPublishDateSelector,
    postModifiedDateSelector,
    postCategorySelector,
    postTagSelector,
    postListLinkSelector,
    postContentSelector,
    categoryHierarchyOrder,
  };
}
