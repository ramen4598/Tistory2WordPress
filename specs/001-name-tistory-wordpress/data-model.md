# Data Model

**Feature**: Tistory to WordPress Migration
**Date**: 2025-12-25

## Overview

Tistory 블로그 마이그레이션을 위한 데이터 모델 정의. Pydantic으로 데이터 검증 수행.

## Entities

### BlogPost

Tistory 블로그 게시글 정보.

```python
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, HttpUrl

class Image(BaseModel):
    url: HttpUrl
    alt_text: str = ""

class Attachment(BaseModel):
    url: HttpUrl
    filename: str
    local_path: Optional[str] = None  # 다운로드 후 로컬 경로

class BlogPost(BaseModel):
    id: str  # Tistory 게시글 ID
    title: str
    content: str  # 정제된 HTML
    original_url: HttpUrl
    created_at: datetime
    updated_at: datetime
    categories: List[str] = []
    tags: List[str] = []
    images: List[Image] = []
    attachments: List[Attachment] = []
    internal_links: List[str] = []  # 내부 Tistory 링크 URL 목록
```

### Category

카테고리 계층 구조.

```python
class Category(BaseModel):
    id: int
    slug: str
    name: str
    parent_id: Optional[int] = None  # 부모 카테고리 ID
    path: str  # 계층 경로 (예: "개발/Python")
```

### Tag

태그 정보.

```python
class Tag(BaseModel):
    id: int
    slug: str
    name: str
```

### InternalLink

내부 Tistory 링크 정보.

```python
class InternalLink(BaseModel):
    source_post_id: str  # 링크가 포함된 게시글 ID
    link_url: HttpUrl  # 내부 링크 URL
```

### CrawlProgress

크롤링 진행 상태.

```python
class CrawlProgress(BaseModel):
    last_success_post_id: Optional[str] = None
    completed: bool = False
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    total_posts: int = 0
    processed_posts: int = 0
    error_count: int = 0
```

## Relationships

```
BlogPost (1) ──< (N) Category
BlogPost (1) ──< (N) Tag
BlogPost (1) ──< (N) Image
BlogPost (1) ──< (N) Attachment
BlogPost (1) ──< (N) InternalLink

Category (N) ──< (1) Category (parent)
```

## Storage Format

### posts.json

크롤링된 게시글 데이터.

```json
{
  "posts": [
    {
      "id": "123",
      "title": "게시글 제목",
      "content": "<p>게시글 내용</p>",
      "original_url": "https://username.tistory.com/123",
      "created_at": "2024-01-01T10:00:00",
      "updated_at": "2024-01-01T10:00:00",
      "categories": ["개발", "Python"],
      "tags": ["python", "tutorial"],
      "images": [
        {
          "url": "https://example.com/image.jpg",
          "alt_text": "이미지 설명"
        }
      ],
      "attachments": [
        {
          "url": "https://example.com/file.pdf",
          "filename": "file.pdf",
          "local_path": "downloads/file.pdf"
        }
      ],
      "internal_links": [
        "https://username.tistory.com/456"
      ]
    }
  ]
}
```

### categories.json

카테고리 계층 구조.

```json
{
  "categories": [
    {
      "id": 1,
      "slug": "dev",
      "name": "개발",
      "parent_id": null,
      "path": "개발"
    },
    {
      "id": 2,
      "slug": "python",
      "name": "Python",
      "parent_id": 1,
      "path": "개발/Python"
    }
  ]
}
```

### tags.json

태그 목록.

```json
{
  "tags": [
    {
      "id": 1,
      "slug": "python",
      "name": "python"
    },
    {
      "id": 2,
      "slug": "tutorial",
      "name": "tutorial"
    }
  ]
}
```

### link_mapping.json

내부 링크 매핑.

```json
{
  "internal_links": [
    {
      "source_post_id": "123",
      "link_url": "https://username.tistory.com/456"
    }
  ]
}
```

### progress.json

크롤링 진행 상태.

```json
{
  "last_success_post_id": "456",
  "completed": false,
  "started_at": "2024-01-01T10:00:00",
  "completed_at": null,
  "total_posts": 100,
  "processed_posts": 50,
  "error_count": 2
}
```

## Data Flow

1. **크롤링 단계**: Tistory → BlogPost → posts.json
2. **정제 단계**: posts.json → HTMLCleaner → posts.json (정제됨)
3. **링크 추적 단계**: posts.json → LinkTracker → link_mapping.json
4. **다운로드 단계**: posts.json → AttachmentDownloader → downloads/ + posts.json (local_path 업데이트)
5. **WXR 생성 단계**: posts.json, categories.json, tags.json → WXRGenerator → output.xml
