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
  const config = loadConfig();
  const { postContentSelector } = config;
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
    registerGenericTableRule(turndownService);
    registerCleanIframeRule(turndownService);
    registerKeepBookmarkCardRule(turndownService);

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
      const src: string = node.getAttribute('src') ?? '';
      if (!src) return '';

      // 일부 속성만 보존
      const width = node.getAttribute('width') ?? '';
      const height = node.getAttribute('height') ?? '';
      const allowfullscreen = node.getAttribute('allowfullscreen') ?? '';

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
 * Turndown 규칙을 추가하여 bookmark-card를 유지합니다.
 * HTML -> Markdown -> HTML 변환 과정에서 bookmark-card가 손상되지 않도록 합니다.
 * @param turndownService TurndownService 인스턴스
 * @return void
 */
const registerKeepBookmarkCardRule = (turndownService: TurndownService): void => {
  turndownService.addRule('keepBookmarkCard', {
    filter: (node: HTMLElement) => {
      if (node.nodeName.toLowerCase() !== 'figure') return false;
      const cls = (node.getAttribute('class') ?? '').trim().split(/\s+/).filter(Boolean);
      return cls.includes('bookmark-card');
    },
    replacement: (_content, node) => {
      const element = node;
      return `\n\n${element.outerHTML}\n\n`;
    },
  });
};

/**
 * Turndown 규칙을 추가하여 table를 정리합니다.
 * - 모든 data-* 속성, style, border 등 표현용 속성은 제거됩니다.
 * - table, thead, tbody, tr, th, td, img 태그만 남깁니다.
 * - th, td 태그 내부에는 text 또는 img 태그만 허용됩니다.
 * - img 태그에는 src, width, height 속성만 보존됩니다.
 * @param turndownService TurndownService 인스턴스
 * @return void
 */
const registerGenericTableRule = (turndownService: TurndownService): void => {
  turndownService.addRule('genericTable', {
    filter: (node: HTMLElement) => {
      if (node.nodeName.toLowerCase() !== 'table') return false;
      return true;
    },
    replacement: (_content, node) => {
      const table: HTMLElement = node;

      const escapeHtml = (value: string): string => value.replace(/&/g, '&amp;');

      const cleanInner = (cell: HTMLElement): string => {
        // inner : text 또는 img
        let inner = cell.textContent.trim() ?? '';
        const img: HTMLImageElement | null = cell.querySelector('img');
        if (!img) return inner;

        let src: string | null = img.getAttribute('src');
        if (!src) return inner;
        src = escapeHtml(src).trim();

        const attrs: string[] = [`src="${src}"`];
        const width = img.getAttribute('width') ?? '';
        const height = img.getAttribute('height') ?? '';
        if (width) attrs.push(`width="${width}"`);
        if (height) attrs.push(`height="${height}"`);

        inner += `<img ${attrs.join(' ')}>`;
        return inner;
      };

      const cleanCell = (cell: HTMLElement): string => {
        const tagName = cell.nodeName.toLowerCase();
        const inner = cleanInner(cell);
        return `<${tagName}>${inner}</${tagName}>`;
      };

      const cleanRow = (row: Element): string => {
        const cells: HTMLElement[] = Array.from(row.querySelectorAll('th, td'));
        const cellHtml = cells.map((cell) => cleanCell(cell)).join('');
        return `<tr>${cellHtml}</tr>`;
      };

      const allRows: HTMLElement[] = Array.from(table.querySelectorAll('tr'));
      const headRow: string[] = [];
      const bodyRows: string[] = [];

      let isFirstRow = true;
      for (const tr of allRows) {
        if (isFirstRow) {
          isFirstRow = false;

          const firstCell = tr.querySelector('th, td');
          if (firstCell?.nodeName.toLowerCase() === 'th') {
            // 첫 번째 행에 th가 하나라도 있으면 헤더로 간주
            headRow.push(cleanRow(tr));
            continue;
          }
        }
        bodyRows.push(cleanRow(tr));
      }

      let thead = '';
      if (headRow.length > 0) {
        thead = `<thead>${headRow}</thead>`;
      }
      let tbody = '';
      if (bodyRows.length > 0) {
        tbody = `<tbody>${bodyRows.join('')}</tbody>`;
      }

      return `\n\n<table>${thead}${tbody}</table>\n\n`;
    },
  });
};
