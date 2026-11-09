// ESM tests import the TypeScript source via Next/tsx-less approach:
// re-implement assertions by spawning node with experimental strip types when available.
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const runner = path.join(here, 'test-youtube-run.mts');
const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', runner], { stdio: 'inherit' });
if (r.status !== 0) {
  const r2 = spawnSync('npx', ['--yes', 'tsx', runner], { stdio: 'inherit' });
  process.exit(r2.status ?? 1);
}
