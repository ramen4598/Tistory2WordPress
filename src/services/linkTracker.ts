import * as cheerio from 'cheerio';
import { insertInternalLink, getInternalLinksByJobItemId } from '../db';
import type { InternalLinkRecord } from '../models/InternalLinkRecord';
import { getLogger } from '../utils/logger';
import { InternalLink } from '../models/InternalLink';
import { loadConfig } from '../utils/config';

export interface LinkTracker {
  /**
   * Extracts internal links from the given HTML content.
   * Inserts internal link records associated with the specified job item ID.
   * @param sourceUrl The URL of the source content
   * @param html The HTML content to extract links from
   * @param jobItemId The job item ID associated with the content
   * @return An array of InternalLink objects
   */
  trackInternalLinks(sourceUrl: string, html: string, jobItemId: number): void;
  /**
   * Retrieves internal link records associated with the specified job item ID.
   * @param jobItemId The job item ID
   * @return An array of InternalLinkRecord objects
   */
  getInternalLinks(jobItemId: number): InternalLinkRecord[];
}

export function createLinkTracker(): LinkTracker {
  const logger = getLogger();
  const config = loadConfig();

  const extractInternalLinks = (sourceUrl: string, html: string): InternalLink[] => {
    const $ = cheerio.load(html);
    const blogUrl = new URL(config.blogUrl);
    const internalLinks: InternalLink[] = [];

    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (!href) return;

      try {
        const targetUrl = new URL(href, blogUrl.origin);

        if (targetUrl.hostname === blogUrl.hostname) {
          const linkText = $(element).text().trim();

          let context: string | undefined = undefined;
          const $parent = $(element).parent();
          if ($parent.length > 0) {
            const parentText = $parent.text();
            const linkIndex = parentText.indexOf(linkText);
            if (linkIndex >= 0) {
              const start = Math.max(0, linkIndex - 50);
              const end = Math.min(parentText.length, linkIndex + linkText.length + 50);
              context = parentText.slice(start, end).trim();
            }
          }

          internalLinks.push({
            source_url: sourceUrl,
            target_url: targetUrl.href,
            link_text: linkText,
            context,
          });
        }
      } catch {
        return;
      }
    });

    return internalLinks;
  };

  const trackInternalLinks = (sourceUrl: string, html: string, jobItemId: number): void => {
    const internalLinks: InternalLink[] = extractInternalLinks(sourceUrl, html);

    if (internalLinks.length === 0) {
      logger.debug('No internal links found', { sourceUrl });
      return;
    }

    logger.info('Tracking internal links', { sourceUrl, count: internalLinks.length });

    for (const link of internalLinks) {
      insertInternalLink({
        job_item_id: jobItemId,
        source_url: link.source_url,
        target_url: link.target_url,
        link_text: link.link_text ?? null,
        context: link.context ?? null,
      });
    }
  };

  const getInternalLinks = (jobItemId: number): InternalLinkRecord[] => {
    return getInternalLinksByJobItemId(jobItemId);
  };

  return {
    trackInternalLinks,
    getInternalLinks,
  };
}
