// Farming-event drop tables built from the stage list (data/stages.json). Pure, so the tests can check the stage
// list against the event guide's own tables.
import type { ScoringFamily, StageDrop } from './events';

export interface StageRow {
  region: string;
  stage: number;
  drops: { source: string; itemId: string; min: number; max: number; chancePerRoll?: number; rolls?: number }[];
}

const victory = (stages: StageRow[], region: string) =>
  stages
    .filter((s) => s.region === region)
    .sort((a, b) => a.stage - b.stage)
    .map((s) => ({ stage: s.stage, drops: s.drops.filter((d) => d.source === 'Victory' && typeof d.chancePerRoll === 'number') }));

// Crest medals (RM_), essences (EE_) and Mana essences (AE_): tier 1-3 score as Rare, Epic and Legendary.
const TIERS: Record<string, string> = { '1': 'Rare', '2': 'Epic', '3': 'Legendary' };
const tierOf = (itemId: string) => /^(RM|EE|AE)_.*Tier(\d)/.exec(itemId)?.[2];

/** Crest and Omnissi drops for one dungeon, as scoring lines by tier. */
export function tierDrops(stages: StageRow[], region: string): ScoringFamily['stages'] {
  return victory(stages, region).map((s) => ({
    stage: s.stage,
    drops: s.drops.flatMap((d): StageDrop[] => {
      const tier = tierOf(d.itemId);
      return tier && TIERS[tier] ? [{ key: TIERS[tier], chance: d.chancePerRoll! * (d.rolls ?? 1), min: d.min, max: d.max }] : [];
    }),
  }));
}

/** Titan Spark drops for Pentiax. */
export function sparkDrops(stages: StageRow[], region: string): ScoringFamily['stages'] {
  return victory(stages, region).map((s) => ({
    stage: s.stage,
    drops: s.drops
      .filter((d) => d.itemId === 'EMP_AnimaSpark')
      .map((d) => ({ key: 'Spark', chance: d.chancePerRoll! * (d.rolls ?? 1), min: d.min, max: d.max })),
  }));
}

/** Chance per roll of each gear drop line (one per star), sorted, by stage. The stars themselves aren't in the list. */
export function gearRollChances(stages: StageRow[], region: string, itemId: string): Map<number, number[]> {
  return new Map(
    victory(stages, region).map((s) => [s.stage, s.drops.filter((d) => d.itemId === itemId).map((d) => d.chancePerRoll!).sort((a, b) => a - b)]),
  );
}
