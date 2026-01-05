import PQueue from 'p-queue';
import { createMigrator } from '../services/migrator';
import { getLogger } from '../utils/logger';
import { loadConfig } from '../utils/config';

export interface PostProcessorOptions {
  concurrency?: number;
}

export interface PostProcessor {
  /**
   * Processes a list of post URLs.
   * @param urls - An array of post URLs to process.
   * @param jobId - The ID of the migration job.
   */
  process(urls: string[], jobId: number): Promise<void>;
}

/**
 * Creates a PostProcessor with rate limiting and concurrency settings from config.
 * @returns A PostProcessor instance.
 */
export const createPostProcessor = (): PostProcessor => {
  const logger = getLogger();
  const config = loadConfig();

  // Calculate rate limiting parameters
  // If rateLimitPerWorker is 1000ms, allow 1 request per 1000ms
  const intervalMs = config.rateLimitPerWorker;
  const intervalCap = 1; // 1 request per interval

  const queue = new PQueue({
    concurrency: config.workerCount,
    intervalCap: intervalCap,
    interval: intervalMs,
  });

  const migrator = createMigrator();

  const process = async (urls: string[], jobId: number): Promise<void> => {
    logger.info('PostProcessor: starting processing', {
      count: urls.length,
      concurrency: config.workerCount,
      rateLimitPerWorker: config.rateLimitPerWorker,
    });

    const tasks = urls.map((url) => {
      return async () => {
        try {
          await migrator.migratePostByUrl(url, { jobId: jobId });
        } catch (error) {
          logger.error('PostProcessor: failed to process post', {
            url,
            error: (error as Error)?.message ?? String(error),
          });
          // Individual post failure should not stop the queue
        }
      };
    });

    await queue.addAll(tasks);
    await queue.onIdle();

    logger.info('PostProcessor: finished processing');
  };

  return {
    process,
  };
};
