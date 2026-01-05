/**
 * Represents an image referenced in post content
 */
export interface Image {
  /**
   * Original image URL (Tistory CDN or external)
   * Must be valid URL format
   */
  url: string;

  /**
   * Image alt attribute (optional)
   * Extracted from HTML alt attribute if available
   */
  alt_text: string | null;

  /**
   * Local WordPress media ID after upload (optional)
   * Set after successful upload to WordPress
   */
  wp_media_id?: number;

  /**
   * Local WordPress media URL after upload (optional)
   * Set after successful upload to WordPress
   */
  wp_media_url?: string;
}
