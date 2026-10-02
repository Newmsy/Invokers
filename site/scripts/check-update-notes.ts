// CI check for data export PRs: when data/manifest.json moves to a new game version, that version's change notes
// (src/data/updates/<version>.json) must be in the same PR. Usage: node scripts/check-update-notes.ts <base ref>
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2] ?? 'origin/main';

let before: string;
try {
  before = JSON.parse(execFileSync('git', ['show', `${base}:data/manifest.json`], { cwd: site, encoding: 'utf8' })).gameVersion;
} catch {
  console.log(`No data/manifest.json at ${base}; nothing to check.`);
  process.exit(0);
}
const after: string = JSON.parse(readFileSync(join(site, '../data/manifest.json'), 'utf8')).gameVersion;

if (before === after) {
  console.log(`Game version unchanged (${after}).`);
} else if (existsSync(join(site, 'src/data/updates', `${after}.json`))) {
  console.log(`Change notes for ${before} → ${after} are present.`);
} else {
  console.error(
    `This PR moves the data pack from ${before} to ${after} but has no change notes.\n` +
      `Run \`npm run update-notes -- --from ${base}\` in site/ and commit src/data/updates/${after}.json.`,
  );
  process.exit(1);
}
