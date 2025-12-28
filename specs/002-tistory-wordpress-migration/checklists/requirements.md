# Requirements Checklist

Generated from functional requirements in spec.md

## P1 Requirements (Critical - MVP)

- [ ] FR-001: System MUST crawl all posts from a Tistory blog URL by following pagination
- [ ] FR-002: System MUST extract post metadata including title, content, creation date, modification date, URL, categories, and tags
- [ ] FR-003: System MUST extract image URLs with alt text and attachment URLs with filenames from posts
- [ ] FR-004: System MUST process posts one at a time (crawl → clean → WXR transformation) rather than batch processing
- [ ] FR-006: System MUST remove Tistory-specific HTML/CSS classes and inline styles from post content
- [ ] FR-007: System MUST preserve semantic content structure (headings, paragraphs, lists, links) during cleaning
- [ ] FR-011: System MUST generate WordPress Importer-compatible WXR XML file
- [ ] FR-012: System MUST include posts, categories, and tags in WXR file with correct hierarchy
- [ ] FR-013: System MUST accept Tistory blog URL via environment variable

## P2 Requirements (Important)

- [ ] FR-008: System MUST identify internal Tistory links (links to same blog) in post content
- [ ] FR-009: System MUST record internal link mappings in link_mapping.json file
- [ ] FR-010: System MUST download attachments to local downloads directory (images are preserved as URLs in WXR)
- [ ] FR-014: System MUST log errors and provide detailed error messages
- [ ] FR-015: System MUST support resuming from errors (skip failed posts, continue with remaining)

## P3 Requirements (Nice to Have)

- [ ] FR-005: System MUST support parallel processing of posts if performance improvement is achievable
- [ ] FR-016: System MUST implement rate limiting for HTTP requests to Tistory
- [ ] FR-017: System MUST handle large volumes of posts (1000+) without memory issues

## Out of Scope Items

- [ ] FR-001-EXCLUDE: Comment migration is NOT included
- [ ] FR-002-EXCLUDE: Automatic file upload to WordPress is NOT included (images preserved as URLs, attachments downloaded locally only)
- [ ] FR-003-EXCLUDE: Automatic internal link rewriting in WXR is NOT included (mapping file provided for manual updates)
- [ ] FR-004-EXCLUDE: Automatic WXR import into WordPress is NOT included (user manually imports via WordPress Importer plugin)

## Success Criteria Checklist

- [ ] SC-001: User can successfully crawl all posts from a Tistory blog URL with 100% post extraction accuracy
- [ ] SC-002: Generated WXR file can be imported into WordPress Importer plugin without validation errors
- [ ] SC-003: All imported WordPress posts contain correct titles, content, and metadata matching Tistory source
- [ ] SC-004: Cleaning process removes all Tistory-specific classes while preserving 100% of semantic content
- [ ] SC-005: link_mapping.json contains 100% of internal Tistory links identified in all posts
- [ ] SC-006: Downloaded attachment files have matching filenames and are accessible in downloads directory; image URLs preserved in WXR with 100% accuracy
- [ ] SC-007: Tool can process 100+ posts within 10 minutes with parallel processing enabled
- [ ] SC-008: Error logging captures 100% of failures with sufficient detail for troubleshooting
- [ ] SC-009: Rate limiting prevents all Tistory server rate limit errors during migration
- [ ] SC-010: User can complete full migration workflow (crawl → clean → generate WXR) in under 30 minutes for typical blog (50-100 posts)
