// CI check after a build: every link from one page of the site to another (and to an #anchor on it) must
// lead somewhere. Usage: node scripts/check-links.ts [base path, default /]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const base = (process.argv[2] ?? process.env.BASE_PATH ?? '/').replace(/\/?$/, '/');

const pages: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.html')) pages.push(p);
  }
};
walk(dist);

const ids = new Map<string, Set<string>>();
const idsOf = (file: string) => {
  if (!ids.has(file)) ids.set(file, new Set([...readFileSync(file, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  return ids.get(file)!;
};

/** The built file a site path points at, if any. */
function target(path: string): string | undefined {
  const local = decodeURIComponent(path.slice(base.length)).replace(/\/$/, '');
  for (const f of [join(dist, local), join(dist, local, 'index.html'), join(dist, `${local}.html`)]) {
    if (existsSync(f) && statSync(f).isFile()) return f;
  }
  return undefined;
}

const broken: string[] = [];
let checked = 0;
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  for (const [, raw] of html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)) {
    const url = raw.replace(/&amp;/g, '&');
    if (/^[a-z]+:|^\/\//i.test(url)) continue;
    const [pathAndQuery, hash] = url.split('#');
    const path = pathAndQuery.split('?')[0];
    const from = `/${relative(dist, page)}`;
    if (!path) {
      if (hash && !idsOf(page).has(hash)) broken.push(`${from}: #${hash} (no such anchor)`);
      continue;
    }
    checked++;
    if (!path.startsWith(base)) {
      broken.push(`${from}: ${url} (outside ${base})`);
      continue;
    }
    const file = target(path);
    if (!file) broken.push(`${from}: ${url}`);
    else if (hash && file.endsWith('.html') && !idsOf(file).has(hash)) broken.push(`${from}: ${url} (no such anchor)`);
  }
}

if (broken.length) {
  console.error(`${broken.length} broken internal links:\n${[...new Set(broken)].join('\n')}`);
  process.exit(1);
}
console.log(`All ${checked} internal links across ${pages.length} pages resolve.`);
