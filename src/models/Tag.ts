/**
 * Represents a blog tag (flat, no hierarchy)
 */
export interface Tag {
  /**
   * Tag display name
   * Must not be empty
   */
  name: string;

  /**
   * URL-safe tag identifier
   * Auto-generated from name (lowercase, hyphenated)
   */
  slug: string;
}
