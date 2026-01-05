-- Tistory -> WordPress REST Migration SQLite schema
-- Aligns with specs/005-tistory-wp-rest/data-model.md (SQLite Entities)

PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

-- 1) migration_jobs: top-level migration runs
CREATE TABLE IF NOT EXISTS migration_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_type TEXT NOT NULL CHECK(job_type IN ('full', 'single')),
  status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_migration_jobs_status ON migration_jobs(status);
CREATE INDEX IF NOT EXISTS idx_migration_jobs_created_at ON migration_jobs(created_at);

-- 2) migration_job_items: per-post state within a job
CREATE TABLE IF NOT EXISTS migration_job_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  tistory_url TEXT NOT NULL,
  wp_post_id INTEGER,
  status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed')),
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (job_id) REFERENCES migration_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_migration_job_items_job_id ON migration_job_items(job_id);
CREATE INDEX IF NOT EXISTS idx_migration_job_items_tistory_url ON migration_job_items(tistory_url);
CREATE INDEX IF NOT EXISTS idx_migration_job_items_status ON migration_job_items(status);

-- 3) migration_image_assets: per-image tracking for a job item
CREATE TABLE IF NOT EXISTS migration_image_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_item_id INTEGER NOT NULL,
  tistory_image_url TEXT NOT NULL,
  wp_media_id INTEGER,
  wp_media_url TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending', 'uploaded', 'failed')),
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (job_item_id) REFERENCES migration_job_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_migration_image_assets_job_item_id ON migration_image_assets(job_item_id);
CREATE INDEX IF NOT EXISTS idx_migration_image_assets_status ON migration_image_assets(status);

-- 4) post_map: mapping from Tistory post URL to WordPress post ID
CREATE TABLE IF NOT EXISTS post_map (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tistory_url TEXT NOT NULL UNIQUE,
  wp_post_id INTEGER NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_post_map_tistory_url ON post_map(tistory_url);
CREATE INDEX IF NOT EXISTS idx_post_map_wp_post_id ON post_map(wp_post_id);

-- 5) internal_links: internal link records for manual fixes / export
CREATE TABLE IF NOT EXISTS internal_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_item_id INTEGER NOT NULL,
  source_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  link_text TEXT,
  context TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (job_item_id) REFERENCES migration_job_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_internal_links_job_item_id ON internal_links(job_item_id);
CREATE INDEX IF NOT EXISTS idx_internal_links_source_url ON internal_links(source_url);
CREATE INDEX IF NOT EXISTS idx_internal_links_target_url ON internal_links(target_url);

COMMIT;
