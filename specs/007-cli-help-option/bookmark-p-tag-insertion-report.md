# Bookmark Card `<p>` Insertion Issue Report

**Spec**: 007-cli-help-option | **Date**: 2026-01-07 | **Type**: Bug Analysis + Flex-Based Fix Proposal

## Summary

북마크 재생성 결과에서 카드 내부에 알 수 없는 `<p></p>`가 삽입되면서, 카드 레이아웃이 깨지는 문제가 발생한다.

원인은 WordPress 저장/렌더링 파이프라인에서 수행되는 자동 HTML 보정(예: `wpautop`, KSES sanitization, 블록/클래식 에디터의 HTML 정리)이 **`<a>` 바로 다음에 빈 `<p>`를 끼워 넣는 패턴**이 관찰되며, 이로 인해 레이아웃 컨테이너의 direct children 순서가 바뀌거나 grid/flex 아이템 계산이 깨진다.

## Symptom

관찰된 `<p>` 삽입 패턴들:

### 패턴 1: `<a>`가 grid 컨테이너일 때 `<a>` 내부에 삽입

```html
<a href="..." style="display: grid; grid-template-columns: 30% 70%;">
  <p></p>
  <div class="bookmark-featured-image">...</div>
  <div class="bookmark-content">...</div>
</a>
```

- Grid 첫 아이템이 `<p>`가 되어 컬럼 배치가 깨짐.

### 패턴 2: `.bookmark-grid` 내부에서 `overlay <a>` 바로 다음에 삽입

```html
<div class="bookmark-grid" style="display: grid; grid-template-columns: 30% 1fr;">
  <a class="bookmark-overlay-link" href="..." ...></a>
  <p></p>
  <div class="bookmark-featured-image">...</div>
  <div class="bookmark-content">...</div>
</div>
```

- Grid direct children이 3개 → 4개로 늘어나며 레이아웃이 깨짐.

### 패턴 3: 헤딩 태그 내부에 TOC 플러그인이 `<span>` 삽입

```html
<h3 class="bookmark-title">
  <span class="ez-toc-section" ...></span>
  GitHub – github/spec-kit: ...
  <span class="ez-toc-section-end"></span>
</h3>
```

- `<p>` 삽입은 아니지만, DOM 오염의 또 다른 패턴.

## Root Cause

- **`<a>` 바로 뒤에 `<p>`가 항상 삽입된다는 관찰**: WP가 자동 문단 처리(wpautop), HTML 정규화, 플러그인 개입으로 `<a>` 다음에 빈 `<p>`를 끼워 넣음.
- **레이아웃 컨테이너의 direct children 오염**: grid/flex 컨테이너 내부에 예상치 못한 `<p>`가 들어가면 레이아웃 계산이 깨짐.
- **헤딩 태그(h3)를 사용하면 TOC 플러그인 개입**: TOC 플러그인이 h2/h3를 스캔하여 앵커/span을 삽입.

## Minimal Fix Proposal

요구사항:

- **"카드 어디를 클릭해도 해당 사이트로 이동"**
- **이미지 30%, 컨텐츠 1fr** (flex: 0 0 30%, flex: 1)
- **WP가 `<a>` 뒤에 `<p>`를 삽입하더라도 레이아웃이 안 깨지는 구조**
- **TOC 플러그인 개입 최소화** (h3 → p 사용)

### Change (Final)

- 레이아웃 컨테이너를 **flex**(`display: flex`)로 변경.
- **overlay `<a>`를 레이아웃 컨테이너의 direct child가 아니게** 하여 `<p>` 삽입이 레이아웃에 영향을 주지 않도록 함.
  - overlay `<a>`는 `<figure>`의 첫 자식으로 두고 (absolute overlay)
  - 레이아웃은 별도 컨테이너(`div.bookmark-row`)에서 처리
- WP가 `<a>` 뒤에 `<p>`를 끼워 넣어도, 그 `<p>`는 `figure` 레벨에서만 늘어나고 **flex 컨테이너의 direct children(이미지/콘텐츠 2개)은 고정**.
- 제목 태그는 `h3` → `p`로 변경하여 TOC 플러그인 개입 최소화.

변경 후(개념):

```html
<figure class="bookmark-card" style="position: relative; ...">
  <a
    class="bookmark-overlay-link"
    href="..."
    target="_blank"
    rel="noopener noreferrer"
    aria-label="..."
    style="position: absolute; inset: 0; display: block; z-index: 3;"
  ></a>

  <!-- WP가 여기에 <p></p>를 끼워도 flex 레이아웃에 영향 없음 -->
  <p></p>

  <div
    class="bookmark-row"
    style="display: flex; gap: 14px; align-items: stretch; position: relative; z-index: 1;"
  >
    <div class="bookmark-featured-image" style="flex: 0 0 30%;">...</div>
    <div class="bookmark-content" style="flex: 1;">
      <p class="bookmark-title" style="... overflow-wrap: anywhere;">Title</p>
      <p class="bookmark-description" style="...">Description</p>
    </div>
  </div>
</figure>
```

### Why This Is Minimal & Robust

- **변경 범위는 템플릿 출력(`renderBookmarkHTML`)에 국한**됨.
- `BookmarkProcessor`, `Cleaner`, `ImageProcessor`의 동작 계약(루트 `figure.bookmark-card` 존재)은 유지됨.
- WP가 `<a>` 뒤에 `<p>`를 삽입하더라도, **flex 컨테이너의 direct children은 그대로 2개**라서 레이아웃이 유지됨.
- **헤딩 태그를 `p`로 변경**하여 TOC 플러그인 개입 최소화.

## Compatibility Notes

- WordPress HTML 보정은 환경(에디터, 테마, 플러그인)에 따라 달라 완전히 제어하기 어렵다.
- 본 수정은 “보정이 발생한다”는 전제 하에 **구조적으로 깨짐 확률을 크게 낮추는 완화책**.
- Overlay `<a>`는 `position:absolute; z-index:3`로 카드 전체를 덮으므로, WP가 끼워 넣는 `<p>`가 overlay 클릭을 가로막지 않음.

## Implementation Targets

- `src/templates/bookmarkTemplate.ts`: `renderBookmarkHTML()` 구조 변경 (flex 기반, h3→p, overlay 위치 이동)
- `tests/unit/templates/bookmarkTemplate.test.ts`: 출력 HTML의 구조가 변경되므로 테스트 업데이트 필요

## Acceptance Criteria

- WordPress 저장/렌더 과정에서 `<p>`가 `<a>` 뒤에 삽입되더라도 북마크 카드의 2-column 레이아웃이 유지된다.
- 기존처럼 `figure.bookmark-card` 루트 식별자는 유지된다.
- 북마크 카드 어디를 클릭해도 URL로 이동한다.
- TOC 플러그인 개입이 줄어든다 (`h3` → `p`).
