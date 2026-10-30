"use client";

import { useState } from "react";
import Link from "next/link";
import { useT } from "@/components/LanguageProvider";
import { getClient } from "@/lib/supabase";
import { useRole } from "@/lib/roles";

/** Shown to moderators only; admins already have the admin link and reach /moderation from there. */
export default function ModerationNavLink() {
  const t = useT();
  const [db] = useState(() => getClient());
  const role = useRole(db);
  if (role.loading || !role.isModerator || role.isAdmin) return null;
  return <Link href="/moderation">{t("nav.moderation")}</Link>;
}
