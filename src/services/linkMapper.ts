import fs from 'fs';
import path from 'path';
import { getAllInternalLinks, getInternalLinksByJobId } from '../db';
import type { InternalLinkRecord } from '../models/InternalLinkRecord';
import { getLogger } from '../utils/logger';
import { InternalLink } from '../models/InternalLink';

export function exportLinkMapping(outputPath: string, jobId?: number): void {
  const logger = getLogger();
  const dir = path.dirname(outputPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`Created output directory: ${dir}`);
  }

  const links: InternalLinkRecord[] =
    jobId != null ? getInternalLinksByJobId(jobId) : getAllInternalLinks();

  const exportData: InternalLink[] = links.map((link) => ({
    source_url: link.source_url,
    target_url: link.target_url,
    link_text: link.link_text ?? undefined,
    context: link.context ?? undefined,
  }));

  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');

  logger.info(`Exported ${exportData.length} internal links to ${outputPath}`, {
    outputPath,
    count: exportData.length,
    jobId,
  });
}
