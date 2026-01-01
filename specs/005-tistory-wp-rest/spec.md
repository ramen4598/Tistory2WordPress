# Feature Specification: Tistory → WordPress REST Migration

**Feature Branch**: `005-tistory-wp-rest`  
**Created**: 2026-01-01  
**Status**: Draft  
**Input**: Based on `/requirements.md` (Tistory→WordPress REST migration) and `specs/003-name-tistory-wxr-generator/spec.md` (WXR 제외 나머지 결정 재사용)

## Clarifications

### Session 2026-01-01

- Q: Export 형식은 기존 WXR 대신 무엇을 사용할까?  
  A: WordPress REST API를 사용해 직접 WordPress 인스턴스로 업로드한다. 중간 산출물로의 WXR 파일은 생성하지 않는다.
- Q: 첨부파일(이미지 외 파일)은 어떻게 처리할까?  
  A: 요구사항 상 범위에서 제외한다. 이미지는 마이그레이션 대상이지만 파일 첨부(zip, pdf 등)는 업로드하지 않는다.
- Q: 내부 링크는 자동으로 WordPress 링크로 바꿔야 할까?  
  A: 자동 수정은 범위 밖이다. 대신 `link_mapping.json`에 Tistory 내부 링크를 기록하여 후속 수동 작업에 활용한다.
- Q: 병렬 처리와 속도 제한은 어떻게 조합할까?  
  A: 고정 워커 수(worker pool)를 두고, 각 워커는 설정된 rate limit 내에서 요청을 보내도록 한다. 워커 수와 rate limit은 env로 조절한다.
- Q: 기존 WXR Generator/Notion2WordPress 코드 재사용 범위는?  
  A: HTML 크리닝, 이미지 다운로드/업로드, 상태 관리/로깅 패턴은 최대한 재사용한다. 출력 경로나 최종 포맷(WXR → REST POST 호출)만 변경한다.

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 단일 Tistory 게시글을 WordPress Draft로 마이그레이션 (Priority: P1)

As a migration operator, I can process one Tistory post end-to-end (crawl → clean HTML → 이미지 다운로드 및 업로드 → 내부 링크 추출 → WordPress REST API로 Draft 업로드) so that each post can be independently migrated and 검증될 수 있다.

**Why this priority**: 단일 포스트 단위 파이프라인이 전체 시스템의 최소 단위이며, 이를 통해 전체 마이그레이션의 품질과 안정성을 검증할 수 있다.

**Independent Test**: 특정 Tistory 게시글 URL을 대상으로 CLI를 실행했을 때, WordPress에 Draft 상태의 게시글이 생성되고, 내용/이미지/카테고리/태그/작성일이 요구사항대로 반영되는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 유효한 Tistory 블로그 URL과 WordPress REST 인증 정보가 env에 설정되어 있고, 마이그레이션 대상 게시글이 하나 존재할 때, **When** CLI를 단일 포스트 모드로 실행하면, **Then** WordPress에 Draft 상태의 게시글이 1건 생성되고 제목, 본문, 카테고리, 태그, 작성일, (가능하다면) 수정일이 Tistory와 일치한다.
2. **Given** 게시글 본문에 Tistory 특유의 HTML/CSS 구조가 포함되어 있을 때, **When** 마이그레이션이 완료되면, **Then** WordPress에 저장된 HTML은 HTML→Markdown→HTML 과정을 거친 깨끗한 구조이며, 가독성이 유지된다.
3. **Given** 게시글에 하나 이상의 이미지가 포함되어 있을 때, **When** 마이그레이션이 완료되면, **Then** 해당 이미지는 WordPress 미디어 라이브러리에 업로드되고, 게시글 본문 내 이미지 URL은 업로드된 WordPress 미디어 URL로 교체된다.

---

### User Story 2 - 전체 블로그 게시글을 일괄 마이그레이션 (Priority: P1)

As a migration operator, I can run the CLI once with a Tistory blog URL and migrate all posts (with pagination, 재시도/재개 기능 포함) so that 대량의 게시글도 신뢰성 있게 WordPress로 옮길 수 있다.

**Why this priority**: 실제 사용 시 대부분은 블로그 전체 이전을 원하므로, 일괄 마이그레이션이 핵심 시나리오이다.

