import { getLogger } from './utils/logger';
import { loadConfig } from './utils/config';
import { createMigrationJob, getDb, getMigrationJobItemsByJobId, updateMigrationJob } from './db';
import { MigrationJobItemStatus, MigrationJobStatus, MigrationJobType } from './enums/db.enum';
import { createMigrator } from './services/migrator';
import { createCrawler } from './services/crawler';
import { MigrationJob } from './models/MigrationJob';
import { createPostProcessor } from './workers/postProcessor';
import { Config } from './models/Config';

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

function printUsage(): void {
  // Keep it simple; tests shouldn’t depend on output.
  console.log('Usage: ts-node src/cli.ts [--post <tistory_post_url> | --all]');
}

export async function runCli(argv: string[]): Promise<number> {
  const logger = getLogger();
  let config: Config;

  try {
    config = loadConfig();
  } catch (error) {
    logger.error('Configuration error', {
      error: (error as Error)?.message ?? String(error),
    });
    return 1;
  }

  const postUrl = getArgValue(argv, '--post');
  const allFlag = hasFlag(argv, '--all');

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
      return await finalizeJob(job.id);
    }

    if (allFlag) {
      const job = createMigrationJob(MigrationJobType.FULL);
      const crawler = createCrawler({
        fetchFn: async (url: string) => {
          const res = await fetch(url);
          return { text: () => res.text() };
        },
      });

      const urls = await crawler.discoverPostUrls();
      logger.info('Discovered URLs for full migration', { count: urls.length });

      const processor = createPostProcessor(config.workerCount);
      await processor.process(urls, job.id);

      return await finalizeJob(job.id);
    }

    return 0;
  } catch (error) {
    logger.error('CLI failed', {
      error: (error as Error)?.message ?? String(error),
    });
    return 1;
  }
}

async function finalizeJob(jobId: number): Promise<number> {
  const items = getMigrationJobItemsByJobId(jobId);
  const completed = items.filter((item) => item.status === MigrationJobItemStatus.COMPLETED).length;
  const failed = items.filter((item) => item.status === MigrationJobItemStatus.FAILED).length;

  const jobResult: Partial<Pick<MigrationJob, 'status' | 'completed_at' | 'error_message'>> = {
    completed_at: new Date().toISOString(),
    status: failed > 0 ? MigrationJobStatus.FAILED : MigrationJobStatus.COMPLETED,
    error_message: failed > 0 ? 'Some items failed to migrate' : null,
  };
  await updateMigrationJob(jobId, jobResult);

  console.log('');
  console.log('----------------------------------------');
  console.log(`- Migration Job Summary (jobId=${jobId})`);
  console.log('----------------------------------------');
  console.log(`- Completed: ${completed}`);
  console.log(`- Failed: ${failed}`);
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
