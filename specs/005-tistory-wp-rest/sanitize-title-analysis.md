# WordPress `sanitize_title()` 분석

## 1. 개요

`sanitize_title( string $title, string $fallback_title = '', string $context = 'save' ): string`

- 역할: **URL/HTML 속성용 slug 문자열을 생성**하는 저수준 함수.
- 핵심 포인트:
  - **사람이 읽는 제목용이 아니라, URL slug용**이다.
  - 기본적으로 악센트/다국어 문자를 ASCII 로 축약하거나 퍼센트 인코딩한다.
  - 실제 slug 모양은 `sanitize_title` 필터에 기본 등록된 `sanitize_title_with_dashes()`에 크게 의존한다.

## 2. 처리 단계 (코드 기준)

공식 구현 (WordPress 6.9 기준, `wp-includes/formatting.php:2207` 인근):

```php
function sanitize_title( $title, $fallback_title = '', $context = 'save' ) {
	$raw_title = $title;

	if ( 'save' === $context ) {
		$title = remove_accents( $title );
	}

	/**
	 * Filters a sanitized title string.
	 *
	 * @since 1.2.0
	 *
	 * @param string $title     Sanitized title.
	 * @param string $raw_title The title prior to sanitization.
	 * @param string $context   The context for which the title is being sanitized.
	 */
	$title = apply_filters( 'sanitize_title', $title, $raw_title, $context );

	if ( '' === $title || false === $title ) {
		$title = $fallback_title;
	}

	return $title;
}
```

### 2.1 `context = 'save'` 일 때

1. `remove_accents( $title )` 호출
   - 악센트 문자(é, ñ 등)를 **ASCII 로 치환**.
   - 한글/중국어와 같이 ASCII 로 매핑되지 않는 문자는 그대로 남는다 (이후 필터 단계에서 처리).

2. `sanitize_title` 필터 적용
   - 코어에서는 기본적으로 `sanitize_title_with_dashes()`가 이 필터에 등록되어 있다.
   - `sanitize_title_with_dashes()`의 주된 동작:
     - 소문자화.
     - HTML 태그 제거.
     - 따옴표, 마침표 등 일부 특수문자 제거.
     - 공백·연속 구분자를 **단일 `-`(dash)** 로 치환.
     - 알파벳/숫자/언더스코어/대시 외 문자는 제거 또는 퍼센트 인코딩.

3. 비어 있거나 `false` 인 경우 fallback
   - 필터 이후 결과가 `''` 또는 `false` 이면 `$fallback_title` 로 대체.
   - 보통 게시글 생성 시 "제목 없음" 같은 디폴트에 사용 가능.

### 2.2 `context` 에 따른 차이

- 기본값은 `'save'`.
- `'query'` 컨텍스트는 `sanitize_title_for_query()`에서 사용:
  - 이 경우 `remove_accents()`를 건너뛰어, DB 쿼리용으로만 약간 덜 공격적으로 처리.
- 우리 REST 마이그레이션에서는 **실제 WP 내부 slug 를 직접 조작하기보다는 WordPress 에게 맡기는 쪽**이 안전하다.

## 3. 대표 예시

### 3.1 영어/숫자 제목

```php
sanitize_title( 'This Long Title is what My Post or Page might be' );
// => 'this-long-title-is-what-my-post-or-page-might-be'
```

- 공백 → `-`
- 대문자 → 소문자
- 알파벳/숫자/대시는 유지.

### 3.2 비라틴 문자 (예: 한글)

유저 노트 예시:

```php
$str = '這是字串';
$str = sanitize_title( $str );
// => '%e9%80%99%e6%98%af%e5%ad%97%e4%b8%b2'
```

- 한자/한글 등은 **퍼센트 인코딩된 바이트 시퀀스** 형태의 slug 가 될 수 있다.
- 브라우저 주소창에서는 보통 디코딩된 유니코드 주소로 보이지만, 실제 요청/DB 저장 시에는 퍼센트 인코딩 문자열이 사용된다.

## 4. slug 생성을 위한 설계 상 시사점 (005 REST 마이그레이션)

