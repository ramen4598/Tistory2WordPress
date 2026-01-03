import { MigrationJobStatus, MigrationJobType } from '../enums/db.enum';

/**
 * Represents a single migration run (e.g., full blog or single post).
 * Mirrors the `migration_jobs` table in SQLite.
 */
export interface MigrationJob {
  id: number;
  job_type: MigrationJobType;
  status: MigrationJobStatus;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
}
