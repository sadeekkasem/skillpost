"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useT } from "@/components/LanguageProvider";
import { getClient } from "@/lib/supabase";
import { useRole } from "@/lib/roles";
import { fetchRatingStats, type RatingStats } from "@/lib/ratings";
import type { Challenge, ChallengeEntry, Project } from "@/lib/types";
import { challengeIsOpen } from "@/lib/challenges";
import ProjectCard from "./ProjectCard";

type EntryRow = ChallengeEntry & { project?: Project | null };

const PROJECT_SELECT =
  "*,profiles!projects_user_id_fkey(id,username,full_name,avatar_path,specialty),attachments(*)";

export default function ChallengeDetail({
  initial,
}: Readonly<{ initial: Challenge }>) {
  const t = useT();
  const [db] = useState(() => getClient());
  const role = useRole(db);

  const [challenge, setChallenge] = useState(initial);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [ratings, setRatings] = useState<Record<string, RatingStats>>({});
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [picked, setPicked] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const open = challengeIsOpen(challenge);
  const myEntry = useMemo(
    () => entries.find((e) => e.user_id && role.userId && e.user_id === role.userId) ?? null,
    [entries, role.userId]
  );

  const loadEntries = useCallback(async () => {
    if (!db) return;
    const { data, error } = await db
      .from("challenge_entries")
      .select("*")
      .eq("challenge_id", challenge.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as ChallengeEntry[];
    const projectIds = rows.map((r) => r.project_id);
    let projectsById = new Map<string, Project>();
    if (projectIds.length) {
      const pr = await db.from("projects").select(PROJECT_SELECT).in("id", projectIds);
      if (pr.error) throw pr.error;
      projectsById = new Map(
        ((pr.data ?? []) as unknown as Project[]).map((p) => [p.id, p])
      );
    }
    const merged: EntryRow[] = rows.map((r) => ({
      ...r,
      project: projectsById.get(r.project_id) ?? null,
    }));
    setEntries(merged);
    try {
      const stats = await fetchRatingStats(db, projectIds);
      setRatings(stats);
    } catch {
      setRatings({});
    }
  }, [db, challenge.id]);

  const refreshChallenge = useCallback(async () => {
    if (!db) return;
    const { data, error } = await db
      .from("challenges")
      .select("*")
      .eq("id", challenge.id)
      .single();
    if (error) throw error;
    setChallenge(data as Challenge);
  }, [db, challenge.id]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await loadEntries();
      } catch (e) {
        if (alive) setMsg(e instanceof Error ? e.message : t("challenges.noEntries"));
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadEntries, t]);

  useEffect(() => {
    if (!db || !role.userId) {
      setMyProjects([]);
      return;
    }
    let alive = true;
    void (async () => {
      const { data } = await db
        .from("projects")
        .select("id,title,created_at")
        .eq("user_id", role.userId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (alive) setMyProjects((data ?? []) as Project[]);
    })();
    return () => {
      alive = false;
    };
  }, [db, role.userId]);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      await action();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    await run(async () => {
      if (!db || !role.userId) throw new Error(t("challenges.loginToSubmit"));
      if (!open) throw new Error(t("challenges.closedHint"));
      if (!picked) throw new Error(t("challenges.pickProject"));
      const result = await db.from("challenge_entries").insert({
        challenge_id: challenge.id,
        project_id: picked,
        user_id: role.userId,
      });
      if (result.error) throw result.error;
      setPicked("");
      await loadEntries();
      setMsg(t("challenges.submitted"));
    });
  }

  async function withdraw() {
    await run(async () => {
      if (!db || !myEntry) return;
      const result = await db.from("challenge_entries").delete().eq("id", myEntry.id);
      if (result.error) throw result.error;
      if (challenge.winner_entry_id === myEntry.id) {
        // RLS only lets admin clear winner; owner withdraw just deletes entry (FK set null).
      }
      await Promise.all([loadEntries(), refreshChallenge()]);
      setMsg(t("challenges.withdrawn"));
    });
  }

  async function setWinner(entryId: string | null) {
    await run(async () => {
      if (!db || !role.isAdmin) throw new Error("Admin only");
      const result = await db
        .from("challenges")
        .update({ winner_entry_id: entryId })
        .eq("id", challenge.id);
      if (result.error) throw result.error;
      await refreshChallenge();
      setMsg(t("challenges.winnerSet"));
    });
  }

  return (
    <>
      {msg && (
        <p className="notice" aria-live="polite">
          {msg}
        </p>
      )}

      <section className="card">
        <h2>{t("challenges.submit")}</h2>
        {!role.userId ? (
          <p className="muted">{t("challenges.loginToSubmit")}</p>
        ) : !open ? (
          <p className="muted">{t("challenges.closedHint")}</p>
        ) : myEntry ? (
          <div className="row">
            <p style={{ margin: 0 }}>{t("challenges.alreadyEntered")}</p>
            <button type="button" className="secondary" disabled={busy} onClick={withdraw}>
              {t("challenges.withdraw")}
            </button>
          </div>
        ) : myProjects.length === 0 ? (
          <p className="muted">
            {t("challenges.needProject")}{" "}
            <Link href="/projects/new">{t("challenges.cta")}</Link>
          </p>
        ) : (
          <div className="row">
            <label style={{ flex: 1, minWidth: 200 }}>
              {t("challenges.pickProject")}
              <select
                value={picked}
                disabled={busy}
                onChange={(e) => setPicked(e.target.value)}
              >
                <option value="">—</option>
                {myProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" disabled={busy || !picked} onClick={submit}>
              {t("challenges.submitAction")}
            </button>
          </div>
        )}
      </section>

      <section>
        <h2>{t("challenges.entries", { count: entries.length })}</h2>
        {!entries.length ? (
          <p className="muted">{t("challenges.noEntries")}</p>
        ) : (
          <div className="grid">
            {entries.map((entry) => {
              if (!entry.project) return null;
              const isWinner = challenge.winner_entry_id === entry.id;
              return (
                <div key={entry.id} style={{ position: "relative" }}>
                  {isWinner && (
                    <span
                      className="badge"
                      style={{
                        position: "absolute",
                        zIndex: 1,
                        top: 12,
                        insetInlineEnd: 12,
                        background: "#fef3c7",
                        color: "#92400e",
                      }}
                    >
                      🏆 {t("challenges.winner")}
                    </span>
                  )}
                  <ProjectCard project={entry.project} rating={ratings[entry.project.id]} />
                  {role.isAdmin && (
                    <div className="row" style={{ marginTop: 8 }}>
                      {isWinner ? (
                        <button
                          type="button"
                          className="secondary"
                          disabled={busy}
                          onClick={() => setWinner(null)}
                        >
                          {t("challenges.clearWinner")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="secondary"
                          disabled={busy}
                          onClick={() => setWinner(entry.id)}
                        >
                          {t("challenges.setWinner")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
