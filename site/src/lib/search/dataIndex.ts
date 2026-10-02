// Builds the search entries for everything in the data pack. Only player-facing names and
// text go in: no internal codes, and items whose names aren't real names are left out.
import itemsJson from '../../../../data/items.json';
import setsJson from '../../../../data/sets.json';
import skillsJson from '../../../../data/skills.json';
import { bossLabel, bossSlug, bosses, heroHref, heroes, href, trophyRoom, type Item, type SkillSet } from '../data';
import { heroArt, itemIcon, skillIcon } from '../art';
import { className, skillTypeName } from '../format';
import type { SearchDoc } from './match';

/** Game rich text to plain text. Star icons become ★. */
export function plainText(s: string): string {
  return s
    .replace(/\s*<sprite[^>]*>\s*/g, '★ ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/★ (?=[\s.,)]|$)/g, '★')
    .trim();
}

/** True for item names that are really placeholders (e.g. "VIP_7d"): no spaces and an underscore, or equal to the code. */
function isPlaceholder(item: Item): boolean {
  return !item.name || item.name === item.id || item.name.includes('_');
}

/** Keeps the index small: long texts are cut at a word boundary. */
export function clip(s: string, max = 240): string {
  return s.length <= max ? s : `${s.slice(0, s.lastIndexOf(' ', max))}…`;
}

// Skill anchors on hero pages: #skill-1, #skill-combo…
const skillAnchor = (type: string) => `skill-${type.replace(/^ActiveSkill/, '').toLowerCase()}`;

interface SetBonus {
  statName: string;
  value: number;
}
interface GearSet {
  id: string;
  name: string;
  bonuses: Record<string, SetBonus[]>;
  recommendation?: string;
}

/** "+20% ATK" or "+50 ACC". Fractions are percentages; whole numbers are flat points. */
function bonusText(b: SetBonus): string {
  const v = b.value < 1 ? `${+(b.value * 100).toFixed(1)}%` : `${b.value}`;
  return `+${v} ${b.statName}`;
}

// Sets whose bonuses are special effects rather than plain stats, worded as in the
// "Every gear set" post.
const specialSets: Record<string, string> = {
  Vampire: '3 pieces: +10% ATK · 5 pieces: lifesteal of 6% of skill damage and 1% of combo damage',
  Paragon: '3 pieces: +15% heal and shield size · 5 pieces: allies move faster out of combat',
  Voodoo: '3 pieces: combo attacks 3 and 5 shorten 1 enemy buff · 5 pieces: a stronger version of the same effect',
  Guardian: "3 pieces: +20% HP · 5 pieces: all allies get a shield worth 20% of the wearer's max HP for 12 seconds",
  Spellwall: '3 pieces: Willpower and Immunity buffs at the start of battle · 5 pieces: +10% HP, ATK and DEF',
};

export function setSummary(set: GearSet): string {
  if (specialSets[set.name]) return specialSets[set.name];
  return Object.entries(set.bonuses)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([pieces, list]) => `${pieces} pieces: ${list.map(bonusText).join(', ')}`)
    .join(' · ');
}

export function dataDocs(): SearchDoc[] {
  const docs: SearchDoc[] = [];
  const heroIds = new Set(heroes.map((h) => h.id));

  for (const h of heroes) {
    docs.push({
      kind: 'Invoker',
      title: h.name,
      sub: [h.element, h.rarity, h.faction, className(h.class)].filter(Boolean).join(' · '),
      url: heroHref(h.id),
      image: heroArt(h.id),
    });
  }

  for (const set of skillsJson as SkillSet[]) {
    if (set.kind !== 'hero' || !heroIds.has(set.heroId)) continue;
    for (const s of set.skills) {
      const first = s.levels?.[0];
      if (!first || !s.title) continue;
      docs.push({
        kind: 'Skill',
        title: s.title,
        sub: `${set.name} · ${skillTypeName(s.type)}`,
        text: clip(plainText(first.text)),
        url: `${heroHref(set.heroId)}#${skillAnchor(s.type)}`,
        image: skillIcon(set.heroId, s.type) ?? heroArt(set.heroId),
      });
    }
  }

  // Mode names as the boss guides page groups them.
  const modes: Record<string, string> = { 'relic boss': 'Relic boss', 'clan boss': 'Clan boss', other: 'Crest boss' };
  for (const b of bosses) {
    docs.push({
      kind: 'Boss',
      title: bossLabel(b),
      sub: [b.title, modes[b.mode]].filter(Boolean).join(' · '),
      text: plainText([b.description ?? '', ...b.dos, ...b.donts].map((t) => t.trim().replace(/([^.!?])$/, '$1.')).join(' ')),
      url: href(`bosses/${bossSlug(b)}`),
    });
  }

  for (const set of setsJson as GearSet[]) {
    docs.push({
      kind: 'Gear set',
      title: `${set.name} set`,
      sub: setSummary(set),
      text: plainText(set.recommendation ?? ''),
      url: href(`gear#set-${set.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`),
    });
  }

  for (const t of trophyRoom.trophies) {
    docs.push({ kind: 'Trophy', title: `${t.name} trophy`, sub: `Trophy Room · up to level ${t.maxLevel}`, url: href('trophies') });
  }

  const seen = new Set<string>();
  for (const item of itemsJson as Item[]) {
    if (isPlaceholder(item)) continue;
    const name = plainText(item.name);
    if (seen.has(name)) continue;
    seen.add(name);
    const desc = item.description && item.description !== item.name ? plainText(item.description) : undefined;
    docs.push({ kind: 'Item', title: name, text: desc, image: itemIcon(item.id) });
  }

  return docs;
}

/** The site's sections, so "privacy" or "skill costs" finds the page. */
export function pageDocs(): SearchDoc[] {
  const pages: [string, string, string][] = [
    ['heroes', 'Invokers', 'Every Invoker with ratings, skills and stats'],
    ['events', 'Events', 'Event calendar and planners'],
    ['summons', 'Summons', 'Summon rates for every star and orb, and the odds of at least one Legendary in N pulls'],
    ['gear', 'Gear sets', 'Every gear set, its 3 and 5 piece bonuses, and the bosses each tolerance set counters'],
    ['trophies', 'Trophy Room', 'Trophy upgrade costs and the stats each level gives'],
    ['bosses', 'Boss guides', 'Dos and don’ts for every boss'],
    ['blog', 'Blog', 'The numbers behind Invokers, worked out in plain language'],
    ['team', 'Team builder', 'Build a team of Invokers and check its elements, factions and speed'],
    ['heroes/compare', 'Compare Invokers', 'Compare Invokers side by side: stats and skills'],
    ['planner', 'Planner', 'What your Invokers still need to max their skills and gear, from your imported box'],
    ['skill-costs', 'Skill upgrade costs', 'What it costs to level a skill, level by level'],
    ['my-box', 'My box', 'Import your Invokers and gear to see your roster'],
    ['about', 'About', 'About this site'],
    ['privacy', 'Privacy', 'What this site stores and how to delete it'],
  ];
  return pages.map(([path, title, text]) => ({ kind: 'Page', title, text, url: href(path) }));
}