**Independent Test**: 여러 페이지에 걸친 Tistory 블로그를 대상으로 전체 마이그레이션을 실행하고, 모든 게시글이 한 번씩만 WordPress에 생성되며, 중간 실패 후 재실행하더라도 중복 없이 나머지만 처리되는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 여러 페이지로 구성된 Tistory 블로그가 있고, **When** CLI를 블로그 전체 모드로 실행하면, **Then** 페이지네이션을 통해 모든 게시글을 찾아내고, 각 게시글을 한 번씩만 처리한다.
2. **Given** 100개의 게시글 중 40개까지 처리된 시점에서 네트워크 오류로 프로세스가 중단되었을 때, **When** CLI를 동일 설정으로 다시 실행하면, **Then** 이미 처리된 40개는 건너뛰고 나머지 60개만 처리하여 최종적으로 100개의 Draft가 WordPress에 생성된다.
3. **Given** Tistory 또는 WordPress 측 rate limit 제약이 있을 때, **When** 마이그레이션을 진행하면, **Then** 설정된 요청 속도 제한과 backoff 전략을 준수하여 차단 없이 작업을 완료하거나, 과도한 오류 발생 시 명확한 에러 메시지를 남기고 종료한다.

---

### User Story 3 - 내부 Tistory 링크 추적 (Priority: P2)

As a migration operator, I can 얻은 모든 내부 Tistory 링크 정보를 `link_mapping.json` 파일로 확인하여, 마이그레이션 후 수동으로 링크를 검토/수정할 수 있다.

**Why this priority**: 자동 링크 변환은 범위 밖이지만, 내부 링크 정보를 체계적으로 수집하면 후처리를 훨씬 수월하게 할 수 있다.

**Independent Test**: 내부 링크가 포함된 여러 게시글을 처리한 뒤 생성된 `link_mapping.json`을 검토하여, 소스/타겟 URL이 모두 올바르게 기록되었는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 두 게시글이 서로 혹은 일방향으로 링크하고 있고, 링크 대상이 동일 Tistory 블로그 도메인일 때, **When** 마이그레이션을 완료하면, **Then** `link_mapping.json`에 각 내부 링크에 대해 source URL(또는 ID)와 target Tistory URL이 기록된다.
2. **Given** 내부 링크가 전혀 없는 블로그를 처리했을 때, **When** 마이그레이션을 완료하면, **Then** `link_mapping.json`은 비어 있거나 생성되지 않는다.

---

### User Story 4 - 설정 및 관측 가능성 (Priority: P3)

As a migration operator, I can Tistory URL, WordPress REST endpoint/인증 정보, 워커 수, 속도 제한 등 운영 파라미터를 환경변수/설정 파일로 제어하고, 로그 및 상태 파일을 통해 진행 상황과 오류를 파악할 수 있다.

**Why this priority**: 서로 다른 블로그 및 서버 환경에 맞춰 안전하게 동작하도록 튜닝하고, 문제 상황을 빠르게 진단하기 위해 필요하다.

**Independent Test**: 서로 다른 설정 값으로 CLI를 여러 번 실행하여, 설정 변경이 실제 동작(동시성, 요청 속도, 타겟 WordPress 인스턴스)에 반영되는지와, 로그/상태 파일을 통해 어떤 게시글이 어떻게 처리되었는지 추적 가능한지 확인한다.

**Acceptance Scenarios**:

1. **Given** 환경변수로 Tistory 블로그 URL, WordPress 기본 URL, Application Password 기반 인증 정보, worker 수, 요청 간 최소 간격을 설정했을 때, **When** CLI를 실행하면, **Then** 해당 설정 값을 사용해 크롤러와 REST 클라이언트가 동작한다.
2. **Given** 일부 게시글에서 이미지 다운로드 실패/WordPress 업로드 실패가 발생했을 때, **When** 로그와 상태 파일을 확인하면, **Then** 어떤 게시글, 어떤 리소스에서 어떤 오류가 발생했는지 식별할 수 있다.
3. **Given** 동일 블로그에 대해 서로 다른 rate limit 설정으로 두 번 마이그레이션을 수행했을 때, **When** 실행 시간과 요청 패턴을 비교하면, **Then** rate limit 설정이 실제 HTTP 요청 빈도에 반영된 것이 로그에서 확인된다.

