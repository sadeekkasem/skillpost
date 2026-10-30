import type { Post } from "@/lib/types";
import type { ChannelVideo } from "./feed";

export type FeedItem = { kind: "post"; post: Post } | { kind: "video"; video: ChannelVideo };

/** Minimum member posts between two video cards. */
const GAP = 3;
const MAX_VIDEOS = 15;

/**
 * Merge videos into posts (both newest first). A video is placed once its
 * date is reached, but only after at least GAP posts since the last video;
 * overdue videos then follow every GAP posts. Leftovers go at the end.
 */
export function interleaveVideos(posts: Post[], videos: ChannelVideo[]): FeedItem[] {
  const seen = new Set<string>();
  const queue = videos
    .filter((v) => !seen.has(v.id) && seen.add(v.id))
    .slice(0, MAX_VIDEOS)
    .sort((a, b) => (Date.parse(b.published) || 0) - (Date.parse(a.published) || 0));
  const out: FeedItem[] = [];
  let since = GAP; // allow a video before the first post if it is newest
  let vi = 0;
  for (const post of posts) {
    const postTime = Date.parse(post.created_at) || 0;
    const next = queue[vi];
    const due = next && (Date.parse(next.published) || 0) >= postTime;
    const overdue = next && vi < queue.length && since >= GAP + 1;
    if (next && since >= GAP && (due || overdue)) {
      out.push({ kind: "video", video: next });
      vi++;
      since = 0;
    }
    out.push({ kind: "post", post });
    since++;
  }
  // Remaining videos at the end (posts ran out).
  while (vi < queue.length) out.push({ kind: "video", video: queue[vi++] });
  return out;
}
