import fs from 'fs';
import path from 'path';
import DatabaseConstructor, { type Database as BetterSqliteDatabase } from 'better-sqlite3';
import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';

const SCHEMA_PATH = path.join(__dirname, '../../db/schema.sql');

let cachedDb: BetterSqliteDatabase | null = null;

/**
 * Get a singleton SQLite database connection using better-sqlite3.
 *
 * This establishes the connection, ensures the DB directory exists,
 * and runs the schema migrations from db/schema.sql on first use.
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
