import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const stubs = fs.readFileSync(path.join(here, "local_auth_stubs.sql"), "utf8");
const migrationNames = ["20261121120000_hifz_companion.sql"];
const migrations = migrationNames.map((name) => fs.readFileSync(path.join(root, "supabase/migrations", name), "utf8"));

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
function literal(s) {
  return "'" + String(s).replaceAll("'", "''") + "'";
}
async function setIdentity(uid, email) {
  const claims = { sub: uid, email, role: "authenticated", email_confirmed_at: "2026-01-01T00:00:00Z" };
  await exec(`SELECT set_config('request.jwt.claims', ${literal(JSON.stringify(claims))}, false)`);
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
  rec("all_migrations_apply", true, migrationNames.join(", "));
} catch (e) {
  rec("all_migrations_apply", false, String(e));
  console.error(e);
  process.exit(1);
}

const A = "00000000-0000-0000-0000-0000000000a1";
const B = "00000000-0000-0000-0000-0000000000b1";
await exec(`
INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
  ('${A}', 'a@example.test', '2026-01-01'),
  ('${B}', 'b@example.test', '2026-01-01');
`);

await setIdentity(A, "a@example.test");
await asRole("authenticated", async () => {
  await query(`INSERT INTO hifz_profiles (user_id, timezone) VALUES ('${A}', 'Europe/Helsinki')`);
  await query(`INSERT INTO hifz_plans (user_id, goal, amount_unit, amount_value, start_surah, start_ayah, memorize_weekdays) VALUES ('${A}', 'new', 'ayat', 5, 1, 1, '{1,2,3,4,5}')`);
  await query(`INSERT INTO hifz_segments (user_id, start_surah, start_ayah, end_surah, end_ayah, status) VALUES ('${A}', 1, 1, 1, 7, 'memorized')`);
  await query(`INSERT INTO hifz_daily_logs (user_id, log_date, new_completed) VALUES ('${A}', '2026-11-21', true)`);
  await query(`INSERT INTO hifz_streaks (user_id, current_streak, longest_streak, last_active_date) VALUES ('${A}', 1, 1, '2026-11-21')`);
});
rec("user_a_can_insert_own_rows", true);

await setIdentity(B, "b@example.test");
const bPlans = await asRole("authenticated", async () => query(`SELECT id FROM hifz_plans`));
const bSegs = await asRole("authenticated", async () => query(`SELECT id FROM hifz_segments`));
const bLogs = await asRole("authenticated", async () => query(`SELECT id FROM hifz_daily_logs`));
const bStreaks = await asRole("authenticated", async () => query(`SELECT user_id FROM hifz_streaks`));
const bProfiles = await asRole("authenticated", async () => query(`SELECT user_id FROM hifz_profiles`));
rec("user_b_cannot_read_user_a_plans", bPlans.length === 0, JSON.stringify(bPlans));
rec("user_b_cannot_read_user_a_segments", bSegs.length === 0, JSON.stringify(bSegs));
rec("user_b_cannot_read_user_a_logs", bLogs.length === 0, JSON.stringify(bLogs));
rec("user_b_cannot_read_user_a_streaks", bStreaks.length === 0, JSON.stringify(bStreaks));
rec("user_b_cannot_read_user_a_profiles", bProfiles.length === 0, JSON.stringify(bProfiles));

let steal = false;
try {
  await asRole("authenticated", async () => {
    await query(`INSERT INTO hifz_plans (user_id, goal, amount_unit, amount_value, start_surah, start_ayah) VALUES ('${A}', 'new', 'ayat', 5, 2, 1)`);
  });
} catch {
  steal = true;
}
rec("user_b_cannot_insert_as_user_a", steal);

await setIdentity(A, "a@example.test");
const aPlans = await asRole("authenticated", async () => query(`SELECT goal::text, amount_value FROM hifz_plans`));
rec("user_a_reads_own_plan", aPlans.length === 1 && aPlans[0].goal === "new" && aPlans[0].amount_value === 5, JSON.stringify(aPlans));

let anonRead = false;
try {
  await exec(`SELECT set_config('request.jwt.claims', '{}', false)`);
  await asRole("anon", async () => query(`SELECT id FROM hifz_plans`));
  anonRead = true;
} catch {
  anonRead = false;
}
rec("anon_cannot_read_hifz_plans", !anonRead);

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(failed.length + " RLS checks failed");
  process.exit(1);
}
console.log("All hifz RLS checks passed (" + results.length + ")");
