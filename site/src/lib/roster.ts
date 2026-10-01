// Compact hero list for the compare page and team builder, built from the data pack at build time and
// served as /data/roster.json. Pages fetch it in the browser so the big pack stays out of their HTML.
import { heroRefsByConfigId, heroes, heroSlug, skillsFor } from './data';
import { className, richText, skillTypeName, statFields } from './format';

export interface RosterHero {
  id: string;
  slug: string;
  name: string;
  rarity: string;
  element: string;
  faction: string;
  /** Display class name, e.g. "Melee". */
  cls: string;
  baseRank: string;
  /** Exact int64 config id as text, to match the player's imported box. */
  configId?: string;
  /** rank → level → values in statFields order. */
  stats: Record<string, Record<string, number[]>>;
}

export interface RosterSkill {
  type: string;
  label: string;
  title: string;
  /** Level → safe HTML. Some skills skip levels; the last listed one at or below a level applies. */
  levels: { level: number; html: string }[];
}

// Percent stats are stored as float32 fractions (0.05000000074505806); four places is plenty.
const round = (v: number) => Math.round(v * 1e4) / 1e4;

export function roster(): RosterHero[] {
  const configIds = new Map(Object.entries(heroRefsByConfigId).map(([configId, ref]) => [ref.id, configId]));
  return heroes.map((h) => ({
    id: h.id,
    slug: heroSlug(h.id),
    name: h.name,
    rarity: h.rarity,
    element: h.element,
    faction: h.faction,
    cls: className(h.class),
    baseRank: h.baseRank,
    configId: configIds.get(h.id),
    stats: Object.fromEntries(
      Object.entries(h.statsByRank).map(([rank, byLevel]) => [
        rank,
        Object.fromEntries(Object.entries(byLevel).map(([lv, s]) => [lv, statFields.map((f) => round(s[f.key]))])),
      ]),
    ),
  }));
}

export function rosterSkills(heroId: string): RosterSkill[] {
  return skillsFor(heroId)
    .filter((s) => s.levels && s.levels.length > 0)
    .map((s) => ({
      type: s.type,
      label: skillTypeName(s.type),
      title: s.title,
      levels: s.levels!.map((l) => ({ level: l.level, html: richText(l.text) })),
    }));
}
