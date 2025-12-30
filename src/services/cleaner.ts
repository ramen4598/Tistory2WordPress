import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
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
