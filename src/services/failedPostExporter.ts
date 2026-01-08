import fs from 'fs';
import path from 'path';
import { getFailedMigrationJobItemsByBlogUrl } from '../db';
import { getLogger } from '../utils/logger';

export interface FailedPostsExportItem {
  tistory_url: string;
  error_messages: string[];
}

export interface FailedPostsExport {
  blog_url: string;
  exported_at: string;
  count: number;
  items: FailedPostsExportItem[];
}

export function exportFailedPostsByBlogUrl(outputPath: string, blogUrl: string): FailedPostsExport {
  const logger = getLogger();
  const dir = path.dirname(outputPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`FailedPostExporter.exportFailedPostsByBlogUrl - created output directory: ${dir}`);
  }

  const failedItems = getFailedMigrationJobItemsByBlogUrl(blogUrl);

  // TODO: 성공한 적이 있는 항목은 제외하는 로직 추가

  const errorMessagesByUrl = new Map<string, Set<string>>();
  for (const item of failedItems) {
    const set = errorMessagesByUrl.get(item.tistory_url) ?? new Set<string>();
    if (item.error_message) {
      set.add(item.error_message);
    }
    errorMessagesByUrl.set(item.tistory_url, set);
  }

  const exportItems: FailedPostsExportItem[] = Array.from(errorMessagesByUrl.entries()).map(
    ([tistoryUrl, messages]) => ({
      tistory_url: tistoryUrl,
      error_messages: Array.from(messages),
    })
  );

  const exportData: FailedPostsExport = {
    blog_url: blogUrl,
    exported_at: new Date().toISOString(),
    count: exportItems.length,
    items: exportItems,
  };

  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');

  logger.info(
    `FailedPostExporter.exportFailedPostsByBlogUrl - exported ${exportData.count} failed posts to ${outputPath}`,
    {
      outputPath,
      count: exportData.count,
      blogUrl,
    }
  );

  return exportData;
}
