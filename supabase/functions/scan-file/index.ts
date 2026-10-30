// Supabase Edge Function: scan-file (SkillPost). Self-contained: paste this whole file in the Dashboard editor.
// Input: POST {"attachment_id": "<uuid>"} with the user's Authorization: Bearer <access_token>.
// Caller must be the attachment owner or an admin. Uses SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (auto-injected).
// Pass  -> attachments.scan_status = 'clean', scanned_at = now().
// Fail  -> storage object and attachments row are deleted; returns {status:'rejected', reason_ar}.
import { createClient } from "npm:@supabase/supabase-js@2";
import { unzipSync } from "npm:fflate@0.8.2";

export const MAX_BYTES = 2 * 1024 * 1024;
const MAX_UNZIPPED = 50 * 1024 * 1024;
const MAX_ENTRIES = 2000;

export type CheckResult = { ok: true } | { ok: false; reason_ar: string; note: string };
const bad = (reason_ar: string, note: string): CheckResult => ({ ok: false, reason_ar, note });
const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

function latin1(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return s;
}

function checkXlsx(b: Uint8Array): CheckResult {
  if (!startsWith(b, [0x50, 0x4b, 0x03, 0x04])) return bad("الملف ليس ملف Excel حقيقيًا (xlsx).", "xlsx: bad signature");
  let total = 0, count = 0, tooBig = false;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(b, {
      filter: (f) => {
        count++;
        total += f.originalSize;
        if (count > MAX_ENTRIES || total > MAX_UNZIPPED) tooBig = true;
        return !tooBig;
      },
    });
  } catch {
    return bad("ملف Excel تالف ولا يمكن فتحه.", "xlsx: unzip failed");
  }
  if (tooBig) return bad("ملف Excel مضغوط بشكل مريب (حجمه بعد الفك كبير جدًا).", "xlsx: zip bomb limits");
  const names = Object.keys(files);
  let real = 0;
  for (const n of names) real += files[n].length;
  if (real > MAX_UNZIPPED) return bad("ملف Excel مضغوط بشكل مريب (حجمه بعد الفك كبير جدًا).", "xlsx: zip bomb real size");
  if (!files["[Content_Types].xml"] || !files["xl/workbook.xml"]) return bad("الملف ليس مصنف Excel صالحًا.", "xlsx: missing core parts");
  const danger = /(vbaProject\.bin|externalLinks\/|activeX|oleObject|embeddings\/|\.bin$)/i;
  const hit = names.find((n) => danger.test(n));
  if (hit) return bad("الملف يحتوي على ماكرو أو كائنات مضمنة أو روابط خارجية، وهذا غير مسموح. احفظه كملف xlsx عادي بدون ماكرو.", "xlsx: entry " + hit);
  const dec = new TextDecoder();
  if (/macroEnabled/i.test(dec.decode(files["[Content_Types].xml"]))) return bad("الملف مصنف بماكرو (macro-enabled) وهذا غير مسموح.", "xlsx: macroEnabled content type");
  for (const n of names) {
    if (!n.endsWith(".rels")) continue;
    // External relationships are only allowed for plain web/mail hyperlinks (clickable links in cells).
    for (const rel of dec.decode(files[n]).match(/<Relationship\b[^>]*>/gi) ?? []) {
      if (!/TargetMode\s*=\s*["']External["']/i.test(rel)) continue;
      const isLink = /Type\s*=\s*["'][^"']*\/relationships\/hyperlink["']/i.test(rel);
      const safeTarget = /Target\s*=\s*["'](https?:\/\/|mailto:)/i.test(rel);
      if (!isLink || !safeTarget) {
        return bad("الملف يحتوي على روابط خارجية لملفات أو بيانات، وهذا غير مسموح.", "xlsx: external relationship in " + n);
      }
    }
  }
  return { ok: true };
}

function checkCsv(b: Uint8Array): CheckResult {
  if (b.includes(0)) return bad("ملف CSV يحتوي على بيانات ثنائية وليس نصًا.", "csv: NUL byte");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(b);
  } catch {
    return bad("ملف CSV ليس نصًا بترميز UTF-8.", "csv: invalid utf-8");
  }
  text = text.replace(/^\uFEFF/, "");
  for (const line of text.split(/\r?\n/)) {
    for (let cell of line.split(/[,;]/)) {
      cell = cell.trim().replace(/^"/, "");
      if (/^[\t\r]*[=+\-@]/.test(cell) && !/^[+-]?\d[\d.,]*%?$/.test(cell) && cell !== "-" ) {
        return bad("ملف CSV يحتوي على خلية تبدأ بـ = أو + أو - أو @ (صيغة قد تُنفَّذ عند فتحه في Excel). احذف الصيغ واحفظ القيم فقط.", "csv: formula cell " + cell.slice(0, 40));
      }
    }
  }
  return { ok: true };
}

function checkPdf(b: Uint8Array): CheckResult {
  if (!startsWith(b, ascii("%PDF-"))) return bad("الملف ليس PDF حقيقيًا.", "pdf: bad signature");
  // Decode #xx escapes in PDF names (e.g. /J#61vaScript) before matching
  const s = latin1(b).replace(/#([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const m = s.match(/\/(JavaScript|JS|Launch|EmbeddedFile|AA|RichMedia|XFA)(?![A-Za-z])/);
  if (m) return bad("ملف PDF يحتوي على أكواد أو ملفات مضمنة أو إجراءات تلقائية، وهذا غير مسموح.", "pdf: /" + m[1]);
  if (/\/OpenAction[^>]*\/(JavaScript|JS|Launch)/.test(s)) return bad("ملف PDF يشغّل إجراء تلقائيًا عند الفتح، وهذا غير مسموح.", "pdf: OpenAction");
  return { ok: true };
}

export function checkFile(name: string, b: Uint8Array): CheckResult {
  if (b.length === 0) return bad("الملف فارغ.", "empty");
  if (b.length > MAX_BYTES) return bad("الملف أكبر من 2 ميغابايت.", "too large");
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "xlsx": return checkXlsx(b);
    case "csv": return checkCsv(b);
    case "pdf": return checkPdf(b);
    case "png":
      return startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ? { ok: true } : bad("الملف ليس صورة PNG حقيقية.", "png: bad signature");
    case "jpg": case "jpeg":
      return startsWith(b, [0xff, 0xd8, 0xff]) ? { ok: true } : bad("الملف ليس صورة JPG حقيقية.", "jpg: bad signature");
    case "webp":
      return startsWith(b, ascii("RIFF")) && startsWith(b, ascii("WEBP"), 8) ? { ok: true } : bad("الملف ليس صورة WEBP حقيقية.", "webp: bad signature");
    default:
      return bad("نوع الملف غير مسموح.", "extension " + ext);
  }
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "unauthorized" }, 401);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: u, error: uerr } = await admin.auth.getUser(token);
  if (uerr || !u.user) return json({ error: "unauthorized" }, 401);

  let id = "";
  try { id = String((await req.json())?.attachment_id ?? ""); } catch { /* bad body */ }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "attachment_id required" }, 400);

  const { data: att, error: aerr } = await admin.from("attachments")
    .select("id, owner_id, path, name, scan_status").eq("id", id).maybeSingle();
  if (aerr) return json({ error: "db error" }, 500);
  if (!att) return json({ error: "not found" }, 404);
  if (att.owner_id !== u.user.id) {
    const { data: prof } = await admin.from("profiles").select("is_admin").eq("id", u.user.id).maybeSingle();
    if (!prof?.is_admin) return json({ error: "forbidden" }, 403);
  }
  if (att.scan_status === "clean") return json({ status: "clean" });

  // The stored object must live in the owner's folder (defence against forged paths)
  let result: CheckResult;
  if (!String(att.path).startsWith(att.owner_id + "/")) {
    result = bad("مسار الملف غير صالح.", "path outside owner folder");
  } else {
    const { data: blob, error: derr } = await admin.storage.from("project-files").download(att.path);
    if (derr || !blob) result = bad("لم يُعثر على الملف المرفوع. ارفعه مرة أخرى.", "object missing");
    else if (blob.size > MAX_BYTES) result = bad("الملف أكبر من 2 ميغابايت.", "too large");
    else {
      // Check against the stored path extension (the display name can be renamed later)
      const ext = String(att.path).split(".").pop() ?? "";
      const nameExt = String(att.name).split(".").pop()?.toLowerCase() ?? "";
      result = nameExt !== ext.toLowerCase()
        ? bad("امتداد اسم الملف لا يطابق الملف المرفوع.", "name/path ext mismatch")
        : checkFile("f." + ext, new Uint8Array(await blob.arrayBuffer()));
    }
  }

  if (result.ok) {
    const { error } = await admin.from("attachments")
      .update({ scan_status: "clean", scanned_at: new Date().toISOString(), scan_note: null }).eq("id", id);
    if (error) return json({ error: "db error" }, 500);
    return json({ status: "clean" });
  }
  // Rejected: it is a fresh upload, not accounting data, so remove the object and the row.
  await admin.storage.from("project-files").remove([att.path]);
  const { error: delErr } = await admin.from("attachments").delete().eq("id", id);
  if (delErr) {
    await admin.from("attachments").update({ scan_status: "rejected", scanned_at: new Date().toISOString(), scan_note: result.note }).eq("id", id);
  }
  console.log("scan-file rejected", id, result.note);
  return json({ status: "rejected", reason_ar: result.reason_ar });
}

if (!Deno.env.get("SCAN_FILE_TEST")) Deno.serve(handle);
