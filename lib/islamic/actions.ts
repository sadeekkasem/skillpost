"use server";

import { redirect } from "next/navigation";
import { parseLessonVideoId, parseYouTubeChannel } from "../youtube";
import { inviteMailEnabled } from "../supabase/env";
import { createSupabaseServerClient } from "../supabase/server";
import { createServiceClient } from "../supabase/service";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function rpc(name: string, args: Record<string, unknown>): Promise<ActionResult & { data?: unknown }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "لم يُضبط الاتصال بعد." };
  const { data, error } = await supabase.rpc(name, args);
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "تم", data };
}

async function maybeSendInvite(email: string): Promise<string> {
  if (!inviteMailEnabled()) {
    return "أُنشئت الدعوة في قاعدة البيانات. إرسال البريد غير مفعّل (ISLAMIC_SEND_INVITES).";
  }
  const admin = createServiceClient();
  if (!admin) {
    return "أُنشئت الدعوة، لكن مفتاح الخدمة غير متوفر فلا يمكن إرسال البريد.";
  }
  const { error } = await admin.auth.admin.inviteUserByEmail(email);
  if (error) return `أُنشئت الدعوة، وتعذّر إرسال البريد: ${error.message}`;
  return "أُرسلت رسالة الدعوة إلى البريد.";
}

export async function requestMagicLink(formData: FormData): Promise<ActionResult> {
  const email = readString(formData, "email").toLowerCase();
  if (!email || !email.includes("@")) return { ok: false, message: "أدخل بريدًا صالحًا." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "الدخول غير مضبوط في هذا البناء." };
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "https://www.skillpostapp.com";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "إن كان البريد مخوّلًا فستصلك رسالة الدخول." };
}

export async function adminCreateSheikh(formData: FormData): Promise<ActionResult> {
  const name = readString(formData, "name");
  const email = readString(formData, "email").toLowerCase();
  const channel = readString(formData, "channel");
  if (name.length < 2) return { ok: false, message: "أدخل الاسم." };
  if (!email.includes("@")) return { ok: false, message: "أدخل بريدًا صالحًا." };
  let channelUrl = "";
  if (channel) {
    const parsed = parseYouTubeChannel(channel);
    if (!parsed.ok) return { ok: false, message: parsed.error };
    channelUrl = parsed.url;
  }
  const result = await rpc("islamic_admin_create_sheikh", {
    p_name: name,
    p_email: email,
    p_channel_url: channelUrl,
  });
  if (!result.ok) return result;
  const extra = await maybeSendInvite(email);
  return { ok: true, message: extra };
}

export async function adminSetSheikhStatus(formData: FormData): Promise<ActionResult> {
  const id = readString(formData, "sheikh_id");
  const status = readString(formData, "status");
  if (!id || !status) return { ok: false, message: "بيانات ناقصة." };
  const result = await rpc("islamic_admin_set_sheikh_status", { p_sheikh_id: id, p_status: status });
  return result.ok ? { ok: true, message: "عُدّلت حالة الصفحة." } : result;
}

export async function adminSetLessonStatus(formData: FormData): Promise<ActionResult> {
  const id = readString(formData, "lesson_id");
  const status = readString(formData, "status");
  if (!id || !status) return { ok: false, message: "بيانات ناقصة." };
  const result = await rpc("islamic_admin_set_lesson_status", { p_lesson_id: id, p_status: status });
  return result.ok ? { ok: true, message: "عُدّلت حالة المقطع." } : result;
}

export async function inviteStaff(formData: FormData): Promise<ActionResult> {
  const email = readString(formData, "email").toLowerCase();
  const role = readString(formData, "role");
  const sheikhId = readString(formData, "sheikh_id");
  if (!email.includes("@") || !role || !sheikhId) return { ok: false, message: "بيانات ناقصة." };
  const result = await rpc("islamic_invite_staff", {
    p_email: email,
    p_role: role,
    p_sheikh_id: sheikhId,
  });
  if (!result.ok) return result;
  const extra = await maybeSendInvite(email);
  return { ok: true, message: extra };
}

export async function revokeInvitation(formData: FormData): Promise<ActionResult> {
  const id = readString(formData, "invitation_id");
  if (!id) return { ok: false, message: "بيانات ناقصة." };
  const result = await rpc("islamic_revoke_invitation", { p_invitation_id: id });
  return result.ok ? { ok: true, message: "أُلغيت الدعوة." } : result;
}

export async function updateSheikhPage(formData: FormData): Promise<ActionResult> {
  const id = readString(formData, "sheikh_id");
  const name = readString(formData, "name");
  const channel = readString(formData, "channel");
  if (!id || name.length < 2) return { ok: false, message: "أدخل الاسم." };
  let channelUrl = "";
  if (channel) {
    const parsed = parseYouTubeChannel(channel);
    if (!parsed.ok) return { ok: false, message: parsed.error };
    channelUrl = parsed.url;
  }
  const result = await rpc("islamic_update_sheikh_page", {
    p_sheikh_id: id,
    p_name: name,
    p_channel_url: channelUrl,
  });
  return result.ok ? { ok: true, message: "حُفظت الصفحة." } : result;
}

export async function addLesson(formData: FormData): Promise<ActionResult> {
  const sheikhId = readString(formData, "sheikh_id");
  const title = readString(formData, "title");
  const link = readString(formData, "video");
  if (!sheikhId || title.length < 2) return { ok: false, message: "أدخل العنوان." };
  const parsed = parseLessonVideoId(link);
  if (!parsed.ok) return { ok: false, message: parsed.error };
  const result = await rpc("islamic_add_lesson", {
    p_sheikh_id: sheikhId,
    p_title: title,
    p_video_id: parsed.id,
  });
  return result.ok ? { ok: true, message: "أُضيف المقطع كمسودة." } : result;
}

export async function updateLesson(formData: FormData): Promise<ActionResult> {
  const id = readString(formData, "lesson_id");
  const title = readString(formData, "title");
  const link = readString(formData, "video");
  if (!id || title.length < 2) return { ok: false, message: "أدخل العنوان." };
  const parsed = parseLessonVideoId(link);
  if (!parsed.ok) return { ok: false, message: parsed.error };
  const result = await rpc("islamic_update_lesson", {
    p_lesson_id: id,
    p_title: title,
    p_video_id: parsed.id,
  });
  return result.ok ? { ok: true, message: "حُفظ المقطع." } : result;
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/login");
}
