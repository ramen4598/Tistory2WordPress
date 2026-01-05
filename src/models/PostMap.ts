/**
 * Maps a Tistory post URL to a WordPress post ID.
 * Mirrors the `post_map` table in SQLite.
 */
export interface PostMap {
  id: number;
  tistory_url: string;
  wp_post_id: number;
  created_at: string;
}
