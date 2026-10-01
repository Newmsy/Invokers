// Team builder model. Saved teams use the share links' TeamDoc, so a saved team can be shared as-is.
// Heroes are stored by data pack id; URLs use name slugs.
import type { RosterHero } from './roster';
import { statFields } from './format';
import type { TeamDoc } from './share/payload';

export { isTeamDoc, type TeamDoc } from './share/payload';

export const TEAM_SIZE = 5;

/** Reads a comma-separated slug list (?h=a,b,c): known slugs only, no repeats, at most `max`. */
export function parseSlugs(param: string | null, known: Set<string>, max: number): string[] {
  const out: string[] = [];
  for (const s of (param ?? '').split(',').map((x) => x.trim().toLowerCase())) {
    if (s && known.has(s) && !out.includes(s) && out.length < max) out.push(s);
  }
  return out;
}

export function countBy<T>(items: T[], key: (t: T) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const i of items) m.set(key(i), (m.get(key(i)) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export const speedKeys = ['comboSpeed', 'skillSpeed', 'skillRecovery', 'manaGen'] as const;

/** Index of each stat in a roster stat row. */
export const statIndex = Object.fromEntries(statFields.map((f, i) => [f.key, i])) as Record<
  (typeof statFields)[number]['key'],
  number
>;

/** Stats at rank Six, top level: the same "max stats" the hero pages show. */
export function maxRow(h: RosterHero): number[] {
  const byLevel = h.stats.Six ?? Object.values(h.stats).pop() ?? {};
  const top = Object.keys(byLevel).sort((a, b) => Number(a) - Number(b)).pop();
  return top ? byLevel[top] : statFields.map(() => 0);
}

export interface TeamSummary {
  elements: [string, number][];
  factions: [string, number][];
  classes: [string, number][];
  hasTank: boolean;
  /** Per speed stat: team total and the lowest and highest member. */
  speed: Record<(typeof speedKeys)[number], { total: number; min: number; max: number }>;
}

export function summarise(team: RosterHero[]): TeamSummary {
  const rows = team.map(maxRow);
  const speed = Object.fromEntries(
    speedKeys.map((k) => {
      const vals = rows.map((r) => r[statIndex[k]]);
      return [k, { total: vals.reduce((a, b) => a + b, 0), min: vals.length ? Math.min(...vals) : 0, max: vals.length ? Math.max(...vals) : 0 }];
    }),
  ) as TeamSummary['speed'];
  return {
    elements: countBy(team, (h) => h.element),
    factions: countBy(team, (h) => h.faction),
    classes: countBy(team, (h) => h.cls),
    hasTank: team.some((h) => h.cls === 'Tank'),
    speed,
  };
}

export function toTeamDoc(name: string, gameVersion: string, team: RosterHero[]): TeamDoc {
  return { schema: 1, name, gameVersion, heroes: team.map((h) => ({ id: h.id })) };
}
