# Quickstart - Tistory → WordPress REST Migration (005-tistory-wp-rest)

This guide explains how to run the REST-based Tistory→WordPress migration tool once it is implemented.

## 1. Prerequisites

- Node.js 18+ and npm installed.
- Access to:
  - A Tistory blog (publicly accessible).
  - A WordPress site with REST API enabled.
- WordPress Application Password created for a user with permissions to create posts/media/categories/tags.

## 2. Install Dependencies

From the project root:

```bash
npm install
```

## 3. Configure Environment

Create a `.env` file (or export env vars).
See `.env.example` for reference.

## 4. Build

If the project uses a build step:

```bash
npm run build
```

(If using ts-node directly in development, you may skip this step.)

## 5. Run a Single-Post Migration (Smoke Test)

This is the recommended first run: migrate a single known Tistory post URL end-to-end.

### 5.1 Environment variables

Create a `.env` file. See `.env.example` for reference.

### 5.2 Run

```bash
npx ts-node src/cli.ts --post="https://your-blog.tistory.com/123"
# Or, if built:
node dist/cli.js --post="https://your-blog.tistory.com/123"
```

### 5.3 What to expect

- The command prints a summary at the end:
  - `Migration Job Summary (jobId=...)`
  - `- Completed: <N>`
  - `- Failed: <M>`
- A new draft post appears in WordPress admin with:
  - Correct title/content.
  - Categories/tags approximating the Tistory structure.
  - Images uploaded to WordPress media library and rendered correctly.
  - Original publish date (and modified date if available).
- SQLite DB at `MIGRATION_DB_PATH` is updated with:
  - A `migration_jobs` row for the run
  - A `migration_job_items` row for the post URL

### 5.4 Rollback smoke check

To confirm rollback behavior is working:

- Intentionally trigger a failure (common ways):
  - Use an invalid `WP_APP_PASSWORD`, or
  - Temporarily point `WP_BASE_URL` to a non-WordPress server
- Re-run the same `--post` command.

Expected behavior:

- The CLI exits with non-zero status when `Failed > 0`.
- Any created WordPress resources during the failed attempt (post and/or media) are deleted.
- `migration_job_items.status` is set to `Failed` with a stored failure reason.

## 6. Run Full-Blog Migration

Once single-post migration works, run the full migration:

```bash
npx ts-node src/cli.ts --all
node dist/cli.js --all
```

Behavior:

- Crawls all posts from `TISTORY_BLOG_URL` with pagination.
- Uses SQLite (`migration.db`) to skip posts whose `MigrationJobItem.status` is already `Completed` (and, depending on flags, optionally `Failed`).
- Processes posts in parallel using a worker pool while respecting `RATE_LIMIT_PER_WORKER`.

Outputs:

- New draft posts appears in your WordPress admin with:
  - Correct title/content.
  - Categories/tags approximating the Tistory structure.
  - Images stored in the WordPress media library and rendered correctly.
  - Original publish date (and modified date if available).
- SQLite DB (e.g. `migration.db`) updated with a `MigrationJob` + `MigrationJobItem` row for the processed URL.
- `output/link_mapping.json` — internal Tistory link mappings.

## 7. Handling Failures & Resume

If the process is interrupted or some posts fail:

1. Inspect logs to identify error types (network, auth, parsing, etc.).
2. Fix configuration or connectivity issues (e.g., wrong credentials, base URL).
3. Re-run the same command (`--post` or `--all`).
   - The tool will consult SQLite (`migration_job_items.status`) and skip items already marked `Completed`.
   - Depending on CLI flags (e.g. `--retry-failed`), it may re-attempt items marked `Failed`.

You can also inspect the `migration_jobs`, `migration_job_items`, and `migration_image_assets` tables in `migration.db` to understand which posts or images failed and why.

## 8. Post-Migration Work

- Review migrated drafts in WordPress.
- Use `link_mapping.json` (exported from SQLite) to manually fix internal links (e.g., mapping Tistory URLs to new WordPress permalinks).

## 9. Relation to Existing 003 (WXR) Tool

- 003 (`Tistory WXR Generator`) try to produces a WXR XML file for import. But aborted. Cause there is a problem to handle media properly.
- 005 (`Tistory → WordPress REST Migration`) pushes content directly into WordPress via REST.
- Both share crawling/cleaning/state logic; REST mode adds WP REST + media upload on top.
- YOU CAN USE REST ONLY. YOU CANT USE WXR. IT'S NOT IMPLEMENTED.
