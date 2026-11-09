export type PublishStatus = "draft" | "published" | "hidden";
export type StaffRole = "admin" | "sheikh" | "student";

export type SheikhRecord = {
  id: string;
  name: string;
  slug: string;
  youtube_channel_url: string | null;
  status: PublishStatus;
  email?: string;
};

export type LessonRecord = {
  id: string;
  sheikh_id: string;
  title: string;
  youtube_video_id: string;
  status: PublishStatus;
};

export type InvitationRecord = {
  id: string;
  email: string;
  role: StaffRole;
  sheikh_id: string;
  expires_at: string;
  revoked_at: string | null;
  accepted_at: string | null;
};

export type AuditRecord = {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

export type AccountRecord = {
  email: string;
  role: string;
  sheikh_id: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  user_id: string | null;
};

export type SiteContentRecord = {
  key: string;
  value: string;
  published: boolean;
  updated_at?: string;
};

export type VisitorPoint = { day: string; views: number; visitors?: number };
export type PathPoint = { path: string; views: number; visitors?: number };

export type VisitorStats = {
  source: "vercel" | "counters" | "fixtures";
  note: string;
  daily: VisitorPoint[];
  paths: PathPoint[];
};

export type Workspace = {
  role: StaffRole | null;
  sheikhs?: SheikhRecord[];
  sheikh?: SheikhRecord | null;
  lessons: LessonRecord[];
  invitations: InvitationRecord[];
};

export type AdminExtras = {
  audit: AuditRecord[];
  accounts: AccountRecord[];
  siteContent: SiteContentRecord[];
  stats: VisitorStats;
};
