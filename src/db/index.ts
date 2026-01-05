import fs from 'fs';
import path from 'path';
import DatabaseConstructor, { type Database as BetterSqliteDatabase } from 'better-sqlite3';
import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';
import type { MigrationJob } from '../models/MigrationJob';
import type { MigrationJobItem } from '../models/MigrationJobItem';
import type { ImageAsset } from '../models/ImageAsset';
import type { PostMap } from '../models/PostMap';
import type { InternalLinkRecord } from '../models/InternalLinkRecord';
// eslint-disable-next-line prettier/prettier
import {
  ImageAssetStatus,
  MigrationJobItemStatus,
  MigrationJobStatus,
  MigrationJobType,
} from '../enums/db.enum';

const SCHEMA_PATH = path.join(__dirname, '../../db/schema.sql');

let cachedDb: BetterSqliteDatabase | null = null;

/**
 * Get a singleton SQLite database connection using better-sqlite3.
 * This establishes the connection, ensures the DB directory exists,
 * and runs the schema migrations from db/schema.sql on first use.
 * @return BetterSqliteDatabase
 */
export function getDb(): BetterSqliteDatabase {
  if (cachedDb) {
    return cachedDb;
  }

  const config = loadConfig();
  const logger = getLogger();
  const dbPath = config.migrationDbPath;
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    logger.info(`Created SQLite directory: ${dbDir}`);
  }

  const db = new DatabaseConstructor(dbPath);
  logger.info(`Opened SQLite database: ${dbPath}`);

  try {
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schemaSql);
    logger.info('Successed to apply SQLite schema migrations');
  } catch (error) {
    logger.error('Failed to apply SQLite schema migrations', error);
    db.close();
    throw error;
  }

  cachedDb = db;
  return cachedDb;
}

/**
 * Close the cached SQLite database connection, if any.
 */
export function closeDb(): void {
  if (!cachedDb) return;

  cachedDb.close();
  cachedDb = null;
}

// --- MigrationJob ---

/**
 * Create a new migration job record.
 * @param jobType MigrationJobType
 * @return MigrationJob
 */
export function createMigrationJob(jobType: MigrationJobType): MigrationJob {
  const db = getDb();
  const stmt = db.prepare('INSERT INTO migration_jobs (job_type, status) VALUES (?, ?)');
  const info = stmt.run(jobType, MigrationJobStatus.RUNNING);
  const id = Number(info.lastInsertRowid);

  const row = db.prepare('SELECT * FROM migration_jobs WHERE id = ?').get(id) as
    | MigrationJob
    | undefined;

  if (!row) {
    throw new Error('Failed to load created migration job');
  }

  return row;
}

/**
 * Update a migration job record by ID.
 * @param id number
 * @param patch Partial<Pick<MigrationJob, 'status' | 'completed_at' | 'error_message'>>
 */
export function updateMigrationJob(
  id: number,
  patch: Partial<Pick<MigrationJob, 'status' | 'completed_at' | 'error_message'>>
): void {
  const db = getDb();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.status !== undefined) {
    fields.push('status = ?');
    values.push(patch.status as MigrationJobStatus);
  }
  if (patch.completed_at !== undefined) {
    fields.push('completed_at = ?');
    values.push(patch.completed_at);
  }
  if (patch.error_message !== undefined) {
    fields.push('error_message = ?');
    values.push(patch.error_message);
  }

  if (fields.length === 0) {
    return;
  }

  values.push(id);

  const sql = `UPDATE migration_jobs SET ${fields.join(', ')} WHERE id = ?`;
  const stmt = db.prepare(sql);
  stmt.run(...values);
}

/**
 * Get a migration job by ID.
 * @param id number
 * @return MigrationJob | undefined
 */
export function getMigrationJobById(id: number): MigrationJob | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM migration_jobs WHERE id = ?').get(id) as
    | MigrationJob
    | undefined;
}

// --- MigrationJobItem ---

/**
 * Create a new migration job item record.
 * @param input { job_id: number; tistory_url: string }
 * @return MigrationJobItem
 */
export function createMigrationJobItem(input: {
  job_id: number;
  tistory_url: string;
}): MigrationJobItem {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO migration_job_items (job_id, tistory_url, status) VALUES (?, ?, ?)'
  );
  const info = stmt.run(input.job_id, input.tistory_url, MigrationJobItemStatus.RUNNING);
  const id = Number(info.lastInsertRowid);

  const row = db.prepare('SELECT * FROM migration_job_items WHERE id = ?').get(id) as
    | MigrationJobItem
    | undefined;

  if (!row) {
    throw new Error('Failed to load created migration job item');
  }

  return row;
}

/**
 * Update a migration job item record by ID.
 * @param id number
 * @param patch Partial<Pick<MigrationJobItem, 'status' | 'wp_post_id' | 'error_message' | 'updated_at'>>
 */
export function updateMigrationJobItem(
  id: number,
  patch: Partial<Pick<MigrationJobItem, 'status' | 'wp_post_id' | 'error_message' | 'updated_at'>>
): void {
  const db = getDb();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.status !== undefined) {
    fields.push('status = ?');
    values.push(patch.status as MigrationJobItemStatus);
  }
  if (patch.wp_post_id !== undefined) {
    fields.push('wp_post_id = ?');
    values.push(patch.wp_post_id);
  }
  if (patch.error_message !== undefined) {
    fields.push('error_message = ?');
    values.push(patch.error_message);
  }
  if (patch.updated_at !== undefined) {
    fields.push('updated_at = ?');
    values.push(patch.updated_at);
  }

  if (fields.length === 0) {
    return;
  }

  values.push(id);

  const sql = `UPDATE migration_job_items SET ${fields.join(', ')} WHERE id = ?`;
  const stmt = db.prepare(sql);
  stmt.run(...values);
}

