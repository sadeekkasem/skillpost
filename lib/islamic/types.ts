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

export type Workspace = {
  role: StaffRole | null;
  sheikhs?: SheikhRecord[];
  sheikh?: SheikhRecord | null;
  lessons: LessonRecord[];
  invitations: InvitationRecord[];
};
