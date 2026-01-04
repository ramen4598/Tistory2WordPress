import { createCleaner } from './cleaner';
import { insertInternalLink, getInternalLinksByJobItemId } from '../db';
import type { InternalLinkRecord } from '../models/InternalLinkRecord';
import { getLogger } from '../utils/logger';
import { InternalLink } from '../models/InternalLink';

export interface LinkTrackerContext {
  jobItemId: number;
}

export interface TrackInternalLinksOptions {
  sourceUrl: string;
  html: string;
  context: LinkTrackerContext;
}

export interface LinkTracker {
  trackInternalLinks(sourceUrl: string, html: string, context: LinkTrackerContext): void;
  getInternalLinks(jobItemId: number): InternalLinkRecord[];
}

export function createLinkTracker(): LinkTracker {
  const logger = getLogger();
  const cleaner = createCleaner();

  const trackInternalLinks = (
    sourceUrl: string,
    html: string,
    context: LinkTrackerContext
  ): void => {
    const internalLinks: InternalLink[] = cleaner.extractInternalLinks(sourceUrl, html);

    if (internalLinks.length === 0) {
      logger.debug('No internal links found', { sourceUrl });
      return;
    }

    logger.info('Tracking internal links', { sourceUrl, count: internalLinks.length });

    for (const link of internalLinks) {
      try {
        insertInternalLink({
          job_item_id: context.jobItemId,
          source_url: link.source_url,
          target_url: link.target_url,
          link_text: link.link_text ?? null,
          context: link.context ?? null,
        });
      } catch (error) {
        const message = (error as Error).message ?? String(error);
        logger.error('Failed to insert internal link record', {
          sourceUrl,
          targetUrl: link.target_url,
          error: message,
        });
      }
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
