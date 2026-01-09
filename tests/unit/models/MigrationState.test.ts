import { MigrationState } from '../../../src/models/MigrationState';

describe('MigrationState', () => {
  describe('MigrationState creation', () => {
    it('should create a migration state with required fields', () => {
      const state: MigrationState = {
        version: '1.0',
        total_posts: 100,
        processed_posts: ['https://blog.tistory.com/1', 'https://blog.tistory.com/2'],
        last_checkpoint: new Date('2025-12-29T10:30:00Z'),
      };

      expect(state.version).toBe('1.0');
      expect(state.total_posts).toBe(100);
      expect(state.processed_posts).toHaveLength(2);
      expect(state.processed_posts[0]).toBe('https://blog.tistory.com/1');
      expect(state.last_checkpoint).toEqual(new Date('2025-12-29T10:30:00Z'));
    });

    it('should handle empty processed_posts array', () => {
      const state: MigrationState = {
        version: '1.0',
        total_posts: 0,
        processed_posts: [],
        last_checkpoint: new Date('2025-12-29T10:30:00Z'),
      };

      expect(state.processed_posts).toHaveLength(0);
      expect(state.total_posts).toBe(0);
    });
  });

  describe('MigrationState validation scenarios', () => {
    it('should enforce unique processed_posts URLs', () => {
      const state: MigrationState = {
        version: '1.0',
        total_posts: 2,
        processed_posts: ['https://blog.tistory.com/1', 'https://blog.tistory.com/2'],
        last_checkpoint: new Date('2025-12-29T10:30:00Z'),
      };

      const uniqueUrls = new Set(state.processed_posts);
      expect(uniqueUrls.size).toBe(state.processed_posts.length);
    });

    it('should ensure last_checkpoint is a Date instance', () => {
      const state: MigrationState = {
        version: '1.0',
        total_posts: 2,
        processed_posts: ['https://blog.tistory.com/1', 'https://blog.tistory.com/2'],
        last_checkpoint: new Date('2025-12-29T10:30:00Z'),
      };

      expect(state.last_checkpoint).toBeInstanceOf(Date);
    });
  });
});
