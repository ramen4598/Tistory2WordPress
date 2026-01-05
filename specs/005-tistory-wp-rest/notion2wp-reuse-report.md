# Notion2Wordpress 재사용 보고서 (005 Tistory → WP REST)

## 1. 개요

`tmp/Notion2Wordpress-main/docs/diagrams/`의 시퀀스 다이어그램과 `tmp/Notion2Wordpress-main/src/`의 소스코드를 분석한 결과, 우리 Tistory → WordPress REST 마이그레이션(스펙 005)에서 직접 재사용하거나 강하게 참고할 수 있는 부분은 다음 다섯 축으로 정리된다.

- WordPress REST 클라이언트 패턴 (`wpService.ts`)
- 인메모리 이미지 다운로드/업로드 파이프라인 (`imageDownloader.ts` + `uploadMedia`)
- 재시도/로깅 유틸리티 (`retryWithBackoff`, `logger`)
- 페이지(포스트) 단위 오케스트레이션 + **롤백 패턴** (`syncOrchestrator.ts` + 시퀀스 다이어그램)
- **SQLite 기반 상태 저장 및 Job/Item/Asset 모델링** (`db`, `schema.sql`)

또한 새로운 결정사항으로:

1. 상태 저장은 JSON 파일이 아니라 Notion2Wordpress와 동일하게 **SQLite**를 사용한다.
2. Notion2Wordpress처럼 **포스트 단위 롤백은 필수** 요구 사항이다.

이 보고서는 위 결정사항을 반영하여 각 요소를 어떻게 우리 코드 구조(`wpClient.ts`, `imageProcessor.ts`, `migrator.ts`, SQLite DB 계층, 워커/CLI)에 적용할지 정리한다.

---

## 2. WordPress REST 클라이언트 패턴 → `wpClient.ts`

### 2.1 Notion2Wordpress `wpService.ts` 요약

- Axios 인스턴스 한 번 생성 후 재사용
  - `baseURL: config.wpApiUrl`
  - Basic Auth: `Buffer.from(`${config.wpUsername}:${config.wpAppPassword}`).toString('base64')`
- 기능 단위 메서드 제공
  - `createDraftPost({ title, content, status })`
  - `uploadMedia({ buffer, filename, contentType, altText })`
  - `deletePost(postId)`, `deleteMedia(mediaId)`
  - `replaceImageUrls(html, imageMap)` – HTML 내 플레이스홀더를 WP URL로 치환
- 모든 HTTP 호출에 `retryWithBackoff` + 구조화된 로깅을 적용
- `isAxiosError`로 HTTP status를 포함한 에러 메시지 생성

### 2.2 우리 프로젝트에서의 활용 방안

1. `src/services/wpClient.ts` 설계

- Axios 인스턴스
  - Base URL: `WP_BASE_URL` + `/wp-json`
  - Basic Auth: `WP_APP_USER`, `WP_APP_PASSWORD` 환경 변수 사용
- 메서드 설계 (우선순위)
  - `createDraftPost(options)`
    - 입력: `title`, `content`, `status = 'draft'`, `date`, `date_gmt`, `modified`, `modified_gmt`, `categories`, `tags`, `featured_media` 등
    - 출력: `id`, `link`, `status`, `date`, `modified`
  - `uploadMedia(options)`
    - 입력: `buffer`, `filename`, `contentType`, `altText`
    - 출력: `id`, `source_url`, `media_type`, `mime_type`
  - (추가) `ensureCategory(name, parent?)`, `ensureTag(name)`
    - WordPress REST `/categories`, `/tags` 엔드포인트 래핑
    - 카테고리/태그 존재 여부 확인 후 없으면 생성
  - (롤백용) `deletePost(postId)`, `deleteMedia(mediaId)`를 필수적으로 구현
- 에러 처리
  - Notion2Wordpress와 동일하게 `getAxiosErrorMessage` 유틸을 두고
  - `isAxiosError` 기반으로 `message + (HTTP status)`를 만들고 로깅

2. 재시도 전략 적용

- `retryWithBackoff`를 공용 유틸로 사용
- `wpClient`의 모든 네트워크 호출 (`createDraftPost`, `uploadMedia`, `ensureCategory`, `ensureTag`, `deletePost`, `deleteMedia` 등)에 적용
- 재시도 관련 설정은 `config.ts`에 추가:
  - `maxRetryAttempts`, `retryInitialDelayMs`, `retryMaxDelayMs`, `retryBackoffMultiplier`

