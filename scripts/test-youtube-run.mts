import assert from "node:assert/strict";
import { parseYouTube, parseYouTubeChannel, parseLessonVideoId } from "../lib/youtube.ts";

const ID = "AbC_-12345z";
const L = "PLabcdefghij_KLMNOP-123";
const ok: [string, "video" | "playlist", string][] = [
  [`https://www.youtube.com/watch?v=${ID}`, "video", ID],
  [`http://youtube.com/watch?v=${ID}&t=30s`, "video", ID],
  [`https://m.youtube.com/watch?v=${ID}`, "video", ID],
  [`youtube.com/watch?feature=share&v=${ID}`, "video", ID],
  [`https://youtu.be/${ID}?si=xyz`, "video", ID],
  [`youtu.be/${ID}`, "video", ID],
  [`https://www.youtube.com/shorts/${ID}`, "video", ID],
  [`https://www.youtube.com/embed/${ID}?start=5`, "video", ID],
  [`https://www.youtube-nocookie.com/embed/${ID}`, "video", ID],
  [`https://youtube.com/live/${ID}?feature=share`, "video", ID],
  [`//www.youtube.com/watch?v=${ID}`, "video", ID],
  [`HTTPS://WWW.YOUTUBE.COM/watch?v=${ID}`, "video", ID],
  [`https://www.youtube.com/watch?v=${ID}&list=${L}`, "video", ID],
  [`https://www.youtube.com/playlist?list=${L}`, "playlist", L],
  [`https://www.youtube.com/watch?list=${L}`, "playlist", L],
  [`https://www.youtube.com/embed/videoseries?list=${L}`, "playlist", L],
  [`https://www.youtube-nocookie.com/embed/videoseries?list=${L}`, "playlist", L],
  [`https://m.youtube.com/playlist?list=${L}`, "playlist", L],
];
const bad: [string, string][] = [
  ["", "الصق"],
  ["   ", "الصق"],
  ["javascript:alert(1)", "javascript"],
  ["JavaScript:alert(document.domain)", "javascript"],
  ["data:text/html,<b>x</b>", "data"],
  ["ftp://youtube.com/watch?v=" + ID, "http"],
  ["vbscript:msgbox", "http"],
  ["https://youtube.com.evil.com/watch?v=" + ID, "ليس من YouTube"],
  ["https://evil.com/?u=https://youtube.com/watch?v=" + ID, "ليس من YouTube"],
  ["https://notyoutube.com/watch?v=" + ID, "ليس من YouTube"],
  ["https://youtube.co/watch?v=" + ID, "ليس من YouTube"],
  ["https://youtu.be.evil.org/" + ID, "ليس من YouTube"],
  ["https://www.youtube.com@evil.com/watch?v=" + ID, "مرفوض"],
  ["https://user:pw@youtube.com/watch?v=" + ID, "بيانات دخول"],
  ["https://youtube.com:8080/watch?v=" + ID, "منفذ"],
  ["https://www.youtube.com/@SomeHandle", "قناة"],
  ["https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv", "قناة"],
  ["https://www.youtube.com/c/SomeName", "قناة"],
  ["https://www.youtube.com/user/someone", "قناة"],
  ["https://www.youtube.com/watch?v=short", "11 حرفًا"],
  ["https://www.youtube.com/watch?v=" + ID + "X", "11 حرفًا"],
  ["https://youtu.be/" + ID.slice(0, 10) + "$", "11 حرفًا"],
  ["https://www.youtube.com/watch?v=<script>", "11 حرفًا"],
  ["https://www.youtube.com/playlist?list=abc", "قائمة التشغيل غير صالح"],
  ["https://www.youtube.com/playlist?list=" + "a".repeat(65), "قائمة التشغيل غير صالح"],
  ["https://www.youtube.com/", "لم يُعثر"],
  ["https://www.youtube.com/feed/trending", "لم يُعثر"],
  ["https://www.youtube-nocookie.com/watch?v=" + ID, "لم يُعثر"],
  ["not a url at all", "ليس رابطًا"],
  ["http://", "ليس رابطًا"],
  ["https://www.youtube.com/watch?v=" + ID + " extra", "ليس رابطًا"],
];

let n = 0;
for (const [u, k, id] of ok) {
  const r = parseYouTube(u);
  assert.equal(r.ok, true, `should accept ${u} got ${JSON.stringify(r)}`);
  if (r.ok) {
    assert.equal(r.kind, k, u);
    assert.equal(r.id, id, u);
    assert.equal(r.embed, k === "video" ? `https://www.youtube-nocookie.com/embed/${id}` : `https://www.youtube-nocookie.com/embed/videoseries?list=${id}`);
  }
  n++;
}
for (const [u, frag] of bad) {
  const r = parseYouTube(u);
  assert.equal(r.ok, false, `should reject ${u}`);
  if (!r.ok) {
    assert.ok(r.error.includes(frag), `${u} -> ${r.error}`);
    assert.ok(/[\u0600-\u06FF]/.test(r.error));
  }
  n++;
}

const channelsOk = [
  ["https://www.youtube.com/@SomeHandle", "@SomeHandle", "https://www.youtube.com/@SomeHandle"],
  ["youtube.com/@SomeHandle", "@SomeHandle", "https://www.youtube.com/@SomeHandle"],
  ["https://m.youtube.com/@SomeHandle", "@SomeHandle", "https://www.youtube.com/@SomeHandle"],
  ["https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv", "UCabcdefghijklmnopqrstuv", "https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv"],
  ["https://www.youtube.com/c/SomeName", "c/SomeName", "https://www.youtube.com/c/SomeName"],
  ["https://www.youtube.com/user/someone", "user/someone", "https://www.youtube.com/user/someone"],
];
for (const [u, id, url] of channelsOk) {
  const r = parseYouTubeChannel(u);
  assert.equal(r.ok, true, `channel should accept ${u} ${JSON.stringify(r)}`);
  if (r.ok) {
    assert.equal(r.kind, "channel");
    assert.equal(r.id, id);
    assert.equal(r.url, url);
  }
  n++;
}
const channelsBad: [string, string][] = [
  [`https://www.youtube.com/watch?v=${ID}`, "فيديو"],
  [`https://youtu.be/${ID}`, "فيديو"],
  ["javascript:alert(1)", "javascript"],
  ["https://evil.com/@x", "ليس من YouTube"],
];
for (const [u, frag] of channelsBad) {
  const r = parseYouTubeChannel(u);
  assert.equal(r.ok, false, `channel should reject ${u}`);
  if (!r.ok) assert.ok(r.error.includes(frag), `${u} -> ${r.error}`);
  n++;
}

const lesson = parseLessonVideoId(`https://youtu.be/${ID}`);
assert.equal(lesson.ok, true);
if (lesson.ok) assert.equal(lesson.id, ID);
const lessonList = parseLessonVideoId(`https://www.youtube.com/playlist?list=${L}`);
assert.equal(lessonList.ok, false);
n += 2;

console.log(`PASS youtube parser (${n} cases) including ${channelsOk.length} channel formats`);
