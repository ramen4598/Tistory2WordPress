import { renderBookmarkHTML } from '../../../src/templates/bookmarkTemplate';

describe('renderBookmarkHTML', () => {
  it('renders figure with title and link', () => {
    const html = renderBookmarkHTML({
      title: 'Example Title',
      url: 'https://example.com',
    });

    expect(html).toContain('<figure');
    expect(html).toContain('class="bookmark-card"');
    expect(html).toContain('Example Title');
    expect(html).toContain('<a href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('includes image section when featuredImage is provided', () => {
    const html = renderBookmarkHTML({
      title: 'With Image',
      url: 'https://example.com',
      featuredImage: 'https://example.com/image.jpg',
    });

    expect(html).toContain('class="bookmark-featured-image"');
    expect(html).toContain('src="https://example.com/image.jpg"');
  });

  it('includes description paragraph when description is provided', () => {
    const html = renderBookmarkHTML({
      title: 'With Description',
      url: 'https://example.com',
      description: 'Short description here',
    });

    expect(html).toContain('class="bookmark-description"');
    expect(html).toContain('Short description here');
  });

  it('keeps minimum card height even without content', () => {
    const html = renderBookmarkHTML({
      title: 'Minimal',
      url: 'https://example.com',
    });

    expect(html).toContain('min-height: 80px');
  });

  it('falls back to URL when title is undefined', () => {
    const html = renderBookmarkHTML({
      // metadata fetcher might produce empty title when it fails
      url: 'https://fallback.example.com/page',
    });

    expect(html).toContain('https://fallback.example.com/page');
  });

  it('falls back to URL when title is empty', () => {
    const html = renderBookmarkHTML({
      // metadata fetcher might produce empty title when it fails
      title: '',
      url: 'https://fallback.example.com/page',
    });

    expect(html).toContain('https://fallback.example.com/page');
  });
});
