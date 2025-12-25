# HTML Cleaner Contract

**Component**: HTML Cleaner Service
**Interface**: `src/services/html_cleaner.py`

## Purpose

Tistory 전용 HTML/CSS 구조 제거하고 순수한 데이터만 남기며, 내부 링크를 식별.

## Methods

### `clean_posts(posts: List[BlogPost], base_url: str) -> List[BlogPost]`

게시글 목록의 HTML을 정제하고 내부 링크를 추출.

**Parameters**:
- `posts`: 정제할 게시글 목록
- `base_url`: Tistory 블로그 URL (내부 링크 식별용)

**Returns**: `List[BlogPost]` - 정제된 게시글 목록

**Raises**: None

**Behavior**:
1. 각 게시글의 HTML에서 Tistory 전용 요소 제거
2. 내부 Tistory 링크 식별
3. 게시글의 internal_links 필드에 내부 링크 URL 목록 저장

---

### `clean_html(html: str) -> str`

HTML 문자열에서 Tistory 전용 요소 제거.

**Parameters**:
- `html`: 정제할 HTML

**Returns**: `str` - 정제된 HTML

**Raises**: None

**Behavior**:
1. Tistory 스킨 스타일 태그 제거 (`<style>`, 인라인 스타일)
2. 광고 관련 요소 제거 (광고 iframe, 스크립트)
3. 공유 버튼/위젯 제거
4. 댓글 관련 요소 제거
5. 티스토리 전용 플러그인 요소 제거

---

### `extract_internal_links(html: str, base_url: str) -> List[str]`

HTML에서 내부 Tistory 링크 추출.

**Parameters**:
- `html`: 분석할 HTML
- `base_url`: Tistory 블로그 URL

**Returns**: `List[str]` - 내부 링크 URL 목록

**Raises**: None

**Behavior**:
1. HTML에서 모든 `<a>` 태그 추출
2. href 속성이 base_url을 포함하는 링크 식별
3. 내부 링크 URL 목록 반환

## Preconditions

1. `posts`의 각 게시글 content는 유효한 HTML이어야 함
2. `base_url`은 유효한 URL이어야 함

## Postconditions

1. 반환된 게시글의 content는 정제된 HTML임
2. 각 게시글의 internal_links 필드에 내부 링크 목록이 포함됨
3. WordPress 호환성을 위한 기본 HTML 구조 유지됨

## Example Usage

```python
from src.services.html_cleaner import HTMLCleaner
from src.models.blog_post import BlogPost

cleaner = HTMLCleaner()

posts = [...]  # 크롤링된 게시글 목록

cleaned_posts = cleaner.clean_posts(posts, "https://username.tistory.com")

# 단일 HTML 정제
clean_html = cleaner.clean_html("<div class='tistory-ad'>...</div><p>Content</p>")
# 결과: "<p>Content</p>"

# 내부 링크 추출
links = cleaner.extract_internal_links(
    "<a href='https://username.tistory.com/123'>Internal</a>",
    "https://username.tistory.com"
)
# 결과: ["https://username.tistory.com/123"]
```

## Notes

- Tistory 블로그 스킨에 따라 제거해야 할 요소가 다를 수 있음
- 정제는 보수적으로 수행하여 의도한 콘텐츠 제거 방지
- 내부 링크는 추출만 하고 수정하지 않음
