# Attachment Downloader Contract

**Component**: Attachment Downloader Service
**Interface**: `src/services/attachment_downloader.py`

## Purpose`

첨부파일 다운로드 및 로컬 경로 업데이트.

## Methods

### `download_attachments(posts: List[BlogPost], output_dir: str) -> List[BlogPost]`

게시글의 첨부파일 다운로드하고 로컬 경로 업데이트.

**Parameters**:
- `posts`: 게시글 목록
- `output_dir`: 다운로드 디렉토리 (예: `downloads`)

**Returns**: `List[BlogPost]` - 첨부파일 local_path가 업데이트된 게시글 목록

**Raises**:
- `ConnectionError`: 네트워크 연결 실패
- `HTTPError`: HTTP 에러 (4xx, 5xx)
- `IOError`: 파일 쓰기 실패

**Behavior**:
1. 각 게시글의 attachments 순회
2. 각 첨부파일 다운로드
3. 다운로드 성공 시 local_path 업데이트
4. 다운로드 실패 시 로그 기록 후 원래 URL 유지

---

### `download_file(url: str, output_path: str) -> bool`

단일 파일 다운로드.

**Parameters**:
- `url`: 다운로드 URL
- `output_path`: 저장 경로

**Returns**: `bool` - 다운로드 성공 시 True, 실패 시 False

**Raises**: None

**Behavior**:
1. HTTP GET 요청
2. 응답을 파일로 저장
3. 에러 발생 시 로그 기록
4. 성공 여부 반환

## Preconditions

1. `output_dir` 디렉토리가 존재해야 함
2. `posts`의 각 게시글 attachments 필드가 비어 있지 않아야 함

## Postconditions

1. `output_dir` 디렉토리에 다운로드된 파일이 저장됨
2. 다운로드 성공한 첨부파일의 local_path가 업데이트됨
3. 다운로드 실패한 첨부파일은 원래 URL 유지

## Example Usage

```python
from src.services.attachment_downloader import AttachmentDownloader

downloader = AttachmentDownloader()

posts = [...]  # 정제된 게시글 목록

# 첨부파일 다운로드
posts_with_attachments = downloader.download_attachments(posts, "downloads")
```

## Notes

- 다운로드 실패는 WXR 파일 생성에 영향 없음
- 다운로드 속도 제한 없음 (크롤링과 별도)
- 중복 파일은 덮어쓰기
- 디렉토리 구조: `downloads/[filename]`
