import { WXRData } from '../../src/models/WXRData';
import { Post } from '../../src/models/Post';
import { Category } from '../../src/models/Category';
import { Tag } from '../../src/models/Tag';

describe('WXRData', () => {
  describe('WXRData creation', () => {
    it('should create WXRData with posts, categories, tags, authors, and site_info', () => {
      const posts: Post[] = [
        {
          url: 'https://blog.tistory.com/1',
          title: 'First Post',
          content: '<p>Content 1</p>',
          publish_date: new Date('2025-01-01'),
          modified_date: null,
          categories: [],
          tags: [],
          images: [],
          attachments: [],
        },
        {
          url: 'https://blog.tistory.com/2',
          title: 'Second Post',
          content: '<p>Content 2</p>',
          publish_date: new Date('2025-01-02'),
          modified_date: null,
          categories: [],
          tags: [],
          images: [],
          attachments: [],
        },
      ];

      const categories: Category[] = [
        { name: 'Tech', slug: 'tech', parent: null, description: null },
        { name: 'Life', slug: 'life', parent: null, description: null },
      ];

      const tags: Tag[] = [
        { name: 'typescript', slug: 'typescript' },
        { name: 'nodejs', slug: 'nodejs' },
      ];

      const wxrData: WXRData = {
        posts,
        categories,
        tags,
        authors: [
          {
            id: 1,
            login: 'admin',
            display_name: 'Admin User',
          },
        ],
        site_info: {
          title: 'My Tistory Blog',
          description: 'A sample Tistory blog',
          url: 'https://blog.tistory.com',
        },
      };

      expect(wxrData.posts).toHaveLength(2);
      expect(wxrData.categories).toHaveLength(2);
      expect(wxrData.tags).toHaveLength(2);
      expect(wxrData.authors).toHaveLength(1);
      expect(wxrData.site_info.title).toBe('My Tistory Blog');
      expect(wxrData.site_info.url).toBe('https://blog.tistory.com');
    });
  });
});
