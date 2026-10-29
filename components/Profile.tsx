"use client";

import { useEffect, useState } from "react";
import { getClient } from "@/lib/supabase";
import type {
  Friendship,
  FriendshipStatus,
  Profile,
  Project,
} from "@/lib/types";
import Card from "./ProjectCard";
import PostsSection from "./PostsSection";

function safeWebUrl(
  value: string | null | undefined,
  linkedinOnly = false
): string | null {
  if (!value?.trim()) return null;

  try {
    const url = new URL(value.trim());

    if (!["https:", "http:"].includes(url.protocol)) {
      return null;
    }

    if (url.username || url.password) {
      return null;
    }

    if (
      linkedinOnly &&
      (
        url.protocol !== "https:" ||
        !["linkedin.com", "www.linkedin.com"].includes(
          url.hostname.toLowerCase()
        ) ||
        Boolean(url.port)
      )
    ) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

function getFriendshipError(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    return String(error.message);
  }

  return "حدث خطأ في عملية الصداقة";
}

export default function UserProfile({
  id,
}: Readonly<{ id: string }>) {
  const [db] = useState(() => getClient());

  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewerId, setViewerId] = useState("");
  const [failedAvatar, setFailedAvatar] = useState("");

  const [friendship, setFriendship] =
    useState<Friendship | null>(null);
  const [friendshipStatus, setFriendshipStatus] =
    useState<FriendshipStatus>("none");
  const [friendBusy, setFriendBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setMessage("");
      setProfile(null);
      setProjects([]);
      setViewerId("");
      setFailedAvatar("");
      setFriendship(null);
      setFriendshipStatus("none");

      if (!db) {
        setMessage("قاعدة البيانات غير متصلة");
        setLoading(false);
        return;
      }

      try {
        const profileResult = await db
          .from("profiles")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (cancelled) return;

        if (profileResult.error) {
          throw profileResult.error;
        }

        if (!profileResult.data) {
          setMessage("هذا الملف الشخصي غير موجود.");
          return;
        }

        setProfile(profileResult.data as Profile);

        const projectsResult = await db
          .from("projects")
          .select(
            "*,profiles!projects_user_id_fkey(id,username,full_name,avatar_path,specialty),attachments(*)"
          )
          .eq("user_id", id)
          .order("created_at", { ascending: false });

        if (cancelled) return;

        if (projectsResult.error) {
          throw projectsResult.error;
        }

        setProjects(
          (projectsResult.data ?? []) as unknown as Project[]
        );

        const authResult = await db.auth.getUser();
        const currentUserId = authResult.data.user?.id ?? "";

        if (cancelled) return;

        setViewerId(currentUserId);

        if (currentUserId && currentUserId !== id) {
          const friendshipResult = await db
            .from("friendships")
            .select("*")
            .or(
              `and(requester_id.eq.${currentUserId},addressee_id.eq.${id}),and(requester_id.eq.${id},addressee_id.eq.${currentUserId})`
            )
            .maybeSingle();

          if (cancelled) return;

          if (friendshipResult.error) {
            throw friendshipResult.error;
          }

          const relation =
            (friendshipResult.data as Friendship | null) ?? null;

          setFriendship(relation);

          if (!relation) {
            setFriendshipStatus("none");
          } else if (relation.status === "accepted") {
            setFriendshipStatus("friends");
          } else if (relation.requester_id === currentUserId) {
            setFriendshipStatus("request_sent");
          } else {
            setFriendshipStatus("request_received");
          }
        }
      } catch (error) {
        if (cancelled) return;

        setMessage(getFriendshipError(error));
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
  }, [id, db]);

  const displayName =
    profile?.full_name || profile?.username || "عضو";

  const avatarUrl =
    db && profile?.avatar_path
      ? db.storage
          .from("avatars")
          .getPublicUrl(profile.avatar_path).data.publicUrl
      : "";

  const websiteUrl = safeWebUrl(profile?.website_url);
  const linkedinUrl = safeWebUrl(profile?.linkedin_url, true);

  const contactEmail = profile?.contact_email?.trim() ?? "";
  const hasContactEmail =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail);

  const isOwner = Boolean(viewerId && viewerId === id);
  const canUseFriends = Boolean(
    viewerId && !isOwner && profile
  );

  async function sendFriendRequest() {
    if (!db || !viewerId || friendBusy) return;

    setFriendBusy(true);
    setMessage("");

    try {
      const { data, error } = await db
        .from("friendships")
        .insert({
          requester_id: viewerId,
          addressee_id: id,
          status: "pending",
        })
        .select("*")
        .single();

      if (error) throw error;

      setFriendship(data as Friendship);
      setFriendshipStatus("request_sent");
      setMessage("تم إرسال طلب الصداقة");
    } catch (error) {
      setMessage(getFriendshipError(error));
    } finally {
      setFriendBusy(false);
    }
  }

  async function acceptFriendRequest() {
    if (!db || !friendship || friendBusy) return;

    setFriendBusy(true);
    setMessage("");

    try {
      const { data, error } = await db
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", friendship.id)
        .select("*")
        .single();

      if (error) throw error;

      setFriendship(data as Friendship);
      setFriendshipStatus("friends");
      setMessage("أصبحتما صديقين");
    } catch (error) {
      setMessage(getFriendshipError(error));
    } finally {
      setFriendBusy(false);
    }
  }

  async function removeFriendship() {
    if (!db || !friendship || friendBusy) return;

    setFriendBusy(true);
    setMessage("");

    try {
      const { error } = await db
        .from("friendships")
        .delete()
        .eq("id", friendship.id);

      if (error) throw error;

      setFriendship(null);
      setFriendshipStatus("none");
      setMessage("تم إزالة الصداقة أو إلغاء الطلب");
    } catch (error) {
      setMessage(getFriendshipError(error));
    } finally {
      setFriendBusy(false);
    }
  }

  return (
    <>
      {loading && (
        <p className="notice" aria-live="polite">
          جار تحميل الملف الشخصي...
        </p>
      )}

      {message && (
        <p className="notice" aria-live="polite">
          {message}
        </p>
      )}

      {profile && (
        <>
          <section
            className="card profile-hero"
            aria-label="بيانات صاحب الملف الشخصي"
            style={{ marginBottom: "24px" }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "24px",
              }}
            >
              {avatarUrl && failedAvatar !== avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={`الصورة الشخصية لـ ${displayName}`}
                  width={140}
                  height={140}
                  onError={() => setFailedAvatar(avatarUrl)}
                  style={{
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "3px solid #cbd5e1",
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div
                  aria-label="لا توجد صورة شخصية متاحة"
                  style={{
                    width: "140px",
                    height: "140px",
                    borderRadius: "50%",
                    backgroundColor: "#e2e8f0",
                    color: "#334155",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "48px",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {displayName.trim().charAt(0) || "؟"}
                </div>
              )}

              <div
                style={{
                  flex: "1 1 240px",
                  minWidth: 0,
                }}
              >
                <h1
                  style={{
                    margin: "0 0 8px",
                    overflowWrap: "anywhere",
                  }}
                >
                  {displayName}
                </h1>

                {profile.specialty && (
                  <p
                    style={{
                      margin: "0 0 12px",
                      fontSize: "18px",
                      fontWeight: 600,
                    }}
                  >
                    {profile.specialty}
                  </p>
                )}

                {profile.bio && (
                  <p
                    style={{
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {profile.bio}
                  </p>
                )}

                {!loading && !message && (
                  <p className="muted">
                    عدد المشاريع المنشورة: {projects.length}
                  </p>
                )}

                {isOwner && (
                  <p className="muted">
                    هذا ملفك الشخصي، وتظهر بياناتك المحفوظة
                    للزوار أيضًا.
                  </p>
                )}
              </div>
            </div>

            {canUseFriends && (
              <div
                style={{
                  marginTop: "20px",
                  paddingTop: "16px",
                  borderTop: "1px solid #cbd5e1",
                }}
              >
                {friendshipStatus === "none" && (
                  <button
                    type="button"
                    disabled={friendBusy}
                    onClick={sendFriendRequest}
                  >
                    {friendBusy
                      ? "جار الإرسال..."
                      : "إضافة صديق"}
                  </button>
                )}

                {friendshipStatus === "request_sent" && (
                  <div className="row">
                    <button disabled>
                      طلب الصداقة مُرسل
                    </button>

                    <button
                      type="button"
                      className="secondary"
                      disabled={friendBusy}
                      onClick={removeFriendship}
                    >
                      إلغاء الطلب
                    </button>
                  </div>
                )}

                {friendshipStatus === "request_received" && (
                  <div className="row">
                    <button
                      type="button"
                      disabled={friendBusy}
                      onClick={acceptFriendRequest}
                    >
                      {friendBusy
                        ? "جار القبول..."
                        : "قبول طلب الصداقة"}
                    </button>

                    <button
                      type="button"
                      className="secondary"
                      disabled={friendBusy}
                      onClick={removeFriendship}
                    >
                      رفض الطلب
                    </button>
                  </div>
                )}

                {friendshipStatus === "friends" && (
                  <div className="row">
                    <button
                      type="button"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent("open-chat", { detail: { id } })
                        )
                      }
                    >
                      💬 راسل
                    </button>

                    <button disabled>
                      أنتما صديقان
                    </button>

                    <button
                      type="button"
                      className="secondary"
                      disabled={friendBusy}
                      onClick={removeFriendship}
                    >
                      إزالة الصداقة
                    </button>
                  </div>
                )}
              </div>
            )}

            {(websiteUrl ||
              linkedinUrl ||
              hasContactEmail) && (
              <div
                style={{
                  marginTop: "20px",
                  paddingTop: "16px",
                  borderTop: "1px solid #cbd5e1",
                }}
              >
                <h2 style={{ fontSize: "20px" }}>
                  التواصل والروابط
                </h2>

                <div
                  className="row"
                  style={{
                    flexWrap: "wrap",
                    gap: "16px",
                    overflowWrap: "anywhere",
                  }}
                >
                  {websiteUrl && (
                    <a
                      href={websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      الموقع الشخصي ↗
                    </a>
                  )}

                  {linkedinUrl && (
                    <a
                      href={linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      LinkedIn ↗
                    </a>
                  )}

                  {hasContactEmail && (
                    <a
                      href={`mailto:${encodeURIComponent(
                        contactEmail
                      )}`}
                    >
                      تواصل عبر البريد
                    </a>
                  )}
                </div>
              </div>
            )}
          </section>

          <h2>معرض الأعمال</h2>

          {!loading &&
            !message &&
            projects.length === 0 && (
              <p className="notice">
                لا توجد مشاريع منشورة لهذا الحساب بعد.
              </p>
            )}

          <div className="grid">
            {projects.map((project) => (
              <Card key={project.id} project={project} />
            ))}
          </div>

          <div style={{ marginTop: "32px" }}>
            <PostsSection userId={id} />
          </div>
        </>
      )}
    </>
  );
}