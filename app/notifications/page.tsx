import type { Metadata } from "next";
import NotificationsList from "@/components/NotificationsList";

export const metadata: Metadata = { title: "الإشعارات | SkillPost", robots: { index: false } };

export default function NotificationsPage() {
  return <NotificationsList />;
}
