# Tasks

**Feature**: Tistory to WordPress Migration
**Date**: 2025-12-25
**Branch**: `001-name-tistory-wordpress`

## Overview

This document contains actionable tasks organized by user story. Tasks marked with **[PARALLEL]** can be executed in parallel with other tasks in the same group.

## User Story 1 - Tistory 게시글 데이터 수집 (Priority: P1)

### Setup Tasks

- [ ] **[BLOCKER]** Create project structure:
  - Create `src/models/`, `src/services/`, `src/cli/`, `src/lib/`
  - Create `tests/contract/`, `tests/integration/`, `tests/unit/`
  - Create `requirements.txt`, `pyproject.toml`, `.env.example`

- [ ] **[BLOCKER]** Setup dependencies:
  - Add `requests>=2.31.0`, `beautifulsoup4>=4.12.0`, `lxml>=4.9.0`, `click>=8.1.0`, `python-dotenv>=1.0.0`, `pydantic>=2.0.0`, `pytest>=7.4.0`
  - Create `.env.example` with `TISTORY_BLOG_URL`, `CRAWL_DELAY`, `LOG_LEVEL`

### Data Model Tasks

- [ ] **[PARALLEL]** Create `src/models/blog_post.py`:
  - Implement `BlogPost` model with Pydantic BaseModel
  - Add nested `Image` model (url, alt_text)
  - Add nested `Attachment` model (url, filename, local_path)
  - Add fields: id, title, content, original_url, created_at, updated_at, categories, tags, images, attachments, internal_links

- [ ] **[PARALLEL]** Create `src/models/category.py`:
  - Implement `Category` model with Pydantic BaseModel
  - Add fields: id, slug, name, parent_id, path

- [ ] **[PARALLEL]** Create `src/models/tag.py`:
  - Implement `Tag` model with Pydantic BaseModel
  - Add fields: id, slug, name

- [ ] **[PARALLEL]** Create `src/models/internal_link.py`:
  - Implement `InternalLink` model with Pydantic BaseModel
  - Add fields: source_post_id, link_url

- [ ] **[PARALLEL]** Create `src/models/crawl_progress.py`:
  - Implement `CrawlProgress` model with Pydantic BaseModel
  - Add fields: last_success_post_id, completed, started_at, completed_at, total_posts, processed_posts, error_count

- [ ] **[PARALLEL]** Create `src/models/__init__.py`:
  - Export all models

- [ ] **[PARALLEL]** Create `tests/unit/test_models.py`:
  - Add tests for all models with valid and invalid data

### Library Tasks

- [ ] **[PARALLEL]** Create `src/lib/logger.py`:
  - Implement logger with Debug, Info, Warn, Error, Fatal levels
  - Add file and console handlers
  - Load LOG_LEVEL from environment variable

- [ ] **[PARALLEL]** Create `src/lib/utils.py`:
  - Implement utility functions (HTML entity encoding, URL parsing)
  - Add `load_env()` function to load .env file

- [ ] **[PARALLEL]** Create `src/lib/__init__.py`:
  - Export utility functions

- [ ] **[PARALLEL]** Create `tests/unit/test_utils.py`:
  - Add tests for utility functions

### Crawler Service Tasks

- [ ] **[BLOCKER]** Create `src/services/crawler.py`:
  - Implement `Crawler` class
  - Implement `crawl_posts(base_url, start_post_id, delay)` method
  - Implement `parse_post_list(html)` method
  - Implement `parse_post_detail(html, post_url)` method
  - Add rate limiting with delay parameter
  - Add error handling with logging
  - Add progress saving to `progress.json`

- [ ] Create `tests/contract/test_crawler.py`:
  - Add contract tests for Crawler class
  - Mock HTTP requests for testing

### CLI Tasks

- [ ] **[BLOCKER]** Create `src/cli/config.py`:
  - Implement configuration loading from .env file
  - Validate configuration (TISTORY_BLOG_URL required)

- [ ] **[BLOCKER]** Create `src/cli/main.py`:
  - Implement CLI with Click
  - Add `migrate` command
  - Add `--url`, `--delay`, `--log-level` options
  - Integrate all services in pipeline

- [ ] Create `tests/integration/test_e2e.py`:
  - Add end-to-end test with mock Tistory responses
  - Verify full pipeline execution

## User Story 2 - 데이터 정제 및 내부 링크 추적 (Priority: P2)

### HTML Cleaner Service Tasks

