import type { Post, Project } from "@/lib/types";
import type { ChannelVideo } from "./feed";

export type FeedItem =
  | { kind: "post"; post: Post; time: number }
  | { kind: "project"; project: Project; time: number }
  | { kind: "video"; video: ChannelVideo; time: number };

const MAX_VIDEOS = 15;
const ts = (s?: string | null) => Date.parse(s ?? "") || 0;

/**
 * Merge posts + projects + videos, newest first, never two videos adjacent.
 * Posts and projects are merged by date. Videos are spread with a gap of
 * 1–3 non-video items (floor(nonVideo / videos), clamped). A video is placed
 * once the gap is met and it is due by date, or the gap is exceeded, or the
 * remaining videos would not fit otherwise. Videos stack only at the very end
 * when there is nothing left to separate them.
 */
export function buildHomeFeed(posts: Post[], projects: Project[], videos: ChannelVideo[]): FeedItem[] {
  const seen = new Set<string>();
  const nonVideo: FeedItem[] = [
    ...posts.map((post) => ({ kind: "post" as const, post, time: ts(post.created_at) })),
    ...projects.map((project) => ({ kind: "project" as const, project, time: ts(project.created_at) })),
  ]
    .filter((i) => {
      const key = i.kind + (i.kind === "post" ? i.post.id : i.project.id);
      return !seen.has(key) && seen.add(key);
    })
    .sort((a, b) => b.time - a.time);
  const queue = videos
    .filter((v) => !seen.has("v" + v.id) && seen.add("v" + v.id))
    .slice(0, MAX_VIDEOS)
    .map((video) => ({ kind: "video" as const, video, time: ts(video.published) }))
    .sort((a, b) => b.time - a.time);

  const gap = queue.length ? Math.max(1, Math.min(3, Math.floor(nonVideo.length / queue.length))) : 0;
  const out: FeedItem[] = [];
  let since = gap; // a newest video may open the feed
  let vi = 0;
  nonVideo.forEach((item, i) => {
    const next = queue[vi];
    if (next && since >= gap) {
      const remainingNon = nonVideo.length - i;
      const mustPlace = queue.length - vi > Math.ceil(remainingNon / gap);
      if (next.time >= item.time || since > gap || mustPlace) {
        out.push(next);
        vi++;
        since = 0;
      }
    }
    out.push(item);
    since++;
  });
  while (vi < queue.length) out.push(queue[vi++]);
  return out;
}
