import { CategoryHierarchyOrder } from '../enums/config.enum';
import { LogLevel } from '../utils/logger';

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
   * WordPress site base URL (REST root is derived from this)
   * @example "https://example.com"
   */
  wpBaseUrl: string;

  /**
   * WordPress Application Password username
   */
  wpAppUser: string;

  /**
   * WordPress Application Password value
   */
  wpAppPassword: string;

  /**
   * SQLite DB file path for REST migration state
   * @default DefaultConfig.MIGRATION_DB_PATH
   */
  migrationDbPath: string;

  /**
   * Maximum retry attempts for transient HTTP errors
   * @default DefaultConfig.MAX_RETRY_ATTEMPTS
   */
  maxRetryAttempts: number;

  /**
   * Initial retry delay in milliseconds
   * @default DefaultConfig.RETRY_INITIAL_DELAY_MS
   */
  retryInitialDelayMs: number;

  /**
   * Maximum retry delay in milliseconds
   * @default DefaultConfig.RETRY_MAX_DELAY_MS
   */
  retryMaxDelayMs: number;

  /**
   * Backoff multiplier for retries
   * @default DefaultConfig.RETRY_BACKOFF_MULTIPLIER
   */
  retryBackoffMultiplier: number;

  /**
   * Number of concurrent workers for parallel processing
   * @default DefaultConfig.WORKER_COUNT
   * @min 1
   * @max 16
   */
  workerCount: number;

  /**
   * Rate limit per worker in milliseconds
   * @default DefaultConfig.RATE_LIMIT_PER_WORKER
   */
  rateLimitPerWorker: number;

  /**
   * Output directory path for generated files
   * @default DefaultConfig.OUTPUT_DIR
   */
  outputDir: string;

  /**
   * Log level for logging
   * @default DefaultConfig.LOG_LEVEL
   */
  logLevel: LogLevel;

  /**
   * Log file path (optional)
   * If not set, logs only to console
   */
  logFile?: string;

  /**
   * CSS selector for post title element
   * e.g. meta[name="title"]
   */
  postTitleSelector: string;

  /**
   * CSS selector for post publish date element
   * e.g. meta[property="article:published_time"]
   */
  postPublishDateSelector: string;

  /**
   * CSS selector for post modified date element
   * e.g. meta[property="article:modified_time"]
   */
  postModifiedDateSelector: string;

  /**
   * CSS selector for post category elements
   * e.g. div.another_category h4 a
   */
  postCategorySelector: string;

  /**
   * CSS selector for post tag elements
   * e.g. div.area_tag a[rel="tag"]
   */
  postTagSelector: string;

  /**
   * CSS selector for the root element containing post content HTML.
   * Only HTML under this element will be cleaned and exported to WXR.
   * e.g. div.tt_article_useless_p_margin.contents_style
   */
  postContentSelector: string;

  /**
   * CSS selector for post links on list/archive pages
   * e.g. a.link_category
   */
  postListLinkSelector: string;

  /**
   * Category hierarchy order when two categories are present.
   * - "first-is-parent": first crawled category is parent
   * - "last-is-parent": last crawled category is parent
   * Defaults to "first-is-parent" when not specified or invalid.
   * @default DefaultConfig.CATEGORY_HIERARCHY_ORDER
   */
  categoryHierarchyOrder: CategoryHierarchyOrder;
}
