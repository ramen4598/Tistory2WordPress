import fs from 'fs';
import path from 'path';
import { getAllInternalLinks, getInternalLinksByJobId, getMigrationJobById } from '../db';
import type { InternalLinkRecord } from '../models/InternalLinkRecord';
import { getLogger } from '../utils/logger';
import { InternalLink } from '../models/InternalLink';

export interface LinkMappingExport {
  blog_url: string;
  exported_at: string;
  count: number;
  items: InternalLink[];
}

export function exportLinkMapping(outputPath: string, jobId: number): LinkMappingExport {
  const logger = getLogger();
  const dir = path.dirname(outputPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`LinkMapper.exportLinkMapping - created output directory: ${dir}`);
  }

  const blogUrl = getMigrationJobById(jobId)?.blog_url ?? 'unknown';

  const links: InternalLinkRecord[] =
    jobId != null ? getInternalLinksByJobId(jobId) : getAllInternalLinks();

  const items: InternalLink[] = links.map((link) => ({
    source_url: link.source_url,
    target_url: link.target_url,
    link_text: link.link_text ?? undefined,
    context: link.context ?? undefined,
  }));

  const exportData: LinkMappingExport = {
    blog_url: blogUrl,
    exported_at: new Date().toISOString(),
    count: items.length,
    items,
  };

  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');

  logger.info(
    `LinkMapper.exportLinkMapping - exported ${exportData.count} internal links to ${outputPath}`,
    {
      outputPath,
      count: exportData.count,
      jobId,
      blogUrl,
    }
  );

  return exportData;
}
