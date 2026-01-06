import { getLogger } from './utils/logger';
import { loadConfig } from './utils/config';
import {
  createMigrationJob,
  getDb,
  getMigrationJobItemsByJobId,
  getLatestRunningJobByType,
  getMigrationJobItemsByJobIdAndStatus,
  updateMigrationJob,
} from './db';
import { MigrationJobItemStatus, MigrationJobStatus, MigrationJobType } from './enums/db.enum';
import { createMigrator } from './services/migrator';
import { createCrawler } from './services/crawler';
import { exportLinkMapping } from './services/linkMapper';
import { MigrationJob } from './models/MigrationJob';
import { createPostProcessor } from './workers/postProcessor';
import path from 'path';

function getArgValue(argv: string[], flag: string): string | undefined {
  const exact = argv.find((a) => a === flag);
  if (exact) {
    const idx = argv.indexOf(exact);
    const value = argv[idx + 1];
    if (value && !value.startsWith('-')) {
      return value;
    }
  }

  const prefix = `${flag}=`;
  const withEquals = argv.find((a) => a.startsWith(prefix));
  if (withEquals) {
    return withEquals.slice(prefix.length);
  }

  return undefined;
}

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes('--help') || argv.includes('-h');
}

function printUsage(): void {
  console.log('Tistory2Wordpress - Migrate Tistory blog posts to WordPress');
  console.log('');
  console.log('Usage:');
  console.log('[--post=<url> | --all] [--retry-failed] [--export-links]');
  console.log('');
  console.log('Options:');
  console.log('  -h, --help           Show this help message');
  console.log('  --post=<url>         Migrate a single post by URL');
  console.log('  --all                Migrate all posts from the blog');
  console.log('  --retry-failed       Retry failed migration items');
  console.log('  --export-links       Export internal link mapping to JSON');
  console.log('');
  console.log('Environment Variables (in .env):');
}

export async function runCli(argv: string[]): Promise<number> {
  if (hasHelpFlag(argv)) {
    printUsage();
    return 0;
  }

  const logger = getLogger();

  try {
    // Load config early to validate and provide clear error messages
    loadConfig();
  } catch (error) {
    logger.error('Configuration error', {
      error: (error as Error)?.message ?? String(error),
    });
    return 1;
  }

  const postUrl = getArgValue(argv, '--post');
  const allFlag = hasFlag(argv, '--all');
  const retryFailedFlag = hasFlag(argv, '--retry-failed');
  const exportLinksFlag = hasFlag(argv, '--export-links');

  if (!postUrl && !allFlag) {
    printUsage();
    return 1;
  }

  try {
    // Ensure DB is initialized and schema applied.
    getDb();
    const migrator = createMigrator();

    if (postUrl) {
      new URL(postUrl);
      const job = createMigrationJob(MigrationJobType.SINGLE);
      await migrator.migratePostByUrl(postUrl, { jobId: job.id });
      return await finalizeJob(job.id, { exportLinks: exportLinksFlag });
    }

    if (allFlag) {
      const job =
        getLatestRunningJobByType(MigrationJobType.FULL) ??
        createMigrationJob(MigrationJobType.FULL);

      const crawler = createCrawler({
        fetchFn: async (url: string) => {
          const res = await fetch(url);
          return { text: () => res.text() };
        },
      });

      const allUrls = await crawler.discoverPostUrls();
      logger.info('Discovered URLs for full migration', { count: allUrls.length });

      const completedItems = getMigrationJobItemsByJobIdAndStatus(
        job.id,
        MigrationJobItemStatus.COMPLETED
      );
      const completedUrls = new Set(completedItems.map((item) => item.tistory_url));
      const failedItems = getMigrationJobItemsByJobIdAndStatus(
        job.id,
        MigrationJobItemStatus.FAILED
      );
      const failedUrls = new Set(failedItems.map((item) => item.tistory_url));

      const pendingUrls = retryFailedFlag
        ? allUrls.filter((url) => !completedUrls.has(url))
        : allUrls.filter((url) => !completedUrls.has(url) && !failedUrls.has(url));

      const skippedCount = allUrls.length - pendingUrls.length;

      if (skippedCount > 0) {
        logger.info(
          `Resuming job ${job.id}: skipping ${skippedCount} ${retryFailedFlag ? 'completed' : 'completed/failed'} items`,
          {
            completedCount: completedUrls.size,
            failedCount: failedUrls.size,
            pendingCount: pendingUrls.length,
            retryFailed: retryFailedFlag,
          }
        );
      }

      const processor = createPostProcessor();
      await processor.process(pendingUrls, job.id);

      return await finalizeJob(job.id, {
        skippedCount,
        exportLinks: exportLinksFlag,
      });
    }

    return 0;
  } catch (error) {
    logger.error('CLI failed', {
      error: (error as Error)?.message ?? String(error),
    });
    return 1;
  }
}

async function finalizeJob(
  jobId: number,
  metrics?: { skippedCount?: number; exportLinks?: boolean }
): Promise<number> {
  const items = getMigrationJobItemsByJobId(jobId);
  const completed = items.filter((item) => item.status === MigrationJobItemStatus.COMPLETED).length;
  const failed = items.filter((item) => item.status === MigrationJobItemStatus.FAILED).length;
  const processed = completed + failed;
  const skipped = metrics?.skippedCount ?? 0;
  const exportLinks = metrics?.exportLinks ?? false;

  const jobResult: Partial<Pick<MigrationJob, 'status' | 'completed_at' | 'error_message'>> = {
    completed_at: new Date().toISOString(),
    status: failed > 0 ? MigrationJobStatus.FAILED : MigrationJobStatus.COMPLETED,
    error_message: failed > 0 ? 'Some items failed to migrate' : null,
  };
  await updateMigrationJob(jobId, jobResult);

  const config = loadConfig();

  console.log('');
  console.log('----------------------------------------');
  console.log(`- Migration Job Summary (jobId=${jobId})`);
  console.log('----------------------------------------');
  console.log(`- Detected : ${items.length}`);
  if (skipped > 0) {
    console.log(`- Skipped: ${skipped}`);
  }
  console.log(`- Completed: ${completed}`);
  console.log(`- Failed: ${failed}`);
  console.log(`- Total processed: ${processed}`);
  console.log(`- Database: ${config.migrationDbPath}`);
  console.log(`- Internal links: stored in 'internal_links' table (jobId=${jobId})`);

  if (exportLinks) {
    const linkMappingPath = path.join(config.outputDir, 'link_mapping.json');
    exportLinkMapping(linkMappingPath, jobId);
    console.log(`- Link mapping exported to: ${linkMappingPath}`);
  }

  console.log('----------------------------------------');

  return failed > 0 ? 1 : 0;
}

// CommonJS entrypoint
if (require.main === module) {
  runCli(process.argv)
    .then((code) => {
      process.exit(code);
    })
    .catch(() => {
      process.exit(1);
    });
}
