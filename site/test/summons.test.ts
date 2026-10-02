import { describe, expect, it } from 'vitest';
import { atLeastOne, legendaryPool, odds, pullsFor, summonItem } from '../src/lib/summons';

const destiny = summonItem('SI_DestinyStar')!;
const radiant = summonItem('SI_RadiantStar')!;

describe('summon odds', () => {
  it('matches the blog post figures', () => {
    expect(atLeastOne(0.0053, 130)).toBeCloseTo(0.499, 3);
    expect(atLeastOne(0.0667, 10)).toBeCloseTo(0.499, 3);
    expect(pullsFor(0.0053, 0.5)).toBe(131);
    expect(legendaryPool(destiny)).toHaveLength(38);
    expect(legendaryPool(radiant)).toHaveLength(19);
    expect(Math.round(38 / 0.0053)).toBe(7170);
  });

  it('leaves out heroes no star can summon', () => {
    expect(legendaryPool(destiny).some((h) => h.name === 'Ardell The Torrent')).toBe(false);
  });

  it('applies estimated mercy only when asked', () => {
    expect(odds({ item: 'SI_DestinyStar', rarity: 'Legendary', pulls: 50 }).chance).toBeCloseTo(0.233, 3);
    const first = odds({ item: 'SI_DestinyStar', rarity: 'Legendary', pulls: 50, mercy: true, firstTime: true });
    expect(first.chance).toBe(1);
    expect(first.guaranteedBy).toBe(50);
    expect(odds({ item: 'SI_DestinyStar', rarity: 'Legendary', pulls: 50, mercy: true }).chance).toBeLessThan(1);
    expect(odds({ item: 'SI_DestinyStar', rarity: 'Legendary', pulls: 40, mercy: true, since: 150 }).guaranteedBy).toBe(40);
  });

  it('counts bonus items', () => {
    const r = odds({ item: 'SI_DestinyStar', rarity: 'Legendary', pulls: 170, bonus: true });
    expect(r.bonusItems).toEqual([{ item: 'SI_DivineStar', count: 2 }]);
    expect(r.expected).toBeCloseTo(170 * 0.0053 + 2 * 0.0667, 6);
    expect(odds({ item: 'SI_DivineStar', rarity: 'Legendary', pulls: 45, bonus: true }).chance).toBe(1);
  });

  it('divides by the pool for one hero', () => {
    expect(odds({ item: 'SI_RadiantStar', rarity: 'Legendary', pulls: 1, poolSize: 19 }).perPull).toBeCloseTo(0.0053 / 19, 9);
  });
});
