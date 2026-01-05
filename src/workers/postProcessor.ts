import PQueue from 'p-queue';
import { createMigrator } from '../services/migrator';
import { getLogger } from '../utils/logger';

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
 * Creates a PostProcessor with the specified concurrency.
 * @param concurrency - The number of concurrent processing tasks.
 * @returns A PostProcessor instance.
 */
export const createPostProcessor = (concurrency: number): PostProcessor => {
  const logger = getLogger();
  const queue = new PQueue({ concurrency });
  const migrator = createMigrator();

  const process = async (urls: string[], jobId: number): Promise<void> => {
    logger.info('PostProcessor: starting processing', { count: urls.length, concurrency });

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
