/**
 * Represents a blog category with optional parent-child hierarchy
 */
export interface Category {
  /**
   * Category display name
   * Must not be empty
   */
  name: string;

  /**
   * URL-safe category identifier
   * Auto-generated from name (lowercase, hyphenated)
   */
  slug: string;

  /**
   * Parent category for hierarchy (optional)
   * Self-referential relationship
   */
  parent: Category | null;

  /**
   * Category description (optional)
   */
  description: string | null;
}
