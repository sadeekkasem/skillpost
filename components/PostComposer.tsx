"use client";

import { useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useT } from "@/components/LanguageProvider";
import { compressImage, MAX_RAW_IMAGE_BYTES } from "@/lib/upload";

const MAX_LENGTH = 3000;
const MAX_IMAGE_SIZE = MAX_RAW_IMAGE_BYTES;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

type Props = {
  db: SupabaseClient;
  userId: string;
  onPublished: () => void;
};

export default function PostComposer({ db, userId, onPublished }: Props) {
  const t = useT();
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const busyRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickImage(file: File | null) {
    setMessage("");
    if (!file) {
      setImage(null);
      return;
    }
    if (!IMAGE_TYPES.includes(file.type)) {
      setMessage("الصورة يجب أن تكون PNG أو JPEG أو WEBP.");
      setImage(null);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setMessage("حجم الصورة يجب ألا يتجاوز 15 ميغابايت.");
      setImage(null);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setImage(file);
  }

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    if (busyRef.current) return;

    const text = content.trim();
    if (!text) {
      setMessage("اكتب شيئاً قبل النشر.");
      return;
    }
    if (text.length > MAX_LENGTH) {
      setMessage(`الحد الأقصى ${MAX_LENGTH} حرف.`);
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setMessage("");

    let uploadedPath: string | null = null;

    try {
      if (image) {
        const small = await compressImage(image);
        const ext =
          small.type === "image/png" ? "png" : small.type === "image/webp" ? "webp" : "jpg";
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await db.storage
          .from("post-images")
          .upload(path, small, { contentType: small.type, upsert: false });
        if (uploadError) throw uploadError;
        uploadedPath = path;
      }

      const { error } = await db
        .from("posts")
        .insert({ user_id: userId, content: text, image_path: uploadedPath });

      if (error) {
        if (uploadedPath) {
          await db.storage.from("post-images").remove([uploadedPath]);
        }
        throw error;
      }

      setContent("");
      setImage(null);
      if (fileRef.current) fileRef.current.value = "";
      setMessage("تم نشر المنشور.");
      onPublished();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "تعذر نشر المنشور. حاول مرة أخرى."
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={publish} style={{ marginBottom: "24px" }}>
      <h2 style={{ marginTop: 0 }}>منشور جديد</h2>

      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        maxLength={MAX_LENGTH}
        rows={4}
        placeholder="بماذا تفكر؟"
        aria-label="نص المنشور"
        disabled={busy}
        style={{ width: "100%", resize: "vertical" }}
      />
      <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.85em" }}>{t("composer.youtubeHint")}</p>

      <p className="muted" style={{ margin: "4px 0 12px" }}>
        {content.length} / {MAX_LENGTH}
      </p>

      <div className="row" style={{ flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
        <label>
          صورة (اختياري):{" "}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(event) => pickImage(event.target.files?.[0] ?? null)}
          />
        </label>

        <button type="submit" disabled={busy || !content.trim()}>
          {busy ? "جارٍ النشر..." : "نشر"}
        </button>
      </div>

      {message && (
        <p className="notice" aria-live="polite" style={{ marginTop: "12px" }}>
          {message}
        </p>
      )}
    </form>
  );
}
