"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClient } from "@/lib/supabase";
import type { Project } from "@/lib/types";
import AdRequestsAdmin from "@/components/AdRequestsAdmin";

export default function AdminPage() {
  const [db] = useState(() => getClient());

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [message, setMessage] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setMessage("");

      if (!db) {
        setMessage("قاعدة البيانات غير متصلة");
        setLoading(false);
        return;
      }

      try {
        const authResult = await db.auth.getUser();
        const user = authResult.data.user;

        if (cancelled) return;

        if (authResult.error) {
          throw authResult.error;
        }

        if (!user) {
          setMessage("سجّل الدخول بحساب المدير أولًا.");
          return;
        }

        const profileResult = await db
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .single();

        if (cancelled) return;

        if (profileResult.error) {
          throw profileResult.error;
        }

        const isAdminProfile =
          profileResult.data?.is_admin === true;

        if (!isAdminProfile) {
          setMessage("هذه الصفحة للمدير فقط.");
          return;
        }

        setIsAdmin(true);

        const projectsResult = await db
          .from("projects")
          .select(
            "*,profiles!projects_user_id_fkey(id,username,full_name),attachments(*)"
          )
          .order("created_at", { ascending: false })
          .limit(100);

        if (cancelled) return;

        if (projectsResult.error) {
          throw projectsResult.error;
        }

        setProjects(
          (projectsResult.data ?? []) as unknown as Project[]
        );
      } catch (error) {
        if (cancelled) return;

        setMessage(
          error instanceof Error
            ? error.message
            : "تعذر تحميل لوحة الإدارة"
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
  }, [db]);

  async function deleteProject(project: Project) {
    if (!db || busyId) return;

    const confirmed = window.confirm(
      `هل تريد حذف مشروع «${project.title}» نهائيًا؟`
    );

    if (!confirmed) return;

    setBusyId(project.id);
    setMessage("");

    try {
      const attachments = project.attachments ?? [];

      if (attachments.length > 0) {
        const storagePaths = attachments.map(
          (file) => file.path
        );

        const storageResult = await db.storage
          .from("project-files")
          .remove(storagePaths);

        if (storageResult.error) {
          setMessage(
            "تعذر حذف ملفات المشروع من التخزين؛ لن نحذف سجل المشروع."
          );
          return;
        }
      }

      const { error } = await db
        .from("projects")
        .delete()
        .eq("id", project.id);

      if (error) throw error;

      setProjects((current) =>
        current.filter((item) => item.id !== project.id)
      );

      setMessage("تم حذف المشروع");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "تعذر حذف المشروع"
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="narrow">
      <h1>لوحة الإدارة</h1>

      {message && (
        <p className="notice" aria-live="polite">
          {message}
        </p>
      )}

      {loading && (
        <p className="notice">جار التحميل...</p>
      )}

      {!loading && !isAdmin && (
        <p className="notice">
          هذه الصفحة متاحة لحساب المدير فقط.
        </p>
      )}

      {isAdmin && (
        <>
          <AdRequestsAdmin />

          <h2>إدارة المشاريع</h2>

          <p className="muted">
            عدد المشاريع المعروضة: {projects.length}
          </p>

          <div className="grid">
            {projects.map((project) => (
              <article
                key={project.id}
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <span className="badge">
                  {project.category}
                </span>

                <h2 style={{ margin: 0 }}>
                  <Link href={`/projects/${project.id}`}>
                    {project.title}
                  </Link>
                </h2>

                <p
                  className="muted"
                  style={{ margin: 0 }}
                >
                  {project.profiles?.full_name ||
                    project.profiles?.username ||
                    "عضو"}
                </p>

                {project.description && (
                  <p style={{ margin: 0 }}>
                    {project.description.slice(0, 120)}
                    {project.description.length > 120
                      ? "…"
                      : ""}
                  </p>
                )}

                <button
                  type="button"
                  className="secondary"
                  disabled={Boolean(busyId)}
                  onClick={() => deleteProject(project)}
                >
                  {busyId === project.id
                    ? "جار الحذف..."
                    : "حذف المشروع"}
                </button>
              </article>
            ))}
          </div>

          {!loading && projects.length === 0 && (
            <p className="notice">
              لا توجد مشاريع لعرضها في لوحة الإدارة.
            </p>
          )}
        </>
      )}
    </div>
  );
}