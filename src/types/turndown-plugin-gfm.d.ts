declare module 'turndown-plugin-gfm' {
  import { TurndownService } from 'turndown';
  // GFM 플러그인 엔트리 포인트 (테이블 등 지원)
  export function gfm(service: TurndownService): void;
}
