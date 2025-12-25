# Quickstart Guide

**Feature**: Tistory to WordPress Migration
**Date**: 2025-12-25

## Prerequisites

- Python 3.11+
- Git

## Installation

1. Clone repository:
```bash
git clone https://github.com/username/Tistory2Wordpress.git
cd Tistory2Wordpress
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Edit `.env` file:
```env
TISTORY_BLOG_URL=https://username.tistory.com
CRAWL_DELAY=1.0
LOG_LEVEL=INFO
```

## Usage

### Basic Usage

1. Run migration:
```bash
python -m src.cli.main
```

2. Check outputs:
   - `output.xml`: WXR 파일 (WordPress Importer로 import)
   - `link_mapping.json`: 내부 링크 매핑
   - `downloads/`: 첨부파일 디렉토리

### Resume from Last Success

```bash
python -m src.cli.main
```

프로그램은 자동으로 `progress.json`을 읽고 마지막 성공한 게시글 ID에서부터 재개함.

### Custom Crawl Delay

`.env` 파일 수정:
```env
CRAWL_DELAY=2.0  # 2초 대기
```

### Log Level

`.env` 파일 수정:
```env
LOG_LEVEL=DEBUG  # Debug, Info, Warn, Error, Fatal
```

## Import to WordPress

1. WordPress 대시보드 → Tools → Import
2. WordPress 플러그인 선택
3. `output.xml` 파일 업로드
4. Import 완료 후 게시글, 카테고리, 태그 확인

## Output Files

```
output.xml           # WXR 파일 (WordPress Importer)
link_mapping.json   # 내부 링크 매핑
downloads/           # 첨부파일 디렉토리
progress.json        # 크롤링 진행 상태 (자동 생성)
```

## Troubleshooting

### Connection Error
- 네트워크 연결 확인
- Tistory 블로그 URL 확인

### Parse Error
- Tistory 블로그 구조가 변경될 수 있음
- 로그 확인 후 이슈 리포트

### Download Failure
- 첨부파일 URL 접근 불가능
- 다운로드 실패는 WXR 파일 생성에 영향 없음

## Cleanup

다운로드한 첨부파일 삭제:
```bash
rm -rf downloads/
```

진행 상태 파일 삭제:
```bash
rm progress.json
```
