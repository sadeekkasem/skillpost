"use client";
import { confirmedOnly } from "@/lib/confirmed";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getClient } from "@/lib/supabase";
import { diamondFirst, getDiamondMembers } from "@/lib/tiers";
import TierBadge from "./TierBadge";
import { useT } from "@/components/LanguageProvider";

type MemberHit = { id: string; username: string; full_name: string; specialty: string | null };
type ProjectHit = { id: string; user_id: string; title: string; description: string; category: string };
type PostHit = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { username: string; full_name: string } | null;
};

type Tab = "members" | "projects" | "posts";

const TABS: Tab[] = ["members", "projects", "posts"];

function isTab(value: string | null): value is Tab {
  return value === "members" || value === "projects" || value === "posts";
}

/** Make a term safe for a PostgREST or()/ilike filter value (unquoted). */
function toPattern(term: string): string {
  const cleaned = term
    .replace(/[,()"'\\:*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[%_]/g, (match) => `\\${match}`);
  return cleaned ? `%${cleaned}%` : "";
}

/** Quote a pattern for PostgREST `.or()` filters that contain % or spaces. */
function quoteFilterValue(value: string): string {
  return `"${value.replace(/"/g, "")}"`;
}

function snippet(text: string, max = 160): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function rankProjects(items: ProjectHit[], term: string): ProjectHit[] {
  const q = term.trim().toLowerCase();
  if (!q) return items;
  return [...items].sort((a, b) => {
    const aTitle = a.title.toLowerCase();
    const bTitle = b.title.toLowerCase();
    const score = (title: string, description: string, category: string) => {
      if (title === q) return 0;
      if (title.startsWith(q)) return 1;
      if (title.includes(q)) return 2;
      if (category.toLowerCase().includes(q)) return 3;
      if (description.toLowerCase().includes(q)) return 4;
      return 5;
    };
    return (
      score(aTitle, a.description, a.category) - score(bTitle, b.description, b.category) ||
      aTitle.localeCompare(bTitle, "ar")
    );
  });
}

export default function SearchClient() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [db] = useState(() => getClient());
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const [tab, setTab] = useState<Tab>(() => {
    const initial = params.get("tab");
    return isTab(initial) ? initial : "members";
  });
  const [members, setMembers] = useState<MemberHit[]>([]);
  const [projects, setProjects] = useState<ProjectHit[]>([]);
  const [posts, setPosts] = useState<PostHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [searched, setSearched] = useState("");
  const t = useT();
  const [specialty, setSpecialty] = useState(() => params.get("specialty") ?? "");
  const [specialties, setSpecialties] = useState<string[]>([]);

  const tabLabels = useMemo(
    () =>
      ({
        members: t("search.tabMembers"),
        projects: t("search.tabProjects"),
        posts: t("search.tabPosts"),
      }) satisfies Record<Tab, string>,
    [t]
  );

  useEffect(() => {
    if (!db) return;
    let alive = true;
    void db
      .from("profiles")
      .select("specialty")
      .not("specialty", "is", null)
      .limit(1000)
      .then(({ data }) => {
        if (!alive || !data) return;
        const set = new Set<string>();
        for (const row of data as { specialty: string | null }[]) {
          const v = row.specialty?.trim();
          if (v) set.add(v);
        }
        setSpecialties([...set].sort((a, b) => a.localeCompare(b, "ar")));
      });
    return () => {
      alive = false;
    };
  }, [db]);

  // Keep local state in sync when the shareable URL changes (back/forward, pasted link).
  useEffect(() => {
    const nextQ = params.get("q") ?? "";
    const nextSpecialty = params.get("specialty") ?? "";
    const nextTab = params.get("tab");
    setQuery((prev) => (prev === nextQ ? prev : nextQ));
    setSpecialty((prev) => (prev === nextSpecialty ? prev : nextSpecialty));
    if (isTab(nextTab)) setTab((prev) => (prev === nextTab ? prev : nextTab));
  }, [params]);

  // Keep the address bar shareable without re-fetching on every tab click.
  useEffect(() => {
    const term = query.trim();
    const qs = new URLSearchParams();
    if (term) qs.set("q", term);
    if (specialty) qs.set("specialty", specialty);
    if (tab !== "members") qs.set("tab", tab);
    const next = qs.toString();
    const currentQ = params.get("q") ?? "";
    const currentSpecialty = params.get("specialty") ?? "";
    const currentTab = params.get("tab") ?? "members";
    if (currentQ === term && currentSpecialty === specialty && currentTab === tab) return;
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [query, specialty, tab, pathname, router, params]);

  useEffect(() => {
    const term = query.trim();
    let cancelled = false;

    const timer = window.setTimeout(() => {
      const pattern = toPattern(term) || (specialty ? "%" : "");
      if ((term.length < 2 && !specialty) || !pattern) {
        setMembers([]);
        setProjects([]);
        setPosts([]);
        setSearched("");
        setMessage("");
        return;
      }
      if (!db) {
        setMessage(t("search.dbOffline"));
        return;
      }

      const quoted = quoteFilterValue(pattern);
      setLoading(true);
      setMessage("");
      void Promise.all([
        confirmedOnly((filter) => {
          let q = db
            .from("profiles")
            .select("id,username,full_name,specialty")
            .or(`username.ilike.${quoted},full_name.ilike.${quoted},specialty.ilike.${quoted}`);
          if (filter) q = q.eq("email_confirmed", true);
          if (specialty) q = q.eq("specialty", specialty);
          return q.limit(20);
        }),
        (specialty
          ? db
              .from("projects")
              .select("id,user_id,title,description,category,profiles!projects_user_id_fkey!inner(specialty)")
              .eq("profiles.specialty", specialty)
          : db.from("projects").select("id,user_id,title,description,category")
        )
          .or(`title.ilike.${quoted},description.ilike.${quoted},category.ilike.${quoted}`)
          .order("created_at", { ascending: false })
          .limit(20),
        db
          .from("posts")
          .select("id,user_id,content,created_at,profiles!posts_user_id_fkey(username,full_name)")
          .ilike("content", pattern)
          .order("created_at", { ascending: false })
          .limit(20),
        getDiamondMembers(db),
      ])
        .then(([m, pr, po, diamonds]) => {
          if (cancelled) return;
          const error = m.error || pr.error || po.error;
          if (error) setMessage(error.message);
          const nextMembers = diamondFirst((m.data ?? []) as MemberHit[], (x) => x.id, diamonds);
          const nextProjects = diamondFirst(
            rankProjects((pr.data ?? []) as ProjectHit[], term),
            (x) => x.user_id,
            diamonds
          );
          const nextPosts = (po.data ?? []) as unknown as PostHit[];
          setMembers(nextMembers);
          setProjects(nextProjects);
          setPosts(nextPosts);
          setSearched(term || specialty);
          const counts: Record<Tab, number> = {
            members: nextMembers.length,
            projects: nextProjects.length,
            posts: nextPosts.length,
          };
          setTab((current) => (counts[current] > 0 ? current : TABS.find((key) => counts[key] > 0) ?? current));
        })
        .catch((error: unknown) => {
          if (!cancelled) setMessage(error instanceof Error ? error.message : t("search.failed"));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, specialty, db]);

  const counts: Record<Tab, number> = { members: members.length, projects: projects.length, posts: posts.length };

  return (
    <div>
      <h1>{t("search.title")}</h1>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("search.placeholder")}
        aria-label={t("search.queryLabel")}
        maxLength={100}
        autoFocus
        style={{ width: "100%", boxSizing: "border-box" }}
      />

      <label style={{ fontWeight: 400 }}>
        {t("search.specialty")}
        <select value={specialty} onChange={(event) => setSpecialty(event.target.value)}>
          <option value="">{t("search.allSpecialties")}</option>
          {specialty && !specialties.includes(specialty) && <option value={specialty}>{specialty}</option>}
          {specialties.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      {!specialty && query.trim().length > 0 && query.trim().length < 2 && (
        <p className="muted">{t("search.minChars")}</p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}

      {searched && (
        <>
          <div className="row" role="tablist" style={{ gap: 8, margin: "16px 0", flexWrap: "wrap" }}>
            {TABS.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={tab === key ? undefined : "secondary"}
                onClick={() => setTab(key)}
              >
                {tabLabels[key]} ({counts[key]})
              </button>
            ))}
          </div>

          {loading && <p className="muted">{t("search.loading")}</p>}

          {tab === "members" && (
            <div style={{ display: "grid", gap: 12 }}>
              {members.length === 0 && <p className="notice">{t("search.noMembers")}</p>}
              {members.map((member) => (
                <article key={member.id} className="card">
                  <Link href={`/profile/${member.id}`} style={{ fontWeight: 700 }}>
                    {member.full_name || member.username}
                  </Link>{" "}
                  <TierBadge id={member.id} />{" "}
                  <span className="muted">
                    <bdi>@{member.username}</bdi>
                  </span>
                  {member.specialty && <p className="muted" style={{ margin: "4px 0 0" }}>{member.specialty}</p>}
                </article>
              ))}
            </div>
          )}

          {tab === "projects" && (
            <div style={{ display: "grid", gap: 12 }}>
              {projects.length === 0 && <p className="notice">{t("search.noProjects")}</p>}
              {projects.map((project) => (
                <article key={project.id} className="card">
                  <span className="badge">{project.category}</span>
                  <h3 style={{ margin: "8px 0" }}>
                    <Link href={`/projects/${project.id}`}>{project.title}</Link>
                  </h3>
                  <p style={{ margin: 0 }}>{snippet(project.description)}</p>
                </article>
              ))}
            </div>
          )}

          {tab === "posts" && (
            <div style={{ display: "grid", gap: 12 }}>
              {posts.length === 0 && <p className="notice">{t("search.noPosts")}</p>}
              {posts.map((post) => (
                <article key={post.id} className="card">
                  <Link href={`/profile/${post.user_id}`} style={{ fontWeight: 700 }}>
                    {post.profiles?.full_name || post.profiles?.username || t("search.memberFallback")}
                  </Link>{" "}
                  <TierBadge id={post.user_id} />{" "}
                  <span className="muted" style={{ fontSize: 14 }}>
                    {new Date(post.created_at).toLocaleString("ar")}
                  </span>
                  <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", margin: "8px 0 0" }}>
                    {snippet(post.content, 300)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
