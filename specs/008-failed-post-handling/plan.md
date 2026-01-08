# 008 Failed Post Handling - Report

## Goal

실패한 블로그 글을 파일로 출력하는 CLI 기능을 추가한다.

- 실패한 글 정의: `TISTORY_BLOG_URL`(= `config.blogUrl`)에 해당하는 migration job들의 하위 jobItem 중 `status = failed`
- 동일 포스트(`tistory_url`)는 하나로 합친다
- 동일 포스트에 대해 에러메시지가 여러개라면 배열로 모두 제공한다
- 출력 파일: `config.outputDir/failed_posts.json`

## Assumptions / Scope

- 기존 DB를 계속 쓸 가능성이 없으므로, 구버전 스키마/마이그레이션 호환성은 고려하지 않는다.
  - 즉, 새로 생성되는 DB에서 `migration_jobs.blog_url`은 항상 존재하며 `NOT NULL`이다.
- URL 정규화(trailing slash, querystring 등)는 범위 밖이며, 문자열 완전 일치 기준으로 병합한다.

## Required Schema Change

`migration_jobs`가 블로그 URL을 저장하도록 확장한다.

- Add column: `migration_jobs.blog_url TEXT NOT NULL`
- Add index (권장):
  - `CREATE INDEX IF NOT EXISTS idx_migration_jobs_blog_url ON migration_jobs(blog_url);`
  - 또는 조회 최적화용 복합 인덱스: `(job_type, status, blog_url)`

## Data/Query Model

### Target jobs

- `migration_jobs.blog_url = config.blogUrl`

### Target items

- 위 job들에 속한 `migration_job_items.status = 'failed'`

### Recommended query (single SQL)

- `migration_job_items`를 job과 JOIN 해서 blog_url로 필터링:
  - `SELECT mji.* FROM migration_job_items mji JOIN migration_jobs mj ON mji.job_id = mj.id WHERE mj.blog_url = ? AND mji.status = 'failed' ORDER BY mji.id`

## Merge Logic

- key: `tistory_url`
- value: `error_messages: string[]`
- 중복 제거: `Set` 기반 dedup 권장
- `error_message`가 `null`이면 배열에 포함하지 않는다(빈 배열 가능)

## Output Format

파일 경로: `path.join(config.outputDir, 'failed_posts.json')`

JSON 포맷(제안):

```json
{
  "blog_url": "https://example.tistory.com",
  "exported_at": "2026-01-08T00:00:00.000Z",
  "count": 2,
  "items": [
    {
      "tistory_url": "https://example.tistory.com/123",
      "error_messages": ["timeout", "wp create failed"]
    }
  ]
}
```

- `count`: dedup 된 포스트 수 (`items.length`)
- `exported_at`: export 시점 ISO string

## CLI Spec

### New option

- `--export-failed`
  - 다른 플래그 없이 단독 실행 가능
  - 실행 시 실패 데이터 조회/병합 후 `failed_posts.json` 출력

### Help/Usage update

`printUsage()`에 추가:

- `--export-failed      Export failed posts to failed_posts.json`

## Interaction With Existing Resume Logic

현재 `--all` 실행 시 running FULL job을 재사용하는 로직이 URL 비교 없이 동작한다.

기존:

- `getLatestRunningJobByType(MigrationJobType.FULL) ?? createMigrationJob(MigrationJobType.FULL)`

변경 요구:

- blogUrl이 같은 경우에만 running job을 재사용하도록 URL 비교를 추가한다.

새 동작:

- `getLatestRunningJobByType(MigrationJobType.FULL, config.blogUrl) ?? createMigrationJob(MigrationJobType.FULL)`

## Proposed Code Changes

### DB layer (`src/db/index.ts`)

- `createMigrationJob(jobType)`에서 `blog_url = loadConfig().blogUrl`을 함께 저장
- running job 조회 함수에서 `blog_url` 필터를 포함
- failed export용 조회 함수 추가:
  - `getFailedMigrationJobItemsByBlogUrl(blogUrl: string): MigrationJobItem[]`

### Models

- `src/models/MigrationJob.ts`: `blog_url: string` 추가

### Service

- 신규: `src/services/failedPostExporter.ts`
  - `exportFailedPostsByBlogUrl(outputPath: string, blogUrl: string): void`
  - dir 생성 + JSON write

### CLI (`src/cli.ts`)

- `--export-failed` 플래그 추가
- `--all`에서 running job 재사용 시 blogUrl 비교 반영

## Tests

### DB unit tests (`tests/unit/db/index.test.ts`)

- job 생성 시 `blog_url` 저장 확인
- blogUrl별 failed item 조회가 올바른지 확인

### CLI unit tests (`tests/unit/cli.test.ts`)

- `--export-failed` 호출 시 exporter 호출 및 output path 검증
- `--all` 호출 시 `getLatestRunningJobByType(MigrationJobType.FULL, blogUrl)` 호출 검증

## Next Actions

1. `db/schema.sql` 업데이트 (blog_url 추가)
2. DB/모델/CLI/service 구현
3. 테스트 업데이트 및 신규 테스트 추가
