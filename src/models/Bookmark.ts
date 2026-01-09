import * as cheerio from 'cheerio';
import { AnyNode } from 'domhandler';

export interface Bookmark {
  /** The original HTML element of the bookmark */
  originalElement: cheerio.Cheerio<AnyNode>;

  /** Extracted URL from the bookmark anchor tag */
  url: string;

  /** The CSS selector used to detect this bookmark */
  selector: string;

  /** Position index of this bookmark in the post (0-based) */
  index: number;
}
