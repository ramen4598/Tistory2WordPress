import { Config } from '../../../src/models/Config';
import { CategoryHierarchyOrder, LogLevel } from '../../../src/enums/config.enum';

export const baseConfig: Config = {
  blogUrl: 'https://example.tistory.com',
  workerCount: 1,
  rateLimitInterval: 60000,
  rateLimitCap: 1,
  outputDir: './output',
  logLevel: LogLevel.INFO,

  postTitleSelector: 'meta[name="title"]',
  postPublishDateSelector: 'meta[property="article:published_time"]',
  postModifiedDateSelector: 'meta[property="article:modified_time"]',
  postCategorySelector: 'div.another_category h4 a',
  postTagSelector: 'div.area_tag a[rel="tag"]',
  postContentSelector: 'div.tt_article_useless_p_margin.contents_style',
  postListLinkSelector: 'a.link_category',
  postFeaturedImageSelector:
    '#main > div > div > div.article_header.type_article_header_cover > div',
  bookmarkSelector: 'figure[data-ke-type="opengraph"]',
  bookmarkTemplatePath: './src/templates/bookmark-template.html',

  categoryHierarchyOrder: CategoryHierarchyOrder.FIRST_IS_PARENT,

  wpBaseUrl: 'https://example.wordpress.com',
  wpAppUser: 'user',
  wpAppPassword: 'password',
  migrationDbPath: './data/migration.db',
  maxRetryAttempts: 3,
  retryInitialDelayMs: 500,
  retryMaxDelayMs: 10000,
  retryBackoffMultiplier: 2,
};
