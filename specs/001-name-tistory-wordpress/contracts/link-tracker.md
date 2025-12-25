# Link Tracker Contract

**Component**: Link Tracker Service
**Interface**: `src/services/link_tracker.py`

## Purpose

내부 Tistory 링크를 추적하고 link_mapping.json 파일에 기록.

## Methods

### `track_links(posts: List[BlogPost]) -> Dict[str, List[InternalLink]]`

게시글 목록에서 내부 링크를 추적하고 매핑 생성.

**Parameters**:
- `posts`: 게시글 목록 (internal_links 필드에 이미 추출된 링크 포함)

**Returns**: `Dict[str, List[InternalLink]]` - 출처 게시글 ID별 내부 링크 목록

**Raises**: None

**Behavior**:
1. 각 게시글의 internal_links 필드에서 링크 추출
2. InternalLink 객체 생성 (source_post_id, link_url)
3. 중복 링크 제거
4. 매핑 반환

---

### `is_internal_link(url: str, base_url: str) -> bool`

URL이 내부 Tistory 링크인지 확인.

**Parameters**:
- `url`: 확인할 URL
- `base_url`: Tistory 블로그 URL

**Returns**: `bool` - 내부 링크이면 True, 그렇지 않으면 False

**Raises**: None

**Behavior**:
1. URL이 base_url로 시작하는지 확인
2. 내부 링크 여부 반환

---

### `write_mapping_file(mapping: Dict[str, List[InternalLink]], output_path: str) -> None`

내부 링크 매핑을 JSON 파일에 기록.

**Parameters**:
- `mapping`: 내부 링크 매핑
- `output_path`: 출력 파일 경로 (예: `link_mapping.json`)

**Returns**: None

**Raises**:
- `IOError`: 파일 쓰기 실패

**Behavior**:
1. 매핑을 JSON 형식으로 변환
2. 지정된 경로에 파일 쓰기
3. UTF-8 인코딩 사용

## Preconditions

1. `posts`의 각 게시글은 internal_links 필드를 가져야 함
2. `output_path`의 디렉토리가 존재해야 함

## Postconditions

1. `link_mapping.json` 파일이 생성됨
2. 파일에 모든 내부 링크가 기록됨

## Example Usage

```python
from src.services.link_tracker import LinkTracker

tracker = LinkTracker()

posts = [...]  # 정제된 게시글 목록

# 링크 추적
mapping = tracker.track_links(posts)

# 매핑 파일 기록
tracker.write_mapping_file(mapping, "link_mapping.json")

# 내부 링크 확인
is_internal = tracker.is_internal_link(
    "https://username.tistory.com/123",
    "https://username.tistory.com"
)
# 결과: True
```

## Output Format

link_mapping.json:

```json
{
  "internal_links": [
    {
      "source_post_id": "123",
      "link_url": "https://username.tistory.com/456"
    },
    {
      "source_post_id": "123",
      "link_url": "https://username.tistory.com/789"
    }
  ]
}
```

## Notes

- 내부 링크는 추적만 하고 수정하지 않음
- link_mapping.json은 마이그레이션 후 링크 유지를 위한 참고 자료로 사용됨
- 중복 링크는 제거됨
