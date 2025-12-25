# Feature Specification: Tistory to WordPress Migration

**Feature Branch**: `001-name-tistory-wordpress`
**Created**: 2025-12-25
**Status**: Draft
**Input**: requirements.md - Tistory 블로그 게시글을 WordPress import 가능한 WXR 파일로 변환

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tistory 게시글 데이터 수집 (Priority: P1)

사용자는 Tistory 블로그 URL을 입력하여 모든 게시글 데이터를 수집한다. 시스템은 페이지네이션을 처리하여 모든 게시글을 크롤링하고, 제목, 내용, 작성일, 수정일, URL, 카테고리, 태그, 이미지, 첨부파일 정보를 파싱한다.

**Why this priority**: 데이터 수집은 모든 마이그레이션 프로세스의 기반이며, 없으면 다른 모든 기능이 불가능함

**Independent Test**: Tistory 블로그 URL을 입력하여 실행하면 모든 게시글이 수집되고 JSON 또는 중간 파일로 저장됨

**Acceptance Scenarios**:

1. **Given** Tistory 블로그 URL이 환경변수에 설정되어 있고, **When** 크롤러를 실행하면, **Then** 모든 게시글 목록과 상세 정보가 성공적으로 수집되어 저장됨
2. **Given** Tistory 블로그에 100개 이상의 게시글이 있고, **When** 페이지네이션 처리를 수행하면, **Then** 모든 페이지의 게시글이 누락 없이 수집됨
3. **Given** 게시글에 이미지가 포함되어 있고, **When** 상세 정보를 파싱하면, **Then** 이미지 URL과 대체 텍스트가 올바르게 추출됨

---

### User Story 2 - 데이터 정제 및 내부 링크 추적 (Priority: P2)

사용자는 수집된 Tistory HTML 데이터에서 Tistory 전용 CSS/HTML 구조를 제거하고 순수한 데이터만 남긴다. 시스템은 내부 링크(Tistory 블로그 URL을 참조하는 링크)를 식별하고 이를 별도 파일에 기록한다.

**Why this priority**: 정제된 데이터는 WordPress 호환성을 보장하며, 내부 링크 추적은 마이그레이션 후 링크 유지를 위한 필수 단계

**Independent Test**: 수집된 데이터 파일을 정제하고 내부 링크를 추출하면 link_mapping.json 파일이 생성됨

**Acceptance Scenarios**:

1. **Given** 수집된 Tistory HTML 데이터가 있고, **When** 정제를 수행하면, **Then** Tistory 전용 스타일 태그와 불필요한 HTML 요소가 제거됨
2. **Given** 게시글에 Tistory 블로그 내부 링크가 포함되어 있고, **When** 내부 링크 추적을 실행하면, **Then** link_mapping.json 파일에 모든 내부 링크가 기록됨
3. **Given** 정제된 HTML이 있고, **When** WordPress Importer 플러그인으로 검증하면, **Then** 기본적인 HTML 구조가 호환됨

---

### User Story 3 - WXR 파일 생성 (Priority: P3)

사용자는 정제된 게시글 데이터를 WordPress Importer 플러그인 호환 WXR(WordPress eXtended RSS) 파일로 변환한다. 시스템은 게시글, 카테고리, 태그를 포함한 WXR XML 파일을 생성한다.

**Why this priority**: WXR 파일 생성이 최종 산출물이며, WordPress로의 실제 마이그레이션을 가능하게 함

**Independent Test**: 정제된 데이터를 입력하여 WXR 파일을 생성하고 WordPress Importer 플러그인으로 import 성공 여부 확인

**Acceptance Scenarios**:

1. **Given** 정제된 게시글 데이터가 있고, **When** WXR 생성을 실행하면, **Then** WordPress Importer 플러그인 호환 output.xml 파일이 생성됨
2. **Given** 게시글에 카테고리와 태그가 있고, **When** WXR을 생성하면, **Then** 카테고리 계층 구조와 태그가 올바르게 포함됨
3. **Given** WXR 파일이 생성되고, **When** WordPress Importer 플러그인으로 import를 시도하면, **Then** 모든 게시글이 성공적으로 import됨

---

### Edge Cases

