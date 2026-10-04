import { describe, expect, it } from 'vitest';
import type { BoxHero } from '../src/lib/box/decode';
import type { BoxDoc } from '../src/lib/box/store';
import { trophiesLookRight, trophyBonuses, type BoxTrophy } from '../src/lib/box/trophies';
import { bareBuild, boxBuild } from '../src/lib/dps/box';
import { dpsData } from '../src/lib/dps/data';
import { finalStat } from '../src/lib/dps/model';

const data = dpsData();

// Newms's Fire room, read off the gap between the in-game hero screen and the simulator for Devi of the Six.
const FIRE: BoxTrophy[] = [
  ['AttackPercent', 12], ['DefensePercent', 7], ['HealthPercent', 7], ['CriticalRatePercent', 12],
  ['CriticalDamagePercent', 12], ['ComboSpeedFlat', 9], ['SkillSpeedFlat', 6], ['SkillRecoveryFlat', 7],
  ['ManaGenerationFlat', 8],
].map(([stat, level]) => ({ element: 'Fire', stat: stat as string, level: level as number }));

describe('trophy room bonuses', () => {
  it('gives the level total, only to the room element', () => {
    const fire = Object.fromEntries(trophyBonuses(FIRE, 'Fire'));
    expect(fire.AttackPercent).toBeCloseTo(0.24);
    expect(fire.CriticalDamagePercent).toBeCloseTo(0.31);
    expect(fire.ComboSpeedFlat).toBe(36);
    expect(trophyBonuses(FIRE, 'Water')).toEqual([]);
    expect(trophyBonuses(undefined, 'Fire')).toEqual([]);
  });

  it('caps at the top level and skips unknown trophies', () => {
    expect(trophyBonuses([{ element: 'Dark', stat: 'AttackPercent', level: 99 }], 'Dark')).toEqual([['AttackPercent', 0.3]]);
    expect(trophyBonuses([{ element: 'Dark', stat: 'Nope', level: 3 }], 'Dark')).toEqual([]);
  });

  it('checks backup shapes', () => {
    expect(trophiesLookRight(undefined)).toBe(true);
    expect(trophiesLookRight(FIRE)).toBe(true);
    expect(trophiesLookRight([{ element: 'Fire', stat: 'AttackPercent', level: -1 }])).toBe(false);
    expect(trophiesLookRight('x')).toBe(false);
  });

  it('closes the gap between the simulator and the game for a box Invoker', () => {
    const devi = data.heroes.find((h) => h.name === 'Devi of the Six')!;
    const owned = {
      id: 1, configId: devi.configId, rank: 'Six', level: 60, skills: [], gearBySlot: {}, accessoryBySlot: {},
      awakenNodeIds: data.signs[devi.sign!],
    } as unknown as BoxHero;
    const doc = (trophies?: BoxTrophy[]) => ({ heroes: [owned], gear: [], accessories: [], trophies }) as unknown as BoxDoc;
    const without = boxBuild(data, doc(), owned)!.totals;
    const withT = boxBuild(data, doc(FIRE), owned)!.totals;
    expect(without).toEqual(bareBuild(data, devi).totals);
    // In game: ATK +280, DEF +104, HP +1,286, Crit +12%, Crit DMG +31%, Combo +36, Skill SPD +24, RECOV +28, Mana +32.
    expect(Math.round(finalStat(withT, 'atk') - finalStat(without, 'atk'))).toBe(280);
    expect(Math.round(finalStat(withT, 'def') - finalStat(without, 'def'))).toBe(104);
    expect(Math.round(finalStat(withT, 'hp') - finalStat(without, 'hp'))).toBe(1286);
    expect(withT.critRate - without.critRate).toBeCloseTo(0.12);
    expect(withT.critDmg - without.critDmg).toBeCloseTo(0.31);
    expect(withT.comboSpeed - without.comboSpeed).toBe(36);
    expect(withT.skillSpeed - without.skillSpeed).toBe(24);
    expect(withT.skillRecovery - without.skillRecovery).toBe(28);
    expect(withT.manaGen - without.manaGen).toBe(32);
  });
});
