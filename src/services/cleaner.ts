/* eslint-disable @typescript-eslint/no-explicit-any */
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import * as gfm from 'turndown-plugin-gfm';
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

    // Rule 적용 순서가 중요. 나중에 추가한 규칙이 최종적으로 우선 적용됨
    // 따라서 아래로 갈수록 더 세부 규칙을 처리하도록 배치해야 함
    // Plugin for GitHub Flavored Markdown (GFM) support.
    turndownService.use([gfm.strikethrough, gfm.taskListItems]);
    turndownService.use(gfm.tables);
    registerGenericTableRule(turndownService);
    registerImageTableRule(turndownService);
    registerCleanIframeRule(turndownService);

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
      const tds = Array.from(querySelectorAll('td')) as any[];
      if (tds.length === 0) return false;

      // 최소 하나의 셀이라도 img를 포함하면 이 규칙을 적용한다.
      const someCellHasImage = tds.some(
        (td) => typeof td.querySelector === 'function' && td.querySelector('img')
      );

      return someCellHasImage;
    },
    replacement: (_content, node) => {
      const table = node as any;
      if (!table || typeof table.querySelectorAll !== 'function') return '';

      const rows = Array.from(table.querySelectorAll('tr')) as any[];
      if (rows.length === 0) return '';

      const escapeHtml = (value: string): string => value.replace(/&/g, '&amp;');

      const rowHtml = rows
        .map((tr) => {
          if (typeof tr.querySelectorAll !== 'function') return '';
          const cells = Array.from(tr.querySelectorAll('td')) as any[];
          if (cells.length === 0) return '';

          const cellHtml = cells
            .map((td) => {
              if (typeof td.querySelector !== 'function') return '<td></td>';
              const img = td.querySelector('img');

              if (!img) {
                const text = (td.textContent ?? '').trim();
                if (!text) return '<td></td>';
                return `<td>${escapeHtml(text)}</td>`;
              }

              let src = getAttr(img, 'src');
              if (!src) return '<td></td>';
              src = escapeHtml(src);

              const width = getAttr(img, 'width');
              const height = getAttr(img, 'height');

              const attrs: string[] = [`src=\"${src}\"`];
              if (width) attrs.push(`width=\"${width}\"`);
              if (height) attrs.push(`height=\"${height}\"`);

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
 * Turndown 규칙을 추가하여 일반 텍스트 기반 표(table)를 정리합니다.
 * GFM 테이블 플러그인이 헤더 행(<th>) 유무에 따라 일부 테이블을 그대로 keep
 * 하는 문제를 우회하기 위한 보조 규칙입니다.
 *
 * - table, thead/tbody/tfoot, tr, th/td만 남깁니다.
 * - 모든 data-* 속성, style, border 등 표현용 속성은 제거됩니다.
 * - 셀 안의 인라인 콘텐츠는 Turndown 기본 규칙(굵게, 링크 등)에 맡깁니다.
 */
const registerGenericTableRule = (turndownService: TurndownService): void => {
  turndownService.addRule('genericTable', {
    filter: (node) => {
      const element = node as any;
      if (!element || typeof element.nodeName !== 'string') return false;
      if (element.nodeName.toLowerCase() !== 'table') return false;

      // GFM 플러그인이 이미 처리한 테이블은 건드리지 않기 위해
      // heading row(모든 셀이 TH인 첫 행)를 가진 경우는 제외한다.
      const rows: any[] = Array.from(element.rows ?? []);
      if (rows.length === 0) return false;
      const firstRow = rows[0];
      const cells: any[] = Array.from(firstRow.cells ?? []);
      const everyCellIsTh =
        cells.length > 0 &&
        cells.every((cell) => {
          return typeof cell.nodeName === 'string' && cell.nodeName.toLowerCase() === 'th';
        });
      if (everyCellIsTh) return false;

      return true;
    },
    replacement: (_content, node) => {
      const table = node as any;
      if (!table) return '';

      // th가 아닌 경우 td로 처리하는 헬퍼 함수
      const cleanCell = (cell: any): string => {
        const tagName =
          typeof cell.nodeName === 'string' && cell.nodeName.toLowerCase() === 'th' ? 'th' : 'td';
        const inner = (cell.textContent ?? '').trim();
        return `<${tagName}>${inner}</${tagName}>`;
      };

      const bodyRows: string[] = [];

      const rowSources: any[] = [];
      if (table.rows && typeof table.rows.length === 'number') {
        // HTMLTableElement 호환
        rowSources.push(...Array.from(table.rows as any));
      } else if (typeof table.querySelectorAll === 'function') {
        // 일반적인 경우(cheerio 등)
        rowSources.push(...Array.from(table.querySelectorAll('tr') as any));
      }

      rowSources.forEach((tr) => {
        // tr 요소에서 th 또는 td 셀만 필터링
        const cellNodes: any[] = Array.from(tr.cells ?? tr.childNodes ?? []).filter((raw) => {
          const n: any = raw;
          return typeof n.nodeName === 'string' && ['th', 'td'].includes(n.nodeName.toLowerCase());
        });
        if (cellNodes.length === 0) return;
        const cellsHtml = cellNodes.map((c) => cleanCell(c)).join('');
        bodyRows.push(`<tr>${cellsHtml}</tr>`);
      });

      if (bodyRows.length === 0) return '';

      return `\n\n<table><tbody>${bodyRows.join('')}</tbody></table>\n\n`;
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
