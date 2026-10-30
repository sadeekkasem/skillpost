import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_RAW_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_EXCEL_PER_USER = 3;

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export const isExcel = (name: string) => /\.(xlsx|csv)$/i.test(name);
export const isImageFile = (file: File) =>
  IMAGE_TYPES.includes(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name);

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("تعذّرت قراءة الصورة"));
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Resize and re-encode an image in the browser so it stays small. */
export async function compressImage(
  file: File,
  maxDim = 1600,
  targetBytes = 400 * 1024
): Promise<File> {
  if (file.size > MAX_RAW_IMAGE_BYTES) {
    throw new Error("الصورة كبيرة جدًا، الحد الأقصى 15 ميغابايت قبل الضغط");
  }
  const img = await loadImage(file);
  let scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  let best: Blob | null = null;

  for (let round = 0; round < 4; round++) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.82, 0.7, 0.6, 0.5]) {
      let blob = await toBlob(canvas, "image/webp", quality);
      if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", quality);
      if (!blob) continue;
      if (!best || blob.size < best.size) best = blob;
      if (blob.size <= targetBytes) break;
    }
    if (best && best.size <= targetBytes) break;
    scale *= 0.8;
  }

  if (!best || (best.size >= file.size && file.size <= targetBytes)) return file;
  const ext = best.type === "image/webp" ? "webp" : "jpg";
  const base = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([best], `${base}.${ext}`, { type: best.type });
}

/** Compress images, then make sure the file fits the 2 MB limit. */
export async function prepareUpload(file: File): Promise<File> {
  const ready = isImageFile(file) ? await compressImage(file) : file;
  if (ready.size > MAX_FILE_BYTES) {
    throw new Error(`الملف "${file.name}" أكبر من 2 ميغابايت`);
  }
  return ready;
}

/** How many Excel/CSV files the account has used, and its quota (default 3). */
export async function getExcelQuotaInfo(
  db: SupabaseClient,
  uid: string
): Promise<{ used: number; quota: number }> {
  const { count, error } = await db
    .from("attachments")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", uid)
    .or("name.ilike.*.xlsx,name.ilike.*.csv");
  if (error) throw error;
  const prof = await db.from("profiles").select("excel_quota").eq("id", uid).maybeSingle();
  const quota = (prof.data as { excel_quota?: number } | null)?.excel_quota ?? MAX_EXCEL_PER_USER;
  return { used: count ?? 0, quota };
}

/** Arabic line shown to owners near the upload field. */
export function excelQuotaText(info: { used: number; quota: number }): string {
  const left = Math.max(0, info.quota - info.used);
  if (left === 0) return "استخدمت كل ملفات Excel المجانية";
  return `لديك ${info.quota} ملفات Excel مجانية لعرض نماذج من عملك يجرّبها العملاء. المتبقي: ${left}`;
}

/** Each account may keep at most 3 Excel/CSV files across all projects. */
export async function assertExcelQuota(db: SupabaseClient, uid: string, adding: number) {
  if (adding <= 0) return;
  const { used, quota } = await getExcelQuotaInfo(db, uid);
  if (used + adding > quota) {
    const left = Math.max(0, quota - used);
    throw new Error(
      `مسموح ${quota} ملفات Excel لحسابك. عندك ${used}، وباقي ${left}. احذف ملفًا قديمًا أو اطلب ملفات إضافية`
    );
  }
}

export type ScanOutcome =
  | { status: "clean" }
  | { status: "rejected"; reason_ar: string }
  | { status: "pending" };

/** Ask the scan-file Edge Function to check an uploaded attachment. Never throws. */
export async function scanAttachment(db: SupabaseClient, attachmentId: string): Promise<ScanOutcome> {
  try {
    const { data, error } = await db.functions.invoke("scan-file", {
      body: { attachment_id: attachmentId },
    });
    if (error || !data) return { status: "pending" };
    const d = data as { status?: string; reason_ar?: string };
    if (d.status === "clean") return { status: "clean" };
    if (d.status === "rejected") return { status: "rejected", reason_ar: d.reason_ar || "رُفض الملف" };
    return { status: "pending" };
  } catch {
    return { status: "pending" };
  }
}
