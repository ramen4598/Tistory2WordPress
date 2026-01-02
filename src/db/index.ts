import fs from 'fs';
import path from 'path';
import DatabaseConstructor, { type Database as BetterSqliteDatabase } from 'better-sqlite3';
import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';

let cachedDb: BetterSqliteDatabase | null = null;

/**
 * Get a singleton SQLite database connection using better-sqlite3.
 *
 * This only establishes the connection and ensures the DB directory exists.
 * Schema creation/migrations are handled in a separate task (T206).
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

  cachedDb = new DatabaseConstructor(dbPath);
  logger.info(`Opened SQLite database: ${dbPath}`);

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
