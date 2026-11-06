export const SEARCH_TABS = ["members", "projects", "posts"] as const;
export const SEARCH_SORTS = ["relevance", "newest", "oldest"] as const;
export const SEARCH_PAGE_SIZE = 12;

export type SearchTab = (typeof SEARCH_TABS)[number];
export type SearchSort = (typeof SEARCH_SORTS)[number];
export type SearchAuthor = { username: string; full_name: string; specialty: string | null };
export type SearchHit = {
  id: string;
  user_id: string;
  kind: SearchTab;
  title: string | null;
  body: string;
  category: string | null;
  created_at: string | null;
  author: SearchAuthor | null;
  relevance: number;
  total_count: number;
};

export function isSearchTab(value: string | null): value is SearchTab {
  return SEARCH_TABS.some((tab) => tab === value);
}

export function isSearchSort(value: string | null): value is SearchSort {
  return SEARCH_SORTS.some((sort) => sort === value);
}

export function searchPage(value: string | null): number {
  if (!value || !/^\d+$/.test(value)) return 1;
  return Math.min(Math.max(Number(value), 1), 100);
}

export function snippet(text: string, max = 200): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
