// Build-time: points per run for each farming event stage, worked out from drop rates and points per drop.
// The drop tables join the data pack later (data/event_scoring.json, issue #13). The glob is empty until then,
// so the page falls back to the per-stage estimates in site/src/data/event-guide.json.
import { expectedPointsPerRun, type ScoringFamily } from './events';

const files = import.meta.glob<{ default: unknown }>('../../../data/event_scoring.json', { eager: true });
const file = Object.values(files)[0]?.default as { families?: unknown; arenaLeagues?: unknown } | undefined;

const families: ScoringFamily[] = Array.isArray(file?.families)
  ? (file.families as ScoringFamily[]).filter((f) => f && Array.isArray(f.modes) && Array.isArray(f.stages) && f.points && f.rollsPerRun > 0)
  : [];

export interface StageScore {
  pointsPerRun: number;
  /** The biggest contributors, for the "how it's worked out" table. Empty for a plain estimate. */
  lines: { key: string; chance: number; amount: string; points: number }[];
}

/** Points per run for a boss mode's stage from the drop tables, or undefined if they don't cover it. */
export function stageScore(mode: string | undefined, stage: number, fallback?: Record<string, number>): StageScore | undefined {
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
  const estimate = fallback?.[String(stage)];
  return typeof estimate === 'number' && estimate > 0 ? { pointsPerRun: estimate, lines: [] } : undefined;
}

/** Rolls per run for the mode's family (items dropped each run), if the tables exist. */
export function rollsPerRun(mode: string | undefined): number | undefined {
  return mode ? families.find((f) => f.modes.includes(mode))?.rollsPerRun : undefined;
}

export interface ArenaLeague { league: string; win: number; loss: number }

/** Arena Rush points per win and loss by league, once exported. */
export const arenaLeagues: ArenaLeague[] = Array.isArray(file?.arenaLeagues)
  ? (file.arenaLeagues as ArenaLeague[]).filter((l) => l && typeof l.league === 'string' && l.win >= 0 && l.loss >= 0)
  : [];
