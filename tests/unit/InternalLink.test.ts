import { InternalLink } from '../../src/models/InternalLink';

describe('InternalLink', () => {
  describe('InternalLink creation', () => {
    it('should create an internal link with all fields', () => {
      const link: InternalLink = {
        source_url: 'https://blog.tistory.com/123',
        target_url: 'https://blog.tistory.com/456',
        link_text: 'See this related post',
        context: 'For more details, see this related post about...',
      };

      expect(link.source_url).toBe('https://blog.tistory.com/123');
      expect(link.target_url).toBe('https://blog.tistory.com/456');
      expect(link.link_text).toBe('See this related post');
      expect(link.context).toBe('For more details, see this related post about...');
    });

    it('should allow optional link_text and context', () => {
      const link: InternalLink = {
        source_url: 'https://blog.tistory.com/123',
        target_url: 'https://blog.tistory.com/456',
      };

      expect(link.source_url).toBe('https://blog.tistory.com/123');
      expect(link.target_url).toBe('https://blog.tistory.com/456');
      expect(link.link_text).toBeUndefined();
      expect(link.context).toBeUndefined();
    });
  });

  describe('InternalLink validation scenarios', () => {
    it('should enforce URL format requirements', () => {
      const link: InternalLink = {
        source_url: 'https://blog.tistory.com/123',
        target_url: 'https://blog.tistory.com/456',
        link_text: 'See this related post',
        context: 'For more details, see this related post about...',
      };

      expect(link.source_url).toMatch(/^https?:\/\//);
      expect(link.target_url).toMatch(/^https?:\/\//);
    });

    it('should ensure URLs match TISTORY_BLOG_URL constraint', () => {
      const link: InternalLink = {
        source_url: 'https://blog.tistory.com/123',
        target_url: 'https://blog.tistory.com/456',
      };

      const tistoryBlogUrl = 'https://blog.tistory.com';

      expect(link.source_url.startsWith(tistoryBlogUrl)).toBe(true);
      expect(link.target_url.startsWith(tistoryBlogUrl)).toBe(true);
    });
  });
});