3. URL 치환 헬퍼 재사용

- Notion2Wordpress의 `replaceImageUrls(html, imageMap)` 패턴을 차용
- 우리 쪽에서는 `originalTistoryImageUrl → wpMediaUrl` 매핑을 `Map<string, string>`으로 유지한 후, `Post.cleaned_html`에 대해 치환 수행
- 구현 위치는 `wpClient` 또는 `imageProcessor` 중 선택 가능하나, 현재 스펙 상 `imageProcessor` 내부 헬퍼로 두는 편이 자연스러움

---

## 3. 인메모리 이미지 파이프라인 → `imageProcessor.ts`

### 3.1 Notion2Wordpress 이미지 처리 흐름

참조 파일: `imageDownloader.ts`, `wpService.uploadMedia`, `syncOrchestrator.syncImage`.

- `imageDownloader.download({ url })`
  - `axios.get(url, { responseType: 'arraybuffer', timeout, headers })`
  - Buffer 생성, `content-type` 추출, sha256 hash 계산, 크기(bytes) 계산
  - URL은 로그에 남길 때 `sanitizeUrl`로 쿼리와 프래그먼트 제거
- `syncOrchestrator.syncImage(...)`
  - `imageDownloader.download`로 이미지 데이터를 메모리(Buffer)로 가져옴
  - `getExtensionFromContentType(contentType)`로 확장자 결정
  - 파일명: `원래이름 + hash prefix`로 충돌 방지
  - `wpService.uploadMedia({ buffer, filename, contentType, altText })`
  - 결과 `media.id`, `media.url`을 DB에 기록하고, `imageMap`에 `placeholder → media.url` 저장
  - 모든 과정에서 디스크 쓰기 없음 (인메모리 처리)

이 흐름은 우리가 스펙에서 정한:

> "이미지는 다운로드해서 파일로 저장하지 않음. 메모리에 보관하다가 바로 업로드한다."

와 완전히 일치한다.

### 3.2 우리 프로젝트에서의 활용 방안

1. `src/services/imageProcessor.ts`의 기본 구조

- `downloadImage(url: string)`
  - Notion2Wordpress `ImageDownloader.download`를 거의 그대로 사용
  - 변경점:
    - User-Agent: `Tistory2Wordpress/<VERSION>` 등으로 변경
    - 설정 값: `config.imageDownloadTimeoutMs` 등을 우리 `config.ts`에 맞춤
- `processImagesForPost(post: Post, context: { jobItemId: number; })` (또는 유사한 이름)
  - 입력: Tistory에서 파싱된 `Post` 객체 (이미지 URL 리스트 + `cleaned_html` 포함)와, DB에서 관리하는 Job Item ID
  - 처리 단계:
    - 각 `post.images`에 대해
      - `downloadImage(image.url)` → Buffer, contentType, hash 획득
      - `getExtensionFromContentType(contentType)`로 확장자 결정
      - 파일명: `원본파일명 + '-' + hashPrefix + '.' + ext`
      - `wpClient.uploadMedia({ buffer, filename, contentType, altText })`
      - 결과로 받은 `wp_media_id`, `wp_media_url`을 `Image` 모델 필드에 저장
      - **DB의 image asset 테이블에**
        - Tistory URL, WP media ID/URL, 상태(Uploaded/Failed)를 기록
      - `originalUrl → wp_media_url` 매핑을 로컬 `Map<string, string>`에 추가
    - `post.cleaned_html` 내에서 URL 치환 (Notion2Wordpress의 `replaceImageUrls` 패턴 활용)
  - 출력:
    - 업데이트된 `post` (이미지 메타와 HTML이 WordPress 기준으로 정리된 상태)
    - 업로드된 media ID 리스트 (롤백 시 사용)

2. 동시성 및 에러 처리

- Notion2Wordpress의 `syncImages` 구조를 참고하여 다음과 같이 구성:
  - `maxConcurrentImageDownloads`를 `config.ts`에 추가
  - 이미지들을 `maxConcurrent` 크기 배치로 나누어 `Promise.allSettled`로 처리
  - 실패한 결과들을 모아 개수/메시지를 합쳐 하나의 에러로 throw
