import { Config } from '../../../src/models/Config';
import { CategoryHierarchyOrder, LogLevel } from '../../../src/enums/config.enum';

export const baseConfig: Config = {
  blogUrl: 'https://example.tistory.com',
  workerCount: 4,
  rateLimitPerWorker: 1000,
  outputDir: './output',
  logLevel: LogLevel.INFO,

  postTitleSelector: 'meta[name="title"]',
  postPublishDateSelector: 'meta[property="article:published_time"]',
  postModifiedDateSelector: 'meta[property="article:modified_time"]',
  postCategorySelector: 'div.another_category h4 a',
  postTagSelector: 'div.area_tag a[rel="tag"]',
  postContentSelector: 'div.tt_article_useless_p_margin.contents_style',
  postListLinkSelector: 'a.link_category',

  categoryHierarchyOrder: CategoryHierarchyOrder.FIRST_IS_PARENT,
};
