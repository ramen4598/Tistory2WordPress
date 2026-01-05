import { getLogger } from './utils/logger';
import { loadConfig } from './utils/config';
import { createMigrationJob, getDb, getMigrationJobItemsByJobId, updateMigrationJob } from './db';
import { MigrationJobItemStatus, MigrationJobStatus, MigrationJobType } from './enums/db.enum';
import { createMigrator } from './services/migrator';

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

function printUsage(): void {
  // Keep it simple; tests shouldn’t depend on output.
  console.log('Usage: ts-node src/cli.ts --post <tistory_post_url>');
}

export async function runCli(argv: string[]): Promise<number> {
  let url: string | undefined;
  const logger = getLogger();

  try {
    loadConfig();
  } catch (error) {
    logger.error('Configuration error', {
      error: (error as Error)?.message ?? String(error),
    });
    return 1;
  }

  try {
    url = getArgValue(argv, '--post');
    if (!url) {
      printUsage(); // Print usage info if --post is missing
      return 1;
    }
    new URL(url);
  } catch (error) {
    logger.error('Argument parsing error', {
      error: (error as Error)?.message ?? String(error),
    });
    return 1;
  }

  try {
    // Ensure DB is initialized and schema applied.
    getDb();

    const job = createMigrationJob(MigrationJobType.SINGLE);
    const migrator = createMigrator();

    await migrator.migratePostByUrl(url, { jobId: job.id });

    const items = getMigrationJobItemsByJobId(job.id);
    const completed = items.filter(
      (item) => item.status === MigrationJobItemStatus.COMPLETED
    ).length;
    const failed = items.filter((item) => item.status === MigrationJobItemStatus.FAILED).length;
    const JobResult: Partial<Pick<MigrationJob, 'status' | 'completed_at' | 'error_message'>> = {
      completed_at: new Date().toISOString(),
      status: failed > 0 ? MigrationJobStatus.FAILED : MigrationJobStatus.COMPLETED,
      error_message: failed > 0 ? 'Some items failed to migrate' : null,
    };
    await updateMigrationJob(job.id, JobResult);

    console.log(`Migration Job Summary (jobId=${job.id})`);
    console.log(`- Completed: ${completed}`);
    console.log(`- Failed: ${failed}`);

    return failed > 0 ? 1 : 0;
  } catch (error) {
    logger.error('CLI failed', {
      error: (error as Error)?.message ?? String(error),
    });
    return 1;
  }
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
