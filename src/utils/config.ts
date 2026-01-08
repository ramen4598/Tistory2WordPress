import { config as dotenvConfig } from 'dotenv';
import { Config } from '../models/Config';
import { CategoryHierarchyOrder, LogLevel } from '../enums/config.enum';

/**
 * Default configuration values
 * Change Config interface JSDoc defaults when modifying these
 */
const DEFAULT_CONFIG = {
  WORKER_COUNT: 1,
  RATE_LIMIT_INTERVAL: 60000, // 1 minute
  RATE_LIMIT_CAP: 1, // 1 request per interval
  OUTPUT_DIR: './output',
  LOG_LEVEL: LogLevel.INFO,
  CATEGORY_HIERARCHY_ORDER: CategoryHierarchyOrder.FIRST_IS_PARENT,
  MIGRATION_DB_PATH: './data/migration.db',
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_INITIAL_DELAY_MS: 500,
  RETRY_MAX_DELAY_MS: 10000,
  RETRY_BACKOFF_MULTIPLIER: 2,
  BOOKMARK_TEMPLATE_PATH: './src/templates/bookmark-template.html',
};

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

// Cached configuration after first load
let cachedConfig: Config | null = null;

/**
 * Loads and validates application configuration from environment variables
 * Caches the configuration after the first load to avoid redundant parsing
 * @throws {ConfigurationError} When required configuration is missing or invalid
 * @returns {Config} Validated configuration object
 */
export function loadConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

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
    : DEFAULT_CONFIG.WORKER_COUNT;

  const rateLimitInterval: number = process.env['RATE_LIMIT_INTERVAL']
    ? parseInt(process.env['RATE_LIMIT_INTERVAL'], 10)
    : DEFAULT_CONFIG.RATE_LIMIT_INTERVAL;

  const rateLimitCap: number = process.env['RATE_LIMIT_CAP']
    ? parseInt(process.env['RATE_LIMIT_CAP'], 10)
    : DEFAULT_CONFIG.RATE_LIMIT_CAP;

  const outputDir: string = process.env['OUTPUT_DIR'] || DEFAULT_CONFIG.OUTPUT_DIR;

  const logLevel: LogLevel = (process.env['LOG_LEVEL'] as LogLevel) || DEFAULT_CONFIG.LOG_LEVEL;

  const logFile: string | undefined = process.env['LOG_FILE'];

  // Optional fields for WP REST migration mode (005)
  const wpBaseUrl: string | undefined = process.env['WP_BASE_URL'];
  const wpAppUser: string | undefined = process.env['WP_APP_USER'];
  const wpAppPassword: string | undefined = process.env['WP_APP_PASSWORD'];

  const migrationDbPath: string =
    process.env['MIGRATION_DB_PATH'] || DEFAULT_CONFIG.MIGRATION_DB_PATH;

  const maxRetryAttempts: number = process.env['MAX_RETRY_ATTEMPTS']
    ? parseInt(process.env['MAX_RETRY_ATTEMPTS'], 10)
    : DEFAULT_CONFIG.MAX_RETRY_ATTEMPTS;
  const retryInitialDelayMs: number = process.env['RETRY_INITIAL_DELAY_MS']
    ? parseInt(process.env['RETRY_INITIAL_DELAY_MS'], 10)
    : DEFAULT_CONFIG.RETRY_INITIAL_DELAY_MS;

  const retryMaxDelayMs: number = process.env['RETRY_MAX_DELAY_MS']
    ? parseInt(process.env['RETRY_MAX_DELAY_MS'], 10)
    : DEFAULT_CONFIG.RETRY_MAX_DELAY_MS;
  const retryBackoffMultiplier: number = process.env['RETRY_BACKOFF_MULTIPLIER']
    ? parseFloat(process.env['RETRY_BACKOFF_MULTIPLIER'])
    : DEFAULT_CONFIG.RETRY_BACKOFF_MULTIPLIER;

  // Load required CSS selectors for post metadata
  const postTitleSelector: string | undefined = process.env['TISTORY_SELECTOR_TITLE'];
  const postPublishDateSelector: string | undefined = process.env['TISTORY_SELECTOR_PUBLISH_DATE'];
  const postModifiedDateSelector: string | undefined =
    process.env['TISTORY_SELECTOR_MODIFIED_DATE'];
  const postCategorySelector: string | undefined = process.env['TISTORY_SELECTOR_CATEGORY'];
  const postTagSelector: string | undefined = process.env['TISTORY_SELECTOR_TAG'];
  const postListLinkSelector: string | undefined = process.env['TISTORY_SELECTOR_POST_LINK'];
  const postContentSelector: string | undefined = process.env['TISTORY_SELECTOR_CONTENT'];
  const postFeaturedImageSelector: string | undefined =
    process.env['TISTORY_SELECTOR_FEATURED_IMAGE'];

  const bookmarkSelector: string | undefined = process.env['TISTORY_BOOKMARK_SELECTOR'];
  const bookmarkTemplatePath: string =
    process.env['TISTORY_BOOKMARK_TEMPLATE_PATH'] ?? DEFAULT_CONFIG.BOOKMARK_TEMPLATE_PATH;

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
      DEFAULT_CONFIG.CATEGORY_HIERARCHY_ORDER || CategoryHierarchyOrder.FIRST_IS_PARENT;
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

  if (!postFeaturedImageSelector) {
    throw new ConfigurationError(
      'TISTORY_SELECTOR_FEATURED_IMAGE is required. Please set it in .env or environment variables.'
    );
  }

  if (!bookmarkSelector || bookmarkSelector.length === 0 || bookmarkSelector.length > 200) {
    throw new ConfigurationError(
      'TISTORY_BOOKMARK_SELECTOR must be a non-empty string with length <= 200.'
    );
  }

  // Validate numeric fields

  if (isNaN(workerCount) || workerCount < 1 || workerCount > 16) {
    throw new ConfigurationError(
      `WORKER_COUNT must be a number between 1 and 16. Got: ${process.env['WORKER_COUNT']}`
    );
  }

  if (isNaN(rateLimitInterval) || rateLimitInterval <= 0) {
    throw new ConfigurationError(
      `RATE_LIMIT_INTERVAL must be a positive number. Got: ${process.env['RATE_LIMIT_INTERVAL']}`
    );
  }

  if (isNaN(rateLimitCap) || rateLimitCap <= 0) {
    throw new ConfigurationError(
      `RATE_LIMIT_CAP must be a positive number. Got: ${process.env['RATE_LIMIT_CAP']}`
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

  const config: Config = {
    blogUrl,
    workerCount,
    rateLimitInterval,
    rateLimitCap,
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
    postFeaturedImageSelector,
    bookmarkSelector,
    bookmarkTemplatePath,
  };

  cachedConfig = config;
  return config;
}
