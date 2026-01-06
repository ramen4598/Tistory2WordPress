# Contract: Bookmark Metadata Fetching

**Feature**: 007-cli-help-option
**Component**: BookmarkProcessor
**Version**: 1.0
**Date**: 2026-01-06

## Overview

This contract defines the interface for fetching OpenGraph metadata from bookmark URLs.

## Metadata Schema

### Request

```typescript
interface FetchMetadataRequest {
  /** The URL to fetch metadata from */
  url: string;

  /** Timeout in milliseconds (default: 10000) */
  timeout?: number;

  /** Maximum number of redirects to follow (default: 5) */
  maxRedirects?: number;

  /** User-Agent header (optional) */
  userAgent?: string;
}
```

### Response

```typescript
interface FetchMetadataResponse {
  /** Title from og:title or <title> */
  title: string;

  /** Description from og:description */
  description: string;

  /** Featured image URL from og:image */
  featuredImage: string;

  /** Canonical URL from og:url or original URL */
  url: string;

  /** ISO 8601 timestamp of fetch */
  fetchedAt: string;

  /** Whether fetch was successful */
  success: boolean;

  /** Error message if fetch failed */
  error?: string;

  /** HTTP status code if available */
  statusCode?: number;
}
```

## OpenGraph Tag Mapping

| HTML Meta Tag                     | Field           | Fallback               |
| --------------------------------- | --------------- | ---------------------- |
| `meta[property="og:title"]`       | `title`         | `<title>` element text |
| `meta[property="og:description"]` | `description`   | Empty string           |
| `meta[property="og:image"]`       | `featuredImage` | Empty string           |
| `meta[property="og:url"]`         | `url`           | Original fetch URL     |

## HTTP Request Specification

### GET Request

```http
GET {url} HTTP/1.1
Host: {hostname}
User-Agent: {userAgent}
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
Accept-Language: en-US,en;q=0.9
```

### Headers

- **User-Agent**: Required to reduce blocking. Default: `Mozilla/5.0 (compatible; Tistory2Wordpress/1.0)`
- **Accept**: `text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8`
- **Accept-Language**: Optional

### Configuration

- **Timeout**: 10,000ms (10 seconds) - hardcoded per spec
- **Max Redirects**: 5 - follows HTTP 301, 302, 307, 308 redirects
- **Response Type**: Text (HTML)

## Response Handling

### Success Conditions

- HTTP status code 200-299
- HTML content received
- At least `title` field populated (from og:title or <title>)

### Failure Conditions

| Condition               | Handling                            | Error Type      |
| ----------------------- | ----------------------------------- | --------------- |
| HTTP 4xx (client error) | Log error, preserve original HTML   | ClientError     |
| HTTP 5xx (server error) | Log error, preserve original HTML   | ServerError     |
| Timeout (>10s)          | Log error, preserve original HTML   | TimeoutError    |
| Network error           | Log error, preserve original HTML   | NetworkError    |
| Invalid HTML            | Log error, preserve original HTML   | ParseError      |
| No metadata found       | Log warning, preserve original HTML | MetadataMissing |

### Retry Policy

**No retries** - per spec requirement (no caching, fetch once per bookmark)

## HTML Parsing Rules

### Selector Priority

1. `meta[property="og:title"]` → use content attribute
2. If not found → `title` element text
3. If not found → use URL as title (last resort)

4. `meta[property="og:description"]` → use content attribute
5. If not found → empty string

6. `meta[property="og:image"]` → use content attribute
7. If not found → empty string

8. `meta[property="og:url"]` → use content attribute
9. If not found → use original fetch URL

### Character Encoding

- Assume UTF-8 encoding
- Fallback to charset from HTML `<meta charset="">`
- Decode HTML entities in text fields

### URL Normalization

