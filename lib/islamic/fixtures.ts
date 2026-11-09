import type { AdminExtras, Workspace } from "./types";

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
      status: "published",
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

export const TEST_ADMIN_EXTRAS: AdminExtras = {
  audit: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      actor_id: null,
      actor_email: "sheikh.test@example.invalid",
      action: "add_lesson",
      entity_type: "lesson",
      entity_id: "22222222-2222-4222-8222-222222222222",
      meta: { status: "published" },
      created_at: "2026-11-09T19:10:00.000Z",
    },
    {
      id: "55555555-5555-4555-8555-555555555555",
      actor_id: null,
      actor_email: "sadeekkasem@gmail.com",
      action: "set_sheikh_status",
      entity_type: "sheikh",
      entity_id: "11111111-1111-4111-8111-111111111111",
      meta: { status: "draft" },
      created_at: "2026-11-09T18:40:00.000Z",
    },
    {
      id: "66666666-6666-4666-8666-666666666666",
      actor_id: null,
      actor_email: "sadeekkasem@gmail.com",
      action: "invite",
      entity_type: "invitation",
      entity_id: "33333333-3333-4333-8333-333333333333",
      meta: { role: "sheikh" },
      created_at: "2026-11-09T18:35:00.000Z",
    },
  ],
  accounts: [
    {
      email: "sadeekkasem@gmail.com",
      role: "admin",
      sheikh_id: null,
      created_at: "2026-11-09T17:00:00.000Z",
      last_sign_in_at: "2026-11-09T19:00:00.000Z",
      user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    },
    {
      email: "sheikh.test@example.invalid",
      role: "sheikh",
      sheikh_id: "11111111-1111-4111-8111-111111111111",
      created_at: "2026-11-09T18:36:00.000Z",
      last_sign_in_at: null,
      user_id: null,
    },
  ],
  siteContent: [
    { key: "hero_eyebrow", value: "قراءة وذكر، بخطوات مطمئنة", published: true },
    { key: "hero_title", value: "مساحة هادئة.\nللقرآن والذكر.", published: true },
    { key: "hero_lead", value: "القرآن الكريم كاملًا بنصّ موثّق مع تفسير الجلالين، وتلاوة اختيارية، وأذكار من حصن المسلم، ومواقيت الصلاة واتجاه القبلة — بلا حسابات ولا إعلانات.", published: true },
    { key: "hero_image_url", value: "/img/kaaba-800.webp", published: true },
    { key: "hero_image_alt", value: "الكعبة والمسجد الحرام في مكة المكرمة عند الغسق", published: true },
    { key: "hero_caption_place", value: "مكة المكرمة", published: true },
    { key: "hero_caption_title", value: "الكعبة · المسجد الحرام", published: true },
    { key: "hero_caption_credit", value: "تصوير Neo Evenger / Pexels", published: true },
  ],
  stats: {
    source: "fixtures",
    note: "أرقام اختبار وهمية — ليست زيارات حقيقية.",
    daily: [
      { day: "2026-11-07", views: 12, visitors: 9 },
      { day: "2026-11-08", views: 21, visitors: 16 },
      { day: "2026-11-09", views: 34, visitors: 25 },
    ],
    paths: [
      { path: "/", views: 41 },
      { path: "/sheikhs", views: 16 },
      { path: "/sources", views: 10 },
    ],
  },
};
