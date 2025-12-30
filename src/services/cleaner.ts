import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { marked } from 'marked';
import { loadConfig } from '../utils/config';

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
    const $ = cheerio.load(html);
    const root = $(postContentSelector).first();
    const rawContentHtml = root.html();

    if (!rawContentHtml) {
      return '';
    }

    const markdown = htmlToMarkdown(rawContentHtml);
    const cleanedHtml = markdownToHtml(markdown);
    return cleanedHtml;
  };

  return {
    htmlToMarkdown,
    markdownToHtml,
    cleanHtml,
  };
};