- Resolve relative URLs to absolute
- Remove fragment (#) from URLs
- Trim whitespace
- Validate URL format before use

## Error Response Schema

```typescript
interface BookmarkMetadataError {
  /** Error type enum */
  type:
    | 'TimeoutError'
    | 'NetworkError'
    | 'ClientError'
    | 'ServerError'
    | 'ParseError'
    | 'MetadataMissing';

  /** Human-readable error message */
  message: string;

  /** Original URL that failed */
  url: string;

  /** Timestamp of error */
  timestamp: string;

  /** HTTP status code if available */
  statusCode?: number;

  /** Stack trace for debugging */
  stack?: string;
}
```

## Logging Specification

### Success Log

```typescript
logger.info('Bookmark metadata fetched successfully', {
  url: bookmark.url,
  title: metadata.title,
  hasDescription: metadata.description.length > 0,
  hasFeaturedImage: metadata.featuredImage.length > 0,
  fetchTimeMs: elapsed,
});
```

### Failure Log

```typescript
logger.warn('Failed to fetch bookmark metadata', {
  url: request.url,
  errorType: error.type,
  message: error.message,
  statusCode: error.statusCode,
});
```

## Security Considerations

### Input Validation

- URL must be valid HTTP/HTTPS URL
- URL length < 2048 characters
- Reject javascript: and data: URLs

### Output Sanitization

- HTML-escape title and description fields
- URL-encode URL and featured image before use
- Remove script tags from HTML content
- Sanitize event handlers in HTML

### Rate Limiting

- No built-in rate limiting (per spec)
- Tool-wide rate limit applies (RATE_LIMIT_PER_WORKER env var)
- Respect HTTP 429 Too Many Requests if received

## Performance Requirements

### Response Time

- Target: <2s average metadata fetch
- Maximum: 10s timeout (per spec)
- P95: <5s for 95% of requests

### Throughput

- 1 request per bookmark (no caching)
- Sequential per post (no parallel bookmark fetching)
- Overall migration overhead: <20% (success criteria)

## Examples

### Example 1: Successful Fetch

**Request**:

```json
{
  "url": "https://example.com/article",
  "timeout": 10000,
  "maxRedirects": 5,
  "userAgent": "Mozilla/5.0 (compatible; Tistory2Wordpress/1.0)"
}
```

**HTML Response**:

```html
<html>
  <head>
    <meta property="og:title" content="Example Article Title" />
    <meta property="og:description" content="This is an example article description." />
    <meta property="og:image" content="https://example.com/image.jpg" />
    <meta property="og:url" content="https://example.com/article" />
  </head>
  <body>
    <title>Example Article Title</title>
  </body>
</html>
```

**Metadata Response**:

```json
{
  "title": "Example Article Title",
  "description": "This is an example article description.",
  "featuredImage": "https://example.com/image.jpg",
  "url": "https://example.com/article",
  "fetchedAt": "2026-01-06T12:00:00Z",
  "success": true,
  "statusCode": 200
}
```

---

### Example 2: Fetch with Fallbacks

**HTML Response** (no OpenGraph tags):

```html
<html>
  <head>
    <title>Article Title from Title Tag</title>
  </head>
  <body>
    <p>Article content...</p>
  </body>
</html>
```

**Metadata Response**:

```json
{
  "title": "Article Title from Title Tag",
  "description": "",
  "featuredImage": "",
  "url": "https://example.com/article",
  "fetchedAt": "2026-01-06T12:00:00Z",
  "success": true,
  "statusCode": 200
}
```

---

### Example 3: Fetch Failure (Timeout)

**Request**:

```json
{
  "url": "https://slow-server.com/article",
  "timeout": 10000
}
```

**Metadata Response**:

```json
{
  "title": "",
  "description": "",
  "featuredImage": "",
  "url": "https://slow-server.com/article",
  "fetchedAt": "2026-01-06T12:00:00Z",
  "success": false,
  "error": "Request timeout after 10000ms",
  "statusCode": undefined
}
```

**Logged Error**:

```
[WARN] Failed to fetch bookmark metadata: Request timeout after 10000ms
{
  "url": "https://slow-server.com/article",
  "errorType": "TimeoutError"
}
```

---

## Testing Guidelines

### Unit Tests Should Cover:

1. **Happy Path**: Successful metadata fetch with all OpenGraph tags
2. **Fallbacks**: Missing og:title, og:description, og:image
3. **Redirects**: Follow 1-5 redirects successfully
4. **Timeout**: Request exceeds 10s timeout
5. **Network Error**: Connection refused, DNS failure
6. **HTTP Errors**: 404, 403, 500, 503
7. **Invalid HTML**: Malformed HTML response
8. **Empty Response**: Empty body or no metadata
9. **Character Encoding**: UTF-8, non-ASCII characters
10. **URL Validation**: Invalid URLs, javascript:, data: schemes

### Integration Tests Should Cover:

1. Real URLs from popular sites (GitHub, Medium, Twitter, etc.)
2. URLs without OpenGraph tags
3. URLs with slow responses (>2s)
4. URLs with redirects (shorteners, canonical URLs)

---

## Version History

| Version | Date       | Changes                     |
| ------- | ---------- | --------------------------- |
| 1.0     | 2026-01-06 | Initial contract definition |