- 게시글이 없는 블로그인 경우 어떻게 처리하는가? → 빈 WXR 파일 생성
- 네트워크 오류나 크롤링 차단 발생 시 어떻게 복구하는가? → 로그 기록 후 마지막 성공 게시글 ID에서 재개
- 첨부파일 URL이 존재하지 않거나 접근 불가능한 경우 어떻게 처리하는가? → 로그 기록 후 WXR 파일에는 원래 URL 유지
- 동일한 카테고리 이름이 다른 계층에 있는 경우 어떻게 처리하는가? → 계층 경로를 포함하여 구분 (예: "개발/Python", "프로그래밍/Python")
- 특수 문자나 비표준 HTML이 포함된 게시글 내용은 어떻게 처리하는가? → HTML 엔티티 인코딩 후 WXR 파일에 저장
- 첨부파일 다운로드가 실패하는 경우 어떻게 처리하는가? → 로그 기록 후 WXR 파일에는 원래 URL 유지
- 크롤링 중 Tistory 서버가 응답하지 않는 경우 어떻게 처리하는가? → 재시도 후 실패 시 로그 기록, 마지막 성공 게시글 ID에서 재개 가능

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 환경변수로 설정된 Tistory 블로그 URL에서 게시글 목록을 크롤링해야 함
- **FR-002**: 시스템은 페이지네이션을 처리하여 모든 게시글을 수집해야 함
- **FR-003**: 시스템은 각 게시글에서 제목, 내용, 작성일, 수정일, URL을 파싱해야 함
- **FR-004**: 시스템은 카테고리 정보를 계층 구조로 파싱해야 함
- **FR-005**: 시스템은 태그 정보를 파싱해야 함
- **FR-006**: 시스템은 이미지 정보(URL, 대체 텍스트)를 파싱해야 함 (다운로드 아님)
- **FR-007**: 시스템은 첨부파일 정보(URL, 파일명)를 파싱해야 함
- **FR-008**: 시스템은 Tistory 전용 HTML/CSS 구조를 제거하고 순수한 데이터만 남겨야 함
- **FR-009**: 시스템은 내부 Tistory 링크를 식별해야 함
- **FR-010**: 시스템은 내부 링크를 포함하는 게시글을 별도 link_mapping.json 파일에 기록해야 함
- **FR-011**: 시스템은 첨부파일을 다운로드해야 함
- **FR-012**: 시스템은 첨부파일을 실행 파일 근처에 `downloads` 디렉토리에 저장해야 함
- **FR-013**: 시스템은 카테고리 계층 구조를 유지해야 함
- **FR-014**: 시스템은 WordPress Importer 플러그인 버전 0.9.5 호환 WXR 파일을 생성해야 함
- **FR-015**: 시스템은 WXR 파일에 게시글, 카테고리, 태그를 포함해야 함
- **FR-016**: 시스템은 Tistory 블로그 URL을 환경변수로 설정할 수 있어야 함
- **FR-017**: 시스템은 대량의 게시글(수천개)을 신뢰성 있게 처리할 수 있어야 함
- **FR-018**: 시스템은 에러 발생 시 로깅을 수행해야 함
- **FR-019**: 시스템은 마지막 성공한 게시글 다음부터 재개가 가능해야 함
- **FR-020**: 시스템은 크롤링 속도를 제한해야 함
- **FR-021**: 시스템은 크롤링 요청 간 기본 1초 대기를 수행해야 함
- **FR-022**: 시스템은 크롤링 요청 간격을 환경변수로 수정할 수 있어야 함
- **FR-023**: 시스템은 Debug, Info, Warn, Error, Fatal 레벨로 로깅을 지원해야 함

### Key Entities

- **BlogPost**: Tistory 블로그 게시글 정보 - 제목, 내용, 작성일, 수정일, URL, 카테고리, 태그, 이미지, 첨부파일 포함
- **Category**: 카테고리 계층 구조 - 부모-자식 관계 포함
- **Tag**: 게시글에 연결된 태그 정보
- **Image**: 게시글 내 이미지 정보 - URL, 대체 텍스트 포함 (다운로드 없이 URL만 유지)
- **Attachment**: 게시글 첨부파일 정보 - URL, 파일명, 다운로드 경로 포함
- **InternalLink**: 내부 Tistory 링크 정보 - 출처 게시글 ID, 링크 URL 포함
- **CrawlProgress**: 크롤링 진행 상태 - 마지막 성공한 게시글 ID, 완료 여부 포함

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tistory 블로그 URL을 입력 후 모든 게시글 수집이 100% 완료되어야 함
- **SC-002**: 정제된 데이터의 HTML 구조가 WordPress Importer 플러그인 0.9.5 버전에 호환되어야 함
- **SC-003**: 생성된 WXR 파일이 WordPress Importer 플러그인 0.9.5로 100% import 성공해야 함
- **SC-004**: link_mapping.json에 모든 내부 링크가 기록되어야 함
- **SC-005**: 에러 발생 시 Debug, Info, Warn, Error, Fatal 레벨로 로깅을 통해 문제 위치를 식별할 수 있어야 함
- **SC-006**: 처리 중단 후 마지막 성공한 게시글 ID에서 재개가 가능해야 함
- **SC-007**: 크롤링 요청 간 기본 1초 대기가 적용되어야 하며, 환경변수로 수정 가능해야 함
- **SC-008**: 모든 첨부파일이 `downloads` 디렉토리에 다운로드되어야 함
- **SC-009**: 수천 개의 게시글을 신뢰성 있게 처리할 수 있어야 함
