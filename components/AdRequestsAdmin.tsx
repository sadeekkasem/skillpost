"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getClient } from "@/lib/supabase";
import { safeLink } from "@/lib/safeLink";

type AdRequest = {
  id: string;
  business_name: string;
  contact_info: string;
  title: string;
  description: string;
  target_url: string;
  duration_days: number;
  status: string;
  price: number | null;
  currency: string;
  starts_at: string | null;
  ends_at: string | null;
};

const statusLabels: Record<string, string> = {
  pending: "بانتظار المراجعة",
  approved: "موافق عليه",
  rejected: "مرفوض",
  stopped: "متوقف",
};

export default function AdRequestsAdmin() {
  const [db] = useState(() => getClient());
  const [requests, setRequests] = useState<AdRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!db) throw new Error("قاعدة البيانات غير متصلة.");

        const { data, error } = await db
          .from("ad_requests")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) throw new Error(error.message);

        if (!cancelled) {
          setRequests((data ?? []) as AdRequest[]);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "تعذر تحميل طلبات الإعلان."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [db]);

  async function updateRequest(
    id: string,
    changes: {
      status: string;
      price?: number;
      currency?: string;
      starts_at?: string;
      ends_at?: string;
    }
  ) {
    if (!db || busyId) return;

    setBusyId(id);
    setMessage("");

    try {
      const { data, error } = await db
        .from("ad_requests")
        .update(changes)
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw new Error(error.message);

      setRequests((current) =>
        current.map((request) =>
          request.id === id ? (data as AdRequest) : request
        )
      );

      setMessage("تم تحديث الطلب.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "تعذر تحديث الطلب."
      );
    } finally {
      setBusyId("");
    }
  }

  function activate(
    event: FormEvent<HTMLFormElement>,
    request: AdRequest
  ) {
    event.preventDefault();

    const values = new FormData(event.currentTarget);
    const rawPrice = String(values.get("price") ?? "").trim();
    const price = Number(rawPrice);
    const currency = String(values.get("currency") ?? "USD");

    if (
      !rawPrice ||
      !Number.isFinite(price) ||
      price < 0 ||
      price > 99999999.99
    ) {
      setMessage("أدخل سعرًا صحيحًا.");
      return;
    }

    const confirmed = window.confirm(
      `هل تأكدت من استلام الدفع وتريد تفعيل الإعلان لمدة ${request.duration_days} يومًا؟`
    );

    if (!confirmed) return;

    const startsAt = new Date();
    const endsAt = new Date(
      startsAt.getTime() +
        request.duration_days * 24 * 60 * 60 * 1000
    );

    void updateRequest(request.id, {
      status: "approved",
      price,
      currency,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    });
  }

  return (
    <section style={{ marginBottom: 40 }}>
      <h2>إدارة طلبات الإعلانات</h2>

      <p className="muted">
        أحدث 100 طلب. لا تفعّل الإعلان قبل الاتفاق
        وتأكيد استلام الدفع.
      </p>

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}

      {loading && <p>جار تحميل الطلبات...</p>}

      {!loading && requests.length === 0 && (
        <p className="notice">لا توجد طلبات إعلانات.</p>
      )}

      <div style={{ display: "grid", gap: 20 }}>
        {requests.map((request) => {
          const expired =
            request.status === "approved" &&
            request.ends_at !== null &&
            new Date(request.ends_at).getTime() <= Date.now();

          return (
            <article key={request.id} className="card">
              <h3>{request.title}</h3>

              <p>
                الحالة:{" "}
                {expired
                  ? "انتهت المدة"
                  : statusLabels[request.status] ?? request.status}
              </p>

              <p>النشاط: {request.business_name}</p>
              <p>
                التواصل: <bdi>{request.contact_info}</bdi>
              </p>

              <p style={{ whiteSpace: "pre-wrap" }}>
                {request.description}
              </p>

              <p>
                {safeLink(request.target_url) ? (<a href={safeLink(request.target_url) ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  فتح رابط المعلن
                </a>) : (<span style={{ overflowWrap: "anywhere" }}>{request.target_url}</span>)}
              </p>

              <p>المدة المطلوبة: {request.duration_days} يومًا</p>

              {request.starts_at && (
                <p>
                  البداية:{" "}
                  {new Date(request.starts_at).toLocaleString("ar")}
                </p>
              )}

              {request.ends_at && (
                <p>
                  النهاية:{" "}
                  {new Date(request.ends_at).toLocaleString("ar")}
                </p>
              )}

              <form onSubmit={(event) => activate(event, request)}>
                <fieldset
                  disabled={Boolean(busyId)}
                  style={{
                    border: 0,
                    padding: 0,
                    margin: 0,
                    display: "grid",
                    gap: 12,
                    minWidth: 0,
                  }}
                >
                  <label>
                    السعر المتفق عليه
                    <input
                      name="price"
                      type="number"
                      min="0"
                      max="99999999.99"
                      step="0.01"
                      defaultValue={request.price ?? ""}
                      required
                    />
                  </label>

                  <label>
                    العملة
                    <select
                      name="currency"
                      defaultValue={request.currency}
                    >
                      <option value="USD">دولار أمريكي</option>
                      <option value="ILS">شيكل</option>
                      <option value="JOD">دينار أردني</option>
                    </select>
                  </label>

                  {request.status !== "approved" && (
                    <button type="submit">
                      تفعيل بعد استلام الدفع
                    </button>
                  )}

                  {request.status === "approved" && (
                    <button
                      type="button"
                      onClick={() =>
                        void updateRequest(request.id, {
                          status: "stopped",
                        })
                      }
                    >
                      إيقاف الإعلان
                    </button>
                  )}

                  {request.status === "pending" && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        void updateRequest(request.id, {
                          status: "rejected",
                        })
                      }
                    >
                      رفض الطلب
                    </button>
                  )}

                  {busyId === request.id && <p>جار الحفظ...</p>}
                </fieldset>
              </form>
            </article>
          );
        })}
      </div>
    </section>
  );
}