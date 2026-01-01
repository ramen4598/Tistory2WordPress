import {
  formatDate,
  formatWXRDate,
  formatWXRGMTDate,
  extractSlug,
} from '../../src/services/wxrGenerator';

describe('WXRGenerator Utilities', () => {
  describe('formatDate', () => {
    it('U-01: should format Date to RFC 2822 format', () => {
      const date = new Date('2025-01-01T10:30:45Z');
      const result = formatDate(date);
      expect(result).toBe('Wed, 01 Jan 2025 10:30:45 +0000');
    });
  });

  describe('formatWXRDate', () => {
    it('U-02: should format Date to WordPress date format Y-m-d H:i:s', () => {
      const date = new Date('2025-06-15T14:20:30Z');
      const result = formatWXRDate(date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      const expected = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      expect(result).toBe(expected);
    });
  });

  describe('formatWXRGMTDate', () => {
    it('U-03: should format Date to WordPress GMT date format', () => {
      const date = new Date('2025-06-15T14:20:30+09:00');
      const result = formatWXRGMTDate(date);
      expect(result).toBe('2025-06-15 05:20:30');
    });
  });

  describe('extractSlug', () => {
    it('U-04: should extract slug from Tistory URL', () => {
      const url = 'https://blog.tistory.com/my-first-post';
      const result = extractSlug(url);
      expect(result).toBe('my-first-post');
    });

    it('U-05: should handle numeric post IDs', () => {
      const url = 'https://blog.tistory.com/123';
      const result = extractSlug(url);
      expect(result).toBe('123');
    });
  });
});
