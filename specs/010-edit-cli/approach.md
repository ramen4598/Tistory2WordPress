# 010-edit-cli: 수정 방법

## 1) main mode 상호배타

- 허용: `--post=<url>` 또는 `--all` 또는 `--retry-failed`
- 위 플래그를 동시에 2개 이상 사용하면 usage 출력 후 종료(code=1)
- `--export-links`는 기존처럼 마이그레이션 실행 시 옵션으로 유지
- `--export-failed`는 기존처럼 "export-only" 모드로 유지

## 2) --all: 미시도 URL만 실행

1. Crawler로 blog 전체 URL을 발견: `allUrls`
2. DB에서 "역대 시도된 URL"을 조회

```sql
SELECT DISTINCT mji.tistory_url
FROM migration_job_items mji
JOIN migration_jobs mj ON mji.job_id = mj.id
WHERE mj.blog_url = ?
```

3. JS에서 Set 기반으로 필터링

```ts
const attemptedSet = new Set(attemptedUrls);
const pendingUrls = allUrls.filter((url) => !attemptedSet.has(url));
```

## 3) --retry-failed: 실패했지만 성공 이력 없는 URL만 실행

DB에서 "역대 실패했지만 성공 이력 없는 URL"을 조회합니다.

```sql
SELECT mji.tistory_url
FROM migration_job_items mji
JOIN migration_jobs mj ON mji.job_id = mj.id
WHERE mj.blog_url = ?
GROUP BY mji.tistory_url
HAVING
  SUM(CASE WHEN mji.status = 'completed' THEN 1 ELSE 0 END) = 0
  AND SUM(CASE WHEN mji.status = 'failed' THEN 1 ELSE 0 END) > 0
```

## 4) RETRY JobType

- 재시도 실행(`--retry-failed`) 시 `migration_jobs.job_type='retry'`로 job을 생성합니다.
- FULL/SINGLE과 분리하여 재시도 실행 이력을 구분합니다.
