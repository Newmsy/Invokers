import { describe, expect, it } from 'vitest';
import { averagePerItem, packData, packValue, starPricePerLegendary } from '../src/lib/packs';

const pack = (id: string) => packData.packs.find((p) => p.id === id)!;

describe('pack value', () => {
  it('counts bonus summons in the averages', () => {
    expect(averagePerItem('SI_DivineStar').Legendary).toBeCloseTo(0.0667 + 1 / 45, 6);
    expect(averagePerItem('SI_DestinyStar').Legendary).toBeCloseTo(0.0053 + (0.0667 + 1 / 45) / 85, 6);
    expect(averagePerItem('SI_RadiantStar').Legendary).toBeCloseTo(0.0053 / 0.9, 6);
  });
  it('values the two boosters', () => {
    const weekly = packValue(pack('weekly-booster-pack'));
    const monthly = packValue(pack('monthly-summon-booster'));
    expect(weekly.pulls.Legendary).toBeCloseTo(0.1079, 3);
    expect(monthly.pulls.Legendary).toBeCloseTo(0.1265, 3);
    expect(weekly.perLegendary).toBeCloseTo(185.3, 0);
    expect(monthly.gemValue).toBeCloseTo(500 + 1000 / 1.5, 6);
    expect(starPricePerLegendary(pack('weekly-booster-pack'), 0)).toBeCloseTo(weekly.perLegendary, 6);
    expect(starPricePerLegendary(pack('monthly-summon-booster'), 0.01)).toBeLessThan(monthly.perLegendary);
  });
});
