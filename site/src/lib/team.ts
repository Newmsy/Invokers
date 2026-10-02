// Team builder model. Saved teams use the share links' TeamDoc, so a saved team can be shared as-is.
// Heroes are stored by data pack id; URLs use name slugs.
import type { RosterHero } from './roster';
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

export interface TeamSummary {
  elements: [string, number][];
  factions: [string, number][];
  classes: [string, number][];
  hasTank: boolean;
}

export function summarise(team: RosterHero[]): TeamSummary {
  return {
    elements: countBy(team, (h) => h.element),
    factions: countBy(team, (h) => h.faction),
    classes: countBy(team, (h) => h.cls),
    hasTank: team.some((h) => h.cls === 'Tank'),
  };
}

export function toTeamDoc(name: string, gameVersion: string, team: RosterHero[]): TeamDoc {
  return { schema: 1, name, gameVersion, heroes: team.map((h) => ({ id: h.id })) };
}
