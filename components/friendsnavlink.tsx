"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClient } from "@/lib/supabase";

export default function FriendsNavLink() {
  const [db] = useState(() => getClient());
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!db) return;

      try {
        const { data } = await db.auth.getUser();
        const userId = data.user?.id;

        if (!userId) {
          setCount(0);
          return;
        }

        const { count: incomingCount, error } = await db
          .from("friendships")
          .select("id", { count: "exact", head: true })
          .eq("addressee_id", userId)
          .eq("status", "pending");

        if (error) {
          setCount(0);
          return;
        }

        if (!cancelled) {
          setCount(incomingCount ?? 0);
        }
      } catch {
        if (!cancelled) {
          setCount(0);
        }
      }
    }

    void load();

    const interval = setInterval(load, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [db]);

  return (
    <Link href="/friends">
      الأصدقاء
      {count > 0 && (
        <span
          aria-label={`${count} طلب صداقة وارد`}
          style={{
            display: "inline-grid",
            placeItems: "center",
            minWidth: "22px",
            height: "22px",
            padding: "0 6px",
            marginRight: "6px",
            borderRadius: "999px",
            backgroundColor: "#dc2626",
            color: "white",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          {count}
        </span>
      )}
    </Link>
  );
}