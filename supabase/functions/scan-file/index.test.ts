// Run: SCAN_FILE_TEST=1 deno test --allow-read --allow-env supabase/functions/scan-file/index.test.ts
// Optional: SCAN_SAMPLES=<dir> (default ./samples); generate them with make_samples.py
import { checkFile } from "./index.ts";
const dir = Deno.env.get("SCAN_SAMPLES") ?? new URL("./samples/", import.meta.url).pathname;
const cases: [string, boolean][] = [
  ["clean.xlsx", true], ["vba.xlsx", false], ["extlinks.xlsx", false], ["exe_renamed.xlsx", false],
  ["hyperlink.csv", false], ["clean.csv", true], ["image.png", true], ["js.pdf", false], ["clean.pdf", true],
  ["obfuscated.pdf", false], ["fake.png", false],
];
for (const [f, expectOk] of cases) {
  Deno.test(`${f} -> ${expectOk ? "clean" : "rejected"}`, () => {
    const r = checkFile(f, Deno.readFileSync(dir + f));
    console.log(f, r.ok ? "clean" : "rejected: " + r.note);
    if (r.ok !== expectOk) throw new Error(`${f}: expected ${expectOk}, got ${JSON.stringify(r)}`);
  });
}
