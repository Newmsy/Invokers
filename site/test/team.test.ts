import { describe, expect, it } from 'vitest';
import { countBy, maxRow, parseSlugs, summarise, toTeamDoc, isTeamDoc } from '../src/lib/team';
import type { RosterHero } from '../src/lib/roster';

// Stat rows follow statFields order: hp, atk, def, critRate, critDmg, acc, res, instinct,
// comboSpeed, skillSpeed, skillRecovery, manaGen, runSpeed.
const row = (combo: number, skill: number, recov: number, mana: number) => [100, 10, 10, 0.05, 0.5, 0, 10, 5, combo, skill, recov, mana, 100];
const hero = (slug: string, cls: string, faction: string, element: string, r: number[]): RosterHero => ({
  id: slug.toUpperCase(),
  slug,
  name: slug,
  rarity: 'Epic',
  element,
  faction,
  cls,
  baseRank: 'Four',
  stats: { Five: { '50': row(1, 1, 1, 1) }, Six: { '1': row(0, 0, 0, 0), '60': r } },
});

describe('parseSlugs', () => {
  const known = new Set(['a', 'b', 'c']);
  it('keeps known slugs in order, drops repeats and unknowns, caps the count', () => {
    expect(parseSlugs('b, a,zz,b,c', known, 2)).toEqual(['b', 'a']);
  });
  it('handles a missing param', () => {
    expect(parseSlugs(null, known, 5)).toEqual([]);
  });
});

describe('team summary', () => {
  const a = hero('a', 'Tank', 'Freeborn', 'Earth', row(8, 0, 7, 0));
  const b = hero('b', 'Support', 'Freeborn', 'Fire', row(0, 6, 3, 5));
  it('reads max stats from rank Six, top level', () => {
    expect(maxRow(a)[8]).toBe(8);
  });
  it('totals speed stats and finds the lowest member', () => {
    const s = summarise([a, b]);
    expect(s.speed.comboSpeed).toEqual({ total: 8, min: 0, max: 8 });
    expect(s.speed.manaGen).toEqual({ total: 5, min: 0, max: 5 });
    expect(s.hasTank).toBe(true);
    expect(s.factions).toEqual([['Freeborn', 2]]);
  });
  it('sorts counts by size then name', () => {
    expect(countBy(['x', 'y', 'y'], (v) => v)).toEqual([['y', 2], ['x', 1]]);
  });
  it('builds a TeamDoc with data pack ids', () => {
    const doc = toTeamDoc('Mine', '0.61.1516', [a, b]);
    expect(doc.heroes).toEqual([{ id: 'A' }, { id: 'B' }]);
    expect(isTeamDoc(doc)).toBe(true);
    expect(isTeamDoc({ schema: 2 })).toBe(false);
  });
});
