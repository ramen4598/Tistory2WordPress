# Research Document

**Feature**: Tistory to WordPress Migration
**Date**: 2025-12-25

## Research Summary

Tistory 블로그에서 WordPress로 마이그레이션하기 위한 기술적 연구 결과. WXR 포맷, Tistory HTML 구조, Python 웹 크롤링 베스트 프랙티스에 대해 조사함.

## 1. WordPress WXR Format

### WXR Structure Overview

WordPress eXtended RSS (WXR)는 WordPress Importer 플러그인이 사용하는 XML 포맷임. 기본 구조는 다음과 같음:

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
    <description>Blog Description</description>
    <language>en</language>
    <wp:wxr_version>1.2</wp:wxr_version>
    
    <!-- Categories -->
    <wp:category>
      <wp:cat_id>1</wp:cat_id>
      <wp:category_nicename>category-slug</wp:category_nicename>
      <wp:category_parent>parent-slug</wp:category_parent>
      <wp:cat_name>Category Name</wp:cat_name>
    </wp:category>
    
    <!-- Tags -->
    <wp:tag>
      <wp:tag_id>1</wp:tag_id>
      <wp:tag_slug>tag-slug</wp:tag_slug>
      <wp:tag_name>Tag Name</wp:tag_name>
    </wp:tag>
    
    <!-- Items (Posts) -->
    <item>
      <title>Post Title</title>
      <link>https://blog.example.com/post-slug</link>
      <pubDate>Wed, 28 May 2014 10:33:47 +0200</pubDate>
      <dc:creator>author</dc:creator>
      <description>Post excerpt</description>
      <content:encoded>Post content</content:encoded>
      <excerpt:encoded>Post excerpt</excerpt:encoded>
      <wp:post_id>123</wp:post_id>
      <wp:post_date>2014-05-28 10:33:47</wp:post_date>
      <wp:post_date_gmt>2014-05-28 08:33:47</wp:post_date_gmt>
      <wp:post_modified>2014-05-28 10:33:47</wp:post_modified>
      <wp:post_modified_gmt>2014-05-28 08:33:47</wp:post_modified_gmt>
      <wp:comment_status>open</wp:comment_status>
      <wp:ping_status>open</wp:ping_status>
      <wp:post_name>post-slug</wp:post_name>
      <wp:status>publish</wp:status>
      <wp:post_type>post</wp:post_type>
      <wp:is_sticky>0</wp:is_sticky>
      
      <!-- Category -->
      <category domain="category" nicename="category-slug">Category Name</category>
      
      <!-- Tag -->
      <category domain="post_tag" nicename="tag-slug">Tag Name</category>
    </item>
  </channel>
</rss>
```

### Key WXR Elements

- **Root**: `<rss>` with version 2.0 and WordPress XML namespaces
- **Channel**: Contains all blog data, metadata
- **wp:category**: Category with ID, slug, parent, name
- **wp:tag**: Tag with ID, slug, name
- **item**: Post/page with all metadata
- **category**: Reference to category or tag with domain attribute

### Python Implementation Reference

```python
from lxml import etree as ET

# Create root element
rss = ET.Element('rss', version='2.0', attrib={
    'xmlns:excerpt': 'http://wordpress.org/export/1.2/excerpt/',
    'xmlns:content': 'http://purl.org/rss/1.0/modules/content/',
    'xmlns:wfw': 'http://wellformedweb.org/CommentAPI/',
    'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
    'xmlns:wp': 'http://wordpress.org/export/1.2/'
})

# Create channel
channel = ET.SubElement(rss, 'channel')

# Add metadata
title = ET.SubElement(channel, 'title')
title.text = 'Blog Title'

# Create post item
item = ET.SubElement(channel, 'item')

title_elem = ET.SubElement(item, 'title')
title_elem.text = 'Post Title'

# Save XML
tree = ET.ElementTree(rss)
tree.write('output.xml', encoding='utf-8', xml_declaration=True)
```

## 2. Tistory HTML Structure

### Tistory Blog Structure

Tistory 블로그의 HTML 구조는 BeautifulSoup으로 파싱 가능함. 일반적인 구조:

```html
<!-- Post List Page -->
<div class="post-item">
  <h2 class="post-title">
    <a href="/123">Post Title</a>
  </h2>
  <span class="post-date">2024-01-01</span>
</div>

<!-- Post Detail Page -->
<div class="article">
  <h1 class="title">Post Title</h1>
  <span class="date">2024-01-01 10:00</span>
  <div class="article-content">
    <!-- Post HTML content -->
  </div>
  <div class="category">
    <a href="/category/tech">Tech</a>
  </div>
  <div class="tags">
    <a href="/tag/python">#python</a>
  </div>
