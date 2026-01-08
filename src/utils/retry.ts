import { Config } from '../models/Config';
import { getLogger } from './logger';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Pick<
    Config,
    'maxRetryAttempts' | 'retryInitialDelayMs' | 'retryMaxDelayMs' | 'retryBackoffMultiplier'
  >,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = config.maxRetryAttempts,
    initialDelayMs = config.retryInitialDelayMs,
    maxDelayMs = config.retryMaxDelayMs,
    backoffMultiplier = config.retryBackoffMultiplier,
    onRetry,
  } = options;

  if (maxAttempts <= 0) {
    throw new Error('maxAttempts must be greater than 0');
  }

  let lastError: Error | undefined;
  let currentDelay = initialDelayMs;
  const logger = getLogger();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts) {
        logger.warn(`retryWithBackoff - max retry attempts (${maxAttempts}) exceeded`, {
          error: lastError.message,
        });
        throw lastError;
      }

      logger.warn(
        `retryWithBackoff - attempt ${attempt}/${maxAttempts} failed, retrying in ${currentDelay}ms`,
        {
          error: lastError.message,
        }
      );

      if (onRetry) {
        onRetry(lastError, attempt, currentDelay);
      }

      await sleep(currentDelay);

      currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError ?? new Error('retryWithBackoff failed without capturing an error');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
