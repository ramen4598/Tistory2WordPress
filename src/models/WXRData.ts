import { Post } from './Post';
import { Category } from './Category';
import { Tag } from './Tag';

export type wxrlang = 'ko-KR' | 'en-US';

/**
 * Aggregated data structure for WXR generation
 */
export interface Author {
  /**
   * Numeric identifier for the author
   */
  id: number;

  /**
   * Login/username for the author
   */
  login: string;

  /**
   * Display name for the author
   */
  display_name: wxrlang;
}

export interface SiteInfo {
  /**
   * Blog title
   */
  title: string;

  /**
   * Blog description
   */
  description: string;

  /**
   * Blog base URL
   */
  url: string;

  /**
   * Blog language code (e.g., ko-KR, en-US)
   */
  language?: string;
}

export interface WXRData {
  /**
   * All processed posts
   */
  posts: Post[];

  /**
   * Unique categories across all posts
   * Expected to be deduplicated by slug
   */
  categories: Category[];

  /**
   * Unique tags across all posts
   * Expected to be deduplicated by slug
   */
  tags: Tag[];

  /**
   * Blog authors (default: single author)
   */
  authors: Author[];

  /**
   * Blog metadata (title, description, URL)
   */
  site_info: SiteInfo;
}
