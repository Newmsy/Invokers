import { describe, expect, it } from 'vitest';
import { averagePerItem, bank, bankGemsPerPound, gbp, itemValue, packValue, rankedPacks, shop } from '../src/lib/packs';

const pack = (name: string) => packValue(shop.packs.find((p) => p.name === name)!);

describe('pack value', () => {
  it('counts bonus summons in the averages', () => {
    expect(averagePerItem('SI_DivineStar').Legendary).toBeCloseTo(0.0667 + 1 / 45, 6);
    expect(averagePerItem('SI_DestinyStar').Legendary).toBeCloseTo(0.0053 + (0.0667 + 1 / 45) / 85, 6);
    expect(averagePerItem('SI_RadiantStar').Legendary).toBeCloseTo(0.0053 / 0.9, 6);
  });
  it('prices items from the Gem Shop and the Bank', () => {
    expect(gbp(20)).toBe(19.99);
    expect(bankGemsPerPound).toBeCloseTo(10000 / 99.99, 6);
    expect(itemValue('SI_DestinyStar')).toEqual({ gems: 300, how: 'shop' });
    expect(itemValue('Energy')!.gems).toBeCloseTo(1.5, 6);
    expect(itemValue('Gold')!.gems).toBeCloseTo(1 / 4000, 9);
    expect(itemValue('SI_DivineStar')!.how).toBe('estimated');
    expect(itemValue('SI_DivineStar')!.gems).toBeGreaterThan(4000);
    expect(bank()[0]).toMatchObject({ price: 4.99, gems: 420, first: 840 });
  });
  it('values the boosters from the screenshots', () => {
    const weekly = pack('WEEKLY BOOSTER PACK');
    expect(weekly.price).toBe(19.99);
    expect(weekly.name).toBe('Weekly Booster Pack');
    expect(weekly.pulls.Legendary).toBeCloseTo(0.1079, 3);
    expect(weekly.ratio).toBeGreaterThan(2);
    const monthly = pack('MONTHLY SUMMON BOOSTER');
    expect(monthly.price).toBe(29.99);
    expect(monthly.pulls.Legendary).toBeCloseTo(0.1265, 3);
  });
  it('ranks every paid pack, Bank bundles left out', () => {
    const ranked = rankedPacks();
    expect(ranked.every((p) => p.tab !== 'Bank' && p.price > 0 && !p.partial)).toBe(true);
    expect(ranked[0].ratio).toBeGreaterThanOrEqual(ranked[ranked.length - 1].ratio);
  });
});
