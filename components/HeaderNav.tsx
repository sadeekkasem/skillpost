"use client";


import { useT } from "@/components/LanguageProvider";
import { useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthNavLink from "@/components/AuthNavLink";
import AdminNavLink from "@/components/AdminNavLink";
import ModerationNavLink from "@/components/ModerationNavLink";
import NotificationBell from "@/components/NotificationBell";
import LanguageToggle from "@/components/LanguageToggle";

export default function HeaderNav() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function closeOnLink(event: MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("a")) setOpen(false);
  }

  return (
    <>
      <LanguageToggle />
      <NotificationBell />
      <button
        type="button"
        className="menu-toggle"
        aria-label={t("nav.menu")}
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "\u2715" : "\u2630"}
      </button>
      <nav id="site-nav" className={open ? "open" : undefined} onClick={closeOnLink}>
      <span className="nav-item"><Link href="/">{t("nav.projects")}</Link></span>
      <span className="nav-item"><Link href="/projects/new">{t("nav.newProject")}</Link></span>
      <span className="nav-item"><Link href="/challenges">{t("nav.challenges")}</Link></span>
      <span className="nav-item"><Link href="/search" aria-label={t("nav.searchLabel")}>{t("nav.search")}</Link></span>
      <span className="nav-item"><Link href="/videos">{t("nav.videos")}</Link></span>
      <span className="nav-item"><Link href="/friends">{t("nav.friends")}</Link></span>
      <AuthNavLink />
      <span className="nav-item"><AdminNavLink /></span>
      <span className="nav-item"><ModerationNavLink /></span>
      </nav>
    </>
  );
}