---

### Edge Cases

- Tistory 블로그 URL이 잘못되었거나 접속 불가한 경우: 빠르게 실패하고 명확한 에러 메시지 출력.
- 게시글에 제목이나 본문이 비어 있는 경우: 가능한 한 마이그레이션을 진행하되, 누락 필드는 기본값/플래그로 표시하고 로그에 기록.
- 게시글 HTML이 심각하게 깨져 있을 경우: 크리닝 시 최대한 복구를 시도하되, 실패 시 원문 일부라도 유지하고 경고 로그 남김.
- 동일한 카테고리/태그 이름이 여러 게시글에서 반복될 경우: WordPress 상에서는 중복 생성 없이 하나의 taxonomy term으로 매핑.
- 매우 긴 게시글(예: 50,000+자) 또는 이미지가 매우 많은 게시글: 별도의 메모리/시간 제한은 없음. 다만, 진행 상황을 알 수 있도록 로그와 state 파일에 중간 상태 기록.
- WordPress 인증 실패 또는 권한 부족: 모든 마이그레이션 작업을 중단하고, 재시도 전에 설정을 점검하도록 안내.
- downloads 디렉토리 권한/존재 문제: 디렉토리 생성 실패 시 이미지 처리 자체를 disable하거나 에러로 중단, 로그에 사유 남김.
- Tistory DOM 구조 변경: 파서가 예상하지 못한 구조를 만나면, 최소한 게시글 URL과 에러 내용을 로깅하여 후속 분석 가능하게 한다.

---

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: 시스템은 Tistory 블로그 URL을 환경변수(예: `TISTORY_BLOG_URL`)로 입력받아야 한다.
- **FR-002**: 시스템은 TypeScript로 구현되어야 하며, 기존 WXR Generator 코드베이스의 크롤러/클리너/모델 구조를 최대한 재사용해야 한다.
- **FR-003**: 시스템은 블로그 목록 페이지를 크롤링하여 모든 게시글 URL을 수집해야 하며, 페이지네이션을 처리하여 누락 없이 전체 게시글을 찾을 수 있어야 한다.
- **FR-004**: 시스템은 각 게시글에 대해 제목, 본문 HTML, 작성일, 수정일(가능하다면), 게시글 URL, 카테고리(계층 구조 포함), 태그, 이미지(URL 및 ALT 텍스트)를 파싱해야 한다.
- **FR-005**: 시스템은 각 게시글을 독립적인 파이프라인(크롤링 → 데이터 정제 → 이미지 다운로드/업로드 → 내부 링크 추적 → WordPress 업로드)으로 처리해야 하며, 전체 일괄 처리 대신 포스트 단위 반복 구조를 기본으로 한다.
- **FR-006**: 시스템은 HTML 본문을 Markdown으로 변환한 뒤 다시 HTML로 변환하여, Tistory 전용 HTML/CSS 구조를 제거하고 최대한 깔끔한 HTML을 생성해야 한다.
- **FR-007**: 시스템은 게시글 본문 내 Tistory 블로그를 가리키는 내부 링크를 식별해야 하며, 각 링크의 source(게시글 URL/ID)와 target(Tistory URL)을 `link_mapping.json`에 기록해야 한다.
- **FR-008**: 시스템은 게시글 내 이미지 URL을 기반으로 이미지를 다운로드한 뒤 (메모리에 보관), WordPress 미디어 라이브러리에 업로드해야 한다. (Notion2WordPress 코드 참고)
- **FR-009**: 시스템은 WordPress 미디어 업로드 후 반환된 URL 또는 미디어 ID를 사용하여, 게시글 본문 내 이미지 URL을 WordPress 미디어 URL로 교체해야 한다.
- **FR-010**: 시스템은 WordPress REST API를 사용해 게시글을 생성해야 하며, 생성 시 카테고리, 태그, 이미지(대표 이미지 또는 갤러리)를 함께 설정해야 한다.
- **FR-011**: 시스템은 WordPress 게시글의 `post_date`를 Tistory 작성일로 설정해야 하며, 가능하다면 수정일도 WordPress의 수정 시각 필드에 반영해야 한다.
- **FR-012**: 시스템은 WordPress에 생성되는 모든 게시글을 `draft` 상태로 업로드해야 한다 (즉시 공개 금지).
- **FR-013**: 시스템은 WordPress REST API 연동 시 Application Passwords 기반 인증을 지원해야 하며, 관련 정보는 환경변수(예: `WP_BASE_URL`, `WP_APP_USER`, `WP_APP_PASSWORD`)로 제공받아야 한다.(Notion2WordPress 참고)
- **FR-014**: 시스템은 크롤링 및 REST 호출에 대해 워커 수(동시성)와 요청 간 최소 간격(속도 제한)을 설정할 수 있어야 하며, 환경변수로 기본값과 변경값을 지정한다.
- **FR-015**: 시스템은 포스트 단위 처리 상태(예: 성공/실패, 마지막 처리 시각)를 JSON 상태 파일에 기록하여, 중단 후 재실행 시 이미 처리된 포스트를 건너뛰고 남은 포스트만 처리할 수 있어야 한다.
- **FR-016**: 시스템은 오류 발생 시 해당 게시글/리소스를 식별할 수 있는 정보와 함께 상세 로그를 남겨야 한다.
- **FR-017**: 시스템은 가능하다면 포스트 단위 작업을 병렬로 처리(워커 풀)해야 하며, 이때도 rate limit을 준수해야 한다.
- **FR-018**: 시스템은 범위에서 제외된 기능(댓글 마이그레이션, 첨부파일 업로드(이미지 외), 내부 링크 자동 수정)을 수행하지 않아야 한다.

