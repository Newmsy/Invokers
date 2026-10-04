// Build-time: points per run for each farming event stage, worked out from drop rates and points per drop.
// Crest, Omnissi and Pentiax drops come from the stage list (data/stages.json), so they follow each game update.
// Relic and clan boss gear keeps the event guide workbook's tables (site/src/data/event-scoring.json): the stage
// list has each star's chance but not the rarity split within it. A data pack data/event_scoring.json overrides all.
import guideTables from '../data/event-scoring.json';
import stagesJson from '../../../data/stages.json';
import { itemName } from './data';
import { expectedPointsPerRun, type ScoringFamily } from './events';
import { sparkDrops, tierDrops, type StageRow } from './stageDrops';

const files = import.meta.glob<{ default: unknown }>('../../../data/event_scoring.json', { eager: true });
const exported = Object.values(files)[0]?.default as { families?: unknown; arenaLeagues?: unknown } | undefined;
const file = (exported ?? guideTables) as { families?: unknown; arenaLeagues?: unknown };

const valid = (f: ScoringFamily) => f && Array.isArray(f.modes) && Array.isArray(f.stages) && f.points && f.rollsPerRun > 0;
const fromFile: ScoringFamily[] = Array.isArray(file.families) ? (file.families as ScoringFamily[]).filter(valid) : [];

// Every Crest and Omnissi dungeon shares one table, so one dungeon stands for each family.
const stageList = (stagesJson as unknown as { stages: StageRow[] }).stages;
const fromStages = (f: ScoringFamily): ScoringFamily => {
  if (exported) return f;
  const stages = f.id === 'crest' ? tierDrops(stageList, 'DungeonTank') : f.id === 'sparks' ? sparkDrops(stageList, 'DungeonTitan') : [];
  return stages.length && stages.every((s) => s.drops.length) ? { ...f, stages } : f;
};
const families: ScoringFamily[] = fromFile.map(fromStages);

// Drop keys are either labels ("5★ Epic") or item ids, which show as the item's name.
const dropName = (key: string) => (/^[A-Za-z]+_/.test(key) ? itemName(key) : key);

export interface StageScore {
  pointsPerRun: number;
  /** The biggest contributors, for the "how it's worked out" table: drop name, expected drops a run, amount, points each. */
  lines: { key: string; perRun: number; amount: string; points: number }[];
}

/** One line per drop: tables that list each amount separately (6, 8 or 10 Crests) are merged into one range. */
function groupLines(drops: ScoringFamily['stages'][number]['drops'], family: ScoringFamily): StageScore['lines'] {
  const byKey = new Map<string, { perRun: number; min: number; max: number }>();
  for (const d of drops) {
    const g = byKey.get(d.key) ?? { perRun: 0, min: d.min, max: d.max };
    byKey.set(d.key, { perRun: g.perRun + d.chance * family.rollsPerRun, min: Math.min(g.min, d.min), max: Math.max(g.max, d.max) });
  }
  return [...byKey]
    .map(([key, g]) => ({ key: dropName(key), perRun: g.perRun, amount: g.min === g.max ? String(g.min) : `${g.min}–${g.max}`, points: family.points[key] }))
    .sort((a, b) => b.perRun * b.points - a.perRun * a.points);
}

/** Points per run for a boss mode's stage from the drop tables, or undefined if they don't cover it. */
export function stageScore(mode: string | undefined, stage: number): StageScore | undefined {
  const family = mode ? families.find((f) => f.modes.includes(mode)) : undefined;
  const row = family?.stages.find((s) => s.stage === stage);
  if (family && row) {
    return {
      pointsPerRun: expectedPointsPerRun(family, row.drops),
      lines: groupLines(row.drops.filter((d) => d.chance > 0 && (family.points[d.key] ?? 0) > 0), family),
    };
  }
  return undefined;
}

export interface ArenaLeague { league: string; win: number; loss: number }

/** Arena Rush points per win and loss by league, once exported. */
export const arenaLeagues: ArenaLeague[] = Array.isArray(file.arenaLeagues)
  ? (file.arenaLeagues as ArenaLeague[])
      .filter((l) => l && typeof l.league === 'string' && l.win >= 0 && l.loss >= 0)
      .map((l) => ({ ...l, league: l.league.replace(/([A-Za-z])(\d)/, '$1 $2') }))
  : [];
