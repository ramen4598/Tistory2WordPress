import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { marked } from 'marked';
import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';

export interface Cleaner {
  htmlToMarkdown(html: string): string;
  markdownToHtml(markdown: string): string;

  /**
   * HTML 콘텐츠를 정리합니다.
   * @param html 원본 HTML 문자열
   * @return 정리된 HTML 문자열
   */
  cleanHtml(html: string): string;
}

export interface CleanerOptions {
  /**
   * HTML을 마크다운으로 변환하는 구현체입니다.
   * 기본 구현체를 사용하려면 이 속성을 생략하세요.
   * @param html 원본 HTML 문자열
   * @return 변환된 마크다운 문자열
   */
  htmlToMarkdownImpl?: (html: string) => string;

  /**
   * 마크다운을 HTML로 변환하는 구현체입니다.
   * 기본 구현체를 사용하려면 이 속성을 생략하세요.
   * @param markdown 원본 마크다운 문자열
   * @return 변환된 HTML 문자열
   */
  markdownToHtmlImpl?: (markdown: string) => string;
}

/**
 * Cleaner 인스턴스를 생성합니다.
 * @param options CleanerOptions
 * @return Cleaner
 */
export const createCleaner = (options: CleanerOptions = {}): Cleaner => {
  const { postContentSelector } = loadConfig();
  const logger = getLogger();

  const defaultHtmlToMarkdown = (html: string): string => {
    const turndownService = new TurndownService();

    // Preserve inline formatting tags that should survive
    // the HTML -> Markdown -> HTML round trip.
    turndownService.keep(['sup', 'sub']);

    // Plugin for GitHub Flavored Markdown (GFM) support.
    turndownService.use(gfm);

    // Register rule to clean up iframe HTML.
    registerCleanIframeRule(turndownService);
    // Register rule to clean up Tistory image table HTML.
    registerImageTableRule(turndownService);

    return turndownService.turndown(html);
  };

  const defaultMarkdownToHtml = (markdown: string): string => {
    return marked.parse(markdown) as string;
  };

  const htmlToMarkdownImpl = options.htmlToMarkdownImpl ?? defaultHtmlToMarkdown;
  const markdownToHtmlImpl = options.markdownToHtmlImpl ?? defaultMarkdownToHtml;

  const htmlToMarkdown = (html: string): string => htmlToMarkdownImpl(html);

  const markdownToHtml = (markdown: string): string => markdownToHtmlImpl(markdown);

  const cleanHtml = (html: string): string => {
    logger.debug('Cleaner.cleanHtml: start');

    const $ = cheerio.load(html);
    const root = $(postContentSelector).first();
    logger.debug('Cleaner.cleanHtml: selected content root', {
      selector: postContentSelector,
      html: root.html(),
    });

    const rawContentHtml = root.html();
    if (!rawContentHtml) {
      logger.warn('Cleaner.cleanHtml: no content found for selector', {
        selector: postContentSelector,
      });
      return '';
    }

    logger.debug('Cleaner.cleanHtml: extracted content root HTML', {
      selector: postContentSelector,
      length: rawContentHtml.length,
    });

    const markdown = htmlToMarkdown(rawContentHtml);
    logger.debug('Cleaner.cleanHtml: converted HTML to markdown', {
      markdownLength: markdown.length,
    });

    const cleanedHtml = markdownToHtml(markdown);
    logger.debug('Cleaner.cleanHtml: converted markdown back to HTML', {
      cleanedHtmlLength: cleanedHtml.length,
    });

    return cleanedHtml;
  };

  return {
    htmlToMarkdown,
    markdownToHtml,
    cleanHtml,
  };
};

/**
 * Turndown 규칙을 추가하여 iframe 태그를 정리합니다.
 * HTML -> Markdown -> HTML 변환 과정에서 깨끗한 iframe 태그를 유지합니다.
 * src, width, height, allowfullscreen 속성만 보존합니다.
 * @param turndownService TurndownService 인스턴스
 * @return void
 */
const registerCleanIframeRule = (turndownService: TurndownService): void => {
  turndownService.addRule('cleanIframe', {
    filter: ['iframe'],
    replacement: (_content, node) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const element = node as any;

      const src = getAttr(element, 'src');
      if (!src) return '';

      // 일부 속성만 보존
      const width = getAttr(element, 'width');
      const height = getAttr(element, 'height');
      const allowfullscreen = getAttr(element, 'allowfullscreen');

      const attrs: string[] = [`src="${src}"`];
      if (width) attrs.push(`width="${width}"`);
      if (height) attrs.push(`height="${height}"`);
      if (allowfullscreen) attrs.push(`allowfullscreen="${allowfullscreen}"`);

      const attrString = attrs.join(' ');

      return `\n\n<iframe ${attrString}></iframe>\n\n`;
    },
  });
};

