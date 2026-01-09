# Tistory2Wordpress

티스토리 블로그를 워드프레스로 이관하는 CLI 도구입니다.

## 프로젝트 소개

티스토리 블로그 포스트를 워드프레스로 마이그레이션하는 CLI 도구입니다. 북마크, 이미지, 카테고리, 태그, 내부 링크 매핑을 지원합니다.

자세한 내용은 [docs/quickstart.md](docs/quickstart.md)와 [docs/spec.md](docs/spec.md)를 참고하세요.

## 설치

```bash
npm install
npm run build
```

## 사용법

**실행하기 전에 워드프레스를 반드시 백업하세요!**

```bash
# 도움말 표시
node dist/cli.js --help

# 단일 포스트 이관
node dist/cli.js --post=https://yourblog.tistory.com/123

# 전체 포스트 이관 (역대 미시도 URL만)
node dist/cli.js --all

# 실패 항목 재시도 (역대 성공한 적 없이 실패만 한 URL만)
node dist/cli.js --retry-failed

# 내부 링크 매핑 내보내기
node dist/cli.js --all --export-links

# 실패한 포스트 목록 내보내기 (DB 기준)
node dist/cli.js --export-failed
```

## 환경변수

`.env` 파일에 필요한 환경변수를 설정하세요. (`.env.example` 참조)

| 이름                              | 설명                                                                                                       | 기본값                                   | 필수 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---- |
| `TISTORY_BLOG_URL`                | 마이그레이션할 티스토리 블로그 주소                                                                        | -                                        | O    |
| `WP_BASE_URL`                     | 워드프레스 설치 주소 (/wp-json 제외)                                                                       | -                                        | O    |
| `WP_APP_USER`                     | 워드프레스 로그인 사용자명                                                                                 | -                                        | O    |
| `WP_APP_PASSWORD`                 | 워드프레스 애플리케이션 비밀번호 (관리자 페이지에서 생성)                                                  | -                                        | O    |
| `WP_POST_STATUS`                  | 생성되는 워드프레스 포스트 상태 (draft, publish, pending, private)                                         | `pending`                                | X    |
| `TISTORY_SELECTOR_POST_LINK`      | 티스토리 포스트 리스트에서 포스트 링크를 찾는 CSS 선택자                                                   | -                                        | O    |
| `TISTORY_SELECTOR_TITLE`          | 포스트 제목을 추출하는 메타 태그 선택자                                                                    | -                                        | O    |
| `TISTORY_SELECTOR_PUBLISH_DATE`   | 포스트 발행일을 추출하는 메타 태그 선택자                                                                  | -                                        | O    |
| `TISTORY_SELECTOR_MODIFIED_DATE`  | 포스트 수정일을 추출하는 메타 태그 선택자                                                                  | -                                        | O    |
| `TISTORY_SELECTOR_CATEGORY`       | 포스트 카테고리를 추출하는 CSS 선택자                                                                      | -                                        | O    |
| `TISTORY_SELECTOR_TAG`            | 포스트 태그를 추출하는 CSS 선택자                                                                          | -                                        | O    |
| `TISTORY_SELECTOR_CONTENT`        | 포스트 본문 컨텐츠를 추출하는 CSS 선택자                                                                   | -                                        | O    |
| `TISTORY_SELECTOR_FEATURED_IMAGE` | 포스트 대표이미지를 추출하는 CSS 선택자                                                                    | -                                        | O    |
| `TISTORY_BOOKMARK_SELECTOR`       | 티스토리 북마크(웹사이트 미리보기)를 감지하는 CSS 선택자                                                   | -                                        | O    |
| `TISTORY_BOOKMARK_TEMPLATE_PATH`  | 북마크 카드 렌더링에 사용할 템플릿 파일 경로                                                               | `./src/templates/bookmark-template.html` | X    |
| `CATEGORY_HIERARCHY_ORDER`        | 포스트에 카테고리가 2개일 때 어느 것을 부모로 할지 결정 (first-is-parent: 첫 번째, last-is-parent: 마지막) | `first-is-parent`                        | X    |
| `WORKER_COUNT`                    | 동시에 처리할 작업자 수 (높일수록 빠르지만 부하 증가)                                                      | 1                                        | X    |
| `RATE_LIMIT_INTERVAL`             | 일정 시간 간격(ms) 동안 요청을 허용하는 기준 간격                                                          | 60000                                    | X    |
| `RATE_LIMIT_CAP`                  | 위 간격(`RATE_LIMIT_INTERVAL`) 동안 허용할 최대 요청 수                                                    | 1                                        | X    |
| `OUTPUT_DIR`                      | 생성된 파일들을 저장할 디렉토리 경로                                                                       | `./output`                               | X    |
| `MIGRATION_DB_PATH`               | 이관 상태를 저장할 SQLite DB 파일 경로                                                                     | `./data/migration.db`                    | X    |
| `LOG_LEVEL`                       | 로그 레벨 (debug: 모든 정보, info: 일반 정보, warn: 경고, error: 에러만)                                   | `info`                                   | X    |
| `LOG_FILE`                        | 로그를 파일로 저장할 경로 (지정하지 않으면 콘솔만 출력)                                                    | -                                        | X    |
| `MAX_RETRY_ATTEMPTS`              | HTTP 요청 실패 시 재시도할 최대 횟수                                                                       | 3                                        | X    |
| `RETRY_INITIAL_DELAY_MS`          | 재시도 시 첫 번째 대기 시간 (ms)                                                                           | 500                                      | X    |
| `RETRY_MAX_DELAY_MS`              | 재시도 시 최대 대기 시간 (ms)                                                                              | 600000                                   | X    |
| `RETRY_BACKOFF_MULTIPLIER`        | 재시도할 때마다 대기 시간을 늘리는 배수 (지수적 백오프)                                                    | 10                                       | X    |

