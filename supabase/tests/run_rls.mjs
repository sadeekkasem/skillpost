import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const stubs = fs.readFileSync(path.join(here, "local_auth_stubs.sql"), "utf8");
const migrations = [
  "20261109220000_islamic_schema.sql",
  "20261109223000_islamic_admin_extensions.sql",
].map((name) => fs.readFileSync(path.join(root, "supabase/migrations", name), "utf8"));

const db = new PGlite({ extensions: { pgcrypto } });
const results = [];

async function exec(sql) {
  return db.exec(sql);
}
async function query(sql) {
  const r = await db.query(sql);
  return r.rows;
}

function rec(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}

async function setIdentity(uid, email, confirmed) {
  const claims = {
    sub: uid,
    email,
    role: "authenticated",
  };
  if (confirmed) claims.email_confirmed_at = "2026-01-01T00:00:00Z";
  await exec(`SELECT set_config('request.jwt.claims', ${literal(JSON.stringify(claims))}, false)`);
}

function literal(s) {
  return "'" + String(s).replaceAll("'", "''") + "'";
}

async function asRole(role, fn) {
  await exec(`SET ROLE ${role}`);
  try {
    return await fn();
  } finally {
    await exec("RESET ROLE");
  }
}

try {
  await exec(stubs);
  for (const migration of migrations) await exec(migration);
  rec("migration_applies", true);
} catch (e) {
  rec("migration_applies", false, String(e));
  console.error(e);
  process.exit(1);
}

const adminEmail = "sadeekkasem@gmail.com";
const A1 = "00000000-0000-0000-0000-0000000000a1";
const A2 = "00000000-0000-0000-0000-0000000000a2";
const A3 = "00000000-0000-0000-0000-0000000000a3";
const S1 = "00000000-0000-0000-0000-0000000000b1";
const S2 = "00000000-0000-0000-0000-0000000000b2";
const T1 = "00000000-0000-0000-0000-0000000000c1";
const X1 = "00000000-0000-0000-0000-0000000000d1";

await exec(`
INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
  ('${A1}', '${adminEmail}', '2026-01-01'),
  ('${A2}', '${adminEmail}', '2026-01-01'),
  ('${A3}', '${adminEmail}', NULL),
  ('${S1}', 'sheikh1@example.test', '2026-01-01'),
  ('${S2}', 'sheikh2@example.test', '2026-01-01'),
  ('${T1}', 'student1@example.test', '2026-01-01'),
  ('${X1}', 'other@example.test', '2026-01-01');
`);

// allowlist seeded
const seeded = await query(`SELECT email FROM islamic.admin_emails`);
rec("admin_emails_seeded", seeded.some((r) => r.email === adminEmail), JSON.stringify(seeded));

await setIdentity(A1, adminEmail, true);
let rows = await query(`SELECT islamic.is_admin() AS ok`);
rec("admin_by_email_with_existing_user", rows[0]?.ok === true);

await setIdentity(A2, adminEmail, true);
rows = await query(`SELECT islamic.is_admin() AS ok`);
rec("admin_by_email_without_old_user_row_in_staff_roles", rows[0]?.ok === true);

await setIdentity(A3, adminEmail, false);
rows = await query(`SELECT islamic.is_admin() AS ok`);
rec("unconfirmed_allowlist_email_is_not_admin", rows[0]?.ok === false);

await setIdentity(X1, "other@example.test", true);
rows = await query(`SELECT islamic.is_admin() AS ok`);
rec("unrelated_user_is_not_admin", rows[0]?.ok === false);

// Admin A2 creates two sheikhs
await setIdentity(A2, adminEmail, true);
let created;
try {
  created = (await query(`SELECT islamic.admin_create_sheikh('شيخ أول', 'sheikh1@example.test', 'https://www.youtube.com/@one') AS j`))[0].j;
  rec("admin_create_sheikh", Boolean(created.sheikh_id), JSON.stringify(created));
} catch (e) {
  rec("admin_create_sheikh", false, String(e));
  process.exit(1);
}
const sheikhId = created.sheikh_id;
const created2 = (await query(`SELECT islamic.admin_create_sheikh('شيخ ثان', 'sheikh2@example.test', '') AS j`))[0].j;
const sheikhId2 = created2.sheikh_id;

