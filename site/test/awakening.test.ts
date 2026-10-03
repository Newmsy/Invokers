import { describe, expect, it } from 'vitest';
import { heroes } from '../src/lib/data';
import { awakeningType, fullyAwakened } from '../src/lib/awakening';

const awakened = (name: string) => fullyAwakened(heroes.find((h) => h.name === name)!)!;

describe('fully awakened stats', () => {
  it('finds an Awakening type for every Invoker', () => {
    expect(heroes.filter((h) => !awakeningType(h)).map((h) => h.name)).toEqual([]);
  });

  it("matches the game's max stats for Skoloss the Tomb Baron", () => {
    const { stats } = awakened('Skoloss the Tomb Baron');
    expect([stats.hp, stats.atk, stats.def].map(Math.round)).toEqual([12294, 364, 1261]);
    expect([stats.acc, stats.res, stats.instinct, stats.manaGen, stats.runSpeed]).toEqual([92, 76, 54, 45, 150]);
    expect(stats.critRate).toBeCloseTo(0.05);
  });

  it("matches the game's max stats for Crestelle Moonveil", () => {
    const { stats } = awakened('Crestelle Moonveil');
    expect([stats.hp, stats.atk, stats.def].map(Math.round)).toEqual([11568, 906, 759]);
    expect([stats.acc, stats.res, stats.comboSpeed, stats.skillSpeed, stats.skillRecovery, stats.manaGen, stats.instinct, stats.runSpeed]).toEqual([0, 45, 26, 54, 0, 0, 47, 128]);
  });

  it('matches the Levelling vs Awakening post', () => {
    const almea = awakened('Almea');
    expect([almea.stats.hp, almea.stats.atk, almea.stats.def].map(Math.round)).toEqual([7387, 940, 671]);
    expect(almea.stats.critRate).toBeCloseTo(0.15);
    const kanraku = awakened('Duchess Kanraku');
    expect([kanraku.stats.hp, kanraku.stats.atk, kanraku.stats.def].map(Math.round)).toEqual([7330, 1290, 817]);
    expect(kanraku.titanTime).toBe(3);
  });
});
