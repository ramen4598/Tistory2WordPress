# Implementation Plan: Tistory to WordPress Migration

**Branch**: `002-tistory-wordpress-migration` | **Date**: 2025-12-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-tistory-wordpress-migration/spec.md`

## Summary

Build a CLI tool that crawls Tistory blog posts, cleans HTML content, extracts metadata, and generates WordPress-compatible WXR XML files. The system processes posts individually using parallel threading with configurable rate limiting, preserves image URLs, downloads attachments locally, tracks internal links, and supports resume capability for interrupted migrations.

## Technical Context

**Language/Version**: Python 3.11+
**Primary Dependencies**:
- requests (HTTP client for crawling)
- beautifulsoup4 (HTML parsing and content extraction)
- lxml (XML generation for WXR files)
- click (CLI framework)
- python-dotenv (environment variable management)
- pydantic (data validation and models)

**Storage**:
- JSON files (link_mapping.json, resume tracking)
- XML file (WXR output file)
- File system (downloads/ directory for attachments)

**Testing**: pytest (unit and integration testing)

**Target Platform**: Command-line tool (macOS, Linux, Windows)

**Project Type**: single (CLI tool)

**Performance Goals**:
- Process 100+ posts within 10 minutes with parallel processing enabled
- Complete full migration workflow for typical blog (50-100 posts) in under 30 minutes

**Constraints**:
- Rate limiting: Default 1 request per second per worker (configurable)
- Memory: Handle 1000+ posts without memory issues
- Threading: Default 5 workers (configurable via environment variable)
- Resumption: Support resume from interruption with state tracking

**Scale/Scope**:
- Support blogs with 1000+ posts
- Process posts one at a time (crawl → clean → WXR transformation)
- Track internal links across all posts
- Download attachments (not images) to local storage

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

✅ No constitution violations - project follows single project structure for CLI tool

## Project Structure

### Documentation (this feature)

```text
specs/002-tistory-wordpress-migration/
├── spec.md              # Feature specification
├── plan.md              # This file (implementation plan)
├── research.md          # Phase 0 output (research and unknowns)
├── data-model.md        # Phase 1 output (data models)
├── quickstart.md        # Phase 1 output (developer quickstart)
├── contracts/           # Phase 1 output (API contracts)
│   └── wxr-format.md    # WXR XML structure specification
└── tasks.md             # Phase 2 output (implementation tasks)
```

### Source Code (repository root)

```text
src/
├── models/
│   ├── __init__.py
│   ├── post.py                    # TistoryPost data model
│   ├── link.py                    # InternalLink data model
│   ├── media.py                   # MediaFile data model
│   └── wxr.py                     # WXRDocument data model
├── services/
│   ├── __init__.py
│   ├── crawler.py                 # Tistory blog crawling service
│   ├── parser.py                  # HTML parsing service
│   ├── cleaner.py                 # HTML cleaning service
│   ├── tracker.py                 # Internal link tracking service
│   ├── downloader.py              # Attachment download service
│   ├── wxr_generator.py           # WXR XML generation service
│   └── rate_limiter.py            # Rate limiting service
├── cli/
│   ├── __init__.py
│   └── main.py                    # Click CLI interface
├── lib/
│   ├── __init__.py
│   ├── config.py                  # Configuration management
│   ├── state.py                   # Resume state management
│   └── progress.py                # Progress tracking
└── utils/
    ├── __init__.py
    └── html_utils.py              # HTML parsing utilities

tests/
├── contract/
│   ├── test_wxr_generator.py     # WXR format validation
│   └── test_link_tracker.py       # Link tracking contract
├── integration/
│   ├── test_full_migration.py    # End-to-end migration test
│   └── test_resume.py             # Resume functionality test
└── unit/
    ├── test_crawler.py
    ├── test_parser.py
    ├── test_cleaner.py
    ├── test_tracker.py
    ├── test_downloader.py
    └── test_models.py

downloads/                          # Downloaded attachments directory
.env                               # Environment variables (TISTORY_URL, etc.)
.output.xml                        # Generated WXR file (default output)
link_mapping.json                  # Internal link mappings
state.json                         # Resume state tracking

requirements.txt                   # Python dependencies
README.md                          # User documentation
pyproject.toml                      # Project metadata and tool configuration
```

**Structure Decision**: Single project structure selected as this is a CLI tool with no separate frontend/backend components. All logic is contained in a single Python package with clear separation of concerns (models, services, CLI, lib, utils).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | N/A | N/A |

## Phase 0: Research and Resolve Unknowns

### Research Items

**R1 - Tistory Blog HTML Structure**
- **Unknown**: Specific HTML structure of Tistory blog pages for post list and individual post pages
- **Impact**: Critical for crawler and parser implementation
- **Research Approach**: Examine actual Tistory blog HTML structure using multiple sample blogs
- **Outcome**: Document HTML selectors for post list, pagination, post content, metadata, categories, tags, images, attachments

**R2 - WXR XML Format Specification**
- **Unknown**: Exact WXR XML format required by WordPress Importer plugin
- **Impact**: Critical for wxr_generator service implementation
- **Research Approach**: Review WordPress Importer plugin documentation and sample WXR files
- **Outcome**: Document WXR XML structure including required elements, namespaces, and post metadata fields

**R3 - Tistory Rate Limits**
- **Unknown**: Official or practical rate limits for Tistory servers
- **Impact**: Important for rate_limiter service default configuration
- **Research Approach**: Test crawling with various rates and monitor for 429 responses
- **Outcome**: Recommended default rate limit (already set to 1 req/sec) and behavior under load

**R4 - Parallel Processing with Rate Limiting**
- **Unknown**: Best approach to apply per-worker rate limiting in threading context
- **Impact**: Important for parallel processing implementation
- **Research Approach**: Evaluate threading-safe rate limiting libraries (e.g., ratelimit, tenacity)
- **Outcome**: Implementation strategy for per-worker rate limiting

**R5 - Resume State Management**
- **Unknown**: Optimal state tracking format and granularity for resume functionality
- **Impact**: Important for state.py implementation
- **Research Approach**: Evaluate checkpoint strategies (per-post, per-page, incremental)
- **Outcome**: State tracking schema and resume strategy

### Research Timeline

1. **R1, R2** (Critical): Complete before any implementation
2. **R3, R4** (High): Complete before parallel processing implementation
3. **R5** (Medium): Complete before resume functionality implementation

## Phase 1: Technical Design

### Sequence Diagram

See `sequence-diagram.md` for detailed interaction flow.

### Data Models

See `data-model.md` for detailed entity definitions.

### API Contracts

See `contracts/` directory for interface specifications.

### Quickstart Guide

See `quickstart.md` for developer onboarding instructions.
