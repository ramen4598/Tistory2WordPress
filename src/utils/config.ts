import { config as dotenvConfig } from 'dotenv';
import { Config, DEFAULT_CONFIG, CategoryHierarchyOrder } from '../models/Config';

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
  const workerCount = process.env['WORKER_COUNT']
    ? parseInt(process.env['WORKER_COUNT'], 10)
    : (DEFAULT_CONFIG.workerCount ?? 4);

  const rateLimitPerWorker = process.env['RATE_LIMIT_PER_WORKER']
    ? parseInt(process.env['RATE_LIMIT_PER_WORKER'], 10)
    : (DEFAULT_CONFIG.rateLimitPerWorker ?? 1000);

  const outputDir = process.env['OUTPUT_DIR'] || DEFAULT_CONFIG.outputDir || './output';

  const downloadsDir =
    process.env['DOWNLOADS_DIR'] || DEFAULT_CONFIG.downloadsDir || './output/downloads';

  const logLevel = (process.env['LOG_LEVEL'] ||
    DEFAULT_CONFIG.logLevel ||
    'info') as Config['logLevel'];

  const logFile = process.env['LOG_FILE'];

  // Load required CSS selectors for post metadata
  const postTitleSelector = process.env['TISTORY_SELECTOR_TITLE'];
  const postPublishDateSelector = process.env['TISTORY_SELECTOR_PUBLISH_DATE'];
  const postModifiedDateSelector = process.env['TISTORY_SELECTOR_MODIFIED_DATE'];
  const postCategorySelector = process.env['TISTORY_SELECTOR_CATEGORY'];
  const postTagSelector = process.env['TISTORY_SELECTOR_TAG'];
  const postListLinkSelector = process.env['TISTORY_SELECTOR_POST_LINK'];
  const postContentSelector = process.env['TISTORY_SELECTOR_CONTENT'];

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
      DEFAULT_CONFIG.categoryHierarchyOrder || CategoryHierarchyOrder.FIRST_IS_PARENT;
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

  return {
    blogUrl,
    workerCount,
    rateLimitPerWorker,
    outputDir,
    downloadsDir,
    logLevel,
    logFile,
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
