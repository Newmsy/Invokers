// Game art. The source files sit in public/art/<kind>/<code>.webp; the site serves copies under
// readable names (img/heroes/<hero-slug>.webp, img/skills/<hero-slug>-skill-1.webp, ...) through
// pages/img/[...path].ts, and the build drops public/art from dist so no code appears in an image URL.
// The glob only lists files; nothing is imported.
import { heroRefsByConfigId, heroes, heroSlug, href, itemName, skillsFor, titans, type HeroRef } from './data';

const sourceFiles = new Set(
  Object.keys(import.meta.glob('../../public/art/**/*.webp')).map((p) => p.replace(/^.*\/public\/art\//, '')),
);

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Served path (under img/) → source path (under public/art/). */
const routes = new Map<string, string>();
const heroArtPath = new Map<string, string>();
const skillIconPath = new Map<string, string>();
const itemIconPath = new Map<string, string>();
const elementIconPath = new Map<string, string>();
const classIconPath = new Map<string, string>();
const titanArtPath = new Map<string, string>();
const heroSplashPath = new Map<string, string>();
const titanSplashPath = new Map<string, string>();

function add(served: string, source: string, index: Map<string, string>, key: string) {
  if (!sourceFiles.has(source) || routes.has(served)) return;
  routes.set(served, source);
  index.set(key, served);
}

// Skill types as the hero page names them (#skill-1, #skill-ultimate), and the source file suffix.
const skillFile: Record<string, string> = { PassiveBonus: 'Passive' };
const skillPart = (type: string) => type.replace(/^ActiveSkill/, '').toLowerCase().replace(/^passivebonus$/, 'passive');

for (const h of heroes) {
  const slug = heroSlug(h.id);
  add(`heroes/${slug}.webp`, `heroes/${h.id}.webp`, heroArtPath, h.id);
  // Full-size character art (issue #66), used for big headers when it exists.
  add(`splash/heroes/${slug}.webp`, `splash/heroes/${h.id}.webp`, heroSplashPath, h.id);
  for (const s of skillsFor(h.id)) {
    add(`skills/${slug}-skill-${skillPart(s.type)}.webp`, `skills/${h.id}_${skillFile[s.type] ?? s.type}.webp`, skillIconPath, `${h.id}/${s.type}`);
  }
}
for (const t of titans) {
  add(`titans/${t.slug}.webp`, `titans/${t.id}.webp`, titanArtPath, t.id);
  add(`splash/titans/${t.slug}.webp`, `splash/titans/${t.id}.webp`, titanSplashPath, t.id);
}
for (const source of sourceFiles) {
  const [kind, file] = source.split('/');
  const code = file?.replace(/\.webp$/, '');
  if (kind === 'items' && code) {
    // Names keep the game's tags ("1 <sprite ...> Echo" is a 1-star Echo); a name that is still a code is skipped.
    const name = itemName(code).replace(/<sprite[^>]*>/g, ' star ').replace(/<[^>]+>/g, '');
    if (!/_/.test(name) || /\s/.test(name)) add(`items/${slugify(name)}.webp`, source, itemIconPath, code);
  }
}
// Every element icon, including Astral (shown on Omnissi), which no Invoker has.
const iconElements = [...sourceFiles].filter((f) => f.startsWith('icons/element/')).map((f) => f.replace(/^.*\/|\.webp$/g, ''));
for (const el of new Set([...heroes.map((h) => h.element), ...iconElements])) {
  add(`icons/${slugify(el === 'Neutral' ? 'Astral' : el)}.webp`, `icons/element/${el}.webp`, elementIconPath, el);
}
for (const c of new Set(heroes.map((h) => String(h.class)))) {
  add(`icons/${slugify(c.replace(/Attacker$/, ''))}.webp`, `icons/class/${c}.webp`, classIconPath, c);
}

const url = (served: string | undefined) => (served ? href(`img/${served}`) : undefined);

/** Every served image, for the img/ endpoint. */
export function artRoutes(): { served: string; source: string }[] {
  return [...routes].map(([served, source]) => ({ served, source }));
}

export const heroArt = (heroId: string) => url(heroArtPath.get(heroId));
export const titanArt = (titanId: string) => url(titanArtPath.get(titanId));
export const heroSplash = (heroId: string) => url(heroSplashPath.get(heroId));
export const titanSplash = (titanId: string) => url(titanSplashPath.get(titanId));
export const skillIcon = (heroId: string, type: string) => url(skillIconPath.get(`${heroId}/${type}`));
export const itemIcon = (itemId: string) => url(itemIconPath.get(itemId));
export const elementIcon = (element: string) => url(elementIconPath.get(element));
export const classIcon = (cls: string) => url(classIconPath.get(cls));

/** heroRefsByConfigId with each hero's portrait URL, for the box, share and planner pages. */
export function heroRefsWithArt(): Record<string, HeroRef> {
  return Object.fromEntries(Object.entries(heroRefsByConfigId).map(([configId, r]) => [configId, { ...r, art: heroArt(r.id) }]));
}