### 4.1 슬러그 생성 책임을 어디에 둘 것인가

- `wp_insert_post`/`POST /wp/v2/posts` 호출 시:
  - `slug`(= `post_name`)를 비우면 WordPress 코어가 **제목 + `sanitize_title()` + 중복 처리**를 모두 알아서 수행.
  - 직접 slug 를 만들 경우, `sanitize_title()` 혹은 JS 에서 `@wordpress/url` 의 `cleanForSlug()` 등으로 WP 와 동일한 규칙을 최대한 따라가야 함.
- 005 스펙의 목적은 **Tistory → WordPress 컨텐츠 이관**이지 커스텀 슬러그 엔진이 아니다.
  - 따라서 기본 전략은:
    - **slug 를 직접 만들지 않고 WordPress 에 맡긴다.**
    - 단, Tistory URL 과 WP slug 의 매핑은 별도 `tistory_wp_post_map` 및 `internal_links` 로 추적.

### 4.2 카테고리/태그 slug

- `register_taxonomy()`, `wp_insert_term()` 등에서도 내부적으로 `sanitize_title()`을 사용.
- 우리가 REST 로 `name`만 보내고 `slug` 를 생략하면, WP가 알아서 slug 를 생성.
- Tistory 카테고리/태그를 그대로 slug 로 옮기고 싶더라도:
  - **WP 내부 규칙과 정합성을 맞추려면** 코어 쪽 처리에 최대한 위임하는 것이 유지보수에 유리.

### 4.3 내부 링크 매핑과 slug

- Tistory 내부 링크 → WP 퍼머링크 변환에서는:
  - 슬러그가 `sanitize_title()` 규칙에 따라 생성/중복 처리되므로, **slug 예측을 시도하기보다는**:
    - `tistory_url → wp_post_id` mapping (`tistory_wp_post_map` 테이블)
    - 최종 퍼머링크는 REST 응답의 `link` 필드 또는 후처리에서 가져오는 방식이 안전.

### 4.4 멀티바이트/한글 블로그에 대한 주의점

- 한글/중국어 블로그에서 slug 를 강제로 Tistory 와 비슷하게 유지하려고 `sanitize_title()`을 직접 호출하면:
  - 위 예시처럼 퍼센트 인코딩 slug 가 생김.
  - SEO/가독성 측면에서 WP 관리자가 원하지 않을 수 있음.
- 실제 WordPress 사이트에서는:
  - 사이트 설정에 따라 **유니코드 slug 허용** 또는 플러그인/필터로 slug 정책을 커스터마이징하는 경우도 많다.
  - 005 도구는 이 정책을 침범하지 않고, **제목/내용/날짜/카테고리/태그만 정확히 보내고 slug 는 WordPress 정책에 맡기는 설계**가 더 안전하다.

## 5. 005-tistory-wp-rest 스펙/구현에 반영할 내용

- `wpClient.createDraftPost` 설계 시:
  - 기본: `slug` 필드를 **보내지 않는다**.
  - 예외적으로 사용자가 "Tistory post ID 기반 slug" 등을 명시적으로 요구하는 기능은 **v1 스코프에서 제외**.
- 카테고리/태그 생성 (`ensureCategory`, `ensureTag`):
  - REST payload 에 `name`만 설정하고 slug 는 생략.
  - 필요하다면, WP가 생성한 `slug` 를 응답에서 읽어와 로컬 캐시에 저장 (DB의 `Category.wpId`/`Tag.wpId` 수준이면 충분).
- 문서에 추가할 설명 (제안):
  - `data-model.md`의 `Category.slug`, `Tag.slug` 설명에:
    - "실제 slug 는 WordPress 가 `sanitize_title()` 규칙에 따라 생성할 수 있으며, 도구는 주로 `name`과 term ID 에 집중한다"는 문장을 추가.
  - 혹은 `research.md`/`wordpress-rest.md`에:
    - `sanitize_title()` 개요와 "slug 정책은 WP 코어/사이트 설정을 따른다"는 짧은 요약을 포함.

