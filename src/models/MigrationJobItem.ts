import type { MigrationJob } from './MigrationJob';
import { MigrationJobItemStatus } from '../enums/db.enum';

/**
 * Represents the migration state of a single Tistory post.
 * Mirrors the `migration_job_items` table in SQLite.
 */
export interface MigrationJobItem {
  id: number;
  job_id: MigrationJob['id'];
  tistory_url: string;
  wp_post_id: number | null;
  status: MigrationJobItemStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}
