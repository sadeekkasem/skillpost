"use client";
import { confirmedOnly } from "@/lib/confirmed";

import { useT } from "@/components/LanguageProvider";

import { useEffect, useMemo, useState } from "react";
import { getClient } from "@/lib/supabase";
import { demoProjects, categories } from "@/lib/demo";
import type { Project } from "@/lib/types";
import Card from "./ProjectCard";
import { diamondFirst, getDiamondMembers } from "@/lib/tiers";
import ActiveAds from "./ActiveAds";


type SortOrder = "newest" | "oldest" | "title";

type PublicMember = {
  id: string;
  username: string | null;
  full_name: string | null;
  specialty: string | null;
  bio: string | null;
  avatar_path: string | null;
};

function normalizeSearch(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ar")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

function getTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export default function Feed({ inTimeline = false }: { inTimeline?: boolean } = {}) {
  const t = useT();
  const [db] = useState(() => getClient());

  const [items, setItems] = useState<Project[]>([]);
  const [members, setMembers] = useState<PublicMember[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [diamonds, setDiamonds] = useState<string[]>([]);
  const [failedAvatars, setFailedAvatars] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setFailed(false);
      setMessage("");

      if (!db) {
        if (!cancelled) {
          setItems(demoProjects);
          setMembers([]);
          setMessage(
            t("feed.demoMode")
          );
          setLoading(false);
        }
        return;
      }

      try {
        const projectsResult = await db
          .from("projects")
          .select(
            "*,profiles!projects_user_id_fkey(username,full_name,avatar_path,specialty),attachments(*)"
          )
          .order("created_at", { ascending: false })
          .limit(100);

        if (cancelled) return;

        if (projectsResult.error) {
          setItems([]);
          setFailed(true);
          setMessage(projectsResult.error.message);
          return;
        }

        const recent = (projectsResult.data ?? []) as unknown as Project[];
        const diamondIds = await getDiamondMembers(db);
        let featured: Project[] = [];
        if (diamondIds.length) {
          const featuredResult = await db
            .from("projects")
            .select(
              "*,profiles!projects_user_id_fkey(username,full_name,avatar_path,specialty),attachments(*)"
            )
            .in("user_id", diamondIds.slice(0, 100))
            .order("created_at", { ascending: false })
            .limit(12);
          featured = (featuredResult.data ?? []) as unknown as Project[];
        }
        if (cancelled) return;
        const seen = new Set(featured.map((p) => p.id));
        setDiamonds(diamondIds);
        setItems([...featured, ...recent.filter((p) => !seen.has(p.id))]);

        const membersResult = await confirmedOnly((filter) => {
          let q = db
            .from("profiles")
            .select("id,username,full_name,specialty,bio,avatar_path");
          if (filter) q = q.eq("email_confirmed", true);
          return q.order("full_name", { ascending: true, nullsFirst: false }).limit(24);
        });

        if (cancelled) return;

        if (membersResult.error) {
          setMembers([]);
        } else {
          setMembers(
            (membersResult.data ?? []) as unknown as PublicMember[]
          );
        }
      } catch (error) {
        if (cancelled) return;

        setItems([]);
        setFailed(true);
        setMessage(
          error instanceof Error
            ? error.message
            : t("feed.loadError")
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [db, reloadKey]);

  const availableCategories = useMemo(
    () =>
      Array.from(
        new Set([
          ...categories,
          ...items.map((project) => project.category),
        ])
      ).filter(Boolean),
    [items]
  );

  const filtered = useMemo(() => {
    const searchWords = normalizeSearch(q)
      .split(" ")
      .filter(Boolean);

    const results = items.filter((project) => {
      if (cat && project.category !== cat) {
        return false;
      }

      const searchableText = normalizeSearch(
        `${project.title ?? ""} ${project.description ?? ""}`
      );

      return searchWords.every((word) =>
        searchableText.includes(word)
      );
    });

    const sorted = results.sort((a, b) => {
      if (sort === "title") {
        return a.title.localeCompare(b.title, "ar", {
          sensitivity: "base",
          numeric: true,
        });
      }

      const difference =
        getTimestamp(a.created_at) - getTimestamp(b.created_at);

      return sort === "oldest" ? difference : -difference;
    });
    return diamondFirst(sorted, (p) => p.user_id, diamonds);
  }, [items, q, cat, sort, diamonds]);

  const hasFilters =
    q.trim() !== "" || cat !== "" || sort !== "newest";

  function resetFilters() {
    setQ("");
    setCat("");
    setSort("newest");
  }

  function memberName(member: PublicMember): string {
    return member.full_name || member.username || t("feed.member");
  }

  function memberAvatar(member: PublicMember): string {
    if (!db || !member.avatar_path) return "";

    return db.storage
      .from("avatars")
      .getPublicUrl(member.avatar_path).data.publicUrl;
  }

  return (
    <>
      
     <ActiveAds />
     
      {message && (
        <p className="notice" aria-live="polite">
          {message}
        </p>
      )}

      {!loading && !failed && members.length > 0 && (
        <section
          className="card"
          aria-label={t("feed.membersLabel")}
          style={{ marginBottom: "24px" }}
        >
          <h2>{t("feed.members")}</h2>

          <p className="muted">
            {t("feed.membersHint")}
          </p>

          <div
            className="grid"
            style={{
              gridTemplateColumns:
                "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            {members.map((member) => {
              const name = memberName(member);
              const avatar = memberAvatar(member);
              const isAvatarFailed =
                Boolean(avatar) &&
                failedAvatars.includes(avatar);

              return (
                <article
                  key={member.id}
                  className="card"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    gap: "12px",
                    padding: "20px",
                  }}
                >
                  {avatar && !isAvatarFailed ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatar}
                      alt={t("feed.avatarAlt", { name })}
                      width={88}
                      height={88}
                      onError={() =>
                        setFailedAvatars((current) => [
                          ...current,
                          avatar,
                        ])
                      }
                      style={{
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "2px solid #cbd5e1",
                      }}
                    />
                  ) : (
                    <div
                      aria-label={t("feed.noAvatar")}
                      style={{
                        width: "88px",
                        height: "88px",
                        borderRadius: "50%",
                        backgroundColor: "#e2e8f0",
                        color: "#334155",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "32px",
                        fontWeight: 700,
                      }}
                    >
                      {name.trim().charAt(0) || "؟"}
                    </div>
                  )}

                  <h3
                    style={{
                      margin: 0,
                      fontSize: "18px",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {name}
                  </h3>

                  {member.specialty && (
                    <p
                      className="muted"
                      style={{ margin: 0 }}
                    >
                      {member.specialty}
                    </p>
                  )}

                  <a
                    href={`/profile/${member.id}`}
                    className="button"
                    style={{ marginTop: "auto" }}
                  >
                    {t("feed.viewProfile")}
                  </a>
                </article>
              );
            })}
          </div>

          {members.length === 24 && (
            <p className="muted">
              {t("feed.membersLimit")}
            </p>
          )}
        </section>
      )}

      <section
        className="card"
        aria-label={t("feed.filtersLabel")}
      >
        <div
          className="row"
          style={{
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "end",
          }}
        >
          <label
            style={{ flex: "2 1 240px", minWidth: 0 }}
          >
            {t("feed.searchLabel")}
            <input
              type="search"
              placeholder={t("feed.searchPlaceholder")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
              }}
            />
          </label>

          <label
            style={{ flex: "1 1 180px", minWidth: 0 }}
          >
            {t("feed.specialty")}
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="">{t("feed.allSpecialties")}</option>

              {availableCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label
            style={{ flex: "1 1 180px", minWidth: 0 }}
          >
            {t("feed.sort")}
            <select
              value={sort}
              onChange={(e) =>
                setSort(e.target.value as SortOrder)
              }
              style={{ width: "100%" }}
            >
              <option value="newest">{t("feed.newest")}</option>
              <option value="oldest">{t("feed.oldest")}</option>
              <option value="title">{t("feed.byTitle")}</option>
            </select>
          </label>

          <button
            type="button"
            className="secondary"
            disabled={!hasFilters}
            onClick={resetFilters}
          >
            {t("feed.clearFilters")}
          </button>
        </div>

        {!loading && !failed && (
          <p className="muted" aria-live="polite">
            {t("feed.resultCount", { shown: filtered.length, total: items.length })}
          </p>
        )}

        {!loading && !failed && items.length === 100 && (
          <p className="muted">
            {t("feed.searchScope")}
          </p>
        )}
      </section>

      {loading ? (
        <p className="notice" aria-live="polite">
          {t("feed.loading")}
        </p>
      ) : failed ? (
        <button
          type="button"
          onClick={() => setReloadKey((key) => key + 1)}
        >
          {t("feed.retry")}
        </button>
      ) : (
        <>
          {inTimeline && !hasFilters ? (
            <p className="muted">{t("feed.inTimelineHint")}</p>
          ) : (
          <div className="grid">
            {filtered.map((project) => (
              <Card key={project.id} project={project} />
            ))}
          </div>
          )}

          {filtered.length === 0 && (
            <section className="card">
              <h2>
                {items.length === 0
                  ? t("feed.noProjects")
                  : t("feed.noMatches")}
              </h2>

              <p>
                {items.length === 0
                  ? t("feed.noProjectsHint")
                  : t("feed.noMatchesHint")}
              </p>

              {hasFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                >
                  {t("feed.clearFilters")}
                </button>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}