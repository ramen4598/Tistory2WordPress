# Quickstart Guide: Tistory WXR Generator

**Branch**: `003-name-tistory-wxr-generator` | **Date**: 2025-12-29

## Overview

This guide helps you get started with the Tistory to WordPress migration tool.

---

## Prerequisites

- **Node.js**: 18.x or higher
- **npm**: 9.x or higher
- **Tistory blog**: Publicly accessible blog URL

---

## Installation

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <repo-url>
cd Tistory2Wordpress

# Install dependencies
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Required
TISTORY_BLOG_URL=https://yourblog.tistory.com

# Optional (with defaults)
WORKER_COUNT=4
RATE_LIMIT_PER_WORKER=1000
OUTPUT_DIR=./output
```

**Environment Variable Details**:
- `TISTORY_BLOG_URL`: Your Tistory blog URL (required)
- `WORKER_COUNT`: Number of concurrent workers (default: 4, range: 1-16)
- `RATE_LIMIT_PER_WORKER`: Milliseconds between requests per worker (default: 1000 = 1 req/sec)
- `OUTPUT_DIR`: Directory for output files (default: `./output`)

---

## Basic Usage

### Run Migration

```bash
npm start
```

This will:
1. Discover all posts from your Tistory blog
2. Process posts in parallel using worker pool
3. Clean HTML content (remove Tistory-specific styling)
4. Track internal links
5. Download attachments
6. Generate WXR file

### Expected Output

```
output/
├── output.wxr.xml          # WordPress import file
├── link_mapping.json       # Internal link mappings
├── migration-state.json    # Resume state (if interrupted)
└── downloads/              # Downloaded attachments
    ├── file1.pdf
    └── file2.zip
```

---

## Testing

### Run All Tests

```bash
npm test
```

### Run Unit Tests Only

```bash
npm run test:unit
```

### Run Integration Tests Only

```bash
npm run test:integration
```

### Test with Coverage

```bash
npm run test:coverage
```

---

## Development Workflow

### 1. Build TypeScript

```bash
npm run build
```

Output: `dist/` directory with compiled JavaScript

### 2. Run in Development Mode (with auto-reload)

```bash
npm run dev
```

### 3. Lint Code

```bash
npm run lint
```

### 4. Format Code

```bash
npm run format
```

---

## Example Scenarios

### Scenario 1: Basic Migration (Small Blog)

**Setup**:
```bash
# .env
TISTORY_BLOG_URL=https://myblog.tistory.com
```

**Run**:
```bash
npm start
```

**Expected Time**: ~2-5 minutes for 50 posts

---

### Scenario 2: Large Blog with Custom Workers

**Setup**:
```bash
# .env
TISTORY_BLOG_URL=https://myblog.tistory.com
WORKER_COUNT=8
RATE_LIMIT_PER_WORKER=500
```

**Run**:
```bash
npm start
```

**Expected Time**: ~5-10 minutes for 500 posts

---

### Scenario 3: Resume Interrupted Migration

**Setup**:
- Previous migration was interrupted
- `output/migration-state.json` exists with partial progress

**Run**:
```bash
npm start
```

**Behavior**:
- Automatically detects existing state file
- Skips already processed posts
- Continues from where it left off

---

### Scenario 4: Conservative Rate Limiting

**Setup**:
```bash
# .env
TISTORY_BLOG_URL=https://myblog.tistory.com
WORKER_COUNT=2
RATE_LIMIT_PER_WORKER=2000
```

**Run**:
```bash
npm start
```

**Behavior**:
- Only 2 concurrent workers
- 2 seconds between requests per worker
- Effective rate: 1 request per second total
- Slower but gentler on Tistory servers

---

## Importing to WordPress

### 1. Install WordPress Importer Plugin

In WordPress Admin:
1. Go to **Tools** → **Import**
2. Install **WordPress** importer
3. Activate the plugin

### 2. Import WXR File

1. Go to **Tools** → **Import** → **WordPress**
2. Upload `output/output.wxr.xml`
3. Click **Upload file and import**
4. Assign authors or create new users
5. Check "Download and import file attachments"
6. Click **Submit**

### 3. Review Internal Links

1. Open `output/link_mapping.json`
2. Review all internal links between posts
3. Manually update links in WordPress as needed

**Example link_mapping.json**:
```json
[
  {
    "source_url": "https://myblog.tistory.com/123",
    "target_url": "https://myblog.tistory.com/456",
    "link_text": "related post",
    "context": "See this related post for more details"
  }
]
```

---

## Troubleshooting

### Issue: "Blog URL not accessible"

**Cause**: Tistory blog is private or URL is incorrect

**Solution**:
- Verify blog URL is public
- Check for typos in TISTORY_BLOG_URL
- Test URL in browser

### Issue: "Rate limited by Tistory"

**Cause**: Too many requests too quickly

**Solution**:
- Increase RATE_LIMIT_PER_WORKER (e.g., 2000 or 3000)
- Decrease WORKER_COUNT (e.g., 2 or 1)
- Wait a few minutes and retry

### Issue: "Out of memory"

**Cause**: Very large blog (1000+ posts with large content)

**Solution**:
- Reduce WORKER_COUNT to 2
- Ensure Node.js has enough heap: `NODE_OPTIONS=--max-old-space-size=4096 npm start`

### Issue: "Invalid WXR file"

**Cause**: Special characters or malformed content

**Solution**:
- Check logs for specific post URLs causing issues
- Manually inspect problematic posts
- File bug report with sample data

### Issue: "Attachments not downloaded"

**Cause**: Network errors or invalid attachment URLs

**Solution**:
- Check logs for specific attachment URLs
- Verify attachments are publicly accessible
- Retry migration (resume will skip already processed posts)

---

## Advanced Configuration

### Custom Output Directory

```bash
# .env
OUTPUT_DIR=/path/to/custom/output
```

### Dry Run (Test Mode)

```bash
# Set environment variable
DRY_RUN=true npm start
```

Behavior:
- Crawls and parses posts
- Logs all actions
- Does NOT write output files

### Verbose Logging

```bash
# Set log level
LOG_LEVEL=debug npm start
```

Levels: `error`, `warn`, `info`, `debug`

---

## Performance Benchmarks

| Blog Size | Workers | Rate Limit | Estimated Time |
|-----------|---------|------------|----------------|
| 50 posts  | 4       | 1000ms     | 2-5 minutes    |
| 100 posts | 4       | 1000ms     | 5-8 minutes    |
| 500 posts | 8       | 500ms      | 10-15 minutes  |
| 1000 posts| 8       | 1000ms     | 30-45 minutes  |

- TODO : Estimate time after implementation.

**Notes**:
- Times vary based on network speed and post content size
- Larger posts (with many images/attachments) take longer
- Conservative rate limiting increases migration time

---

## Next Steps

1. **Run migration** with your blog
2. **Review output files** (WXR, link_mapping.json)
3. **Import to WordPress** using WordPress Importer
4. **Update internal links** using link_mapping.json as reference
5. **Verify content** in WordPress

---

## Support

- **Documentation**: See `specs/003-name-tistory-wxr-generator/`
- **Issues**: File bug reports on GitHub
- **Logs**: Check console output and log files for debugging
