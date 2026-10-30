"use client";

import { useEffect, useState } from "react";
import { getClient } from "@/lib/supabase";
import { useT } from "@/components/LanguageProvider";
import { useRole, isMissingFeature } from "@/lib/roles";
import ReportQueue from "@/components/moderation/ReportQueue";
import ModerationLog from "@/components/moderation/ModerationLog";

export default function ModerationPage() {
  const t = useT();
  const [db] = useState(() => getClient());
  const role = useRole(db);
  const [ready, setReady] = useState<boolean | null>(null);
  const [logReload, setLogReload] = useState(0);
  const allowed = role.isModerator || role.isAdmin;

  useEffect(() => {
    if (!db || !allowed) return;
    let cancelled = false;
    void (async () => {
      const { error } = await db.rpc("is_moderator");
      if (!cancelled) setReady(!error || !isMissingFeature(error.message));
    })();
    return () => {
      cancelled = true;
    };
  }, [db, allowed]);

  return (
    <div className="narrow admin-page">
      <h1>{t("mod.title")}</h1>
      {role.loading && <p className="notice">{t("loading.text")}</p>}
      {!role.loading && !role.userId && <p className="notice">{t("mod.signIn")}</p>}
      {!role.loading && role.userId && !allowed && <p className="notice">{t("mod.only")}</p>}
      {allowed && db && ready === false && <p className="notice">{t("mod.notReady")}</p>}
      {allowed && db && ready && (
        <>
          <h2>{t("mod.reportsTitle")}</h2>
          <ReportQueue db={db} onAction={() => setLogReload((n) => n + 1)} />
          <h2>{role.isAdmin ? t("mod.log") : t("mod.myLog")}</h2>
          <ModerationLog db={db} reload={logReload} />
        </>
      )}
    </div>
  );
}
