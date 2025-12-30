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
