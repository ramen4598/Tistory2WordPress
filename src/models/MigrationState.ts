/**
 * Tracks migration progress for resume capability
 */
export interface MigrationState {
  /**
   * State file format version
   * Must be "1.0" for current format
   */
  version: string;

  /**
   * Total number of posts discovered
   */
  total_posts: number;

  /**
   * Array of processed post URLs
   * Must contain unique URLs only
   */
  processed_posts: string[];

  /**
   * Timestamp of last state update
   */
  last_checkpoint: Date;
}
