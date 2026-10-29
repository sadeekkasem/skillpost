"use client";

import { useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthNavLink from "@/components/AuthNavLink";
import AdminNavLink from "@/components/AdminNavLink";
import NotificationBell from "@/components/NotificationBell";

export default function HeaderNav() {
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
      <button
        type="button"
        className="menu-toggle"
        aria-label={"\u0627\u0644\u0642\u0627\u0626\u0645\u0629"}
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "\u2715" : "\u2630"}
      </button>
      <nav id="site-nav" className={open ? "open" : undefined} onClick={closeOnLink}>
      <span className="nav-item"><Link href="/">المشاريع</Link></span>
      <span className="nav-item"><Link href="/projects/new">نشر مشروع</Link></span>
      <span className="nav-item"><Link href="/challenges">التحديات</Link></span>
      <span className="nav-item"><Link href="/search" aria-label="البحث">🔍 بحث</Link></span>
      <span className="nav-item"><Link href="/friends">الأصدقاء</Link></span>
      <AuthNavLink />
      <span className="nav-item"><AdminNavLink /></span>
      <NotificationBell />
      <span className="nav-item"><Link href="/setup">التجهيز</Link></span>
      </nav>
    </>
  );
}