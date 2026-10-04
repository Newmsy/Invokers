import { describe, expect, it } from 'vitest';
import sample from '../../datamine/samples/box-sample.json';
import powerJson from '../../data/power.json';
import type { BoxHero } from '../src/lib/box/decode';
import { heroes } from '../src/lib/data';
import { dpsData } from '../src/lib/dps/data';
import { finalStat, totalsFor } from '../src/lib/dps/model';
import type { BoxDoc } from '../src/lib/box/store';
import { boxPower, formatPower, power, powerMultiplier } from '../src/lib/power';

const data = dpsData();
const configIds = new Map(heroes.map((h) => [h.id, data.heroes.find((d) => d.name === h.name)?.configId]));
const owned = sample.heroes.items as unknown as (BoxHero & { heroId: string })[];

describe('power', () => {
  for (const c of powerJson.checks) {
    const hero = owned.find((h) => h.id === c.boxHeroId)!;
    it(`matches the game for ${c.heroId}`, () => {
      expect(Math.abs(powerMultiplier(hero) - c.multiplier)).toBeLessThan(2e-5);
      const dh = data.heroes.find((h) => h.configId === configIds.get(c.heroId))!;
      // Awakening counts through the multiplier only. The game's number also has account-wide bonuses
      // (VIP, Trophy Room) that the sample has no record of, so ours reads up to ~7% lower.
      const t = totalsFor(data, dh, hero.rank, hero.level, [], []);
      const p = power(powerMultiplier(hero), finalStat(t, 'atk'), finalStat(t, 'def'), finalStat(t, 'hp'));
      expect(p).toBeLessThanOrEqual(c.gamePowerWithoutGear);
      expect(p / c.gamePowerWithoutGear).toBeGreaterThan(0.93);
    });
  }

  it('counts gear for a boxed Invoker', () => {
    const doc = {
      gear: sample.gear.items,
      accessories: sample.accessories.items,
      heroes: owned.map((h) => ({ ...h, configId: configIds.get(h.heroId)! })),
    } as unknown as BoxDoc;
    const geared = doc.heroes.find((h) => Object.values(h.gearBySlot).some((id) => doc.gear.some((g) => g.id === id)))!;
    const bare = { ...doc, gear: [], accessories: [] };
    expect(boxPower(data, doc, geared)!).toBeGreaterThan(boxPower(data, bare, geared)!);
  });

  it('formats like the game', () => {
    expect(formatPower(43660)).toBe('43.66K');
    expect(formatPower(12900)).toBe('12.9K');
    expect(formatPower(624.4)).toBe('624');
  });
});
