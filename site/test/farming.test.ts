import { describe, expect, it } from 'vitest';
import { farmItems, farmingFor, placeName, stageList } from '../src/lib/farming';
import { bonusName, bonusValue, tactics } from '../src/lib/tactics';
import { plainItemName } from '../src/lib/progression';

describe('farming', () => {
  it('names every item and every place in plain English', () => {
    for (const id of farmItems) {
      expect(plainItemName(id), id).not.toMatch(/_/);
      for (const s of farmingFor(id).stages) {
        expect(s.place, id).not.toMatch(/_|Dungeon|Tower/);
        expect(s.energy).toBeGreaterThan(0);
      }
    }
  });

  it('ranks stages by average per Energy, best first', () => {
    for (const id of farmItems) {
      const list = farmingFor(id).stages;
      for (let i = 1; i < list.length; i++) expect(list[i - 1].perEnergy).toBeGreaterThanOrEqual(list[i].perEnergy);
    }
  });

  it('adds up every Victory roll of a stage', () => {
    // Omnissi (Astral) stage 1: 2 at 50% and 4 at 50% = 3 a win, 5 Energy.
    const s = farmingFor('AE_ManaTier1').stages.find((r) => r.place === 'Omnissi (Astral)' && r.stages.includes(1))!;
    expect(s.perRun).toBeCloseTo(3);
    expect(s.perEnergy).toBeCloseTo(0.6);
    expect(s.estimated).toBe(false);
  });

  it('marks in-battle Campaign loot as estimated and keeps Spires apart', () => {
    const m = farmingFor('Memorium');
    expect(m.stages[0].area).toBe('Campaign');
    expect(m.stages[0].estimated).toBe(true);
    expect(m.spires.map((s) => s.place)).toContain('Light Spire');
    expect(m.shop.length).toBeGreaterThan(0);
  });

  it('names places', () => {
    expect(placeName('Campaign', 'Chapter12_CEL').name).toBe('Chapter 12');
    expect(placeName('Tower', 'TowerFire').name).toBe('Fire Spire');
    expect(placeName('Dungeon', 'DungeonTitan')).toEqual({ name: 'Pentiax', path: 'bosses/pentiax' });
    expect(stageList([1, 2, 3, 5, 7, 8])).toBe('1–3, 5, 7–8');
  });
});

describe('tactics', () => {
  it('gives every bonus an English name and a value at both ends', () => {
    for (const t of tactics) {
      for (const b of t.bonuses) {
        expect(bonusName(b), t.name).not.toMatch(/[a-z][A-Z]/);
        expect(b.valuesByLevel.length).toBe(20);
      }
    }
    const tank = tactics.find((t) => t.name === 'Tank')!;
    expect(bonusValue(tank.bonuses[0], tank.bonuses[0].valuesByLevel[19])).toBe('−15%');
  });
});
