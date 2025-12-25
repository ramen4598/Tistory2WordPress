# Implementation Plan: Tistory to WordPress Migration

**Branch**: `001-name-tistory-wordpress` | **Date**: 2025-12-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-name-tistory-wordpress/spec.md`

## Summary

Tistory 블로그 게시글을 WordPress Importer 플러그인 0.9.5 호환 WXR 파일로 변환하는 CLI 프로그램. Tistory 크롤링 → 데이터 정제 → 내부 링크 추적 → 첨부파일 다운로드 → WXR 생성 순서로 처리하며, 환경변수로 URL, 크롤링 딜레이, 로그 레벨 등을 설정할 수 있음. 마지막 성공한 게시글 ID에서 재개 가능하며, 첨부파일은 `downloads` 디렉토리에 다운로드됨.

## Technical Context

**Language/Version**: Python 3.11+
**Primary Dependencies**: requests (HTTP), beautifulsoup4 (HTML 파싱), lxml (XML 생성), click (CLI), python-dotenv (환경변수), pydantic (데이터 검증)
**Storage**: JSON 파일 (중간 데이터), XML 파일 (WXR), JSON (link_mapping), 파일 시스템 (downloads 디렉토리)
**Testing**: pytest
**Target Platform**: Cross-platform (Linux, macOS, Windows)
**Project Type**: single (CLI 프로그램)
**Performance Goals**: 1초당 1개 게시글 처리, 1000+ 게시글 안정적 처리
**Constraints**: 메모리 사용 <500MB, 재개 가능, 크롤링 속도 제한
**Scale/Scope**: 수천 개 게시글 처리, 수백 개 첨부파일 다운로드

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Single project (CLI 프로그램)
- [x] Python 3.11+ 사용
- [x] pytest 테스트 프레임워크
- [x] 필요한 의존성만 추가 (requests, beautifulsoup4, lxml, click, python-dotenv, pydantic)
- [x] WXR 포맷 준수 (WordPress Importer 0.9.5)
- [x] 환경변수 사용 (.env 파일)
- [x] 로깅 시스템 (Debug, Info, Warn, Error, Fatal)

## Project Structure

### Documentation (this feature)

```text
specs/001-name-tistory-wordpress/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── crawler.md
│   ├── cleaner.md
│   ├── link-tracker.md
│   ├── wxr-generator.md
│   └── downloader.md
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
src/
├── models/
│   ├── __init__.py
│   ├── blog_post.py
│   ├── category.py
│   ├── tag.py
│   ├── image.py
│   ├── attachment.py
│   ├── internal_link.py
│   └── crawl_progress.py
├── services/
│   ├── __init__.py
│   ├── crawler.py
│   ├── html_cleaner.py
│   ├── link_tracker.py
│   ├── attachment_downloader.py
│   └── wxr_generator.py
├── lib/
│   ├── __init__.py
│   ├── utils.py
│   └── logger.py
└── cli/
    ├── __init__.py
    ├── main.py
    └── config.py

tests/
├── contract/
│   ├── test_crawler.py
│   ├── test_cleaner.py
│   ├── test_link_tracker.py
│   ├── test_wxr_generator.py
│   └── test_downloader.py
├── integration/
│   └── test_e2e.py
└── unit/
    ├── test_models.py
    └── test_utils.py

.env.example
requirements.txt
pyproject.toml
```

**Structure Decision**: Single project (CLI 프로그램)으로 결정. `src/models/`는 데이터 모델, `src/services/`는 비즈니스 로직, `src/cli/`는 CLI 인터페이스, `src/lib/`는 공통 유틸리티와 로거. `tests/contract/`는 서비스 계약 테스트, `tests/integration/`는 통합 테스트, `tests/unit/`는 단위 테스트.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitution violations identified.
