// Loads the data pack from ../data. The datamining side owns that folder and
// exports it; the site only reads it at build time.
import manifest from '../../../data/manifest.json';
import heroesJson from '../../../data/heroes.json';
import skillsJson from '../../../data/skills.json';
import eventsJson from '../../../data/events.json';
import bossesJson from '../../../data/bosses.json';
import trophiesJson from '../../../data/trophies.json';
import itemsJson from '../../../data/items.json';
import heroesRaw from '../../../data/heroes.json?raw';
import statsJson from '../../../data/stats.json';
import setsJson from '../../../data/sets.json';
// Ratings are the site's own (Newms's scores), so they live under site/.
import ratingsJson from '../data/ratings.json';

export interface Manifest {
  gameVersion: string;
  extractedAt: string;
  schemaVersion: number;
}

/** Stat block as heroes.json stores it. Percent stats are fractions (0.05 = 5%). */
export interface HeroStats {
  hp: number;
  atk: number;
  def: number;
  critRate: number;
  critDmg: number;
  acc: number;
  res: number;
  instinct: number;
  comboSpeed: number;
  skillSpeed: number;
  skillRecovery: number;
  manaGen: number;
  runSpeed: number;
}

export interface Hero {
  id: string;
  name: string;
  rarity: string;
  faction: string;
  element: string;
  class: string;
  baseRank: string;
  maxStats: HeroStats;
  /** rank ("One".."Six") → level ("1", "10", …) → stats */
  statsByRank: Record<string, Record<string, HeroStats>>;
}

export interface SkillLevel {
  level: number;
  text: string;
}

export interface Skill {
  type: string;
  title: string;
  levels?: SkillLevel[];
}

export interface SkillSet {
  heroId: string;
  kind: 'hero' | 'titan';
  name: string;
  skills: Skill[];
}

export interface Rating {
  /** Tier letter, e.g. S, A, B, C, D. */
  tier: string;
  note?: string;
}

export interface Boss {
  id: string;
  name: string;
  title?: string;
  mode: string;
  element?: string;
  description?: string;
  dos: string[];
  donts: string[];
  corruptions: string[];
  stages: { stage: number; energy: number }[];
}

export interface StatInfo {
  id: string;
  name: string;
  short?: string;
  description?: string;
  kind?: string;
}

export interface ItemAmount {
  itemId: string;
  amount: number;
}

export interface StatBonus {
  stat: string;
  value: number;
  valueType: 'percent' | 'flat';
}

export interface TrophyLevel {
  level: number;
  cost: ItemAmount[];
  /** Total bonus at this level, not the step from the previous one. */
  bonuses: StatBonus[];
}

export interface Trophy {
  id: string;
  name: string;
  maxLevel: number;
  levels: TrophyLevel[];
}

export interface TrophyRoom {
  rooms: string[];
  scope: { type: string; description: string };
  source: string;
  unconfirmed: string[];
  trophies: Trophy[];
}

export interface Item {
  id: string;
  name: string;
  description?: string;
}

export interface GameEvent {
  id: string;
  name: string;
  [key: string]: unknown;
}

export const pack: Manifest = manifest;
export const heroes: Hero[] = heroesJson as Hero[];
export const events: GameEvent[] = eventsJson as GameEvent[];
export const trophyRoom: TrophyRoom = trophiesJson as TrophyRoom;

const itemsById = new Map((itemsJson as Item[]).map((i) => [i.id, i]));

export function itemName(id: string): string {
  return itemsById.get(id)?.name ?? id;
}

export const bossPack = bossesJson as { unconfirmed: string[]; bosses: Boss[] };
export const bosses: Boss[] = bossPack.bosses;

/** URL slug for a boss: its name, plus the element for the Omnissi variants. */
export function bossSlug(b: Boss): string {
  return [b.name, b.element].filter(Boolean).join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function bossLabel(b: Boss): string {
  return b.element ? `${b.name} (${b.element})` : b.name;
}

const tolerances = (statsJson as StatInfo[]).filter((s) => s.kind === 'rating' && s.id.endsWith('Tolerance'));

/** Corruption names, e.g. "Manashock" for ManashockTolerance. */
export const corruptionNames = tolerances.map((s) => s.id.replace(/Tolerance$/, ''));

/** The game's help text for a corruption's tolerance stat, e.g. "Daze" → DazeTolerance. */
export function toleranceFor(corruption: string): StatInfo | undefined {
  const key = `${corruption.replace(/\s+/g, '')}Tolerance`.toLowerCase();
  return tolerances.find((s) => s.id.toLowerCase() === key);
}

const skillSets = skillsJson as SkillSet[];
const skillsByHero = new Map(skillSets.map((s) => [s.heroId, s.skills]));
const ratings = ratingsJson as Record<string, Rating | undefined>;

export function skillsFor(heroId: string): Skill[] {
  return skillsByHero.get(heroId) ?? [];
}

export function ratingFor(heroId: string): Rating | undefined {
  return ratings[heroId];
}

/** Prefixes a site path with the deploy base (e.g. /invokers/ on GitHub Pages). */
export function href(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}

// heroes.json stores configId as a bare int64, which JSON.parse rounds. The box import matches on the
// exact value, so read it from the raw text.
const exactConfigIds = new Map<string, string>(
  [...heroesRaw.matchAll(/"id":\s*"([^"]+)",\s*"configId":\s*(\d+)/g)].map((m) => [m[1], m[2]]),
);

/** What the box pages need to show an owned hero, keyed by exact config id. */
export interface HeroRef {
  id: string;
  name: string;
  rarity: string;
  faction: string;
  element: string;
  class: string;
}

export const heroRefsByConfigId: Record<string, HeroRef> = Object.fromEntries(
  heroes.flatMap((h) => {
    const configId = exactConfigIds.get(h.id);
    if (!configId) return [];
    const { id, name, rarity, faction, element } = h as Hero & Record<string, string>;
    return [[configId, { id, name, rarity, faction, element, class: String(h.class) }]];
  }),
);

/** Gear stat labels by stat id (e.g. AttackPercent -> ATK, percent). */
export const gearStatLabels: Record<string, { name: string; percent: boolean }> = Object.fromEntries(
  (statsJson as { id: string; name: string; percent?: boolean }[])
    .filter((s) => typeof s.percent === 'boolean')
    .map((s) => [s.id, { name: s.name, percent: s.percent as boolean }]),
);

export const setNames: Record<string, string> = Object.fromEntries(
  (setsJson as { id: string; name: string }[]).map((s) => [s.id, s.name]),
);
