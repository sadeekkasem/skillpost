export const ADMIN_ALERT_EMAIL = "sadeekkasem@gmail.com";

export type LessonAlertInfo = {
  title: string;
  videoId: string;
  sheikhId: string;
};

export type AlertMail = {
  from: string;
  to: string[];
  subject: string;
  text: string;
};

export async function sendViaResend(mail: AlertMail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("missing RESEND_API_KEY");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: mail.from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body.slice(0, 200));
  }
}

export function buildLessonAlert(info: LessonAlertInfo): AlertMail {
  return {
    from: process.env.ALERT_FROM || "alerts@skillpostapp.com",
    to: [ADMIN_ALERT_EMAIL],
    subject: `درس جديد: ${info.title.slice(0, 80)}`,
    text: [
      "أُضيف درس جديد على سِكِل بوست.",
      `العنوان: ${info.title}`,
      `معرّف الفيديو: ${info.videoId}`,
      `معرّف الصفحة: ${info.sheikhId}`,
    ].join("\n"),
  };
}

function alertsAreEnabled(): boolean {
  return (
    process.env.ISLAMIC_LESSON_ALERTS === "true" &&
    Boolean(process.env.RESEND_API_KEY) &&
    Boolean(process.env.ALERT_FROM)
  );
}

export async function notifyNewLesson(
  info: LessonAlertInfo,
  send: (mail: AlertMail) => Promise<void> = sendViaResend,
): Promise<{ sent: boolean; reason?: string }> {
  if (!alertsAreEnabled()) return { sent: false, reason: "disabled" };
  const mail = buildLessonAlert(info);
  mail.to = [ADMIN_ALERT_EMAIL];
  await send(mail);
  return { sent: true };
}
