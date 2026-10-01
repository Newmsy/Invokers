// Writes the change notes for a new game update: compares the previous data pack with the current one and saves
// src/data/updates/<new version>.json, which the Updates page lists.
//
//   npm run update-notes                    previous = data/ as committed at HEAD, current = data/ on disk
//   npm run update-notes -- --from <ref>    previous = data/ at a git ref (e.g. origin/main, a commit, a tag)
//   npm run update-notes -- --from-dir <d>  previous = a folder holding an older export
//   --force                                 write even if both packs report the same game version
//
// Run it in the export's PR, after the new files are in data/ and before merging.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { changeCount, diffPacks, type PackFiles } from '../src/lib/updates/diff.ts';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(site, '..');
const files = {
  manifest: 'manifest.json',
  heroes: 'heroes.json',
  skills: 'skills.json',
  skillCosts: 'skill_costs.json',
  sets: 'sets.json',
  items: 'items.json',
  trophies: 'trophies.json',
  bosses: 'bosses.json',
} as const;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function load(read: (file: string) => string | undefined): PackFiles {
  const pack: Record<string, unknown> = {};
  for (const [key, file] of Object.entries(files)) {
    const text = read(file);
    if (text !== undefined) pack[key] = JSON.parse(text);
  }
  if (!pack.manifest) throw new Error('No manifest.json in that pack');
  return pack as unknown as PackFiles;
}

const fromDir = (dir: string) => (file: string) => {
  const path = join(dir, file);
  return existsSync(path) ? readFileSync(path, 'utf8') : undefined;
};

const fromGit = (ref: string) => (file: string) => {
  try {
    return execFileSync('git', ['show', `${ref}:data/${file}`], { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return undefined;
  }
};

const prevDir = arg('--from-dir');
const prev = load(prevDir ? fromDir(resolve(prevDir)) : fromGit(arg('--from') ?? 'HEAD'));
const next = load(fromDir(join(repo, 'data')));

if (prev.manifest.gameVersion === next.manifest.gameVersion && !process.argv.includes('--force')) {
  console.log(`Both packs are game version ${next.manifest.gameVersion}; nothing to write (use --force to compare anyway).`);
  process.exit(0);
}

const notes = diffPacks(prev, next);
const out = join(site, 'src/data/updates', `${notes.to}.json`);
writeFileSync(out, JSON.stringify(notes, null, 2) + '\n');
console.log(`${notes.from} → ${notes.to}: ${changeCount(notes)} changes, written to ${out.slice(repo.length + 1)}`);