- 에러 처리 시:
  - 이미지 동기화 중 하나라도 실패하면 해당 포스트의 이미지 동기화 전체를 실패로 간주
  - 관련 image asset 레코드를 `Failed` 상태로 업데이트하고, 에러 메시지를 기록
  - 상위 레벨(`migrator`)에서 포스트 단위 롤백을 트리거

---

## 4. 오케스트레이션 + 롤백 패턴 → `migrator.ts` 및 워커

### 4.1 Notion2Wordpress 시퀀스 다이어그램 & `syncOrchestrator.ts` 요약

메인 시퀀스(성공/실패 모두 동일 구조)를 요약하면:

- `executeSyncJob(jobType)`
  - DB에서 마지막 동기화 시점 조회
  - Notion에서 동기화 대상 페이지 조회
  - `syncPages(syncJob, pages)` 호출
  - 결과를 DB에 업데이트하고 Telegram 알림 전송
- `syncPages(syncJob, pages)`
  - 각 Notion 페이지에 대해 `syncPage(jobId, page)` 호출
  - 각 페이지의 성공/실패를 카운팅하고, 개별 오류를 `syncJob.errors`에 축적
- `syncPage(jobId, page)`
  - DB에 SyncJobItem 생성
  - Notion에서 HTML + 이미지 정보 가져오기 (`getPageHTML`)
  - `syncImages(syncJobItem, imageMap, images)`로 이미지 다운로드/업로드 수행
  - `wpService.replaceImageUrls(html, imageMap)`으로 최종 HTML 생성
  - `wpService.createDraftPost`로 워드프레스 포스트 생성
  - DB 매핑 생성, Notion 상태 업데이트, JobItem 상태 성공으로 변경
  - 중간에 실패 시 `rollback` 수행 (업로드된 media, post 삭제 + 상태 업데이트)

### 4.2 우리 `migrator.ts` 설계에의 적용

우리 스펙에서 요구하는 것은 "포스트 단위 파이프라인" + "포스트 단위 롤백"이므로, `syncPage` 패턴을 그대로 가져와 다음과 같이 매핑할 수 있다.

- `migratePostByUrl(tistoryUrl: string, jobId: number)` (단일 포스트)
  - DB에 **JobItem 레코드 생성** (Tistory URL 기준)
  - `crawler.fetchPost(tistoryUrl)`
    - HTML, 메타데이터(제목, 발행일, 수정일, 카테고리/태그, 이미지 URL 등) 파싱
  - `cleaner.clean(rawHtml)`
    - Tistory 특유 HTML/CSS 제거
    - HTML → Markdown → HTML 재정리
    - 내부 링크 추출 (`InternalLink` 리스트)
  - `imageProcessor.processImagesForPost(post, { jobItemId })`
    - 인메모리 이미지 다운로드/업로드
    - `post.cleaned_html` 내 URL을 WP media URL로 치환
    - 업로드된 media ID 리스트를 반환 → JobItem에 연결
  - `wpClient.ensureCategories/Tags(...)` (필요 시)
  - `wpClient.createDraftPost({ ... })`
    - 상태: `draft`
    - 날짜: Tistory 발행/수정일 유지
    - 분류: categories, tags, featured_media 등
  - DB에 **Tistory URL ↔ WP Post ID 매핑 테이블** 업데이트
  - DB의 JobItem 상태를 `Completed`로 갱신
  - 내부 링크 매핑은 별도 테이블/칼럼으로 관리 (`link_mapping` 테이블 등)

- 전체 블로그 모드 (`--all`)에서는
  - crawler가 Tistory 페이지를 페이지네이션으로 순회하며 URL 리스트를 수집
  - 상위 Job 컨텍스트(예: `SyncJob`)를 생성하고, 각 URL에 대해 `migratePostByUrl(jobId, url)` 실행
  - 실패한 포스트는 JobItem 상태를 `Failed`로 기록하고, Job 차원에서는 `pagesFailed` 카운터 증가

### 4.3 포스트 단위 롤백 정책 (필수 요구 사항)

새로운 결정사항에 따라, 포스트 단위 롤백은 **선택이 아니라 필수**다. Notion2Wordpress의 `rollback` 구현을 그대로 참고하여 다음과 같이 설계한다.

- 각 포스트 마이그레이션 동안 추적해야 할 정보
  - JobItem ID
  - 생성된 WP Post ID (없는 경우도 있음)
  - 업로드된 WP Media ID 리스트
  - Tistory 포스트 URL, 제목 등 식별자
