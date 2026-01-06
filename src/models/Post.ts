import { Category } from './Category';
import { Tag } from './Tag';
import { Image } from './Image';
// import { Attachment } from './Attachment';

/**
 * Represents a single blog post with all associated metadata and content
 */
export interface Post {
  /**
   * Post ID (for WXR generation, auto-generated)
   */
  id?: number;

  /**
   * Original Tistory post URL (unique identifier)
   * Must be valid URL format and start with TISTORY_BLOG_URL
   */
  url: string;

  /**
   * Post title
   * Must not be empty (fallback: "Untitled")
   */
  title: string;

  /**
   * Post HTML content (cleaned)
   * Can be empty but should be logged
   */
  content: string;

  /**
   * Original publication date (required)
   */
  publish_date: Date;

  /**
   * Last modification date (optional)
   */
  modified_date: Date | null;

  /**
   * Associated categories (hierarchical)
   * Many-to-many relationship
   */
  categories: Category[];

  /**
   * Associated tags
   * Many-to-many relationship
   */
  tags: Tag[];

  /**
   * Images referenced in post
   * One-to-many relationship
   */
  images: Image[];

  /**
   * File attachments
   * One-to-many relationship
   */
  // attachments: Attachment[];

  /**
   * Featured image URL (optional)
   */
  featured_image: Image | null;
}
