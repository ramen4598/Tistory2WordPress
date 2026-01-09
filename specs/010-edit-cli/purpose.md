# 010-edit-cli: 수정 목적

## 배경

기존 CLI의 `--all` 동작은 "실행 중인 FULL job이 있으면 resume"하는 방식이었고, `--retry-failed`는 `--all`의 보조 옵션으로 동작했습니다.

그러나 이 방식은 다음 문제를 만들었습니다:

- `--retry-failed`를 단독으로 실행할 수 없음
- "역대" 기준이 아니라 특정 job 기준으로만 완료/실패를 판단하여 사용자가 기대하는 재시도/전체 이관 동작과 어긋남

## 목표

- `--post=<url> | --all | --retry-failed` 를 상호배타(main mode)로 만들기
- `--all`: "역대 한 번도 시도되지 않은 URL"만 이관 ("시도 여부"는 `migration_job_items` 존재 여부로 판단)
- `--retry-failed`: "역대 실패했지만 성공(COMPLETED) 이력이 단 한 번도 없는 URL"만 재시도
- job type에 `RETRY`를 추가하여 재시도 job을 구분

## 비목표

- 기존 SQLite DB에 대한 마이그레이션/호환성 유지
  - 사용자는 기존 DB를 삭제하고 새 DB로 다시 실행하는 것을 전제로 합니다.
