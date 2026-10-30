"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getClient } from "@/lib/supabase";
import { diamondFirst, getDiamondMembers } from "@/lib/tiers";
import TierBadge from "./TierBadge";

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

const tabLabels: Record<Tab, string> = {
  members: "الأعضاء",
  projects: "المشاريع",
  posts: "المنشورات",
};

/** Make a term safe for a PostgREST or()/ilike filter. */
function toPattern(term: string): string {
  const cleaned = term
    .replace(/[,()"'\\:*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[%_]/g, (match) => `\\${match}`);
  return cleaned ? `%${cleaned}%` : "";
}

function snippet(text: string, max = 160): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export default function SearchClient() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [db] = useState(() => getClient());
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const [tab, setTab] = useState<Tab>("members");
  const [members, setMembers] = useState<MemberHit[]>([]);
  const [projects, setProjects] = useState<ProjectHit[]>([]);
  const [posts, setPosts] = useState<PostHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [searched, setSearched] = useState("");

  useEffect(() => {
    const term = query.trim();
    let cancelled = false;

    const timer = window.setTimeout(() => {
      const current = params.get("q") ?? "";
      if (term !== current) {
        router.replace(term ? `${pathname}?q=${encodeURIComponent(term)}` : pathname, { scroll: false });
      }

      const pattern = toPattern(term);
      if (term.length < 2 || !pattern) {
        setMembers([]);
        setProjects([]);
        setPosts([]);
        setSearched("");
        setMessage("");
        return;
      }
      if (!db) {
        setMessage("قاعدة البيانات غير متصلة.");
        return;
      }

      setLoading(true);
      setMessage("");
      void Promise.all([
        db
          .from("profiles")
          .select("id,username,full_name,specialty")
          .or(`username.ilike.${pattern},full_name.ilike.${pattern},specialty.ilike.${pattern}`)
          .limit(20),
        db
          .from("projects")
          .select("id,user_id,title,description,category")
          .or(`title.ilike.${pattern},description.ilike.${pattern},category.ilike.${pattern}`)
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
          setMembers(diamondFirst((m.data ?? []) as MemberHit[], (x) => x.id, diamonds));
          setProjects(diamondFirst((pr.data ?? []) as ProjectHit[], (x) => x.user_id, diamonds));
          setPosts((po.data ?? []) as unknown as PostHit[]);
          setSearched(term);
        })
        .catch((error: unknown) => {
          if (!cancelled) setMessage(error instanceof Error ? error.message : "تعذر البحث.");
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
  }, [query, db]);

  const counts: Record<Tab, number> = { members: members.length, projects: projects.length, posts: posts.length };

  return (
    <div>
      <h1>البحث</h1>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="ابحث عن عضو أو مشروع أو منشور..."
        aria-label="كلمة البحث"
        maxLength={100}
        autoFocus
        style={{ width: "100%", boxSizing: "border-box" }}
      />

      {query.trim().length > 0 && query.trim().length < 2 && (
        <p className="muted">اكتب حرفين على الأقل.</p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}

      {searched && (
        <>
          <div className="row" role="tablist" style={{ gap: 8, margin: "16px 0", flexWrap: "wrap" }}>
            {(Object.keys(tabLabels) as Tab[]).map((key) => (
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

          {loading && <p className="muted">جارٍ البحث...</p>}

          {tab === "members" && (
            <div style={{ display: "grid", gap: 12 }}>
              {members.length === 0 && <p className="notice">لا يوجد أعضاء مطابقون.</p>}
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
              {projects.length === 0 && <p className="notice">لا توجد مشاريع مطابقة.</p>}
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
              {posts.length === 0 && <p className="notice">لا توجد منشورات مطابقة.</p>}
              {posts.map((post) => (
                <article key={post.id} className="card">
                  <Link href={`/profile/${post.user_id}`} style={{ fontWeight: 700 }}>
                    {post.profiles?.full_name || post.profiles?.username || "عضو"}
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
