"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import { getClient } from "@/lib/supabase";
import { categories, demoProjects } from "@/lib/demo";
import type { Project, Comment } from "@/lib/types";
import ReportButton from "@/components/ReportButton";
import {
  prepareUpload,
  assertExcelQuota,
  isExcel,
  getExcelQuotaInfo,
  excelQuotaText,
  scanAttachment,
} from "@/lib/upload";

type SubmitEvent = Parameters<
  NonNullable<ComponentProps<"form">["onSubmit"]>
>[0];

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    return String(error.message);
  }

  return "حدث خطأ غير متوقع";
}

export default function Detail({
  id,
}: Readonly<{ id: string }>) {
  const [db] = useState(() => getClient());

  const [p, setP] = useState<Project | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("جار التحميل");
  const [likes, setLikes] = useState(0);
  const [uid, setUid] = useState("");
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [quotaText, setQuotaText] = useState("");
  const scanRequested = useRef(new Set<string>());

  const isDemo = id.startsWith("demo-");
  const isOwner = Boolean(p && uid && uid === p.user_id);

  const load = useCallback(async () => {
    if (isDemo) {
      setP(demoProjects.find((project) => project.id === id) ?? null);
      setMsg("مشروع توضيحي؛ التعديل والتعليقات والتحميل غير مفعّلين.");
      return;
    }

    if (!db) {
      setMsg("اربط قاعدة البيانات أولًا");
      return;
    }

    const projectResult = await db
      .from("projects")
      .select(
        "*,profiles!projects_user_id_fkey(username,full_name),attachments(*)"
      )
      .eq("id", id)
      .single();

    if (projectResult.error) throw projectResult.error;

    setP(projectResult.data as unknown as Project);

    const authResult = await db.auth.getUser();
    const user = authResult.data.user;
    setUid(user?.id ?? "");

    if (user) {
      const adminResult = await db
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();
      setIsAdmin(Boolean((adminResult.data as { is_admin?: boolean } | null)?.is_admin));

      const owner = (projectResult.data as { user_id?: string }).user_id === user.id;
      if (owner) {
        try {
          setQuotaText(excelQuotaText(await getExcelQuotaInfo(db, user.id)));
        } catch {
          setQuotaText("");
        }
      } else {
        setQuotaText("");
      }
    } else {
      setIsAdmin(false);
      setQuotaText("");
    }

    const commentsResult = await db
      .from("comments")
      .select("*,profiles!comments_user_id_fkey(username,full_name)")
      .eq("project_id", id)
      .order("created_at");

    if (commentsResult.error) throw commentsResult.error;

    setComments(
      (commentsResult.data ?? []) as unknown as Comment[]
    );

    const likesResult = await db
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("project_id", id);

    if (likesResult.error) throw likesResult.error;
    setLikes(likesResult.count ?? 0);

    if (user) {
      const likedResult = await db
        .from("likes")
        .select("user_id")
        .eq("project_id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (likedResult.error) throw likedResult.error;
      setLiked(Boolean(likedResult.data));
    } else {
      setLiked(false);
    }
  }, [db, id, isDemo]);

  useEffect(() => {
    setEditing(false);
    setFiles([]);
    setMsg("جار التحميل");

    void load()
      .then(() => {
        if (!isDemo) setMsg("");
      })
      .catch((error: unknown) => {
        setMsg(errorMessage(error));
      });
  }, [load, isDemo]);

  // Scan attachments still pending (e.g. older uploads) when the owner or an admin views them.
  useEffect(() => {
    if (!db || isDemo || !p || !uid || !(isOwner || isAdmin)) return;
    const pending = (p.attachments ?? []).filter(
      (a) => (a.scan_status ?? "pending") === "pending" && !scanRequested.current.has(a.id)
    );
    if (!pending.length) return;
    pending.forEach((a) => scanRequested.current.add(a.id));
    void (async () => {
      const notes: string[] = [];
      let changed = false;
      for (const a of pending) {
        const scan = await scanAttachment(db, a.id);
        if (scan.status !== "pending") changed = true;
        if (scan.status === "rejected") notes.push(`رُفض الملف "${a.name}" وحُذف: ${scan.reason_ar}`);
      }
      if (changed) {
        try {
          await load();
        } catch {
          // ignore; the list refreshes on next visit
        }
      }
      if (notes.length) setMsg(notes.join(" "));
    })();
  }, [db, isDemo, p, uid, isOwner, isAdmin, load]);

  async function runAction(action: () => Promise<void>) {
    if (busy) return;

    setBusy(true);
    setMsg("");

    try {
      await action();
    } catch (error) {
      setMsg(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function startEditing() {
    if (!p || !isOwner || busy) return;

    setTitle(p.title);
    setDescription(p.description);
    setCategory(p.category);
    setFiles([]);
    setFileInputKey((key) => key + 1);
    setMsg("");
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setFiles([]);
    setFileInputKey((key) => key + 1);
    setMsg("");
  }

  async function saveProject(e: SubmitEvent) {
    e.preventDefault();

    await runAction(async () => {
      if (!db || !p || !isOwner) {
        throw new Error("لا يمكنك تعديل هذا المشروع");
      }

      if (!title.trim() || !description.trim()) {
        throw new Error("اكتب عنوان المشروع ووصفه");
      }

      for (const file of files) {
        if (!/\.(csv|xlsx|pdf|png|jpg|jpeg|webp)$/i.test(file.name)) {
          throw new Error(`نوع الملف غير مسموح: ${file.name}`);
        }
      }

      const ready: File[] = [];
      for (const file of files) ready.push(await prepareUpload(file));
      await assertExcelQuota(db, uid, ready.filter((f) => isExcel(f.name)).length);

      const updateResult = await db
        .from("projects")
        .update({
          title: title.trim(),
          description: description.trim(),
          category,
        })
        .eq("id", id)
        .eq("user_id", uid)
        .select("id")
        .single();

      if (updateResult.error) throw updateResult.error;

      let uploadedCount = 0;
      const scanNotes: string[] = [];

      try {
        for (const file of ready) {
          const extension = file.name.split(".").pop()?.toLowerCase();
          const path = `${uid}/${id}/${crypto.randomUUID()}.${extension}`;

          const uploadResult = await db.storage
            .from("project-files")
            .upload(path, file);

          if (uploadResult.error) throw uploadResult.error;

          const attachmentResult = await db
            .from("attachments")
            .insert({
              project_id: id,
              owner_id: uid,
              path,
              name: file.name,
            })
            .select("id")
            .single();

          if (attachmentResult.error) {
            const cleanupResult = await db.storage
              .from("project-files")
              .remove([path]);

            if (cleanupResult.error) {
              throw new Error(
                `${attachmentResult.error.message} — تعذر أيضًا تنظيف الملف المرفوع: ${cleanupResult.error.message}`
              );
            }

            throw attachmentResult.error;
          }

          uploadedCount += 1;
          scanRequested.current.add(attachmentResult.data.id);

          const scan = await scanAttachment(db, attachmentResult.data.id);
          if (scan.status === "rejected") {
            scanNotes.push(`رُفض الملف "${file.name}" وحُذف: ${scan.reason_ar}`);
          } else if (scan.status === "pending") {
            scanNotes.push(`الملف "${file.name}" قيد الفحص.`);
          }
        }
      } catch (error) {
        setFiles((current) => current.slice(uploadedCount));
        setFileInputKey((key) => key + 1);

        try {
          await load();
        } catch {
          // Keep the upload failure as the main message.
        }

        throw new Error(
          `حُفظت بيانات المشروع وأُضيف ${uploadedCount} من المرفقات الجديدة. ${errorMessage(error)}`
        );
      }

      setFiles([]);
      setFileInputKey((key) => key + 1);
      setEditing(false);

      await load();
      setMsg(["تم حفظ التعديلات", ...scanNotes].join(" "));
    });
  }

  async function deleteAttachment(attachmentId: string, path: string) {
    if (!isOwner || busy) return;
    if (!window.confirm("حذف هذا المرفق نهائيًا؟")) return;

    await runAction(async () => {
      if (!db || !isOwner) return;

      const storageResult = await db.storage
        .from("project-files")
        .remove([path]);

      if (storageResult.error) throw storageResult.error;

      const deleteResult = await db
        .from("attachments")
        .delete()
        .eq("id", attachmentId)
        .eq("project_id", id)
        .eq("owner_id", uid)
        .select("id");

      if (deleteResult.error) {
        throw new Error(
          `حُذف الملف من التخزين، لكن تعذر حذف سجله: ${deleteResult.error.message}`
        );
      }

      if (!deleteResult.data?.length) {
        throw new Error(
          "حُذف الملف من التخزين، لكن لم يُحذف سجله. نحتاج مراجعة صلاحيات المرفقات."
        );
      }

      await load();
      setMsg("تم حذف المرفق");
    });
  }

  async function comment(e: SubmitEvent) {
    e.preventDefault();

    await runAction(async () => {
      if (!db || !uid) {
        throw new Error("سجّل الدخول أولًا");
      }

      const content = text.trim();

      if (!content) {
        throw new Error("اكتب تعليقًا أولًا");
      }

      const result = await db.from("comments").insert({
        project_id: id,
        user_id: uid,
        content,
      });

      if (result.error) throw result.error;

      setText("");
      await load();
    });
  }

  async function like() {
    await runAction(async () => {
      if (!db || !uid) {
        throw new Error("سجّل الدخول أولًا");
      }

      const result = liked
        ? await db
            .from("likes")
            .delete()
            .eq("project_id", id)
            .eq("user_id", uid)
        : await db
            .from("likes")
            .insert({ project_id: id, user_id: uid });

      if (result.error) throw result.error;
      await load();
    });
  }

  async function download(path: string) {
    await runAction(async () => {
      if (!db || !uid) {
        throw new Error("سجّل الدخول أولًا لتنزيل الملف");
      }

      const result = await db.storage
        .from("project-files")
        .createSignedUrl(path, 60, { download: true });

      if (result.error) throw result.error;

      if (result.data) {
        window.location.assign(result.data.signedUrl);
      }
    });
  }

  async function deleteProject() {
    if (!isOwner || busy) return;
    if (!window.confirm("حذف المشروع وجميع مرفقاته نهائيًا؟")) return;

    await runAction(async () => {
      if (!db || !p || !isOwner) return;

      const paths = (p.attachments ?? []).map((file) => file.path);

      if (paths.length) {
        const storageResult = await db.storage
          .from("project-files")
          .remove(paths);

        if (storageResult.error) throw storageResult.error;
      }

      const result = await db
        .from("projects")
        .delete()
        .eq("id", id)
        .eq("user_id", uid)
        .select("id");

      if (result.error) throw result.error;

      if (!result.data?.length) {
        throw new Error("لم يُحذف المشروع؛ تحقق من صلاحيات الحذف");
      }

      window.location.assign("/");
    });
  }

  return (
    <>
      {msg && (
        <p className="notice" aria-live="polite">
          {msg}
        </p>
      )}

      {p && (
        <>
          <article className="card project-hero">
            <span className="badge">{p.category}</span>
            <h1>{p.title}</h1>
            <p className="description">{p.description}</p>

            <a href={`/profile/${p.user_id}`}>
              {p.profiles?.full_name || p.profiles?.username || "عضو"}
            </a>

            {!isDemo && (
              <div className="row">
                <button
                  type="button"
                  disabled={busy}
                  onClick={like}
                >
                  {liked ? "إلغاء الإعجاب" : "إعجاب"} · {likes}
                </button>

                <ReportButton db={db} viewerId={uid} ownerId={p.user_id} targetType="project" targetId={p.id} />

                {isOwner && (
                  <>
                    <button
                      type="button"
                      disabled={busy || editing}
                      onClick={startEditing}
                    >
                      تعديل المشروع
                    </button>

                    <button
                      type="button"
                      className="danger"
                      disabled={busy}
                      onClick={deleteProject}
                    >
                      حذف مشروعي
                    </button>
                  </>
                )}
              </div>
            )}
          </article>

          {!isDemo && isOwner && editing && (
            <form className="card" onSubmit={saveProject}>
              <h2>تعديل المشروع</h2>

              <label>
                العنوان
                <input
                  required
                  maxLength={120}
                  value={title}
                  disabled={busy}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>

              <label>
                الوصف
                <textarea
                  required
                  maxLength={10000}
                  rows={6}
                  value={description}
                  disabled={busy}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>

              <label>
                التخصص
                <select
                  value={category}
                  disabled={busy}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {Array.from(
                    new Set<string>([...categories, category])
                  )
                    .filter(Boolean)
                    .map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                إضافة مرفقات جديدة
                <input
                  key={fileInputKey}
                  type="file"
                  multiple
                  disabled={busy}
                  accept=".csv,.xlsx,.pdf,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => {
                    const selected = Array.from(e.target.files ?? []);
                    setFiles((current) => [...current, ...selected]);
                  }}
                />
              </label>

              <p className="muted">
                حتى 2 ميغابايت لكل ملف، و3 ملفات Excel كحد أقصى لكل حساب. الصور تُضغط تلقائيًا. المرفقات الجديدة تُضاف إلى
                المرفقات الحالية ولا تستبدلها. لا ترفع بيانات
                شخصية أو مالية حقيقية.
              </p>

              {quotaText && <p className="muted">{quotaText}</p>}

              {files.length > 0 && (
                <ul>
                  {files.map((file, index) => (
                    <li key={`${file.name}-${index}`}>
                      <span dir="auto">{file.name}</span>{" "}
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          setFiles((current) =>
                            current.filter((_, i) => i !== index)
                          )
                        }
                      >
                        إزالة من القائمة
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="row">
                <button type="submit" disabled={busy}>
                  {busy ? "جار الحفظ..." : "حفظ التعديلات"}
                </button>

                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={cancelEditing}
                >
                  إلغاء
                </button>
              </div>
            </form>
          )}

          {!isDemo && (
            <section className="card">
              <h2>المرفقات</h2>

              <p className="muted">
                يتطلب التنزيل تسجيل الدخول. يفحص الموقع كل ملف تلقائيًا قبل إتاحته
                للآخرين: يتأكد من نوعه الحقيقي، ويرفض ملفات Excel التي فيها ماكرو أو
                روابط خارجية، وملفات CSV التي فيها صيغ، وملفات PDF التي فيها أكواد.
                هذا فحص أمان أساسي وليس مضاد فيروسات كاملًا.
              </p>

              {!p.attachments?.length && (
                <p>لا توجد مرفقات لهذا المشروع.</p>
              )}

              {p.attachments?.map((attachment) => (
                <div className="row" key={attachment.id}>
                  <button
                    type="button"
                    className="secondary"
                    disabled={
                      busy ||
                      ((attachment.scan_status ?? "pending") !== "clean" &&
                        !isOwner &&
                        !isAdmin)
                    }
                    onClick={() => download(attachment.path)}
                  >
                    {attachment.name}
                  </button>

                  <span className="muted">
                    {attachment.scan_status === "clean"
                      ? "✅ تم فحص الملف"
                      : attachment.scan_status === "rejected"
                        ? "⛔ مرفوض"
                        : "⏳ قيد الفحص"}
                  </span>

                  {isOwner && (
                    <button
                      type="button"
                      className="danger"
                      disabled={busy}
                      onClick={() =>
                        deleteAttachment(
                          attachment.id,
                          attachment.path
                        )
                      }
                    >
                      حذف المرفق
                    </button>
                  )}
                </div>
              ))}
            </section>
          )}

          {!isDemo && (
            <section className="card">
              <h2>التعليقات</h2>

              {comments.map((item) => (
                <article key={item.id}>
                  <strong>
                    {item.profiles?.full_name ||
                      item.profiles?.username ||
                      "عضو"}
                  </strong>
                  <p>{item.content}</p>
                  {item.user_id && (
                    <ReportButton db={db} viewerId={uid} ownerId={item.user_id} targetType="comment" targetId={item.id} />
                  )}
                </article>
              ))}

              <form onSubmit={comment}>
                <textarea
                  aria-label="تعليق"
                  required
                  maxLength={2000}
                  value={text}
                  disabled={busy}
                  onChange={(e) => setText(e.target.value)}
                />

                <button type="submit" disabled={busy}>
                  إضافة تعليق
                </button>
              </form>
            </section>
          )}
        </>
      )}
    </>
  );
}