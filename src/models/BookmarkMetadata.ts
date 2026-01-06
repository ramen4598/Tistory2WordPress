export interface BookmarkMetadata {
  /** Title from og:title meta tag or <title> fallback */
  title: string;

  /** Description from og:description meta tag (may be empty) */
  description: string;

  /** Featured image URL from og:image meta tag (may be empty) */
  featuredImage: string;

  /** The canonical URL from og:url meta tag (defaults to fetch URL) */
  url: string;

  /** Timestamp when metadata was fetched */
  fetchedAt: string;

  /** Whether metadata fetch was successful */
  success: boolean;

  /** Error message if fetch failed (optional) */
  error?: string;
}
