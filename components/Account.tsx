"use client";

import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import { getClient } from "@/lib/supabase";
import { compressImage, MAX_RAW_IMAGE_BYTES } from "@/lib/upload";

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

function validateWebsite(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const url = new URL(trimmed);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("رابط الموقع يجب أن يبدأ بـ https:// أو http://");
  }

  if (url.username || url.password) {
    throw new Error("لا تضع بيانات دخول داخل رابط الموقع");
  }

  return trimmed;
}

function validateLinkedIn(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const url = new URL(trimmed);

  if (
    url.protocol !== "https:" ||
    !["linkedin.com", "www.linkedin.com"].includes(
      url.hostname.toLowerCase()
    ) ||
    url.port ||
    url.username ||
    url.password
  ) {
    throw new Error(
      "اكتب رابط LinkedIn صحيحًا يبدأ بـ https://www.linkedin.com/"
    );
  }

  return trimmed;
}

export default function Account() {
  const [db] = useState(() => getClient());

  const [uid, setUid] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [confirmAge, setConfirmAge] = useState(false);
  const [signupMarketing, setSignupMarketing] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [website, setWebsite] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [avatarPath, setAvatarPath] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);

  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileReady, setProfileReady] = useState(false);

  function clearProfile() {
    setName("");
    setBio("");
    setSpecialty("");
    setWebsite("");
    setLinkedin("");
    setContactEmail("");
    setAvatarPath("");
    setAvatarFile(null);
    setFileInputKey((key) => key + 1);
    setProfileReady(false);
  }

  async function loadProfile(userId: string) {
    if (!db) return;

    setProfileReady(false);

    const { data, error } = await db
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) throw error;

    setName(data.full_name ?? "");
    setBio(data.bio ?? "");
    setSpecialty(data.specialty ?? "");
    setWebsite(data.website_url ?? "");
    setLinkedin(data.linkedin_url ?? "");
    setContactEmail(data.contact_email ?? "");
    setAvatarPath(data.avatar_path ?? "");
    setMarketingOptIn(data.marketing_opt_in === true);
    setAvatarFile(null);
    setFileInputKey((key) => key + 1);
    setProfileReady(true);
  }

  useEffect(() => {
    let active = true;

    async function initialize() {
      if (!db) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await db.auth.getUser();

        if (!active) return;

        if (!data.user) {
          setUid("");
          if (error && error.name !== "AuthSessionMissingError") {
            setMsg(error.message);
          }
          return;
        }

        setUid(data.user.id);
        await loadProfile(data.user.id);
      } catch (error) {
        if (active) setMsg(errorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialize();

    return () => {
      active = false;
    };
    // The client is created once for this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  useEffect(() => {
    if (!avatarFile) {
      setPreviewUrl("");
      return;
    }

    const url = URL.createObjectURL(avatarFile);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [avatarFile]);

  const savedAvatarUrl =
    db && avatarPath
      ? db.storage.from("avatars").getPublicUrl(avatarPath).data.publicUrl
      : "";

  const displayedAvatar = previewUrl || savedAvatarUrl;

  async function auth(e: SubmitEvent) {
    e.preventDefault();
    if (!db || busy) return;

    setBusy(true);
    setMsg("");

    try {
      if (mode === "signup") {
        if (!confirmAge) {
          throw new Error("التسجيل متاح لمن هم في سن 18 عامًا فأكثر فقط");
        }

        if (!acceptTerms) {
          throw new Error("يجب الموافقة على الشروط وسياسة الخصوصية لإنشاء حساب");
        }

        const { data, error } = await db.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              terms_accepted: true,
              age_confirmed: true,
              marketing_opt_in: signupMarketing,
            },
          },
        });

        if (error) throw error;

        setPassword("");

        if (data.session && data.user) {
          clearProfile();
          setUid(data.user.id);
          await loadProfile(data.user.id);
          setMsg("تم إنشاء الحساب وتسجيل الدخول");
        } else {
          setMsg(
            "تم إرسال طلب التسجيل. إذا كان تأكيد البريد مفعّلًا، أكّد بريدك ثم سجّل الدخول."
          );
        }
      } else {
        const { data, error } = await db.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        clearProfile();
        setUid(data.user.id);
        setPassword("");
        await loadProfile(data.user.id);
        setMsg("تم تسجيل الدخول");
      }
    } catch (error) {
      setMsg(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function save(e: SubmitEvent) {
    e.preventDefault();
    if (!db || busy || !profileReady) return;

    setBusy(true);
    setMsg("");

    let uploadedPath = "";
    let profileSaved = false;

    try {
      if (!name.trim()) {
        throw new Error("اكتب اسمك أولًا");
      }

      let websiteValue: string | null;
      let linkedinValue: string | null;

      try {
        websiteValue = validateWebsite(website);
      } catch (error) {
        if (error instanceof TypeError) {
          throw new Error("رابط الموقع غير صحيح؛ ابدأ بـ https://");
        }
        throw error;
      }

      try {
        linkedinValue = validateLinkedIn(linkedin);
      } catch (error) {
        if (error instanceof TypeError) {
          throw new Error("رابط LinkedIn غير صحيح");
        }
        throw error;
      }

      const { data: authData, error: authError } =
        await db.auth.getUser();

      if (authError) throw authError;

      if (!authData.user || authData.user.id !== uid) {
        throw new Error("انتهت الجلسة أو تغيّر الحساب. أعد تحميل الصفحة.");
      }

      let nextAvatarPath = avatarPath;

      if (avatarFile) {
        const extensions: Record<string, string> = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
        };

        if (!extensions[avatarFile.type]) {
          throw new Error("الصورة يجب أن تكون JPG أو PNG أو WebP");
        }

        const small = await compressImage(avatarFile, 512, 150 * 1024);
        const extension = extensions[small.type];

        if (!extension) {
          throw new Error("الصورة يجب أن تكون JPG أو PNG أو WebP");
        }

        const path = `${uid}/${crypto.randomUUID()}.${extension}`;

        const uploadResult = await db.storage
          .from("avatars")
          .upload(path, small, {
            contentType: small.type,
            upsert: false,
          });

        if (uploadResult.error) throw uploadResult.error;

        uploadedPath = path;
        nextAvatarPath = path;
      }

      const { error } = await db
        .from("profiles")
        .update({
          full_name: name.trim(),
          bio: bio.trim(),
          specialty: specialty.trim() || null,
          website_url: websiteValue,
          linkedin_url: linkedinValue,
          contact_email: contactEmail.trim() || null,
          avatar_path: nextAvatarPath || null,
        })
        .eq("id", uid)
        .select("id")
        .single();

      if (error) throw error;

      profileSaved = true;

      const oldAvatarPath = avatarPath;
      setAvatarPath(nextAvatarPath);
      setAvatarFile(null);
      setFileInputKey((key) => key + 1);

      if (
        uploadedPath &&
        oldAvatarPath &&
        oldAvatarPath !== uploadedPath
      ) {
        const cleanup = await db.storage
          .from("avatars")
          .remove([oldAvatarPath]);

        if (cleanup.error) {
          setMsg(
            "تم حفظ بياناتك والصورة الجديدة، لكن تعذر حذف الصورة القديمة من التخزين."
          );
          return;
        }
      }

      setMsg("تم حفظ بياناتك بنجاح");
    } catch (error) {
      let message = errorMessage(error);

      if (uploadedPath && !profileSaved) {
        const cleanup = await db.storage
          .from("avatars")
          .remove([uploadedPath]);

        if (cleanup.error) {
          message +=
            " — تعذر تنظيف الصورة المرفوعة بعد فشل الحفظ.";
        }
      }

      setMsg(message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleMarketing(next: boolean) {
    if (!db || busy || !uid) return;

    setBusy(true);
    setMsg("");

    try {
      const { error } = await db
        .from("profiles")
        .update({
          marketing_opt_in: next,
          marketing_opt_in_at: new Date().toISOString(),
        })
        .eq("id", uid)
        .select("id")
        .single();

      if (error) throw error;

      setMarketingOptIn(next);
      setMsg(
        next
          ? "تم تفعيل استلام الأخبار والعروض على بريدك"
          : "تم إيقاف رسائل الأخبار والعروض"
      );
    } catch (error) {
      setMsg(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!db || busy) return;

    setBusy(true);
    setMsg("");

    try {
      const { error } = await db.auth.signOut();
      if (error) throw error;

      setUid("");
      setPassword("");
      clearProfile();
      setMsg("تم تسجيل الخروج");
    } catch (error) {
      setMsg(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function retryProfile() {
    if (!uid || busy) return;

    setBusy(true);
    setMsg("");

    try {
      await loadProfile(uid);
    } catch (error) {
      setMsg(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (!db) {
    return (
      <div className="notice">
        أنشئ ملف الإعدادات واربط Supabase أولًا. راجع صفحة التجهيز.
      </div>
    );
  }

  if (loading) {
    return <p className="notice">جار تحميل الحساب...</p>;
  }

  return (
    <div className="account-page">
      {msg && (
        <p className="notice" aria-live="polite">
          {msg}
        </p>
      )}

      {uid ? (
        <>
          {!profileReady ? (
            <section className="card">
              <h1>حسابي</h1>
              <p>
                تعذر تحميل ملفك الشخصي. أعد المحاولة قبل تعديل بياناتك.
              </p>
              <div className="row">
                <button
                  type="button"
                  disabled={busy}
                  onClick={retryProfile}
                >
                  إعادة المحاولة
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={signOut}
                >
                  خروج
                </button>
              </div>
            </section>
          ) : (
            <form onSubmit={save}>
              <section className="card account-hero">
                <div className="account-banner" aria-hidden="true" />
                <div className="account-hero-body">
                  <div className="account-avatar">
                    {displayedAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={displayedAvatar}
                        alt={name ? `الصورة الشخصية لـ ${name}` : "صورتك الشخصية"}
                        width={120}
                        height={120}
                      />
                    ) : (
                      <div
                        className="account-avatar-fallback"
                        aria-label="لم تُضف صورة شخصية"
                      >
                        {name.trim().charAt(0) || "؟"}
                      </div>
                    )}
                  </div>
                  <h1 className="account-name">{name.trim() || "حسابي"}</h1>
                  {specialty.trim() && (
                    <p className="account-specialty">{specialty}</p>
                  )}
                  {avatarFile && (
                    <p className="muted">
                      هذه معاينة؛ اضغط حفظ لاعتماد الصورة.
                    </p>
                  )}
                  <div className="account-quick">
                    <a className="button secondary" href={`/profile/${uid}`}>
                      👤 معرض أعمالي
                    </a>
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={signOut}
                    >
                      ↩ خروج
                    </button>
                  </div>
                </div>
              </section>

              <p className="muted account-note">
                الاسم والصورة والنبذة والتخصص وروابط التواصل
                التي تحفظها هنا مخصصة للعرض العام. بريد التواصل
                اختياري ولا يغيّر بريد تسجيل الدخول.
              </p>

              <section className="card account-section">
                <h2><span aria-hidden="true">📝</span> المعلومات الشخصية</h2>
                <div className="account-fields">
                  <label>
                    الاسم الظاهر للزوار
                    <input
                      required
                      maxLength={80}
                      autoComplete="name"
                      value={name}
                      disabled={busy}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>

                  <label>
                    التخصص
                    <input
                      maxLength={120}
                      placeholder="مثال: تحليل البيانات وإعداد تقارير Excel"
                      value={specialty}
                      disabled={busy}
                      onChange={(e) => setSpecialty(e.target.value)}
                    />
                  </label>

                  <label className="account-wide">
                    نبذة عنك
                    <textarea
                      maxLength={1000}
                      rows={5}
                      placeholder="عرّف الزوار بمهاراتك ونوع المشاريع التي تقدمها"
                      value={bio}
                      disabled={busy}
                      onChange={(e) => setBio(e.target.value)}
                    />
                  </label>
                </div>
              </section>

              <section className="card account-section">
                <h2><span aria-hidden="true">🔗</span> الروابط</h2>
                <div className="account-fields">
                  <label>
                    موقعك الشخصي — اختياري
                    <input
                      type="url"
                      maxLength={500}
                      dir="ltr"
                      placeholder="https://example.com"
                      value={website}
                      disabled={busy}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </label>

                  <label>
                    رابط LinkedIn — اختياري
                    <input
                      type="url"
                      maxLength={500}
                      dir="ltr"
                      placeholder="https://www.linkedin.com/in/your-name"
                      value={linkedin}
                      disabled={busy}
                      onChange={(e) => setLinkedin(e.target.value)}
                    />
                  </label>

                  <label>
                    بريد التواصل العام — اختياري
                    <input
                      type="email"
                      maxLength={254}
                      dir="ltr"
                      placeholder="contact@example.com"
                      value={contactEmail}
                      disabled={busy}
                      onChange={(e) => setContactEmail(e.target.value)}
                    />
                  </label>
                </div>
              </section>

              <section className="card account-section">
                <h2><span aria-hidden="true">🖼️</span> الصورة</h2>
                <label>
                  الصورة الشخصية
                  <input
                    key={fileInputKey}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      if (!file) return;

                      if (
                        !["image/jpeg", "image/png", "image/webp"].includes(
                          file.type
                        )
                      ) {
                        setMsg("اختر صورة JPG أو PNG أو WebP");
                        e.target.value = "";
                        return;
                      }

                      if (file.size > MAX_RAW_IMAGE_BYTES) {
                        setMsg("الحد الأقصى للصورة 15 ميغابايت");
                        e.target.value = "";
                        return;
                      }

                      setMsg("");
                      setAvatarFile(file);
                    }}
                  />
                </label>

                <p className="muted">
                  JPG أو PNG أو WebP. تُضغط الصورة تلقائيًا. الصورة
                  المحفوظة عامة، لذا لا ترفع صورة خاصة أو حساسة.
                </p>

                {avatarFile && (
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      setAvatarFile(null);
                      setFileInputKey((key) => key + 1);
                    }}
                  >
                    إلغاء اختيار الصورة الجديدة
                  </button>
                )}
              </section>

              <section className="card account-section">
                <h2><span aria-hidden="true">🔒</span> الخصوصية والرسائل</h2>
                <label className="switch-row">
                  <input
                    type="checkbox"
                    role="switch"
                    className="switch"
                    checked={marketingOptIn}
                    disabled={busy}
                    onChange={(e) => void toggleMarketing(e.target.checked)}
                  />
                  <span>
                    أرغب باستلام أخبار وعروض الموقع على بريدي الإلكتروني (يمكنك
                    الإلغاء في أي وقت). يُحفظ هذا الخيار فورًا.
                  </span>
                </label>
              </section>

              <div className="account-actions">
                <button type="submit" disabled={busy}>
                  {busy ? "جار التنفيذ..." : "حفظ البيانات"}
                </button>
              </div>
            </form>
          )}
        </>
      ) : (
        <form className="card auth-card" onSubmit={auth}>
          <div className="auth-strip">
            <span className="auth-welcome">أهلًا بك في مهاراتي 👋</span>
          </div>

          <div className="auth-body">
            <div className="auth-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                className={mode === "login" ? "auth-tab active" : "auth-tab"}
                disabled={busy}
                onClick={() => {
                  if (mode === "login") return;
                  setMode("login");
                  setPassword("");
                  setMsg("");
                }}
              >
                تسجيل الدخول
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                className={mode === "signup" ? "auth-tab active" : "auth-tab"}
                disabled={busy}
                onClick={() => {
                  if (mode === "signup") return;
                  setMode("signup");
                  setPassword("");
                  setMsg("");
                }}
              >
                إنشاء حساب
              </button>
            </div>

            <h1 className="auth-title">
              {mode === "signup" ? "إنشاء حساب" : "تسجيل الدخول"}
            </h1>

            <label>
              بريد تسجيل الدخول
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                disabled={busy}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label>
              كلمة المرور
              <input
                type="password"
                minLength={8}
                required
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                value={password}
                disabled={busy}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            {mode === "signup" && (
              <div className="check-list">
                <label className="check-row">
                  <input
                    type="checkbox"
                    required
                    checked={confirmAge}
                    disabled={busy}
                    onChange={(e) => setConfirmAge(e.target.checked)}
                  />
                  <span>أؤكد أن عمري 18 سنة أو أكثر</span>
                </label>
                <label className="check-row">
                  <input
                    type="checkbox"
                    required
                    checked={acceptTerms}
                    disabled={busy}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                  />
                  <span>
                    أوافق على <a href="/terms" target="_blank">الشروط</a> و
                    <a href="/privacy" target="_blank">سياسة الخصوصية</a>
                  </span>
                </label>

                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={signupMarketing}
                    disabled={busy}
                    onChange={(e) => setSignupMarketing(e.target.checked)}
                  />
                  <span>
                    أرغب باستلام أخبار وعروض الموقع على بريدي الإلكتروني (يمكنك
                    الإلغاء في أي وقت)
                  </span>
                </label>
              </div>
            )}

            <button
              type="submit"
              className="auth-submit"
              disabled={busy || (mode === "signup" && (!acceptTerms || !confirmAge))}
            >
              {busy ? "جار التنفيذ..." : "متابعة"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
