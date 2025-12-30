import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { marked } from 'marked';
import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';

export interface Cleaner {
  htmlToMarkdown(html: string): string;
  markdownToHtml(markdown: string): string;
  cleanHtml(html: string): string;
}

export interface CleanerOptions {
  htmlToMarkdownImpl?: (html: string) => string;
  markdownToHtmlImpl?: (markdown: string) => string;
}

export const createCleaner = (options: CleanerOptions = {}): Cleaner => {
  const { postContentSelector } = loadConfig();
  const logger = getLogger();

  const defaultHtmlToMarkdown = (html: string): string => {
    const turndownService = new TurndownService();

    turndownService.use(gfm);

    // Preserve inline formatting tags that should survive
    // the HTML -> Markdown -> HTML round trip.
    turndownService.keep(['sup', 'sub']);

    // Register rule to clean up iframe HTML.
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

const registerCleanIframeRule = (turndownService: TurndownService): void => {
  // Convert iframes (e.g. YouTube embeds) into
  // raw HTML iframe tags with only the src, width,
  // height, and allowfullscreen attributes, so that the
  // HTML -> Markdown -> HTML round trip yields a clean
  // <iframe ...></iframe>.
  turndownService.addRule('cleanIframe', {
    filter: ['iframe'],
    replacement: (_content, node) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const element = node as any;

      // Turndown이 다양한 HTML 파서와 함께 사용될 때 호환성 보장
      const getAttr = (name: string): string | null => {
        // DOM API 방식 (예: jsdom 또는 브라우저 환경)
        if (typeof element.getAttribute === 'function') {
          const value = element.getAttribute(name);
          return value == null ? null : String(value);
        }
        // 객체 프로퍼티 방식 (예: cheerio 또는 단순 객체)
        const value = (element as Record<string, unknown>)[name];
        return value == null ? null : String(value);
      };

      const src = getAttr('src');
      if (!src) return '';

      // 일부 속성만 보존
      const width = getAttr('width');
      const height = getAttr('height');
      const allowfullscreen = getAttr('allowfullscreen');

      const attrs: string[] = [`src="${src}"`];
      if (width) attrs.push(`width="${width}"`);
      if (height) attrs.push(`height="${height}"`);
      if (allowfullscreen) attrs.push(`allowfullscreen="${allowfullscreen}"`);

      const attrString = attrs.join(' ');

      return `\n\n<iframe ${attrString}></iframe>\n\n`;
    },
  });
};