### Key Entities

- **Post**: 하나의 Tistory 게시글을 표현. 속성: title, raw_html, cleaned_html, created_at, updated_at, url, categories, tags, images, internal_links 등.
- **Category**: 카테고리 이름과 상위 카테고리 참조를 가진 계층 구조. WordPress 카테고리 ID와 매핑 정보 포함.
- **Tag**: 태그 이름과 WordPress 태그 ID 매핑 정보.
- **Image/Media**: 이미지 원본 URL, ALT 텍스트, 로컬 다운로드 경로, WordPress 미디어 URL/ID.
- **InternalLink**: source_post_id/url, target_tistory_url로 구성된 내부 링크 레코드. 최종적으로 `link_mapping.json`에 직렬화.
- **MigrationState**: 이미 처리된 포스트 목록, 실패한 포스트 목록, 마지막 실행 시각, 재시도 카운트 등을 포함하는 상태 모델.

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 사용자가 Tistory 블로그 URL과 WordPress REST 설정만으로 CLI를 실행했을 때, 전체 게시글 중 95% 이상이 WordPress Draft로 정상 마이그레이션된다(나머지는 오류 로그로 식별 가능).
- **SC-002**: 마이그레이션된 WordPress 게시글의 제목, 본문, 카테고리, 태그, 작성일은 Tistory 원본과 논리적으로 동일하게 유지된다(데이터 무결성 95%+).
- **SC-003**: `link_mapping.json`은 내부 Tistory 링크의 95% 이상을 정확히 식별하며, 각 항목은 source URL/ID와 target URL을 포함한다.
- **SC-004**: HTML 크리닝 과정 후에도 가시적인 본문 내용의 99% 이상이 유지되고, Tistory 전용 스타일/래퍼는 제거된다.
- **SC-005**: 500개 이상의 게시글을 가진 블로그를 마이그레이션할 때, 메모리 부족이나 비정상 종료 없이 작업이 완료되며, rate limit 설정을 통해 Tistory/WordPress로부터 차단되지 않는다.
- **SC-006**: 마이그레이션 도중 프로세스가 중단된 후 재실행했을 때, 이미 성공한 게시글을 중복 생성하지 않고 남은 게시글만 처리한다.
- **SC-007**: 오류 로그와 상태 파일을 통해 90% 이상의 실패 사례에 대해 원인(네트워크, 인증, 파싱 오류 등)을 식별할 수 있다.
- **SC-008**: 병렬 처리를 활성화했을 때, 100개 이상의 게시글을 가진 블로그 기준으로 순차 처리 대비 총 소요 시간이 30% 이상 단축된다(환경에 따라 다를 수 있음).