</div>
```

### Tistory-specific Elements to Remove

Tistory 전용 CSS/HTML 요소 제거 필요:
- Tistory 스킨 스타일 태그 (`<style>`, 스킨 관련 CSS)
- 광고 관련 요소 (광고 iframe, 스크립트)
- 공유 버튼/위젯
- 댓글 관련 요소 (범위 제외됨)
- 티스토리 전용 플러그인 요소

### BeautifulSoup Parsing Example

```python
from bs4 import BeautifulSoup

soup = BeautifulSoup(html_content, 'html.parser')

# Extract post title
title = soup.find('h1', class_='title').text.strip()

# Extract content
content = soup.find('div', class_='article-content')

# Extract categories
categories = []
for cat_elem in soup.find_all('div', class_='category'):
    categories.append(cat_elem.text.strip())

# Extract tags
tags = []
for tag_elem in soup.find_all('a', class_='tag'):
    tags.append(tag_elem.text.strip())
```

## 3. Python Web Scraping Best Practices

### Rate Limiting

크롤링 속도 제한 구현 방법:

```python
import time
import requests

class RateLimitedCrawler:
    def __init__(self, delay=1.0):
        self.delay = delay
    
    def get(self, url):
        response = requests.get(url)
        time.sleep(self.delay)  # Wait between requests
        return response

crawler = RateLimitedCrawler(delay=1.0)  # 1 second delay
```

또는 `requests-ratelimiter` 라이브러리 사용:

```python
from requests_ratelimiter import LimiterSession

session = LimiterSession(per_second=1)  # 1 request per second
response = session.get(url)
```

### Error Handling and Retry

```python
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

session = requests.Session()
retry_strategy = Retry(
    total=3,
    backoff_factor=1,
    status_forcelist=[429, 500, 502, 503, 504]
)
adapter = HTTPAdapter(max_retries=retry_strategy)
session.mount("http://", adapter)
session.mount("https://", adapter)
```

### Logging

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('scraper.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)
logger.info('Starting crawl')
```

## 4. Key Decisions

### Technology Stack

1. **Python 3.11+**: 웹 크롤링, HTML 파싱에 최적화된 생태계
2. **requests**: HTTP 요청
3. **beautifulsoup4**: HTML 파싱
4. **lxml**: XML 생성 (WXR 파일)
5. **click**: CLI 프로그램
6. **python-dotenv**: 환경변수 관리
7. **pydantic**: 데이터 검증
8. **pytest**: 테스트 프레임워크

### Architecture Decisions

1. **Single Process**: 병렬 처리 대신 rate-limiting으로 안정성 우선
2. **Checkpointing**: 마지막 성공한 게시글 ID 저장하여 재개 가능
3. **Separate Stages**: 크롤링 → 정제 → 다운로드 → WXR 생성 순서
4. **Download-only Attachments**: 이미지는 URL만 유지, 첨부파일만 다운로드

### WXR Version

- WordPress Importer 플러그인 버전 0.9.5 호환
- WXR 버전 1.2 사용
- 네임스페이스: `xmlns:wp="http://wordpress.org/export/1.2/"`

## 5. Open Questions Resolved

### Q1: WXR 포맷 스펙
- 해결: WordPress Importer 소스코드 및 GitHub 문서 참조
- 네임스페이스 정의됨, channel/item 구조 명확함

### Q2: Tistory HTML 구조
- 해결: BeautifulSoup으로 파싱 가능
- 티스토리 전용 요소 제거 필요

### Q3: 크롤링 속도 제한
- 해결: `time.sleep()` 또는 `requests-ratelimiter` 사용
- 기본 1초 딜레이, 환경변수로 설정 가능

### Q4: 재개 기능
- 해결: 마지막 성공한 게시글 ID 저장 후 다시 로드
- JSON 파일에 진행 상태 저장

## References

1. WordPress WXR Specification: https://stackoverflow.com/questions/9356099/wordpress-wxr-specification
2. WordPress Importer GitHub: https://github.com/WordPress/wordpress-importer
3. Creating WXR XML Import File: https://axel.leroy.sh/blog/creating-wordpress-wxr-xml-import-file
4. BeautifulSoup Documentation: https://www.crummy.com/software/BeautifulSoup/bs4/doc/
5. Python Rate Limiting: https://stackoverflow.com/questions/401215/how-to-limit-rate-of-requests-to-web-services-in-python
