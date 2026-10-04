import { describe, expect, it } from 'vitest';
import stagesJson from '../../data/stages.json';
import guide from '../src/data/event-scoring.json';
import { expectedPointsPerRun, type ScoringFamily } from '../src/lib/events';
import { gearRollChances, sparkDrops, tierDrops, type StageRow } from '../src/lib/stageDrops';

// The stage list and the event guide workbook should agree. If a game update changes the stage list, these fail and
// the workbook-based relic tables (event-scoring.json) need checking.
const stages = (stagesJson as unknown as { stages: StageRow[] }).stages;
const family = (id: string) => (guide.families as unknown as ScoringFamily[]).find((f) => f.id === id)!;

describe('stage list vs event guide', () => {
  it('gives every Crest and Omnissi dungeon the guide points per run', () => {
    const crest = family('crest');
    const dungeons = [...new Set(stages.map((s) => s.region))].filter((r) => /^Dungeon(Tank|Melee|Ranged|Support|Essence)/.test(r));
    expect(dungeons).toHaveLength(11);
    for (const region of dungeons) {
      tierDrops(stages, region).forEach((s, i) => {
        expect(expectedPointsPerRun(crest, s.drops)).toBeCloseTo(expectedPointsPerRun(crest, crest.stages[i].drops), 1);
      });
    }
  });

  it('gives Pentiax the guide spark ranges', () => {
    const sparks = family('sparks');
    sparkDrops(stages, 'DungeonTitan').forEach((s, i) => expect(s.drops).toEqual(sparks.stages[i].drops));
  });

  it('gives relic and clan bosses the guide star chances', () => {
    const gear = family('gear');
    const guideChances = new Map(
      gear.stages.map((s) => {
        const byStar = new Map<string, number>();
        for (const d of s.drops) byStar.set(d.key.split(' ')[0], (byStar.get(d.key.split(' ')[0]) ?? 0) + d.chance);
        return [s.stage, [...byStar.values()].map((c) => Math.round(c * 1e4) / 1e4).sort((a, b) => a - b)];
      }),
    );
    for (const [region, item] of [['DungeonRelics1', 'Relic'], ['DungeonRelics2', 'Relic'], ['DungeonRelics6', 'Relic'], ['ClanBoss1', 'Accessory']]) {
      for (const [stage, chances] of gearRollChances(stages, region, item)) expect(chances).toEqual(guideChances.get(stage));
    }
  });
});
