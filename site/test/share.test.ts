import { describe, expect, it } from 'vitest';
import type { BoxDoc } from '../src/lib/box/store';
import { SHARE_ID, boxSharePayload, isTeamDoc, newShareId } from '../src/lib/share/payload';

const hero = (id: number, inStorage = false) => ({
  id, configId: String(1000 + id), rank: 'Three', level: 30, locked: false, inStorage, marker: 'None', skills: [],
  gearBySlot: { Weapon: id * 10 }, accessoryBySlot: {}, awakenLevel: 0, awakenNodeIds: [], chroma: false, skin: null,
});
const gear = (id: number, equippedHeroId: number | null) => ({
  id, slot: 'Weapon', rank: 'Three', rarity: 'Epic', set: 'Speed', equippedHeroId, level: 8, seen: true, mainStat: null, subStats: [],
});
const doc: BoxDoc = {
  schema: 1, importedAt: '2026-10-01T12:00:00.000Z', gameVersion: '0.61.1516', files: {},
  heroes: [hero(1), hero(2, true)],
  gear: [gear(10, 1), gear(20, 2), gear(30, null)],
  accessories: [],
};

describe('box share payload', () => {
  it('shares invokers only, by default without storage or gear', () => {
    const p = boxSharePayload(doc, { storage: false, equipment: false });
    expect(p.heroes.map((h) => h.id)).toEqual([1]);
    expect(p.heroes[0].gearBySlot).toEqual({});
    expect(p.gear).toEqual([]);
    expect(p).not.toHaveProperty('files');
  });
  it('includes only gear worn by shared invokers, never spare gear', () => {
    expect(boxSharePayload(doc, { storage: false, equipment: true }).gear.map((g) => g.id)).toEqual([10]);
    expect(boxSharePayload(doc, { storage: true, equipment: true }).gear.map((g) => g.id)).toEqual([10, 20]);
  });
});

describe('share ids and teams', () => {
  it('makes unguessable URL-safe ids', () => {
    const ids = new Set(Array.from({ length: 200 }, newShareId));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(SHARE_ID);
  });
  it('checks the team format', () => {
    expect(isTeamDoc({ schema: 1, name: 'Arena', gameVersion: '0.61.1516', heroes: [{ id: 'h1', note: 'lead' }] })).toBe(true);
    expect(isTeamDoc({ schema: 1, name: 'Arena', heroes: [{ slug: 'x' }] })).toBe(false);
  });
});
