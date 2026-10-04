// The player's Trophy Room levels and the stat bonuses they give. Each room boosts every Invoker of its element in
// every battle; percent trophies are of the Invoker's own stats (level + Awakening), like gear percents.
// Reads trophies.json directly (small), so client pages don't pull in the whole data pack.
import trophiesJson from '../../../../data/trophies.json';
import type { BoxDoc } from './store';

/** One trophy as imported: the room (element), the trophy's stat id and the levels bought (0-15). */
export interface BoxTrophy {
  element: string;
  stat: string;
  level: number;
}

interface TrophyData {
  rooms: string[];
  trophies: { id: string; name: string; maxLevel: number; levels: { level: number; bonuses: { stat: string; value: number }[] }[] }[];
}

const room = trophiesJson as unknown as TrophyData;
export const TROPHY_ROOMS = room.rooms;
const byId = new Map(room.trophies.map((t) => [t.id, t]));

export const trophyName = (stat: string): string => byId.get(stat)?.name ?? stat;

/** The trophies of one room that have at least one level. */
export function roomLevels(trophies: BoxTrophy[] | undefined, element: string): BoxTrophy[] {
  return (trophies ?? []).filter((t) => t.element === element && t.level > 0 && byId.has(t.stat));
}

/** [stat, value] bonuses an Invoker of this element gets from the Trophy Room (levels hold totals, not steps). */
export function trophyBonuses(trophies: BoxTrophy[] | undefined, element: string): [stat: string, value: number][] {
  const out: [string, number][] = [];
  for (const t of roomLevels(trophies, element)) {
    const def = byId.get(t.stat)!;
    const lv = def.levels.find((l) => l.level === Math.min(t.level, def.maxLevel));
    for (const b of lv?.bonuses ?? []) out.push([b.stat, b.value]);
  }
  return out;
}

/** True when the box carries Trophy Room levels (older imports and backups don't). */
export const hasTrophies = (doc: BoxDoc | null): boolean => !!doc?.trophies;

/** Shape check for backups: a hand-edited list can't break the views. */
export function trophiesLookRight(v: unknown): boolean {
  return (
    v === undefined ||
    (Array.isArray(v) &&
      v.every((t: BoxTrophy) => typeof t?.element === 'string' && typeof t.stat === 'string' && Number.isInteger(t.level) && t.level >= 0))
  );
}
