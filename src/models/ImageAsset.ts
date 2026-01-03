import type { MigrationJobItem } from './MigrationJobItem';
import { ImageAssetStatus } from '../enums/db.enum';

/**
 * Tracks the state of each image processed for a specific job item.
 * Mirrors the `migration_image_assets` table in SQLite.
 */
export interface ImageAsset {
  id: number;
  job_item_id: MigrationJobItem['id'];
  tistory_image_url: string;
  wp_media_id: number | null;
  wp_media_url: string | null;
  status: ImageAssetStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}
