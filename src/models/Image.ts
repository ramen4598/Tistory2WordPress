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
}