/**
 * Turndown 규칙을 추가하여 Tistory 이미지 전용 표 구조를 정규화합니다.
 * HTML -> Markdown -> HTML 변환 과정에서 깨끗한 이미지 표 구조를 유지합니다.
 * table, tbody, tr, td, img 태그만 남기고 불필요한 속성 및 래퍼를 제거합니다.
 * img 태그에는 src, width, height 속성만 보존합니다.
 * @param turndownService TurndownService 인스턴스
 * @return void
 */
const registerImageTableRule = (turndownService: TurndownService): void => {
  turndownService.addRule('tistoryImageTable', {
    filter: (node) => {
      // 노드가 <table>인지 확인
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const element = node as any;
      if (!element || typeof element.nodeName !== 'string') return false;
      if (element.nodeName.toLowerCase() !== 'table') return false;

      // Turndown이 다양한 HTML 파서와 함께 사용될 때 호환성 보장
      // querySelectorAll 메서드가 없으면 false 반환
      const querySelectorAll = element.querySelectorAll?.bind(element);
      if (typeof querySelectorAll !== 'function') return false;

      // <figure class="imageblock"> 내에 이미지가 있는지 확인
      const hasImageFigure = querySelectorAll('figure.imageblock img').length > 0;
      if (!hasImageFigure) return false;

      // 모든 <td> 요소를 가져온다
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tds = Array.from(querySelectorAll('td')) as any[];
      if (tds.length === 0) return false;

      // TODO: 하나의 셀에만 img가 있을 때도 처리할지 여부 고민 필요
      // 모든 셀에 img가 있을 때만 이 규칙을 적용한다.
      const everyCellHasImage = tds.every(
        (td) => typeof td.querySelector === 'function' && td.querySelector('img')
      );

      return everyCellHasImage;
    },
    replacement: (_content, node) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table = node as any;
      if (!table || typeof table.querySelectorAll !== 'function') return '';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = Array.from(table.querySelectorAll('tr')) as any[];
      if (rows.length === 0) return '';

      const escapeHtml = (value: string): string => value.replace(/&/g, '&amp;');

      const rowHtml = rows
        .map((tr) => {
          if (typeof tr.querySelectorAll !== 'function') return '';
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cells = Array.from(tr.querySelectorAll('td')) as any[];
          if (cells.length === 0) return '';

          const cellHtml = cells
            .map((td) => {
              if (typeof td.querySelector !== 'function') return '<td></td>';
              const img = td.querySelector('img');
              if (!img) return '<td></td>';

              let src = getAttr(img, 'src');
              if (!src) return '<td></td>';
              src = escapeHtml(src);

              const width = getAttr(img, 'width');
              const height = getAttr(img, 'height');

              const attrs: string[] = [`src="${src}"`];
              if (width) attrs.push(`width="${width}"`);
              if (height) attrs.push(`height="${height}"`);

              return `<td><img ${attrs.join(' ')}></td>`;
            })
            .join('');

          if (!cellHtml) return '';
          return `<tr>${cellHtml}</tr>`;
        })
        .filter(Boolean)
        .join('');

      if (!rowHtml) return '';

      return `\n\n<table><tbody>${rowHtml}</tbody></table>\n\n`;
    },
  });
};

/**
 * 주어진 요소에서 지정된 속성의 값을 안전하게 가져옵니다.
 * Turndown이 다양한 HTML 파서와 함께 사용될 때 호환성을 보장합니다.
 * @param element 속성을 가져올 요소
 * @param name 가져올 속성 이름
 * @return 속성 값 (문자열) 또는 null (존재하지 않을 경우)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getAttr = (element: any, name: string): string | null => {
  // DOM API 방식 (예: jsdom 또는 브라우저 환경)
  if (typeof element.getAttribute === 'function') {
    const value = element.getAttribute(name);
    return value == null ? null : String(value);
  }
  // 객체 프로퍼티 방식 (예: cheerio 또는 단순 객체)
  const value = (element as Record<string, unknown>)[name];
  return value == null ? null : String(value);
};
