import type { Workspace } from "./types";

export const TEST_WORKSPACE: Workspace = {
  role: "admin",
  sheikhs: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "شيخ اختبار أول (ليس حقيقيًا)",
      slug: "test-sheikh-one",
      youtube_channel_url: "https://www.youtube.com/@exampleTestChannel",
      status: "draft",
      email: "sheikh.test@example.invalid",
    },
  ],
  lessons: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      sheikh_id: "11111111-1111-4111-8111-111111111111",
      title: "مقطع اختبار ١ — بيانات وهمية",
      youtube_video_id: "AbC_-12345z",
      status: "draft",
    },
  ],
  invitations: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      email: "sheikh.test@example.invalid",
      role: "sheikh",
      sheikh_id: "11111111-1111-4111-8111-111111111111",
      expires_at: "2099-01-01T00:00:00.000Z",
      revoked_at: null,
      accepted_at: null,
    },
  ],
};
