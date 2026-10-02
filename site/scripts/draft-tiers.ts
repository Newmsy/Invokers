// Seeds src/data/tiers.json with draft tiers scored from the data pack (see src/lib/tiers). The tiers are
// Newms's call: edit tiers.json by hand, moving slugs between tiers, and set "draft" to false when they're
// final. This script won't overwrite an existing file unless you pass --force.
//
//   node scripts/draft-tiers.ts            write tiers.json if it doesn't exist
//   node scripts/draft-tiers.ts --force    replace it with a fresh draft
//   node scripts/draft-tiers.ts --print    print the draft without writing
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { heroCandidates, titanCandidates } from '../src/lib/tiers/candidates.ts';
import { scoreList, tierLists, tierNames, toTiers } from '../src/lib/tiers/lists.ts';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => JSON.parse(readFileSync(resolve(site, '../data', file), 'utf8'));
const heroes = read('heroes.json');
const skills = read('skills.json');
const out = resolve(site, 'src/data/tiers.json');

const pools = { invokers: heroCandidates(heroes, skills), titans: titanCandidates(heroes, skills) };
const doc = {
  draft: true,
  ...Object.fromEntries(
    Object.entries(pools).map(([kind, candidates]) => [
      kind,
      Object.fromEntries(tierLists.map((l) => [l.id, toTiers(scoreList(l, candidates))])),
    ]),
  ),
};

if (process.argv.includes('--print')) {
  for (const kind of Object.keys(pools) as (keyof typeof pools)[]) {
    for (const l of tierLists) {
      const t = (doc as unknown as Record<string, Record<string, Record<string, string[]>>>)[kind][l.id];
      console.log(`${kind} · ${l.label}: ${tierNames.slice(0, 2).map((n) => `${n} ${t[n].join(', ')}`).join(' | ')}`);
    }
  }
} else if (existsSync(out) && !process.argv.includes('--force')) {
  console.error('tiers.json already exists; pass --force to replace it with a fresh draft.');
  process.exit(1);
} else {
  // One line per tier, so moving a pick is cutting a name from one line and pasting it into another.
  const text = JSON.stringify(doc, null, 2).replace(/\[\n\s*("[^\]]*?")\n\s*\]/g, (_, body: string) => `[${body.replace(/,\n\s*/g, ', ')}]`);
  writeFileSync(out, `${text}\n`);
  console.log(`Wrote ${out}`);
}