- [ ] **[BLOCKER]** Create `src/services/html_cleaner.py`:
  - Implement `HTMLCleaner` class
  - Implement `clean_posts(posts, base_url)` method
  - Implement `clean_html(html)` method
  - Implement `extract_internal_links(html, base_url)` method
  - Remove Tistory-specific CSS/HTML elements
  - Extract internal links based on base_url pattern

- [ ] Create `tests/contract/test_cleaner.py`:
  - Add contract tests for HTMLCleaner class
  - Test with sample Tistory HTML

### Link Tracker Service Tasks

- [ ] **[BLOCKER]** Create `src/services/link_tracker.py`:
  - Implement `LinkTracker` class
  - Implement `track_links(posts)` method
  - Implement `is_internal_link(url, base_url)` method
  - Implement `write_mapping_file(mapping, output_path)` method
  - Generate `link_mapping.json` with InternalLink objects

- [ ] Create `tests/contract/test_link_tracker.py`:
  - Add contract tests for LinkTracker class
  - Verify link_mapping.json format

## User Story 3 - WXR 파일 생성 (Priority: P3)

### Attachment Downloader Service Tasks

- [ ] **[BLOCKER]** Create `src/services/attachment_downloader.py`:
  - Implement `AttachmentDownloader` class
  - Implement `download_attachments(posts, output_dir)` method
  - Implement `download_file(url, output_path)` method
  - Create `downloads/` directory if not exists
  - Handle download failures with logging

- [ ] Create `tests/contract/test_downloader.py`:
  - Add contract tests for AttachmentDownloader class
  - Mock file downloads for testing

### WXR Generator Service Tasks

- [ ] **[BLOCKER]** Create `src/services/wxr_generator.py`:
  - Implement `WXRGenerator` class
  - Implement `generate_wxr(posts, categories, tags, output_path)` method
  - Implement `build_rss(posts, categories, tags)` method
  - Implement `add_post(item, post)` method
  - Use lxml with WordPress namespaces
  - Generate WordPress Importer 0.9.5 compatible WXR

- [ ] Create `tests/contract/test_wxr_generator.py`:
  - Add contract tests for WXRGenerator class
  - Validate WXR XML structure
  - Test with sample posts, categories, tags

## Integration & Testing Tasks

- [ ] **[BLOCKER]** Integrate all services in CLI pipeline:
  - Update `src/cli/main.py` to orchestrate: crawl → clean → track → download → generate
  - Handle errors at each stage
  - Add progress logging

- [ ] **[BLOCKER]** Add comprehensive error handling:
  - Handle network errors with retry logic
  - Handle parse errors with logging
  - Handle file I/O errors gracefully

- [ ] **[BLOCKER]** Add resume functionality:
  - Load progress.json at startup
  - Pass start_post_id to crawler
  - Save progress after each successful post

- [ ] Create complete end-to-end test:
  - Test full migration pipeline with mock data
  - Verify output.xml, link_mapping.json, downloads/
  - Verify resume functionality

- [ ] **[BLOCKER]** Update documentation:
  - Update README.md with usage instructions
  - Update quickstart.md if needed
  - Add troubleshooting section

- [ ] **[BLOCKER]** Run full test suite:
  - `pytest tests/ -v`
  - Fix any failing tests
  - Ensure 100% contract test coverage

## Deployment Tasks

- [ ] **[BLOCKER]** Final code review:
  - Review all services and models
  - Ensure code follows Python best practices
  - Verify error handling completeness

- [ ] **[BLOCKER]** Performance testing:
  - Test with large blog (1000+ posts)
  - Verify memory usage < 500MB
  - Verify crawl delay works correctly

- [ ] **[BLOCKER]** Create release:
  - Tag commit as v1.0.0
  - Create release notes
  - Update CHANGELOG.md

## Task Statistics

- **Total Tasks**: 46
- **BLOCKER Tasks**: 12
- **PARALLEL Groups**: 5
- **Estimated Completion**: 2-3 days

## Parallel Execution Opportunities

1. **Data Model Creation**: 6 parallel tasks (blog_post, category, tag, internal_link, crawl_progress, test_models)
2. **Library Creation**: 3 parallel tasks (logger, utils, test_utils)
3. **HTML Cleaner & Link Tracker**: Can be developed in parallel
4. **Attachment Downloader & WXR Generator**: Can be developed in parallel
5. **Service Contract Tests**: Can be written in parallel with services