- 롤백 트리거 조건
  - `migratePostByUrl` 수행 중 **어느 단계에서든** 예외 발생 시 (크롤링 실패, 클리닝 실패, 이미지 처리 실패, WP API 실패 등)
- 롤백 동작
  - 업로드된 media ID 리스트에 대해
    - `wpClient.deleteMedia(mediaId)`를 비동기로 호출하고, 실패 시 경고 로그 남김
  - WP Post가 이미 생성된 경우
    - `wpClient.deletePost(postId)`를 비동기로 호출하고, 실패 시 경고 로그 남김
  - DB의 JobItem 레코드
    - 상태를 `Failed`로 변경
    - 에러 메시지를 `error_message` 필드에 기록
  - (선택) 별도 오류 테이블/로그 테이블이 있다면 거기에도 적재
- 비동기 처리 전략
  - Notion2Wordpress처럼 롤백 내에서 fire-and-forget 패턴을 사용할 수 있으나,
  - 우리 쪽에서는 가능하면 롤백이 끝나기 전까지 `await`로 기다리는 동기 롤백을 우선 고려하고,
  - 성능·경쟁 조건을 검토 후 필요 시 fire-and-forget으로 완화하는 것이 좋다.

---

## 5. SQLite 기반 상태 저장 및 모델링 → `db` 계층

### 5.1 Notion2Wordpress의 DB 구조 개요

참조 파일: `config/schema.sql`, `src/db/index.ts`, `src/enums/db.enums.ts`, `src/orchestrator/syncOrchestrator.ts`.

- 주요 개념 테이블
  - `sync_jobs`
    - 전체 Job 단위 메타데이터 (job 타입, 상태, 마지막 동기화 시점 등)
  - `sync_job_items`
    - 개별 Notion 페이지 단위 상태 (WP 포스트 ID, 업로드된 media IDs, 상태 등)
  - `image_assets`
    - 개별 이미지 단위 상태 (Notion URL, WP media ID/URL, 상태, 에러 메시지 등)
  - `page_post_map`
    - Notion 페이지 ID ↔ WordPress Post ID 매핑
- `src/db/index.ts`에서 위 스키마를 바탕으로 CRUD 메서드 제공
  - `createSyncJob`, `updateSyncJob`, `getLastSyncTimestamp` 등
  - `createSyncJobItem`, `updateSyncJobItem`
  - `createImageAsset`, `updateImageAsset`
  - `createPagePostMap`

### 5.2 우리 프로젝트에서의 SQLite 활용 방안

새 결정사항에 따라, 기존에 JSON 파일로 설계되어 있던 `MigrationState`는 다음과 같이 **SQLite 기반**으로 재설계한다.

- 데이터베이스
  - 파일: 예) `migration.db` (경로는 `config`에서 관리)
- 주요 테이블(초안)
  - `migration_jobs`
    - 마이그레이션 모드, 시작/종료 시간, 전체 포스트 수, 성공/실패 개수, 상태 등
  - `migration_job_items`
    - 단일 Tistory 포스트 URL 단위
    - 칼럼 예: `id`, `job_id`, `tistory_url`, `wp_post_id`, `status`, `error_message`, `created_at`, `updated_at`
  - `migration_image_assets`
    - 개별 이미지 단위
    - 칼럼 예: `id`, `job_item_id`, `tistory_image_url`, `wp_media_id`, `wp_media_url`, `status`, `error_message`, `created_at`, `updated_at`
  - `tistory_wp_post_map`
    - Tistory 포스트 ID/URL ↔ WP Post ID/URL 매핑
  - (선택) `internal_links`
    - 내부 링크 매핑(`link_mapping.json`에 들어갈 내용)을 테이블로 유지하고, 필요 시 JSON으로 덤프
- DB 계층(`src/db/index.ts` 유사 구조)
  - Notion2Wordpress의 `db` 모듈을 참고하여 TypeScript 래퍼 생성
  - 제공 메서드 예:
    - `createMigrationJob`, `updateMigrationJob`, `getLastMigrationTimestamp`
    - `createMigrationJobItem`, `updateMigrationJobItem`
    - `createImageAsset`, `updateImageAsset`
    - `createPostMap`, `getPostMapByTistoryUrl`

SQLite를 사용함으로써 얻는 이점:

- 대규모 블로그에서도 상태 저장/조회가 효율적
- 부분 재시도, 재시작, 통계/리포트 생성이 용이
- Notion2Wordpress와 거의 동일한 운영 모델 사용 가능