## 주요 기능

- **단일/전체 블로그 이관**: 개별 포스트 또는 전체 블로그 이관
- **티스토리 메타데이터 보존**: 제목, 발행일, 썸네일 유지
- **카테고리 및 태그 이관**: 티스토리 카테고리 및 태그 그대로 유지
- **북마크, 유튜브 처리**: 북마크 및 유튜브 링크 보존
- **이미지 이관**: 워드프레스 미디어 라이브러리로 이미지 다운로드 및 업로드
- **컨텐츠 정제**: 불필요한 HTML 태그 및 속성 제거, 구조 보존
- **내부 링크 추적**: 자신의 다른 티스토리 블로그 글을 참조한 블로그 글을 기록. 워드프레스 이관 후에도 수정해야할 내부 링크 목록 제공.
- **재시도 지원**: 실패한 URL 재시도

**중요: 티스토리 글에 포함된 동영상(비디오) 파일은 이 도구가 자동으로 워드프레스로 업로드하지 않습니다.**
마이그레이션 후 워드프레스에서 동영상은 별도로 다시 업로드/삽입해야 합니다.

**중요: 내부 링크는 이 도구가 자동으로 업데이트하지 않습니다.**
이관 후 내부 링크는 `--export-links`로 내보낸 매핑 파일을 참고하여 수동으로 업데이트해야 합니다.

자세한 기능 설명과 한계점은 [docs/spec.md](docs/spec.md)를 참고하세요.

## 개발

```bash
# 의존성 설치
npm install

# 테스트 실행
npm test

# 린팅
npm run lint

# 타입 체크
npm run typecheck

# 빌드
npm run build
```

## 문서

- [빠른 시작](docs/quickstart.md) - 상세 사용법
- [기능 스펙](docs/spec.md) - 제공 기능 및 한계점
- [시퀀스 다이어그램](docs/sequence-diagram.md) - 주요 동작 흐름

## 라이선스

[MIT License](LICENSE)
