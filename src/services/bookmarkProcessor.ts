import axios from 'axios';
import * as cheerio from 'cheerio';
import { Bookmark } from '../models/Bookmark';
import { BookmarkMetadata } from '../models/BookmarkMetadata';
import { renderBookmarkHTML } from '../templates/bookmarkTemplate';
import { loadConfig } from '../utils/config';
import { getLogger } from '../utils/logger';
import { retryWithBackoff } from '../utils/retry';

export interface BookmarkProcessorOptions {
  config?: {
    timeout?: number;
    maxRedirects?: number;
    userAgent?: string;
  };
}

/**
 * BookmarkProcessor 인스턴스를 생성합니다.
 * @param options BookmarkProcessorOptions
 * @return BookmarkProcessor
 */
export const createBookmarkProcessor = (
  options: BookmarkProcessorOptions = {}
): BookmarkProcessor => {
  const config = loadConfig();
  const logger = getLogger();

  const {
    timeout = 60000, // 1 minutes
    maxRedirects = 5,
    userAgent = 'Mozilla/5.0 (compatible; Tistory2Wordpress/1.0)',
  } = options.config || {};

  const resolveUrl = (siteUrl: string, path: string): string => {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    const site = new URL(siteUrl);
    // return `${siteUrl.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
    return site.origin + (path.startsWith('/') ? path : '/' + path);
  };

  const detectBookmarks = (html: string): Bookmark[] => {
    const $ = cheerio.load(html);
    const { bookmarkSelector } = config;

    const bookmarkElements = $(bookmarkSelector);
    const bookmarks: Bookmark[] = [];

    bookmarkElements.each((index, element) => {
      const $element = $(element);

      const anchor = $element.find('a').first();
      const url = anchor.attr('href');

      if (url) {
        bookmarks.push({
          originalElement: $element,
          url,
          selector: bookmarkSelector,
          index,
        });
      }
    });

    logger.info(`Detected ${bookmarks.length} bookmark(s)`);

    return bookmarks;
  };

  const fetchMetadata = async (url: string): Promise<BookmarkMetadata> => {
    const startTime = Date.now();
    const fetchedAt = new Date().toISOString();

    try {
      logger.info('Fetching bookmark metadata', { url });

      const response = await retryWithBackoff(async () => {
        return await axios.get(url, {
          timeout,
          maxRedirects,
          headers: {
            'User-Agent': userAgent,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            // 'Accept-Language': 'en-US,en;q=0.9',
          },
        });
      }, config);

      const $ = cheerio.load(response.data);

      const title = $('meta[property="og:title"]').attr('content') || $('title').text() || url;

      const description: string | undefined =
        $('meta[property="og:description"]').attr('content') || undefined;

      // 파비콘 추출 (우선순위 순서)
      const favicon =
        $('link[rel="icon"]').attr('href') ||
        $('link[rel="shortcut icon"]').attr('href') ||
        $('link[rel="apple-touch-icon"]').attr('href') ||
        undefined;

      // 없으면 파비콘 시비
      const featuredImage =
        $('meta[property="og:image"]').attr('content') ||
        (favicon ? resolveUrl(url, favicon) : undefined);

      const canonicalUrl = $('meta[property="og:url"]').attr('content') || url;

      const elapsedTime = Date.now() - startTime;
      logger.info('Bookmark metadata fetched successfully', {
        url,
        title,
        hasDescription: description ? description.length > 0 : false,
        hasFeaturedImage: featuredImage ? featuredImage.length > 0 : false,
        fetchTimeMs: elapsedTime,
      });

      return {
        title,
        description,
        featuredImage,
        url: canonicalUrl,
        fetchedAt,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const elapsedTime = Date.now() - startTime;

      logger.warn('Failed to fetch bookmark metadata', {
        url,
        errorType: err.name,
        message: err.message,
        fetchTimeMs: elapsedTime,
      });

      return {
        title: url,
        description: undefined,
        featuredImage: undefined,
        url,
        fetchedAt,
        error: err.message,
      };
    }
  };

  const replaceBookmarks = async (html: string): Promise<string> => {
    const bookmarks = detectBookmarks(html);
    if (bookmarks.length === 0) return html;

    const $ = cheerio.load(html);

    const bookmarkEls = $(config.bookmarkSelector);

    for (let i = 0; i < bookmarkEls.length; i++) {
      const bookmarkEl = bookmarkEls.eq(i);
      const anchor = bookmarkEl.find('a').first();
      const url = anchor.attr('href');

      if (!url) {
        continue;
      }

      const metadata = await fetchMetadata(url);
      const cardHtml = renderBookmarkHTML({
        url: metadata.url || url,
        title: metadata.title,
        description: metadata.description,
        featuredImage: metadata.featuredImage,
      });

      logger.info('Replacing bookmark with bookmark-card HTML', {
        url,
        selector: config.bookmarkSelector,
        index: i,
      });

      bookmarkEl.replaceWith(cardHtml);
    }

    return $.html();
  };

  return {
    detectBookmarks,
    fetchMetadata,
    replaceBookmarks,
  };
};

export interface BookmarkProcessor {
  detectBookmarks(html: string): Bookmark[];
  fetchMetadata(url: string): Promise<BookmarkMetadata>;
  replaceBookmarks(html: string): Promise<string>;
}
