"use client";

import { useRef, useState, type FormEvent } from "react";
import { getClient } from "@/lib/supabase";

export default function AdRequestForm() {
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting.current) return;

    const form = event.currentTarget;
    const values = new FormData(form);

    const businessName = String(
      values.get("business_name") ?? ""
    ).trim();

    const contactInfo = String(
      values.get("contact_info") ?? ""
    ).trim();

    const title = String(values.get("title") ?? "").trim();
    const description = String(
      values.get("description") ?? ""
    ).trim();

    const targetUrl = String(
      values.get("target_url") ?? ""
    ).trim();

    const durationDays = Number(values.get("duration_days"));

    setMessage("");

    if (
      !businessName ||
      contactInfo.length < 3 ||
      !title ||
      !description
    ) {
      setMessage("يرجى تعبئة جميع البيانات المطلوبة.");
      return;
    }

    try {
      const url = new URL(targetUrl);

      if (url.protocol !== "https:" || !url.hostname) {
        throw new Error();
      }
    } catch {
      setMessage("أدخل رابطًا صحيحًا يبدأ بـ https://");
      return;
    }

    if (![7, 14, 30].includes(durationDays)) {
      setMessage("اختر مدة الإعلان من القائمة.");
      return;
    }

    submitting.current = true;
    setBusy(true);

    try {
      const db = getClient();

      if (!db) {
        throw new Error("قاعدة البيانات غير متصلة.");
      }

      const { data, error: authError } = await db.auth.getUser();

      if (authError || !data.user) {
        setMessage("سجّل الدخول أولًا، ثم أرسل طلب الإعلان.");
        return;
      }

      const { error } = await db.from("ad_requests").insert({
        user_id: data.user.id,
        business_name: businessName,
        contact_info: contactInfo,
        title,
        description,
        target_url: targetUrl,
        duration_days: durationDays,
      });

      if (error) {
        setMessage(`تعذر إرسال الطلب: ${error.message}`);
        return;
      }

      form.reset();

      setMessage(
        "تم إرسال طلبك بنجاح. سنراجع التفاصيل ونتواصل معك لتأكيد السعر والدفع قبل تفعيل الإعلان."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "تعذر إرسال الطلب. حاول مرة أخرى."
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <fieldset
        disabled={busy}
        style={{
          border: 0,
          padding: 0,
          margin: 0,
          display: "grid",
          gap: 16,
          minWidth: 0,
        }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          اسم النشاط أو المعلن
          <input
            name="business_name"
            type="text"
            maxLength={150}
            required
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          البريد الإلكتروني أو رقم التواصل
          <input
            name="contact_info"
            type="text"
            minLength={3}
            maxLength={300}
            required
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          عنوان الإعلان
          <input
            name="title"
            type="text"
            maxLength={150}
            required
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          وصف الإعلان
          <textarea
            name="description"
            rows={5}
            maxLength={2000}
            required
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          رابط الموقع أو الخدمة
          <input
            name="target_url"
            type="url"
            placeholder="https://example.com"
            dir="ltr"
            maxLength={2000}
            required
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          مدة الإعلان المطلوبة
          <select name="duration_days" defaultValue="7">
            <option value="7">7 أيام</option>
            <option value="14">14 يومًا</option>
            <option value="30">30 يومًا</option>
          </select>
        </label>

        <p className="muted">
          إرسال الطلب لا يعني نشر الإعلان. يُحدَّد السعر
          بالاتفاق، وتبدأ مدة العرض بعد موافقة الإدارة
          وتأكيد استلام الدفع.
        </p>

        <button type="submit">
          {busy ? "جار إرسال الطلب..." : "إرسال طلب الإعلان"}
        </button>
      </fieldset>

      {message && (
        <p className="notice" role="status" aria-live="polite">
          {message}
        </p>
      )}
    </form>
  );
}