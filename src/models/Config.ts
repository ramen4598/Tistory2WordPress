import { CategoryHierarchyOrder, LogLevel } from '../enums/config.enum';

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
   * @default './data/migration.db'
   */
  migrationDbPath: string;

  /**
   * Maximum retry attempts for transient HTTP errors
   * @default 3
   */
  maxRetryAttempts: number;

  /**
   * Initial retry delay in milliseconds
   * @default 500
   */
  retryInitialDelayMs: number;

  /**
   * Maximum retry delay in milliseconds
   * @default 600000 (10 minutes)
   */
  retryMaxDelayMs: number;

  /**
   * Backoff multiplier for retries
   * @default 10
   */
  retryBackoffMultiplier: number;

  /**
   * Number of concurrent workers for parallel processing
   * @default 1
   * @min 1
   * @max 16
   */
  workerCount: number;

  /**
   * Rate limit interval
   * @default 60000 (1 minute)
   */
  rateLimitInterval: number;

  /**
   * Rate limit cap (number of requests per interval)
   * @default 1 (1 request per interval)
   */
  rateLimitCap: number;

  /**
   * Output directory path for generated files
   * @default './output'
   */
  outputDir: string;

  /**
   * Log level for logging
   * @default LogLevel.INFO
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
   * CSS selector for featured image element
   * e.g. #main > div > div > div.article_header.type_article_header_cover > div
   */
  postFeaturedImageSelector: string;

  /**
   * Category hierarchy order when two categories are present.
   * - "first-is-parent": first crawled category is parent
   * - "last-is-parent": last crawled category is parent
   * Defaults to "first-is-parent" when not specified or invalid.
   * @default CategoryHierarchyOrder.FIRST_IS_PARENT
   */
  categoryHierarchyOrder: CategoryHierarchyOrder;

  /**
   * CSS selector to detect bookmark elements in Tistory posts
   * e.g. figure[data-ke-type="opengraph"]
   */
  bookmarkSelector: string;

  /**
   * Path to bookmark HTML template file
   * @default "./src/templates/bookmark-template.html"
   */
  bookmarkTemplatePath: string;
}