await query(`SELECT islamic.admin_set_sheikh_status('${sheikhId}'::uuid, 'published')`);
const pub = await query(`SELECT status FROM islamic.sheikhs WHERE id = '${sheikhId}'`);
rec("admin_can_publish", pub[0]?.status === "published");

// Accept invitations as sheikhs
await setIdentity(S1, "sheikh1@example.test", true);
await query(`SELECT islamic.accept_pending_invitations()`);
await setIdentity(S2, "sheikh2@example.test", true);
await query(`SELECT islamic.accept_pending_invitations()`);
const roles = await query(`SELECT user_id::text, role::text, sheikh_id::text FROM islamic.staff_roles`);
rec("accept_invites_creates_staff_roles", roles.filter((r) => r.role === "sheikh").length === 2, JSON.stringify(roles));

// Anon sees only published
await exec("RESET ROLE");
await exec(`SELECT set_config('request.jwt.claims', '{}', false)`);
const anonPublished = await asRole("anon", async () => query(`SELECT id::text, status::text FROM islamic.sheikhs`));
rec("anon_reads_only_published_sheikhs", anonPublished.length === 1 && anonPublished[0].id === sheikhId, JSON.stringify(anonPublished));

let anonDraftFail = false;
try {
  await asRole("anon", async () => {
    await query(`SELECT email FROM islamic.sheikh_contacts`);
  });
} catch {
  anonDraftFail = true;
}
// contacts: no grant so permission denied
rec("anon_cannot_read_contacts", anonDraftFail);

let anonInsertFail = false;
try {
  await asRole("anon", async () => {
    await query(`INSERT INTO islamic.sheikhs (name, slug) VALUES ('x','nope')`);
  });
} catch {
  anonInsertFail = true;
}
rec("anon_cannot_insert_sheikh", anonInsertFail);

// Sheikh 1 edits own page
await setIdentity(S1, "sheikh1@example.test", true);
await query(`SELECT islamic.update_sheikh_page('${sheikhId}'::uuid, 'شيخ أول بعد التعديل', 'https://www.youtube.com/@one')`);
const renamed = await query(`SELECT name FROM islamic.sheikhs WHERE id = '${sheikhId}'`);
rec("sheikh_can_edit_own_page", renamed[0]?.name === "شيخ أول بعد التعديل");

let statusDenied = false;
try {
  await asRole("authenticated", async () => {
    await query(`UPDATE islamic.sheikhs SET status = 'hidden' WHERE id = '${sheikhId}'`);
  });
} catch {
  statusDenied = true;
}
const stillPub = await query(`SELECT status::text FROM islamic.sheikhs WHERE id = '${sheikhId}'`);
rec("sheikh_cannot_change_status_via_sql", statusDenied && stillPub[0]?.status === "published", stillPub[0]?.status);

let otherEdit = true;
try {
  await query(`SELECT islamic.update_sheikh_page('${sheikhId2}'::uuid, 'قرصنة', '')`);
  otherEdit = false;
} catch {
  otherEdit = true;
}
rec("sheikh_cannot_edit_other_sheikh", otherEdit);

// Add lesson as sheikh
const lessonId = (await query(`SELECT islamic.add_lesson('${sheikhId}'::uuid, 'مقطع أول', 'AbC_-12345z') AS id`))[0].id;
const lesson = await query(`SELECT status::text, title FROM islamic.lessons WHERE id = '${lessonId}'`);
rec("sheikh_adds_lesson_as_published", lesson[0]?.status === "published");

let sheikhPublish = false;
try {
  await query(`SELECT islamic.admin_set_lesson_status('${lessonId}'::uuid, 'published')`);
  sheikhPublish = true;
} catch {
  sheikhPublish = false;
}
rec("sheikh_can_publish_own_lesson", sheikhPublish === true);

await query(`SELECT islamic.admin_set_lesson_status('${lessonId}'::uuid, 'hidden')`);
const hiddenOwn = await query(`SELECT status::text FROM islamic.lessons WHERE id = '${lessonId}'`);
rec("sheikh_can_hide_own_lesson", hiddenOwn[0]?.status === "hidden");

let sheikhPagePublish = false;
try {
  await query(`SELECT islamic.admin_set_sheikh_status('${sheikhId}'::uuid, 'published')`);
  sheikhPagePublish = true;
} catch {
  sheikhPagePublish = false;
}
rec("sheikh_can_publish_own_page", sheikhPagePublish === true);

