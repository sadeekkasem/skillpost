import assert from "node:assert/strict";
import { ADMIN_ALERT_EMAIL, buildLessonAlert, notifyNewLesson } from "../lib/islamic/alerts.ts";

let n = 0;
const info = { title: "مقطع اختبار وهمي", videoId: "AbC_-12345z", sheikhId: "11111111-1111-4111-8111-111111111111" };

delete process.env.ISLAMIC_LESSON_ALERTS;
delete process.env.RESEND_API_KEY;
delete process.env.ALERT_FROM;
let called = 0;
const resultOff = await notifyNewLesson(info, async () => {
  called += 1;
});
assert.equal(resultOff.sent, false);
assert.equal(called, 0);
n += 1;

process.env.ISLAMIC_LESSON_ALERTS = "true";
process.env.RESEND_API_KEY = "re_test_mock_not_real";
process.env.ALERT_FROM = "نور الإسلام <alerts@noorislamsite.com>";

const mail = buildLessonAlert(info);
assert.deepEqual(mail.to, [ADMIN_ALERT_EMAIL]);
assert.equal(mail.to.length, 1);
assert.ok(mail.subject.includes("مقطع اختبار وهمي"));
assert.ok(mail.text.includes(info.videoId));
n += 1;

const sent = [];
const resultOn = await notifyNewLesson(info, async (payload) => {
  sent.push(payload);
});
assert.equal(resultOn.sent, true);
assert.equal(sent.length, 1);
assert.deepEqual(sent[0].to, [ADMIN_ALERT_EMAIL]);
assert.equal(sent[0].from, "نور الإسلام <alerts@noorislamsite.com>");
n += 1;

console.log(`PASS lesson alert mocks (${n} cases); recipient is admin only; no network call`);
