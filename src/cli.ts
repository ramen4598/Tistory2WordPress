import { getLogger } from './utils/logger';
import { loadConfig } from './utils/config';
import { createMigrationJob, getDb } from './db';
import { MigrationJobType } from './enums/db.enum';
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

    return 0;
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
