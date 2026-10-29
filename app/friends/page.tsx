"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClient } from "@/lib/supabase";
import type { Friendship, Profile } from "@/lib/types";

type FriendRow = {
  friendship: Friendship;
  person: Profile;
};

function personName(person: Profile | null): string {
  return person?.full_name || person?.username || "عضو";
}

export default function FriendsPage() {
  const [db] = useState(() => getClient());

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [viewerId, setViewerId] = useState("");

  const [incoming, setIncoming] = useState<FriendRow[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRow[]>([]);
  const [friends, setFriends] = useState<FriendRow[]>([]);

  const [busyId, setBusyId] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setMessage("");
      setIncoming([]);
      setOutgoing([]);
      setFriends([]);

      if (!db) {
        setMessage("قاعدة البيانات غير متصلة");
        setLoading(false);
        return;
      }

      try {
        const authResult = await db.auth.getUser();
        const currentUserId = authResult.data.user?.id ?? "";

        if (cancelled) return;

        if (!currentUserId) {
          setMessage(
            "سجّل الدخول أولًا لعرض أصدقائك وطلبات الصداقة."
          );
          return;
        }

        setViewerId(currentUserId);

        const result = await db
          .from("friendships")
          .select(
            "*,requester:profiles!friendships_requester_id_fkey(*),addressee:profiles!friendships_addressee_id_fkey(*)"
          )
          .or(
            `requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`
          )
          .order("created_at", { ascending: false });

        if (cancelled) return;

        if (result.error) {
          throw result.error;
        }

        const rows = (result.data ?? []) as unknown as Array<
          Friendship & {
            requester: Profile | null;
            addressee: Profile | null;
          }
        >;

        const nextIncoming: FriendRow[] = [];
        const nextOutgoing: FriendRow[] = [];
        const nextFriends: FriendRow[] = [];

        for (const row of rows) {
          const isRequester =
            row.requester_id === currentUserId;

          const person = isRequester
            ? row.addressee
            : row.requester;

          if (!person) continue;

          const item: FriendRow = {
            friendship: row,
            person,
          };

          if (row.status === "accepted") {
            nextFriends.push(item);
          } else if (isRequester) {
            nextOutgoing.push(item);
          } else {
            nextIncoming.push(item);
          }
        }

        setIncoming(nextIncoming);
        setOutgoing(nextOutgoing);
        setFriends(nextFriends);
      } catch (error) {
        if (cancelled) return;

        setMessage(
          error instanceof Error
            ? error.message
            : "تعذر تحميل الأصدقاء وطلبات الصداقة"
        );
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
  }, [db]);

  async function acceptRequest(friendshipId: string) {
    if (!db || busyId) return;

    setBusyId(friendshipId);
    setMessage("");

    try {
      const { error } = await db
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", friendshipId);

      if (error) throw error;

      setIncoming((current) =>
        current.filter(
          (item) => item.friendship.id !== friendshipId
        )
      );

      const accepted = incoming.find(
        (item) => item.friendship.id === friendshipId
      );

      if (accepted) {
        setFriends((current) => [accepted, ...current]);
      }

      setMessage("تم قبول طلب الصداقة");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "تعذر قبول الطلب"
      );
    } finally {
      setBusyId("");
    }
  }

  async function removeFriendship(friendshipId: string) {
    if (!db || busyId) return;

    setBusyId(friendshipId);
    setMessage("");

    try {
      const { error } = await db
        .from("friendships")
        .delete()
        .eq("id", friendshipId);

      if (error) throw error;

      setIncoming((current) =>
        current.filter(
          (item) => item.friendship.id !== friendshipId
        )
      );

      setOutgoing((current) =>
        current.filter(
          (item) => item.friendship.id !== friendshipId
        )
      );

      setFriends((current) =>
        current.filter(
          (item) => item.friendship.id !== friendshipId
        )
      );

      setMessage("تم حذف الطلب أو الصداقة");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "تعذر حذف الطلب أو الصداقة"
      );
    } finally {
      setBusyId("");
    }
  }

  function avatarUrl(person: Profile): string {
    if (!db || !person.avatar_path) return "";

    return db.storage
      .from("avatars")
      .getPublicUrl(person.avatar_path).data.publicUrl;
  }

  function PersonCard({ item }: { item: FriendRow }) {
    const person = item.person;
    const name = personName(person);
    const avatar = avatarUrl(person);
    const isBusy = busyId === item.friendship.id;

    return (
      <article
        className="card friend-card"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: "12px",
          padding: "20px",
        }}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt={`الصورة الشخصية لـ ${name}`}
            width={80}
            height={80}
            style={{
              borderRadius: "50%",
              objectFit: "cover",
              border: "2px solid #cbd5e1",
            }}
          />
        ) : (
          <div
            aria-label="لا توجد صورة شخصية"
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              backgroundColor: "#e2e8f0",
              color: "#334155",
              display: "grid",
              placeItems: "center",
              fontSize: "30px",
              fontWeight: 700,
            }}
          >
            {name.trim().charAt(0) || "؟"}
          </div>
        )}

        <h3 style={{ margin: 0 }}>{name}</h3>

        {person.specialty && (
          <p className="muted" style={{ margin: 0 }}>
            {person.specialty}
          </p>
        )}

        <Link href={`/profile/${person.id}`}>
          عرض الملف
        </Link>

        <div className="row" style={{ flexWrap: "wrap" }}>
          {item.friendship.status === "pending" &&
            item.friendship.addressee_id === viewerId && (
              <>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() =>
                    acceptRequest(item.friendship.id)
                  }
                >
                  {isBusy ? "جار القبول..." : "قبول"}
                </button>

                <button
                  type="button"
                  className="secondary"
                  disabled={isBusy}
                  onClick={() =>
                    removeFriendship(item.friendship.id)
                  }
                >
                  رفض
                </button>
              </>
            )}

          {item.friendship.status === "pending" &&
            item.friendship.requester_id === viewerId && (
              <button
                type="button"
                className="secondary"
                disabled={isBusy}
                onClick={() =>
                  removeFriendship(item.friendship.id)
                }
              >
                {isBusy ? "جار الإلغاء..." : "إلغاء الطلب"}
              </button>
            )}

          {item.friendship.status === "accepted" && (
            <button
              type="button"
              className="secondary"
              disabled={isBusy}
              onClick={() =>
                removeFriendship(item.friendship.id)
              }
            >
              {isBusy ? "جار التنفيذ..." : "إزالة الصداقة"}
            </button>
          )}
        </div>
      </article>
    );
  }

  return (
    <div className="narrow friends-page">
      <h1>الأصدقاء</h1>

      {message && (
        <p className="notice" aria-live="polite">
          {message}
        </p>
      )}

      {loading ? (
        <p className="notice">جار التحميل...</p>
      ) : (
        <>
          <section className="card friends-incoming">
            <h2>
              طلبات الصداقة الواردة{" "}
              {incoming.length > 0 && `(${incoming.length})`}
            </h2>

            {incoming.length === 0 ? (
              <p className="muted">
                لا توجد طلبات صداقة واردة الآن.
              </p>
            ) : (
              <div className="grid">
                {incoming.map((item) => (
                  <PersonCard
                    key={item.friendship.id}
                    item={item}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h2>
              طلبات أرسلتها{" "}
              {outgoing.length > 0 && `(${outgoing.length})`}
            </h2>

            {outgoing.length === 0 ? (
              <p className="muted">
                لم ترسل طلبات صداقة معلقة.
              </p>
            ) : (
              <div className="grid">
                {outgoing.map((item) => (
                  <PersonCard
                    key={item.friendship.id}
                    item={item}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h2>
              أصدقائي{" "}
              {friends.length > 0 && `(${friends.length})`}
            </h2>

            {friends.length === 0 ? (
              <p className="muted">
                لا يوجد أصدقاء بعد. أرسل طلب صداقة من ملف
                أي مشترك.
              </p>
            ) : (
              <div className="grid">
                {friends.map((item) => (
                  <PersonCard
                    key={item.friendship.id}
                    item={item}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}