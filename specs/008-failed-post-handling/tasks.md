# 008 Failed Post Handling - Tasks

## Goal

Add a CLI command to export all failed posts for the current blog (`config.blogUrl`) to `config.outputDir/failed_posts.json`, deduplicated by `tistory_url` and aggregating all error messages.

## Assumptions

- Existing DB compatibility is out of scope.
- `migration_jobs.blog_url` is `NOT NULL`.

## Tasks

### 1) Schema

- [ ] Update `db/schema.sql` to add `migration_jobs.blog_url TEXT NOT NULL`.
- [ ] Add an index for `migration_jobs.blog_url` (and optionally `(job_type, status, blog_url)`).

### 2) Models

- [ ] Update `src/models/MigrationJob.ts` to include `blog_url: string`.

### 3) DB Repository

- [ ] Update `src/db/index.ts`:
  - [ ] Modify `createMigrationJob(jobType)` to save `blog_url = loadConfig().blogUrl`.
  - [ ] Update running-job lookup to include `blog_url`:
    - [ ] Change `getLatestRunningJobByType` signature to accept `blogUrl` OR add a new `getLatestRunningJobByTypeAndBlogUrl`.
  - [ ] Add a query helper to fetch failed items by blog:
    - [ ] `getFailedMigrationJobItemsByBlogUrl(blogUrl: string)` using a JOIN between `migration_jobs` and `migration_job_items`.

### 4) Failed Posts Exporter Service

- [ ] Add `src/services/failedPostExporter.ts`:
  - [ ] Fetch failed jobItems for `blogUrl` via DB helper.
  - [ ] Group by `tistory_url` and aggregate unique `error_message` values into `error_messages: string[]`.
  - [ ] Write JSON output to the provided path, ensuring parent directory exists.
  - [ ] Output format:
    - [ ] `blog_url`, `exported_at`, `count`, `items[]`.

### 5) CLI Integration

- [ ] Update `src/cli.ts`:
  - [ ] Add `--export-failed` flag.
  - [ ] Allow running with only `--export-failed` (no `--post/--all` required).
  - [ ] Call exporter with `path.join(config.outputDir, 'failed_posts.json')`.
  - [ ] Update help/usage to include the new flag.
  - [ ] Update `--all` resume logic to reuse running FULL jobs only when `blog_url` matches:
    - [ ] `getLatestRunningJobByType(MigrationJobType.FULL, config.blogUrl) ?? createMigrationJob(MigrationJobType.FULL)`.

### 6) Tests

- [ ] Update/add DB unit tests in `tests/unit/db/index.test.ts`:
  - [ ] Verify `createMigrationJob` persists `blog_url`.
  - [ ] Verify `getFailedMigrationJobItemsByBlogUrl` filters by blog correctly.
- [ ] Update/add CLI unit tests in `tests/unit/cli.test.ts`:
  - [ ] `--export-failed` triggers exporter and writes to `outputDir/failed_posts.json`.
  - [ ] `--all` calls running-job lookup with `(MigrationJobType.FULL, blogUrl)`.

### 7) Validation

- [ ] Run unit tests: `npm test` (or `npm run test`).
- [ ] Ensure `--help` output includes `--export-failed`.
