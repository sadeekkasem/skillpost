"use client";

import { useEffect, useState } from "react";
import { getClient } from "@/lib/supabase";
import { TIERS, loadTier, type Tier } from "@/lib/tiers";

/** Small tier badge next to a member name. Renders nothing until known (or before the migration). */
export default function TierBadge({ id, tier }: { id?: string | null; tier?: Tier | null }) {
  const [loaded, setLoaded] = useState<Tier | null>(null);

  useEffect(() => {
    const db = getClient();
    if (tier || !id || !db) return;
    let alive = true;
    void loadTier(db, id).then((t) => {
      if (alive) setLoaded(t);
    });
    return () => {
      alive = false;
    };
  }, [id, tier]);

  const t = tier ?? loaded;
  if (!t) return null;
  const meta = TIERS[t];
  return (
    <span className={`tier-badge tier-${t}`} title={`درجة ${meta.name}`} aria-label={`درجة ${meta.name}`}>
      {meta.icon}
      {t !== "bronze" && <span className="tier-name">{meta.name}</span>}
    </span>
  );
}
