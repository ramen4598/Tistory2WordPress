# 010-edit-cli: 수정 계획

1. DB schema 및 enum에 `retry` job type 추가
2. DB helper 함수 추가
   - `getAttemptedTistoryUrlsByBlogUrl(blogUrl)`
   - `getRetryUrlsByBlogUrl(blogUrl)`
3. CLI 수정
   - main mode 상호배타 처리
   - `--all`은 항상 새 FULL job 생성 + 미시도 URL만 실행
   - `--retry-failed`는 새 RETRY job 생성 + retry URL만 실행
4. 테스트 수정
   - `tests/unit/cli.test.ts`에서 기존 resume 로직 및 `--all --retry-failed` 조합 제거/변경
   - `--retry-failed` 단독 실행 테스트 추가
5. 문서 수정
   - `docs/quickstart.md`, `docs/spec.md`, `docs/sequence-diagram.md`
6. `npm run typecheck`, `npm test`로 검증
