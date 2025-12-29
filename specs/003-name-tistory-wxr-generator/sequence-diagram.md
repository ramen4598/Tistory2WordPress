# Sequence Diagram: Tistory WXR Generator

**Branch**: `003-name-tistory-wxr-generator` | **Date**: 2025-12-29 | **Spec**: [spec.md](./spec.md)
**Purpose**: Visual representation of migration pipeline, worker pool processing, and system interactions

## Sequence Diagrams

### Complete Migration Flow (Overview)

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant Config
    participant State
    participant Crawler
    participant Tistory
    participant WorkerPool
    participant PostProcessor
    participant Cleaner
    participant LinkTracker
    participant Downloader
    participant WXRGenerator
    participant FileSystem

    User->>CLI: Execute migration command
    CLI->>Config: Load environment variables
    Config-->>CLI: TISTORY_BLOG_URL, WORKER_COUNT, RATE_LIMIT
    
    CLI->>State: Load migration-state.json
    alt State exists
        State-->>CLI: Processed post URLs
    else No state
        State-->>CLI: Empty state
    end
    
    CLI->>Crawler: Start crawling blog
    loop Pagination
        Crawler->>Tistory: Fetch post list page
        Tistory-->>Crawler: HTML with post links
        Crawler->>Crawler: Extract post URLs
    end
    Crawler-->>CLI: All post URLs
    
    CLI->>CLI: Filter out processed posts (resume)
    CLI->>WorkerPool: Initialize workers (WORKER_COUNT)
    WorkerPool->>WorkerPool: Create worker pool with rate limiters
    
    CLI->>WorkerPool: Process remaining posts
    
    par Worker 1
        loop Each assigned post
            WorkerPool->>PostProcessor: Process post
            PostProcessor->>Tistory: Fetch post HTML (rate limited)
            Tistory-->>PostProcessor: Post content
            PostProcessor->>PostProcessor: Parse metadata (title, dates, categories, tags)
            
            PostProcessor->>Cleaner: Clean HTML content
            Cleaner->>Cleaner: HTML→Markdown→HTML conversion
            Cleaner->>LinkTracker: Extract links
            
            alt Link is internal
                LinkTracker->>FileSystem: Append to link_mapping.json
            end
            
            LinkTracker-->>Cleaner: Done
            Cleaner-->>PostProcessor: Cleaned HTML
            
            alt Post has attachments
                loop Each attachment
                    PostProcessor->>Downloader: Download attachment
                    Downloader->>Tistory: Fetch file
                    alt Success
                        Tistory-->>Downloader: File data
                        Downloader->>FileSystem: Save to downloads/
                    else Failure
                        Downloader->>FileSystem: Log error
                    end
                    Downloader-->>PostProcessor: Local path or null
                end
            end
            
            PostProcessor->>WXRGenerator: Add post to WXR
            PostProcessor->>State: Mark post processed
            State->>FileSystem: Update migration-state.json
        end
    and Worker 2
        Note over WorkerPool,PostProcessor: Same process, parallel execution
    and Worker 3
        Note over WorkerPool,PostProcessor: Same process, parallel execution
    and Worker 4
        Note over WorkerPool,PostProcessor: Same process, parallel execution
    end
    
    WorkerPool-->>CLI: All posts processed
    
    CLI->>WXRGenerator: Finalize WXR
    WXRGenerator->>FileSystem: Write output.wxr.xml
    FileSystem-->>WXRGenerator: Success
    
    CLI-->>User: Migration complete
    Note over User,FileSystem: Output: output.wxr.xml, link_mapping.json, migration-state.json, downloads/