---

## 6. 재시도 및 로깅 유틸리티 → `retry.ts`, `logger.ts`

### 6.1 `retryWithBackoff`

- 위치: `tmp/Notion2Wordpress-main/src/lib/retry.ts`
- 기능:
  - `fn: () => Promise<T>`를 받아 최대 `maxAttempts`까지 실행
  - 실패 시 `initialDelayMs`부터 시작해서 `backoffMultiplier` 배수로 지수 증가
  - `maxDelayMs` 상한을 갖는 지수 백오프
  - 각 시도 실패 시 로그 및 `onRetry` 콜백 호출

우리 쪽 활용 방안:

- `src/utils/retry.ts`로 유사 구현 추가
- 적용 대상:
  - `wpClient`의 모든 REST 호출 (post 생성, media 업로드, taxonomy API, 삭제 API 포함)
  - `imageProcessor`의 이미지 다운로드
  - (선택) `crawler`의 HTTP 요청에도 적용해 Tistory 간헐 오류 대응

### 6.2 `logger` 패턴

- 위치: `tmp/Notion2Wordpress-main/src/lib/logger.ts`
- 특징:
  - `LogLevel` enum + 환경 변수(`config.logLevel`)로 현재 레벨 결정
  - `debug/info/warn/error` 네 가지 수준
  - 구조화된 JSON 형태(`message` + 추가 데이터)를 콘솔에 출력

우리 쪽 활용 방안:

- 이미 `src/utils/logger.ts`가 존재하므로, 인터페이스(`debug/info/warn/error`)를 Notion2Wordpress 패턴과 유사하게 유지
- 새로운 모듈(`wpClient`, `imageProcessor`, `migrator`, DB 계층)에서
  - 모든 중요 이벤트(HTTP 호출, 재시도, 실패, 성공, 롤백)를 `logger`를 통해 기록
  - 나중에 문제 발생 시, Notion2Wordpress와 비슷한 수준의 추적이 가능하도록 로그 메시지 포맷을 일관되게 유지

---

## 7. 우리 코드로의 구체적 이식 포인트 요약

1. `wpService.ts` → `src/services/wpClient.ts`
   - Axios 인스턴스 + Basic Auth
   - `createDraftPost`, `uploadMedia`, `deletePost`, `deleteMedia`, `replaceImageUrls`
   - `retryWithBackoff` + `getAxiosErrorMessage` 패턴

2. `imageDownloader.ts` → `src/services/imageProcessor.ts` 내부
   - `axios.get(..., responseType: 'arraybuffer')`로 인메모리 다운로드
   - hash 기반 안전 파일명 생성
   - MIME 타입에 따라 확장자 결정 (`getExtensionFromContentType`)
   - 업로드된 media ID를 롤백용으로 리턴하고, SQLite 이미지 자산 테이블과 연동

3. `syncOrchestrator.ts` → `src/services/migrator.ts`
   - 포스트 단위 파이프라인 함수 설계 (`migratePostByUrl` 등)
   - 이미지 배치 처리, 에러 집계, 실패 포스트만 개별적으로 표시하는 정책
   - 포스트 단위 롤백 구현 (업로드된 media/post 삭제 + DB 상태 업데이트)

4. `config/schema.sql` + `src/db/index.ts` → 우리 SQLite DB 계층
   - Job/JobItem/ImageAsset/Mapping 테이블을 정의하고, TypeScript 래퍼 제공
   - 기존 JSON 기반 `MigrationState` 설계는 SQLite 기반으로 대체

5. `retry.ts` → `src/utils/retry.ts`
   - 네트워크/외부 서비스 호출 안정성을 위한 공통 유틸

6. `logger.ts` → 기존 `logger`와 패턴 통일
   - 새로운 모듈에서 일관된 로깅 사용 (특히 롤백 경로 포함)

이상의 재사용 전략과 보강된 결정사항(SQLite 상태 저장, 포스트 단위 롤백 필수)을 기반으로, 다음 단계에서는

- SQLite 스키마 초안 및 DB 래퍼 인터페이스 정의
- `wpClient.ts`, `imageProcessor.ts`의 구체 시그니처 및 기본 구현 스켈레톤 작성
- `migrator.ts`의 포스트 단위 오케스트레이션 및 롤백 흐름을 코드 레벨에서 정의

하는 순서로 진행하는 것이 자연스럽다.
