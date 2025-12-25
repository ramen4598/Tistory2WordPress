# Crawler Contract

**Component**: Crawler Service
**Interface**: `src/services/crawler.py`

## Purpose

Tistory 블로그에서 게시글 목록과 상세 정보를 크롤링하고 파싱.

## Methods

### `crawl_posts(base_url: str, start_post_id: Optional[str] = None, delay: float = 1.0) -> List[BlogPost]`

Tistory 블로그의 모든 게시글을 크롤링.

**Parameters**:
- `base_url`: Tistory 블로그 URL (예: `https://username.tistory.com`)
- `start_post_id`: 재개 시작 게시글 ID (옵션)
- `delay`: 요청 간 대기 시간 (초, 기본값 1.0)

**Returns**: `List[BlogPost]` - 크롤링된 게시글 목록

**Raises**:
- `ConnectionError`: 네트워크 연결 실패
- `HTTPError`: HTTP 에러 (4xx, 5xx)
- `ParseError`: HTML 파싱 실패

**Behavior**:
1. 마지막 게시글 ID에서부터 크롤링 시작 (start_post_id 지정 시)
2. 페이지네이션 처리하여 모든 게시글 수집
3. 각 요청마다 delay 초 대기
4. 마지막 성공한 게시글 ID를 progress.json에 저장
5. 에러 발생 시 로그 기록 후 재개 가능

---

### `parse_post_list(html: str) -> List[str]`

게시글 목록 페이지에서 게시글 URL 목록 추출.

**Parameters**:
- `html`: 게시글 목록 페이지 HTML

**Returns**: `List[str]` - 게시글 URL 목록

**Raises**: `ParseError` - HTML 파싱 실패

**Behavior**:
- Tistory 게시글 목록 페이지 구조 파싱
- 각 게시글의 상세 페이지 URL 추출

---

### `parse_post_detail(html: str, post_url: str) -> BlogPost`

게시글 상세 페이지에서 게시글 정보 파싱.

**Parameters**:
- `html`: 게시글 상세 페이지 HTML
- `post_url`: 게시글 URL

**Returns**: `BlogPost` - 게시글 정보

**Raises**: `ParseError` - HTML 파싱 실패

**Behavior**:
- 제목, 내용, 작성일, 수정일 파싱
- 카테고리 정보 파싱 (계층 구조 포함)
- 태그 파싱
- 이미지 정보(URL, 대체 텍스트) 파싱
- 첨부파일 정보(URL, 파일명) 파싱

## Preconditions

1. `base_url`은 유효한 Tistory 블로그 URL이어야 함
2. 네트워크 연결이 가능해야 함
3. `delay`는 0보다 커야 함

## Postconditions

1. `progress.json` 파일에 마지막 성공한 게시글 ID가 저장됨
2. 크롤링된 모든 게시글이 반환됨
3. 각 게시글의 HTML은 정제되지 않은 원본 상태임

## Example Usage

```python
from src.services.crawler import Crawler

crawler = Crawler()

# 처음 크롤링
posts = crawler.crawl_posts("https://username.tistory.com")

# 중단 후 재개
posts = crawler.crawl_posts(
    "https://username.tistory.com",
    start_post_id="456",
    delay=2.0  # 2초 대기
)
```

## Notes

- Tistory 블로그 구조가 변경될 경우 파싱 로직 업데이트 필요
- Rate-limiting은 delay 파라미터로 조절 가능
- 크롤링 중단 시 progress.json을 사용하여 재개 가능