```

**Complete Flow Summary**:
1. **Initialization**: Load config and check for existing state (resume capability)
2. **Discovery**: Crawl Tistory blog with pagination to get all post URLs
3. **Filtering**: Skip already processed posts (from state file)
4. **Parallel Processing**: Worker pool processes posts concurrently with rate limiting
5. **Per-Post Pipeline**: Fetch → Parse → Clean → Track Links → Download Attachments → Add to WXR → Update State
6. **Finalization**: Generate final WXR XML file
7. **Outputs**: WXR file, link mapping, state file, downloaded attachments

---

### Feature 1 - Basic Post Migration (Priority: P1)

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant Config
    participant Crawler
    participant Tistory
    participant PostProcessor
    participant Cleaner
    participant WXRGenerator
    participant FileSystem

    User->>CLI: Execute migration command
    CLI->>Config: Load environment variables
    Config-->>CLI: TISTORY_BLOG_URL, WORKER_COUNT, etc.
    
    CLI->>Crawler: Start crawling blog
    
    loop For each page
        Crawler->>Tistory: Fetch next page
        Tistory-->>Crawler: HTML with post links
        Crawler->>Crawler: Extract URLs
    end
    
    Crawler-->>CLI: List of all post URLs
    
    CLI->>PostProcessor: Process posts (worker pool)
    
    loop For each post (parallel workers)
        PostProcessor->>Tistory: Fetch post HTML
        Tistory-->>PostProcessor: Post HTML content
        PostProcessor->>PostProcessor: Parse title, dates, categories, tags
        PostProcessor->>Cleaner: Clean HTML content
        Cleaner->>Cleaner: Convert HTML→Markdown→HTML
        Cleaner->>Cleaner: Remove unnecessary elements if needed.
        Cleaner-->>PostProcessor: Cleaned HTML
        PostProcessor->>WXRGenerator: Add post to WXR
    end
    
    PostProcessor-->>CLI: All posts processed
    
    CLI->>WXRGenerator: Finalize WXR
    WXRGenerator->>FileSystem: Write output.wxr.xml
    FileSystem-->>WXRGenerator: Success
    WXRGenerator-->>CLI: WXR file created
    CLI-->>User: Migration complete
```

**Key Interactions**:
- Crawler handles pagination automatically to collect all post URLs
- Worker pool processes multiple posts concurrently with rate limiting
- Each post goes through: fetch → parse → clean → add to WXR pipeline
- WXR is built incrementally as posts are processed

---

### Feature 2 - Internal Link Tracking (Priority: P2)

```mermaid
sequenceDiagram
    participant PostProcessor
    participant Cleaner
    participant LinkTracker
    participant FileSystem

    PostProcessor->>Cleaner: Clean HTML content
    Cleaner->>Cleaner: Convert HTML→Markdown→HTML
    Cleaner->>Cleaner: Remove unnecessary elements if needed.
    Cleaner->>LinkTracker: Extract all links from HTML
    
    LinkTracker->>LinkTracker: Check if link is internal (matches blog URL)
    
    alt Link is internal
        LinkTracker->>LinkTracker: Record source/target mapping
        LinkTracker->>FileSystem: Append to link_mapping.json
        FileSystem-->>LinkTracker: Success
    else Link is external
        LinkTracker->>LinkTracker: Skip
    end
    
    LinkTracker-->>Cleaner: Link processing complete
    Cleaner-->>PostProcessor: Cleaned HTML
```

**Key Interactions**:
- Link tracking happens during HTML cleaning phase
- Internal links identified by comparing href to TISTORY_BLOG_URL
- link_mapping.json updated incrementally for each post
- External links ignored

---

### Feature 3 - Attachment Handling & Resume (Priority: P3)

```mermaid
sequenceDiagram
    participant CLI
    participant State
    participant PostProcessor
    participant Tistory
    participant Downloader
    participant FileSystem

    CLI->>State: Load migration-state.json
    
    alt State file exists
        State-->>CLI: List of processed post URLs
        CLI->>CLI: Filter out already processed posts
    else No state file
        State-->>CLI: Empty state
    end
    
    CLI->>PostProcessor: Process remaining posts
    
    PostProcessor->>Tistory: Fetch post HTML
    Tistory-->>PostProcessor: Post content with attachments
    PostProcessor->>PostProcessor: Parse attachment URLs
    
    loop For each attachment
        PostProcessor->>Downloader: Download attachment
        Downloader->>Tistory: Fetch attachment file
        
        alt Download successful
            Tistory-->>Downloader: File data
            Downloader->>FileSystem: Save to downloads/
            FileSystem-->>Downloader: Local path
            Downloader-->>PostProcessor: Local path
        else Download failed
            Tistory-->>Downloader: Error
            Downloader->>FileSystem: Log error
            Downloader-->>PostProcessor: null (continue)
        end
    end
    
    PostProcessor->>State: Mark post as processed
    State->>FileSystem: Update migration-state.json
    FileSystem-->>State: Success
    
    PostProcessor-->>CLI: Post complete
```

