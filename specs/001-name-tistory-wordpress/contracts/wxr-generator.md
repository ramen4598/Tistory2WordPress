# WXR Generator Contract

**Component**: WXR Generator Service
**Interface**: `src/services/wxr_generator.py`

## Purpose

WordPress Importer 플러그인 0.9.5 호환 WXR 파일 생성.

## Methods

### `generate_wxr(posts: List[BlogPost], categories: List[Category], tags: List[Tag], output_path: str) -> str`

게시글, 카테고리, 태그로 WXR 파일 생성.

**Parameters**:
- `posts`: 게시글 목록
- `categories`: 카테고리 목록
- `tags`: 태그 목록
- `output_path`: 출력 파일 경로 (예: `output.xml`)

**Returns**: `str` - 생성된 WXR 파일 경로

**Raises**:
- `IOError`: 파일 쓰기 실패

**Behavior**:
1. WXR XML 구조 생성 (rss/channel)
2. 카테고리 추가 (wp:category)
3. 태그 추가 (wp:tag)
4. 게시글 추가 (item)
5. 파일 쓰기

---

### `build_rss(posts: List[BlogPost], categories: List[Category], tags: List[Tag]) -> Element`

WXR RSS XML 요소 생성.

**Parameters**:
- `posts`: 게시글 목록
- `categories`: 카테고리 목록
- `tags`: 태그 목록

**Returns**: `lxml.etree.Element` - RSS 요소

**Raises**: None

**Behavior**:
1. RSS 요소 생성 (version 2.0, 네임스페이스 포함)
2. Channel 요소 생성
3. 블로그 메타데이터 추가
4. 카테고리, 태그, 게시글 추가

---

### `add_post(item: Element, post: BlogPost) -> None`

WXR item 요소에 게시글 추가.

**Parameters**:
- `item`: WXR item 요소
- `post`: 게시글 정보

**Returns**: None

**Raises**: None

**Behavior**:
1. 게시글 메타데이터 추가 (title, link, pubDate, dc:creator)
2. 콘텐츠 추가 (content:encoded, excerpt:encoded)
3. WordPress 전용 요소 추가 (wp:post_id, wp:post_date, wp:post_name, wp:status, wp:post_type)
4. 카테고리 레퍼런스 추가 (category domain="category")
5. 태그 레퍼런스 추가 (category domain="post_tag")

## Preconditions

1. `posts`의 각 게시글 content는 정제된 HTML이어야 함
2. `categories`와 `tags`의 slug는 유효해야 함
3. `output_path`의 디렉토리가 존재해야 함

## Postconditions

1. `output.xml` 파일이 생성됨
2. 파일은 WordPress Importer 0.9.5 호환 포맷임

## Example Usage

```python
from src.services.wxr_generator import WXRGenerator

generator = WXRGenerator()

posts = [...]  # 정제된 게시글 목록
categories = [...]  # 카테고리 목록
tags = [...]  # 태그 목록

# WXR 파일 생성
wxr_path = generator.generate_wxr(posts, categories, tags, "output.xml")
```

## WXR Format Reference

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
    xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
    xmlns:content="http://purl.org/rss/1.0/modules/content/"
    xmlns:wfw="http://wellformedweb.org/CommentAPI/"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:wp="http://wordpress.org/export/1.2/">
  <channel>
    <title>Blog Title</title>
    <link>https://blog.example.com</link>
    <wp:wxr_version>1.2</wp:wxr_version>
    
    <wp:category>
      <wp:cat_id>1</wp:cat_id>
      <wp:category_nicename>category-slug</wp:category_nicename>
      <wp:cat_name>Category Name</wp:cat_name>
    </wp:category>
    
    <item>
      <title>Post Title</title>
      <wp:post_id>123</wp:post_id>
      <wp:post_date>2024-01-01 10:00:00</wp:post_date>
      <content:encoded>Post content</content:encoded>
      <category domain="category" nicename="category-slug">Category Name</category>
      <category domain="post_tag" nicename="tag-slug">Tag Name</category>
      <wp:status>publish</wp:status>
      <wp:post_type>post</wp:post_type>
    </item>
  </channel>
</rss>
```

## Notes

- WordPress Importer 0.9.5 호환 포맷 사용
- 네임스페이스: `xmlns:wp="http://wordpress.org/export/1.2/"`
- WXR 버전: 1.2
- 이미지는 HTML에 포함된 URL로 유지 (다운로드하지 않음)
- 첨부파일은 다운로드된 로컬 경로로 업데이트됨
