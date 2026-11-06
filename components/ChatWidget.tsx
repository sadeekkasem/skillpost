"use client";

import Link from "next/link";
import { hasContactInfo, CONTACT_BLOCKED_MESSAGE } from "@/lib/contactFilter";
import { useEffect, useMemo, useRef, useState } from "react";
import { getClient } from "@/lib/supabase";

type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

type Person = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_path: string | null;
};

type FriendshipRow = {
  requester_id: string;
  addressee_id: string;
  requester: Person | null;
  addressee: Person | null;
};

function personName(p: Person | null | undefined): string {
  return p?.full_name || p?.username || "مستخدم";
}

function timeLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function ChatWidget() {
  const [db] = useState(() => getClient());
  const [uid, setUid] = useState("");
  const [friends, setFriends] = useState<Person[]>([]);
  // Non-friends you are talking with (diamond members can message anyone; others can reply).
  const [others, setOthers] = useState<Person[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const markingReadIdsRef = useRef<Set<string>>(new Set());

  // Track the signed-in user
  useEffect(() => {
    if (!db) return;
    let alive = true;
    void db.auth.getUser().then(({ data }) => {
      if (alive) setUid(data.user?.id ?? "");
    });
    const { data: sub } = db.auth.onAuthStateChange((_event, session) => {
      setUid(session?.user?.id ?? "");
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [db]);

  // Load friends and recent messages, then listen for new ones
  useEffect(() => {
    if (!db || !uid) {
      setFriends([]);
      setOthers([]);
      setMessages([]);
      setOpen(false);
      setActiveId("");
      return;
    }
    let alive = true;

    async function load() {
      if (!db) return;
      const [fr, ms] = await Promise.all([
        db
          .from("friendships")
          .select(
            "requester_id,addressee_id,requester:profiles!friendships_requester_id_fkey(id,username,full_name,avatar_path),addressee:profiles!friendships_addressee_id_fkey(id,username,full_name,avatar_path)"
          )
          .eq("status", "accepted")
          .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`),
        db
          .from("messages")
          .select("*")
          .or(`sender_id.eq.${uid},recipient_id.eq.${uid}`)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);
      if (!alive) return;
      if (!fr.error) {
        const rows = (fr.data ?? []) as unknown as FriendshipRow[];
        setFriends(
          rows
            .map((r) => (r.requester_id === uid ? r.addressee : r.requester))
            .filter((p): p is Person => Boolean(p))
        );
      }
      if (!ms.error) {
        setMessages(((ms.data ?? []) as Message[]).reverse());
      }
    }

    void load();

    const channel = db
      .channel(`messages-${uid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${uid}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
        }
      )
      .subscribe();

    return () => {
      alive = false;
      void db.removeChannel(channel);
    };
  }, [db, uid]);

  // Open a chat from anywhere: window.dispatchEvent(new CustomEvent("open-chat", { detail: { id } }))
  useEffect(() => {
    function onOpen(e: Event) {
      const id = (e as CustomEvent<{ id?: string }>).detail?.id ?? "";
      setOpen(true);
      setActiveId(id);
      setError("");
    }
    window.addEventListener("open-chat", onOpen);
    return () => window.removeEventListener("open-chat", onOpen);
  }, []);

  const contacts = useMemo(() => [...friends, ...others], [friends, others]);

  // Load names for people in your messages (or the opened chat) who are not friends
  useEffect(() => {
    if (!db || !uid) return;
    const known = new Set(contacts.map((c) => c.id));
    const missing = new Set<string>();
    for (const m of messages) {
      const other = m.sender_id === uid ? m.recipient_id : m.sender_id;
      if (!known.has(other)) missing.add(other);
    }
    if (activeId && activeId !== uid && !known.has(activeId)) missing.add(activeId);
    if (!missing.size) return;
    let alive = true;
    void db
      .from("profiles")
      .select("id,username,full_name,avatar_path")
      .in("id", [...missing].slice(0, 100))
      .then(({ data }) => {
        const fresh = ((data ?? []) as Person[]).filter((p) => !known.has(p.id));
        if (alive && fresh.length) setOthers((cur) => [...cur, ...fresh.filter((p) => !cur.some((c) => c.id === p.id))]);
      });
    return () => {
      alive = false;
    };
  }, [db, uid, messages, activeId, contacts]);

  const unreadTotal = useMemo(
    () => messages.filter((m) => m.recipient_id === uid && !m.read_at).length,
    [messages, uid]
  );

  const conversations = useMemo(() => {
    return contacts
      .map((f) => {
        const thread = messages.filter(
          (m) =>
            (m.sender_id === f.id && m.recipient_id === uid) ||
            (m.sender_id === uid && m.recipient_id === f.id)
        );
        const last = thread[thread.length - 1];
        const unread = thread.filter((m) => m.recipient_id === uid && !m.read_at).length;
        return { friend: f, last, unread };
      })
      .sort((a, b) => (b.last?.created_at ?? "").localeCompare(a.last?.created_at ?? ""));
  }, [contacts, messages, uid]);

  const active = contacts.find((f) => f.id === activeId) ?? null;

  const thread = useMemo(
    () =>
      active
        ? messages.filter(
            (m) =>
              (m.sender_id === active.id && m.recipient_id === uid) ||
              (m.sender_id === uid && m.recipient_id === active.id)
          )
        : [],
    [active, messages, uid]
  );

  // Persist read_at for unread incoming messages while the conversation is open.
  // Only keep local read_at for ids the UPDATE actually returns; roll back on failure.
  useEffect(() => {
    if (!db || !open || !active) return;
    const unreadIds = thread
      .filter((m) => m.recipient_id === uid && m.sender_id === active.id && !m.read_at)
      .map((m) => m.id)
      .filter((id) => !markingReadIdsRef.current.has(id));
    if (unreadIds.length === 0) return;

    for (const id of unreadIds) markingReadIdsRef.current.add(id);
    const now = new Date().toISOString();
    // Optimistic clear so the badge disappears immediately
    setMessages((cur) =>
      cur.map((m) => (unreadIds.includes(m.id) ? { ...m, read_at: now } : m))
    );

    void (async () => {
      try {
        const { data, error } = await db
          .from("messages")
          .update({ read_at: now })
          .in("id", unreadIds)
          .eq("recipient_id", uid)
          .select("id");

        const persisted = new Set((data ?? []).map((row) => row.id as string));
        const failed = unreadIds.filter((id) => !persisted.has(id));

        if (error || failed.length > 0) {
          // Roll back ids that did not persist so refresh behavior stays honest
          setMessages((cur) =>
            cur.map((m) => (failed.includes(m.id) && m.read_at === now ? { ...m, read_at: null } : m))
          );
        }
      } finally {
        for (const id of unreadIds) markingReadIdsRef.current.delete(id);
      }
    })();

  }, [db, open, active, thread, uid]);

  // Keep the newest message in view
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread.length, activeId, open]);

  function avatarUrl(p: Person): string {
    if (!db || !p.avatar_path) return "";
    return db.storage.from("avatars").getPublicUrl(p.avatar_path).data.publicUrl;
  }

  function Avatar({ p }: { p: Person }) {
    const url = avatarUrl(p);
    return url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="chat-avatar" src={url} alt="" width={42} height={42} />
    ) : (
      <span className="chat-avatar" aria-hidden="true">
        {personName(p).trim().charAt(0) || "؟"}
      </span>
    );
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const body = draft.trim();
    if (!db || !active || !body || sending) return;
    if (body.length > 2000) {
      setError("الرسالة طويلة، الحد الأقصى 2000 حرف.");
      return;
    }
    if (hasContactInfo(body)) {
      setError(CONTACT_BLOCKED_MESSAGE);
      return;
    }
    setSending(true);
    setError("");
    const { data, error: err } = await db
      .from("messages")
      .insert({ sender_id: uid, recipient_id: active.id, body })
      .select("*")
      .single();
    setSending(false);
    if (err) {
      setError(
        err.message.includes("contact_blocked")
          ? CONTACT_BLOCKED_MESSAGE
          : err.message.includes("rate_limit")
          ? "أرسلت رسائل كثيرة بسرعة، انتظر دقيقة."
          : "تعذّر إرسال الرسالة. الدردشة متاحة بين الأصدقاء، ولأعضاء ماسي مع الجميع."
      );
      return;
    }
    setDraft("");
    setMessages((cur) => [...cur, data as Message]);
  }

  if (!db || !uid) return null;

  if (!open) {
    return (
      <button
        type="button"
        className="chat-bubble"
        aria-label={unreadTotal > 0 ? `الرسائل (${unreadTotal} غير مقروءة)` : "الرسائل"}
        onClick={() => setOpen(true)}
      >
        💬
        {unreadTotal > 0 && <span className="chat-badge">{unreadTotal > 99 ? "99+" : unreadTotal}</span>}
      </button>
    );
  }

  return (
    <section
      className="chat-panel"
      role="dialog"
      aria-label="الدردشة"
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <div className="chat-head">
        {active && (
          <button type="button" className="chat-icon" aria-label="رجوع" onClick={() => setActiveId("")}>
            →
          </button>
        )}
        {active && <Avatar p={active} />}
        <strong>{active ? personName(active) : "الرسائل"}</strong>
        <button type="button" className="chat-icon" aria-label="تصغير" onClick={() => setOpen(false)}>
          —
        </button>
      </div>

      {!active ? (
        <div className="chat-list">
          {conversations.length === 0 ? (
            <p className="chat-empty">
              الدردشة متاحة بين الأصدقاء. <Link href="/friends">أضف أصدقاء</Link> لتبدأ.
            </p>
          ) : (
            conversations.map(({ friend, last, unread }) => (
              <button
                key={friend.id}
                type="button"
                className="chat-row"
                onClick={() => {
                  setActiveId(friend.id);
                  setError("");
                }}
              >
                <Avatar p={friend} />
                <span className="chat-row-text">
                  <b>{personName(friend)}</b>
                  <small>{last ? (last.sender_id === uid ? "أنت: " : "") + last.body : "ابدأ المحادثة"}</small>
                </span>
                {unread > 0 && <span className="chat-count">{unread}</span>}
              </button>
            ))
          )}
        </div>
      ) : (
        <>
          <div className="chat-msgs" ref={listRef} aria-live="polite">
            {thread.length === 0 && <p className="chat-empty">لا توجد رسائل بعد. قل مرحبًا 👋</p>}
            {thread.map((m) => (
              <div key={m.id} className={`chat-msg ${m.sender_id === uid ? "mine" : "theirs"}`}>
                {m.body}
                <time dateTime={m.created_at}>{timeLabel(m.created_at)}</time>
              </div>
            ))}
          </div>
          {error && <p className="chat-error">{error}</p>}
          <form className="chat-form" onSubmit={send}>
            <textarea
              value={draft}
              maxLength={2000}
              placeholder="اكتب رسالة..."
              aria-label="نص الرسالة"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button type="submit" disabled={sending || !draft.trim()}>
              {sending ? "..." : "إرسال"}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