**Key Interactions**:
- State file checked at startup to enable resume
- Already processed posts skipped
- Attachments downloaded with error handling (failures logged but don't stop migration)
- State updated after each post for granular resume capability
- Errors logged but don't halt entire migration

---

### Feature 4 - Parallel Processing with Rate Limiting (Priority: P4)

```mermaid
sequenceDiagram
    participant CLI
    participant WorkerPool
    participant Worker1
    participant Worker2
    participant RateLimiter
    participant Tistory

    CLI->>WorkerPool: Initialize (WORKER_COUNT=4)
    WorkerPool->>WorkerPool: Create 4 workers
    WorkerPool->>RateLimiter: Configure (1 req/sec per worker)
    
    CLI->>WorkerPool: Process 100 posts
    
    par Worker 1
        Worker1->>RateLimiter: Request permission
        RateLimiter-->>Worker1: Allowed
        Worker1->>Tistory: Fetch post
        Tistory-->>Worker1: Post data
        Worker1->>Worker1: Process post
        Worker1->>RateLimiter: Wait 1 second
        RateLimiter-->>Worker1: Ready for next
    and Worker 2
        Worker2->>RateLimiter: Request permission
        RateLimiter-->>Worker2: Allowed
        Worker2->>Tistory: Fetch post
        Tistory-->>Worker2: Post data
        Worker2->>Worker2: Process post
        Worker2->>RateLimiter: Wait 1 second
        RateLimiter-->>Worker2: Ready for next
    and Worker 3
        Note over Worker1,Worker2: Worker 3 & 4 follow same pattern
    and Worker 4
        Note over Worker1,Worker2: Processing in parallel
    end
    
    WorkerPool-->>CLI: All posts processed
```

**Key Interactions**:
- Worker pool creates configurable number of workers (default: 4)
- Each worker has independent rate limiter (1 req/sec per worker)
- Workers process posts concurrently without interference
- Effective throughput: WORKER_COUNT * RATE_LIMIT requests/sec

---

## Component Definitions

### CLI
- **Responsibility**: Entry point, configuration loading, orchestration
- **Key Operations**: Initialize, load config, start crawler, manage worker pool, report completion

### Crawler
- **Responsibility**: Discover all post URLs from Tistory blog
- **Key Operations**: Fetch post list pages, handle pagination, extract post URLs

### PostProcessor
- **Responsibility**: Process individual posts through full pipeline
- **Key Operations**: Fetch post HTML, parse metadata, clean content, track links, download attachments, add to WXR

### Cleaner
- **Responsibility**: Remove Tistory-specific HTML/CSS via Markdown conversion
- **Key Operations**: Convert HTML→Markdown (turndown), Convert Markdown→HTML (marked)

### LinkTracker
- **Responsibility**: Identify and record internal links
- **Key Operations**: Extract links from HTML, check if internal, write to link_mapping.json

### Downloader
- **Responsibility**: Download attachments with error handling
- **Key Operations**: Fetch files, save to downloads/, handle errors gracefully

### WXRGenerator
- **Responsibility**: Build WordPress-compatible WXR XML
- **Key Operations**: Add posts/categories/tags, generate valid WXR structure, write XML file

### State
- **Responsibility**: Track migration progress for resume capability
- **Key Operations**: Load state, mark posts processed, save state incrementally

### WorkerPool
- **Responsibility**: Manage concurrent post processing with rate limiting
- **Key Operations**: Create workers, distribute work, enforce rate limits per worker

## Cross-Feature Interactions

- **Crawler → PostProcessor**: Crawler provides list of post URLs to worker pool for parallel processing
- **PostProcessor → Cleaner → LinkTracker**: Content cleaning automatically triggers link tracking
- **PostProcessor → State**: Every processed post updates state file for resume capability
- **WorkerPool → All Services**: Worker pool orchestrates all processing with concurrency and rate limiting
- **All Services → FileSystem**: Multiple outputs written (WXR, link_mapping.json, migration-state.json, downloads/)

---

## Notes

- All network requests to Tistory respect rate limiting (1 req/sec per worker)
- Error handling is non-blocking: failures logged but don't stop migration
- State tracking enables resume from any point of interruption
- WXR built incrementally to handle large blogs without memory issues
- Worker pool provides parallelism while respecting rate limits per worker