## 5.1 Taxonomy 검색 (`/categories?search=`, `/tags?search=`) 사용 시 주의점

- WordPress REST API의 `GET /wp-json/wp/v2/categories?search={term}` 및 `GET /wp-json/wp/v2/tags?search={term}`는:
  - **name, slug, description** 필드에서 반(半)일치 텍스트를 모두 포함하는 범위 검색으로 동작한다.
  - 가능한 상황:
    - `{term}`이 카테고리 이름의 일부로만 포함돼도 결과에 포함될 수 있다.
    - `{term}`가 description 내용에만 나타나도 검색 결과에 포함될 수 있다.
    - slug 에도 가능한 일부 문자열 일치가 포함된다.
- 따라서 `?search={name}`만으로 특정 슬러그/용어를 **정확히 식별된 단일 카테고리/태그**와 1:1 매핑한다고 가정하면 안 된다.
  - 특히, description 에 `{name}`가 들어간 전혀 다른 카테고리가 선택될 위험이 있다.

### 5.1.1 `ensureCategory` / `ensureTag` 설계 패턴

- REST 호출 단계:
  1. `GET /wp-json/wp/v2/categories?search={name}` 또는 `/tags?search={name}` 로 **후보 목록**을 가져온다.
  2. 응답 배열에서 **정확한 이름 일치만 필터링**한다:

     ```ts
     const exactMatches = results.filter((term) => term.name === name);
     ```

- 결정 로직 제안:
  - `exactMatches.length === 1` 인 경우:
    - 해당 term 의 `id`를 재사용하고, `Category.wpId`/`Tag.wpId` 에 저장한다.
  - `exactMatches.length === 0` 인 경우:
    - `POST /wp-json/wp/v2/categories` (또는 `/tags`) 로 `{ name }` 만 담아 새 term 을 생성한다.
    - 응답으로 받은 `id` (및 필요 시 `slug`)를 로컬에 캐시한다.
  - `exactMatches.length > 1` 인 경우:
    - - 우선 parent 나 taxonomy-specific 제약(예: 상위 카테고리)을 알고 있다면 추가 필터링에 사용한다.
      - 그렇지 않다면, 첫 번째 항목을 선택하되 **경고 로그**를 남겨 운영자가 중복을 정리할 수 있도록 한다.

- 캐싱 전략:
  - 마이그레이션 실행 중에는 `name → termId` 매핑을 메모리에 캐시하면, 동일한 이름에 대해 WordPress 를 반복 조회하지 않아도 된다.
  - 장기적으로는 DB 나 별도 테이블(`categories`, `tags` 등)이 이 역할을 할 수 있지만, 005 스코프에서는 `Category.wpId`/`Tag.wpId` 와 간단한 in-memory 캐시만으로도 충분하다.

- 이 패턴의 장점:
  - slug 를 직접 알거나 계산할 필요가 없다.
  - `search` 가 description/slug 를 포함한 모호한 검색이라는 사실을 전제로, **정확한 이름 일치 후 필터링**으로 오탐을 줄인다.
  - WordPress 코어와 사이트 설정(필터/플러그인)에 의해 생성된 slug 를 그대로 신뢰하면서도, 우리가 원하는 이름 기반 카테고리/태그 재사용 로직을 구현할 수 있다.

## 6. 요약

- `sanitize_title()`은 **WordPress slug/URL용 문자열을 만드는 저수준 함수**로, 실제 동작은 `remove_accents()` + `sanitize_title` 필터(`sanitize_title_with_dashes()`)로 이루어진다.
- 결과는 대개:
  - 소문자,
  - 공백 → 대시,
  - 허용되지 않는 문자는 제거/퍼센트 인코딩,
  - 비어 있으면 fallback 사용.
- 005 REST 마이그레이션 도구는 slug 를 직접 재현하기보다:
  - WordPress 에게 slug 생성 책임을 맡기고,
  - 우리는 `tistory_url ↔ wp_post_id` 및 최종 퍼머링크만 추적하는 방향이 안전하고, 유지보수 비용도 낮다.