await asRole("anon", async () => {
  const seen = await query(`SELECT id FROM islamic.lessons`);
  rec("anon_cannot_see_hidden_lessons", seen.length === 0, String(seen.length));
});

// other sheikh cannot update or publish lesson/page they do not own
await setIdentity(S2, "sheikh2@example.test", true);
let otherLesson = true;
try {
  await query(`SELECT islamic.update_lesson('${lessonId}'::uuid, 'stolen', 'AbC_-12345z')`);
  otherLesson = false;
} catch {
  otherLesson = true;
}
rec("other_sheikh_cannot_edit_lesson", otherLesson);

let otherPublish = true;
try {
  await query(`SELECT islamic.admin_set_lesson_status('${lessonId}'::uuid, 'published')`);
  otherPublish = false;
} catch {
  otherPublish = true;
}
rec("other_sheikh_cannot_publish_lesson", otherPublish);

let otherPage = true;
try {
  await query(`SELECT islamic.admin_set_sheikh_status('${sheikhId}'::uuid, 'hidden')`);
  otherPage = false;
} catch {
  otherPage = true;
}
const pageStill = await query(`SELECT status::text FROM islamic.sheikhs WHERE id = '${sheikhId}'`);
rec("other_sheikh_cannot_change_page_status", otherPage && pageStill[0]?.status === "published", pageStill[0]?.status);

// student invite
await setIdentity(S1, "sheikh1@example.test", true);
const inv = (await query(`SELECT islamic.invite_staff('student1@example.test', 'student', '${sheikhId}'::uuid) AS j`))[0].j;
rec("sheikh_can_invite_one_student", Boolean(inv.invitation_id));

let second = true;
try {
  await query(`SELECT islamic.invite_staff('someone@example.test', 'student', '${sheikhId}'::uuid)`);
  second = false;
} catch {
  second = true;
}
rec("sheikh_cannot_invite_second_student", second);

await setIdentity(T1, "student1@example.test", true);
await query(`SELECT islamic.accept_pending_invitations()`);
await query(`SELECT islamic.update_lesson('${lessonId}'::uuid, 'مقطع بعد مساعدة', 'AbC_-12345z')`);
const updated = await query(`SELECT title FROM islamic.lessons WHERE id = '${lessonId}'`);
rec("student_can_edit_own_sheikh_lesson", updated[0]?.title === "مقطع بعد مساعدة");

await query(`SELECT islamic.admin_set_lesson_status('${lessonId}'::uuid, 'published')`);
const studentPub = await query(`SELECT status::text FROM islamic.lessons WHERE id = '${lessonId}'`);
rec("student_can_publish_own_lesson", studentPub[0]?.status === "published");

await query(`SELECT islamic.admin_set_sheikh_status('${sheikhId}'::uuid, 'published')`);
let studentOther = true;
try {
  await query(`SELECT islamic.admin_set_sheikh_status('${sheikhId2}'::uuid, 'published')`);
  studentOther = false;
} catch {
  studentOther = true;
}
rec("student_cannot_publish_other_page", studentOther);

let studentInvite = true;
try {
  await query(`SELECT islamic.invite_staff('x@example.test', 'student', '${sheikhId}'::uuid)`);
  studentInvite = false;
} catch {
  studentInvite = true;
}
rec("student_cannot_invite", studentInvite);

// revoke test: admin invites extra sheikh email then revokes
await setIdentity(A2, adminEmail, true);
const extra = (await query(`SELECT islamic.invite_staff('extra@example.test', 'sheikh', '${sheikhId2}'::uuid) AS j`))[0].j;
await query(`SELECT islamic.revoke_invitation('${extra.invitation_id}'::uuid)`);
const revoked = await query(`SELECT revoked_at IS NOT NULL AS r FROM islamic.invitations WHERE id = '${extra.invitation_id}'`);
rec("admin_can_revoke_invitation", revoked[0]?.r === true);

