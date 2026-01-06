import { retryWithBackoff } from '../../../src/utils/retry';
import { Config } from '../../../src/models/Config';
import { loadConfig } from '../../../src/utils/config';
import { baseConfig } from '../helpers/baseConfig';

jest.mock('../../../src/utils/config');

const mockedLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;

const retryConfig: Pick<
  Config,
  'maxRetryAttempts' | 'retryInitialDelayMs' | 'retryMaxDelayMs' | 'retryBackoffMultiplier'
> = {
  maxRetryAttempts: 3,
  retryInitialDelayMs: 1,
  retryMaxDelayMs: 8,
  retryBackoffMultiplier: 2,
};

describe('retryWithBackoff', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedLoadConfig.mockReturnValue(baseConfig);
  });

  it('resolves on first attempt', async () => {
    let calls = 0;

    const result = await retryWithBackoff(async () => {
      calls++;
      return 'ok';
    }, retryConfig);

    expect(result).toBe('ok');
    expect(calls).toBe(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    let calls = 0;
    const attempts: number[] = [];
    const delays: number[] = [];

    const result = await retryWithBackoff(
      async () => {
        calls++;
        if (calls < 3) {
          throw new Error('temporary');
        }
        return 42;
      },
      retryConfig,
      {
        onRetry: (_error, attempt, delayMs) => {
          attempts.push(attempt);
          delays.push(delayMs);
        },
      }
    );

    expect(result).toBe(42);
    expect(calls).toBe(3);
    expect(attempts).toEqual([1, 2]);
    expect(delays[0]).toBeGreaterThanOrEqual(1);
    expect(delays[1]).toBeGreaterThanOrEqual(delays[0]);
  });

  it('throws after exhausting attempts', async () => {
    let calls = 0;

    await expect(
      retryWithBackoff(async () => {
        calls++;
        throw new Error('fail');
      }, retryConfig)
    ).rejects.toThrow('fail');

    expect(calls).toBe(3);
  });
});