/**
 * Get a migration job item by ID.
 * @param id number
 * @return MigrationJobItem | undefined
 */
export function getMigrationJobItemById(id: number): MigrationJobItem | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM migration_job_items WHERE id = ?').get(id) as
    | MigrationJobItem
    | undefined;
}

/**
 * Get all migration job items by job ID.
 * @param jobId number
 * @return MigrationJobItem[]
 */
export function getMigrationJobItemsByJobId(jobId: number): MigrationJobItem[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM migration_job_items WHERE job_id = ? ORDER BY id')
    .all(jobId) as MigrationJobItem[];
}

// --- ImageAsset ---

/**
 * Create a new image asset record.
 * @param input { job_item_id: number; tistory_image_url: string }
 * @return ImageAsset
 */
export function createImageAsset(input: {
  job_item_id: number;
  tistory_image_url: string;
}): ImageAsset {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO migration_image_assets (job_item_id, tistory_image_url, status) VALUES (?, ?, ?)'
  );
  const info = stmt.run(input.job_item_id, input.tistory_image_url, ImageAssetStatus.PENDING);
  const id = Number(info.lastInsertRowid);

  const row = db.prepare('SELECT * FROM migration_image_assets WHERE id = ?').get(id) as
    | ImageAsset
    | undefined;

  if (!row) {
    throw new Error('Failed to load created image asset');
  }

  return row;
}

/**
 * Update an image asset record by ID.
 * @param id number
 * @param patch Partial<Pick<ImageAsset, 'status' | 'wp_media_id' | 'wp_media_url' | 'error_message' | 'updated_at'>>
 */
export function updateImageAsset(
  id: number,
  patch: Partial<
    Pick<ImageAsset, 'status' | 'wp_media_id' | 'wp_media_url' | 'error_message' | 'updated_at'>
  >
): void {
  const db = getDb();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.status !== undefined) {
    fields.push('status = ?');
    values.push(patch.status as ImageAssetStatus);
  }
  if (patch.wp_media_id !== undefined) {
    fields.push('wp_media_id = ?');
    values.push(patch.wp_media_id);
  }
  if (patch.wp_media_url !== undefined) {
    fields.push('wp_media_url = ?');
    values.push(patch.wp_media_url);
  }
  if (patch.error_message !== undefined) {
    fields.push('error_message = ?');
    values.push(patch.error_message);
  }
  if (patch.updated_at !== undefined) {
    fields.push('updated_at = ?');
    values.push(patch.updated_at);
  }

  if (fields.length === 0) {
    return;
  }

  values.push(id);

  const sql = `UPDATE migration_image_assets SET ${fields.join(', ')} WHERE id = ?`;
  const stmt = db.prepare(sql);
  stmt.run(...values);
}

/**
 * Get all image assets by job item ID.
 * @param jobItemId number
 * @return ImageAsset[]
 */
export function getImageAssetsByJobItemId(jobItemId: number): ImageAsset[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM migration_image_assets WHERE job_item_id = ? ORDER BY id')
    .all(jobItemId) as ImageAsset[];
}

// --- PostMap ---

/**
 * Create a new post map record.
 * @param input { tistory_url: string; wp_post_id: number }
 * @return PostMap
 */
export function createPostMap(input: { tistory_url: string; wp_post_id: number }): PostMap {
  const db = getDb();
  const stmt = db.prepare('INSERT INTO post_map (tistory_url, wp_post_id) VALUES (?, ?)');
  const info = stmt.run(input.tistory_url, input.wp_post_id);
  const id = Number(info.lastInsertRowid);

  const row = db.prepare('SELECT * FROM post_map WHERE id = ?').get(id) as PostMap | undefined;

  if (!row) {
    throw new Error('Failed to load created post map');
  }

  return row;
}

/**
 * Get a post map record by Tistory URL.
 * @param tistoryUrl string
 * @return PostMap | undefined
 */
export function getPostMapByTistoryUrl(tistoryUrl: string): PostMap | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM post_map WHERE tistory_url = ?').get(tistoryUrl) as
    | PostMap
    | undefined;
}

// --- InternalLinkRecord ---

/**
 * Create a new internal link record.
 * @param record Omit<InternalLinkRecord, 'id' | 'created_at'>
 * @return InternalLinkRecord
 */
export function insertInternalLink(
  record: Omit<InternalLinkRecord, 'id' | 'created_at'>
): InternalLinkRecord {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO internal_links (job_item_id, source_url, target_url, link_text, context) VALUES (?, ?, ?, ?, ?)'
  );
  const info = stmt.run(
    record.job_item_id,
    record.source_url,
    record.target_url,
    record.link_text ?? null,
    record.context ?? null
  );
  const id = Number(info.lastInsertRowid);

  const row = db.prepare('SELECT * FROM internal_links WHERE id = ?').get(id) as
    | InternalLinkRecord
    | undefined;

  if (!row) {
    throw new Error('Failed to load created internal link record');
  }

  return row;
}

/**
 * Get all internal link records by job item ID.
 * @param jobItemId number
 * @return InternalLinkRecord[]
 */
export function getInternalLinksByJobItemId(jobItemId: number): InternalLinkRecord[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM internal_links WHERE job_item_id = ? ORDER BY id')
    .all(jobItemId) as InternalLinkRecord[];
}
