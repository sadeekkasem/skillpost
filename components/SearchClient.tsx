"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getClient } from "@/lib/supabase";
import { diamondFirst, getDiamondMembers } from "@/lib/tiers";
import TierBadge from "./TierBadge";
import { useT } from "@/components/LanguageProvider";
import {
  isSearchSort,
  isSearchTab,
  SEARCH_PAGE_SIZE,
  SEARCH_TABS,
  searchPage,
  snippet,
  type SearchHit,
  type SearchSort,
  type SearchTab,
} from "@/lib/search";

export default function SearchClient() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [db] = useState(() => getClient());
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const [category, setCategory] = useState(() => params.get("category") ?? "");
  const tab = (isSearchTab(params.get("tab")) ? params.get("tab") : "projects") as SearchTab;
  const specialty = params.get("specialty") ?? "";
  const sort = (isSearchSort(params.get("sort")) ? params.get("sort") : "relevance") as SearchSort;
  const page = searchPage(params.get("page"));
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [total, setTotal] = useState(0);
  const [diamonds, setDiamonds] = useState<string[]>([]);
  const requestId = useRef(0);
  const t = useT();

  const tabLabels = useMemo(
    () => ({
      members: t("search.tabMembers"),
      projects: t("search.tabProjects"),
      posts: t("search.tabPosts"),
    }) satisfies Record<SearchTab, string>,
    [t]
  );

  function updateUrl(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!("page" in changes)) next.delete("page");
    if (next.get("tab") === "projects") next.delete("tab");
    if (next.get("sort") === "relevance") next.delete("sort");
    const serialized = next.toString();
    router.replace(serialized ? `${pathname}?${serialized}` : pathname, { scroll: false });
  }

  useEffect(() => {
    setQuery(params.get("q") ?? "");
    setCategory(params.get("category") ?? "");
  }, [params]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      const term = query.trim();
      if (term) next.set("q", term);
      else next.delete("q");
      if (category) next.set("category", category);
      else next.delete("category");
      next.delete("page");
      if (next.toString() !== params.toString()) {
        router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false });
      }
    }, 300);
    return () => window.clearTimeout(timer);
    // URL changes sync input in the preceding effect; avoid an immediate rewrite loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category]);

  useEffect(() => {
    if (!db) return;
    let active = true;
    void Promise.all([
      db.from("projects").select("category").limit(1000),
      db.from("profiles").select("specialty").not("specialty", "is", null).limit(1000),
      getDiamondMembers(db),
    ]).then(([projectRows, memberRows, diamondIds]) => {
      if (!active) return;
      setCategories([...new Set((projectRows.data ?? []).map((row) => row.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar")));
      setSpecialties([...new Set((memberRows.data ?? []).map((row) => row.specialty).filter((x): x is string => Boolean(x?.trim())))] .sort((a, b) => a.localeCompare(b, "ar")));
      setDiamonds(diamondIds);
    });
    return () => { active = false; };
  }, [db]);

  useEffect(() => {
    const id = ++requestId.current;
    const term = params.get("q")?.trim() ?? "";
    if (!db) {
      setMessage(t("search.dbOffline"));
      return;
    }
    if (term.length === 1 && !category && !specialty) {
      setHits([]);
      setTotal(0);
      setMessage("");
      return;
    }
    const timer = window.setTimeout(() => {
      setLoading(true);
      setMessage("");
      void Promise.resolve(db.rpc("search_content", {
        p_tab: tab,
        p_term: term,
        p_category: category,
        p_specialty: specialty,
        p_sort: sort,
        p_page: page,
        p_page_size: SEARCH_PAGE_SIZE,
      })).then(({ data, error }) => {
        if (id !== requestId.current) return;
        if (error) {
          setMessage(error.message);
          setHits([]);
          setTotal(0);
          return;
        }
        const rows = (data ?? []) as unknown as SearchHit[];
        setHits(tab === "posts" ? rows : diamondFirst(rows, (row) => row.user_id, diamonds));
        setTotal(rows[0]?.total_count ?? 0);
      }).catch((error: unknown) => {
        if (id === requestId.current) setMessage(error instanceof Error ? error.message : t("search.failed"));
      }).finally(() => {
        if (id === requestId.current) setLoading(false);
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [db, params, tab, category, specialty, sort, page, diamonds, t]);

  const pages = Math.max(1, Math.ceil(total / SEARCH_PAGE_SIZE));

  return (
    <div>
      <h1>{t("search.title")}</h1>
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search.placeholder")} aria-label={t("search.queryLabel")} maxLength={100} autoFocus style={{ width: "100%", boxSizing: "border-box" }} />
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginTop: 12 }}>
        <label>{t("search.specialty")}
          <select value={specialty} onChange={(event) => updateUrl({ specialty: event.target.value || null })}>
            <option value="">{t("search.allSpecialties")}</option>
            {specialty && !specialties.includes(specialty) && <option value={specialty}>{specialty}</option>}
            {specialties.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label>{t("search.category")}
          <select value={category} onChange={(event) => { setCategory(event.target.value); updateUrl({ category: event.target.value || null }); }}>
            <option value="">{t("search.allCategories")}</option>
            {category && !categories.includes(category) && <option value={category}>{category}</option>}
            {categories.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label>{t("search.sort")}
          <select value={sort} onChange={(event) => updateUrl({ sort: event.target.value })}>
            {(["relevance", "newest", "oldest"] as const).map((value) => <option key={value} value={value}>{t(`search.sort_${value}`)}</option>)}
          </select>
        </label>
      </div>
      {params.get("q")?.trim().length === 1 && !category && !specialty && <p className="muted">{t("search.minChars")}</p>}
      {message && <p className="notice" role="alert">{message}</p>}
      <div className="row" role="tablist" style={{ gap: 8, margin: "16px 0", flexWrap: "wrap" }}>
        {SEARCH_TABS.map((value) => <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? undefined : "secondary"} onClick={() => updateUrl({ tab: value })}>{tabLabels[value]}</button>)}
      </div>
      {loading ? <p className="muted">{t("search.loading")}</p> : <p className="muted" role="status">{t("search.resultCount", { count: total })}</p>}
      {!loading && hits.length === 0 && !message && <p className="notice">{t("search.noResults")}</p>}
      <div style={{ display: "grid", gap: 12 }}>
        {hits.map((hit) => (
          <article key={`${hit.kind}-${hit.id}`} className="card">
            <Link href={hit.kind === "members" ? `/profile/${hit.id}` : hit.kind === "projects" ? `/projects/${hit.id}` : `/profile/${hit.user_id}`} style={{ fontWeight: 700 }}>
              {hit.kind === "members" ? `@${hit.body}` : hit.kind === "projects" ? hit.title : hit.author?.full_name || hit.author?.username || t("search.memberFallback")}
            </Link>{" "}
            <TierBadge id={hit.user_id} />
            {hit.category && <span className="badge" style={{ marginInlineStart: 8 }}>{hit.category}</span>}
            {hit.kind === "members" && <span className="muted">{hit.title}</span>}
            {hit.kind !== "members" && hit.body && <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{snippet(hit.body, hit.kind === "posts" ? 300 : 200)}</p>}
            {hit.created_at && <p className="muted" style={{ fontSize: 14 }}>{new Date(hit.created_at).toLocaleString("ar")}</p>}
          </article>
        ))}
      </div>
      {pages > 1 && <nav aria-label={t("search.pagination")} className="row" style={{ justifyContent: "center", marginTop: 20 }}>
        <button type="button" disabled={page <= 1 || loading} onClick={() => updateUrl({ page: String(page - 1) })}>{t("search.previous")}</button>
        <span>{t("search.pageOf", { page, total: pages })}</span>
        <button type="button" disabled={page >= pages || loading} onClick={() => updateUrl({ page: String(page + 1) })}>{t("search.next")}</button>
      </nav>}
    </div>
  );
}
