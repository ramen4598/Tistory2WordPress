/**
 * Tracks links between posts within the same Tistory blog
 */
export interface InternalLink {
  /**
   * URL of post containing the link
   * Must match a processed post URL
   */
  source_url: string;

  /**
   * URL of referenced post
   * Must start with TISTORY_BLOG_URL
   */
  target_url: string;

  /**
   * Anchor text of the link (optional)
   */
  link_text?: string;

  /**
   * Surrounding text for context (optional)
   */
  context?: string;
}