// admin publishes lesson; anon sees it only if sheikh published (already is)
await query(`SELECT islamic.admin_set_lesson_status('${lessonId}'::uuid, 'published')`);
await exec(`SELECT set_config('request.jwt.claims', '{}', false)`);
const anonLessons = await asRole("anon", async () => query(`SELECT title FROM islamic.lessons`));
rec("anon_sees_published_lesson_of_published_sheikh", anonLessons.length === 1 && anonLessons[0].title === "مقطع بعد مساعدة", JSON.stringify(anonLessons));

// Phase 4 readers/writers
await setIdentity(S1, "sheikh1@example.test", true);
let sheikhAudit = true;
try {
  await query(`SELECT islamic.admin_list_audit(10)`);
  sheikhAudit = false;
} catch {
  sheikhAudit = true;
}
rec("sheikh_cannot_read_audit", sheikhAudit);

let sheikhAccounts = true;
try {
  await query(`SELECT islamic.admin_list_accounts()`);
  sheikhAccounts = false;
} catch {
  sheikhAccounts = true;
}
rec("sheikh_cannot_read_accounts", sheikhAccounts);

let sheikhContentWrite = true;
try {
  await query(`SELECT islamic.admin_upsert_site_content('hero_eyebrow', 'تغيير غير مسموح', true)`);
  sheikhContentWrite = false;
} catch {
  sheikhContentWrite = true;
}
rec("sheikh_cannot_upsert_site_content", sheikhContentWrite);

await setIdentity(A2, adminEmail, true);
const audit = (await query(`SELECT islamic.admin_list_audit(50) AS j`))[0].j;
rec("admin_can_read_audit", Array.isArray(audit) && audit.length > 0, String(audit?.length));
const accounts = (await query(`SELECT islamic.admin_list_accounts() AS j`))[0].j;
rec("admin_can_read_accounts", Array.isArray(accounts) && accounts.some((a) => a.email === adminEmail && a.role === "admin") && accounts.some((a) => a.role === "sheikh"), JSON.stringify(accounts.map((a) => a.role)));

await query(`SELECT islamic.admin_upsert_site_content('hero_eyebrow', 'قراءة وذكر، بخطوات مطمئنة', true)`);
const content = (await query(`SELECT islamic.admin_list_site_content() AS j`))[0].j;
rec("admin_can_list_site_content", Array.isArray(content) && content.some((c) => c.key === "hero_eyebrow"), String(content?.length));

let badImage = true;
try {
  await query(`SELECT islamic.admin_upsert_site_content('hero_image_url', 'https://evil.example/x.webp', true)`);
  badImage = false;
} catch {
  badImage = true;
}
rec("admin_hero_image_rejects_external_url", badImage);

await exec(`SELECT set_config('request.jwt.claims', '{}', false)`);
const publishedContent = await asRole("anon", async () => query(`SELECT key, value FROM islamic.site_content WHERE key = 'hero_caption_place'`));
rec("anon_reads_published_site_content", publishedContent[0]?.value === "مكة المكرمة", JSON.stringify(publishedContent));

let anonUpsert = true;
try {
  await asRole("anon", async () => query(`SELECT islamic.admin_upsert_site_content('hero_eyebrow', 'x', true)`));
  anonUpsert = false;
} catch {
  anonUpsert = true;
}
rec("anon_cannot_upsert_site_content", anonUpsert);

await asRole("anon", async () => {
  await query(`SELECT islamic.record_page_view('/')`);
  await query(`SELECT islamic.record_page_view('/sources')`);
  await query(`SELECT islamic.record_page_view('https://evil.example')`);
});
const views = await query(`SELECT path, views FROM islamic.page_views ORDER BY path`);
rec("anon_can_record_sanitized_page_views", views.length === 2 && views.every((v) => Number(v.views) >= 1), JSON.stringify(views));

let anonReadViews = true;
try {
  await asRole("anon", async () => query(`SELECT * FROM islamic.page_views`));
  anonReadViews = false;
} catch {
  anonReadViews = true;
}
rec("anon_cannot_read_page_views_table", anonReadViews);

await setIdentity(A2, adminEmail, true);
const stats = (await query(`SELECT islamic.admin_page_views(14) AS j`))[0].j;
rec("admin_can_read_page_views", stats?.source === "counters" && Array.isArray(stats.paths) && stats.paths.length >= 1, JSON.stringify(stats));

const failed = results.filter((r) => !r.ok);
console.log(`TOTAL ${results.length} FAILURES ${failed.length}`);
if (failed.length) process.exit(1);
