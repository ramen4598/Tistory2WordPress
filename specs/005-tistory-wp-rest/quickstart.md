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

Once single-post migration works, run full migration:

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
  - Categories/tags approximating Tistory structure.
  - Images stored in WordPress media library and rendered correctly.
  - Original publish date (and modified date if available).
- SQLite DB (e.g. `migration.db`) updated with a `MigrationJob` + `MigrationJobItem` row for processed URL.

### 6.1 Export Internal Link Mapping

To export a JSON file containing all internal Tistory links detected during migration:

```bash
npx ts-node src/cli.ts --all --export-links
node dist/cli.js --all --export-links
```

This creates `output/link_mapping.json`(configurable via .env file) in your project directory.

### 6.2 Understanding link_mapping.json

The exported JSON file contains an array of internal link records:

```json
[
  {
    "source_url": "https://your-blog.tistory.com/123",
    "target_url": "https://your-blog.tistory.com/456",
    "link_text": "See my previous post",
    "context": "For more details, see my previous post about..."
  },
  {
    "source_url": "https://your-blog.tistory.com/123",
    "target_url": "https://your-blog.tistory.com/789",
    "link_text": null,
    "context": null
  }
]
```

Fields:

- `source_url`: The Tistory post containing the link
- `target_url`: The Tistory post URL the link points to
- `link_text`: The anchor text of the link (may be null)
- `context`: Surrounding text snippet for context (may be null)

## 7. Handling Failures & Resume

If the process is interrupted or some posts fail:

1. Inspect logs to identify error types (network, auth, parsing, etc.).
2. Fix configuration or connectivity issues (e.g., wrong credentials, base URL).
3. Re-run the same command (`--post` or `--all`).
   - The tool will consult SQLite (`migration_job_items.status`) and skip items already marked `Completed`.
   - Depending on CLI flags (e.g. `--retry-failed`), it may re-attempt items marked `Failed`.

You can also inspect the `migration_jobs`, `migration_job_items`, and `migration_image_assets` tables in `migration.db` to understand which posts or images failed and why.

## 8. Post-Migration Work

### 8.1 Review Migrated Content

- Review migrated drafts in WordPress.
- Check for:
  - Correct content formatting
  - Proper image uploads
  - Accurate categories and tags
  - Original publish/modified dates

### 8.2 Fix Internal Links

Internal Tistory links still point to old Tistory URLs. Use `link_mapping.json` to manually update them:

**Workflow:**

1. Export internal links (if not already done):

   ```bash
   npx ts-node src/cli.ts --all --export-links
   ```

2. Open `output/link_mapping.json` in your editor or review tool

3. For each internal link entry:
   - Find the `source_url` post in WordPress admin
   - Update the link to point to the new WordPress URL for `target_url`
   - You can find the WordPress URL using the `tistory_wp_post_map` table:
     ```bash
     sqlite3 migration.db "SELECT tistory_url, wp_post_id FROM post_map WHERE tistory_url = 'https://your-blog.tistory.com/456';"
     ```

4. Example manual fix:
   - Original: `<a href="https://your-blog.tistory.com/456">See previous post</a>`
   - Fixed: `<a href="https://your-wordpress.com/2023/previous-post">See previous post</a>`

**Tips:**

- Use WordPress's "Find and Replace" plugins for bulk updates
- Search/replace `https://your-blog.tistory.com/` with new WordPress base URL
- Verify that link text and context in `link_mapping.json` help identify which links need attention

## 9. Performance Tuning

### 9.1 Adjusting Worker Count

`WORKER_COUNT` controls how many posts are processed concurrently.

- **Default: 4 workers**
- **Range: 1-16 workers**
- **When to increase:**
  - Fast network and server response times
  - Large number of posts (> 100)
  - Testing/staging environments
- **When to decrease:**
  - Slow WordPress server
  - Rate limiting from WordPress or Tistory
  - Limited system resources

**Example configurations:**

```bash
# Conservative (production with slow server)
WORKER_COUNT=2
RATE_LIMIT_PER_WORKER=2000

# Balanced (default)
WORKER_COUNT=4
RATE_LIMIT_PER_WORKER=1000

# Aggressive (testing with fast server)
WORKER_COUNT=8
RATE_LIMIT_PER_WORKER=500
```

### 9.2 Rate Limiting Best Practices

The `RATE_LIMIT_PER_WORKER` setting works with `WORKER_COUNT`:

- **Total requests/second = WORKER_COUNT × (1000 / RATE_LIMIT_PER_WORKER)**
- Example: `WORKER_COUNT=4` + `RATE_LIMIT_PER_WORKER=1000` = 4 requests/second

**Guidelines:**

1. **Start conservative** (1000-2000ms per worker)
2. **Monitor logs** for rate limit errors (HTTP 429)
3. **Adjust incrementally** until optimal
4. **Consider server load** - too aggressive may cause failures

**Common scenarios:**

- **Shared hosting**: Use lower values (WORKER_COUNT=2-4, RATE_LIMIT_PER_WORKER=1500-2000)
- **Dedicated server**: Can use higher values (WORKER_COUNT=4-8, RATE_LIMIT_PER_WORKER=500-1000)
- **Tistory rate limits**: If you see HTTP 429 from Tistory, increase `RATE_LIMIT_PER_WORKER`

### 9.3 Retry Configuration

Retry settings help handle transient failures:

```bash
# Maximum number of retry attempts per request
MAX_RETRY_ATTEMPTS=3  # default: 3

# Initial delay before first retry (milliseconds)
RETRY_INITIAL_DELAY_MS=500  # default: 500

# Maximum delay between retries (milliseconds)
RETRY_MAX_DELAY_MS=10000  # default: 10000

# Backoff multiplier (delay = previous_delay * multiplier)
RETRY_BACKOFF_MULTIPLIER=2  # default: 2
```

**When to adjust:**

- **Unreliable network**: Increase `MAX_RETRY_ATTEMPTS` to 5-10
- **Fast recovery**: Decrease `RETRY_INITIAL_DELAY_MS` to 100-300
- **Long operations**: Increase `RETRY_MAX_DELAY_MS` to 15000-30000

### 9.4 Troubleshooting Performance Issues

**Migration is slow:**

1. Check `WORKER_COUNT` - increase if network and server are fast
2. Check `RATE_LIMIT_PER_WORKER` - decrease if no rate limiting errors
3. Monitor CPU/memory usage - decrease if hitting limits

**Getting rate limit errors:**

1. Look for HTTP 429 status codes in logs
2. Increase `RATE_LIMIT_PER_WORKER` (slower requests)
3. Decrease `WORKER_COUNT` (fewer concurrent requests)

**High failure rate:**

1. Check network connectivity
2. Verify WordPress credentials and permissions
3. Review logs for specific error messages
4. Increase retry settings if errors are transient

## 10. Relation to Existing 003 (WXR) Tool

- 003 (`Tistory WXR Generator`) try to produces a WXR XML file for import. But aborted. Cause there is a problem to handle media properly.
- 005 (`Tistory → WordPress REST Migration`) pushes content directly into WordPress via REST.
- Both share crawling/cleaning/state logic; REST mode adds WP REST + media upload on top.
- YOU CAN USE REST ONLY. YOU CANT USE WXR. IT'S NOT IMPLEMENTED.
