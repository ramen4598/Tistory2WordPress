import type { MigrationJobItem } from './MigrationJobItem';

/**
 * DB representation of an internal link between Tistory posts.
 * Mirrors the `internal_links` table in SQLite.
 */
export interface InternalLinkRecord {
  id: number;
  job_item_id: MigrationJobItem['id'];
  source_url: string;
  target_url: string;
  link_text: string | null;
  context: string | null;
  created_at: string;
}
