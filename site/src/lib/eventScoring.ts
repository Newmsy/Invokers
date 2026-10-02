// Build-time: points per run for each farming event stage, worked out from drop rates and points per drop.
// The tables come from the event guide workbook (site/src/data/event-scoring.json) until the data pack exports
// its own copy (data/event_scoring.json, issue #13), which then takes over.
import guideTables from '../data/event-scoring.json';
import { expectedPointsPerRun, type ScoringFamily } from './events';

const files = import.meta.glob<{ default: unknown }>('../../../data/event_scoring.json', { eager: true });
const file = (Object.values(files)[0]?.default ?? guideTables) as { families?: unknown; arenaLeagues?: unknown };

const families: ScoringFamily[] = Array.isArray(file.families)
  ? (file.families as ScoringFamily[]).filter((f) => f && Array.isArray(f.modes) && Array.isArray(f.stages) && f.points && f.rollsPerRun > 0)
  : [];

export interface StageScore {
  pointsPerRun: number;
  /** The biggest contributors, for the "how it's worked out" table. Empty for a plain estimate. */
  lines: { key: string; chance: number; amount: string; points: number }[];
}

/** Points per run for a boss mode's stage from the drop tables, or undefined if they don't cover it. */
export function stageScore(mode: string | undefined, stage: number): StageScore | undefined {
  const family = mode ? families.find((f) => f.modes.includes(mode)) : undefined;
  const row = family?.stages.find((s) => s.stage === stage);
  if (family && row) {
    return {
      pointsPerRun: expectedPointsPerRun(family, row.drops),
      lines: row.drops
        .filter((d) => d.chance > 0 && (family.points[d.key] ?? 0) > 0)
        .map((d) => ({ key: d.key, chance: d.chance, amount: d.min === d.max ? String(d.min) : `${d.min}–${d.max}`, points: family.points[d.key] }))
        .sort((a, b) => b.chance * b.points - a.chance * a.points),
    };
  }
  return undefined;
}

export interface ArenaLeague { league: string; win: number; loss: number }

/** Arena Rush points per win and loss by league, once exported. */
export const arenaLeagues: ArenaLeague[] = Array.isArray(file.arenaLeagues)
  ? (file.arenaLeagues as ArenaLeague[]).filter((l) => l && typeof l.league === 'string' && l.win >= 0 && l.loss >= 0)
  : [];
