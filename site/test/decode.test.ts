import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeAccessories, decodeGear, decodeHeroes, decodeTrophies } from '../src/lib/box/decode';
import { importBackup, importSnapshots, partFor } from '../src/lib/box/importer';
import { encodeAccessories, encodeGear, encodeHeroes, encodeTrophies } from './encode';

// The dataminer's decoded sample (datamine/samples/box-sample.json), re-encoded to the game's binary layout.
const raw = readFileSync(new URL('../../datamine/samples/box-sample.json', import.meta.url), 'utf8');
const sample = JSON.parse(raw);
// JSON.parse rounds the int64 config ids, so take them from the text.
const configIds = [...raw.matchAll(/"configId":\s*(\d+)/g)].map((m) => m[1]);

describe('box decoder', () => {
  it('decodes gear', () => {
    const snap = decodeGear(encodeGear(sample.gear));
    expect(snap.formatVersion).toBe(sample.gear.formatVersion);
    expect(snap.revision).toBe(String(sample.gear.revision));
    expect(snap.items).toEqual(sample.gear.items);
  });

  it('decodes accessories', () => {
    expect(decodeAccessories(encodeAccessories(sample.accessories)).items).toEqual(sample.accessories.items);
  });

  it('decodes heroes with exact config ids', () => {
    const snap = decodeHeroes(encodeHeroes(sample.heroes, configIds));
    const expected = sample.heroes.items.map(({ heroId: _, ...h }: { heroId: string }, n: number) => ({
      ...h,
      configId: configIds[n],
    }));
    expect(snap.items).toEqual(expected);
    expect(snap.items[0].configId).toBe('17264861641262248');
  });

  it('reads long members (multi-byte lengths)', () => {
    const many = Array.from({ length: 3000 }, (_, n) => ({ ...sample.gear.items[n % 10], id: n + 1 }));
    const snap = decodeGear(encodeGear({ ...sample.gear, items: many }));
    expect(snap.items).toHaveLength(3000);
    expect(snap.items[2999].id).toBe(3000);
  });

  it('rejects a truncated file', () => {
    const bytes = encodeGear(sample.gear);
    expect(() => decodeGear(bytes.subarray(0, bytes.length - 20))).toThrow();
  });
});

describe('trophy room', () => {
  const ids = { Fire: 1, Earth: 2, Wind: 3, Water: 4, Light: 5, Dark: 6 };
  const t = (sample as unknown as { trophies: { formatVersion: number; items: { element: string; stat: string; level: number }[] } }).trophies;

  it('decodes member 8 only and drops level 0', () => {
    const items = [...t.items, { element: 'Light', stat: 'AccuracyFlat', level: 0 }];
    const snap = decodeTrophies(encodeTrophies({ formatVersion: t.formatVersion, revision: 7, items }, ids));
    expect(snap.formatVersion).toBe(9);
    expect(snap.revision).toBe('7');
    expect(snap.items).toEqual(t.items);
  });

  it('imports alongside the other files, and a bad arena file only adds a note', async () => {
    const good = new File([encodeTrophies({ formatVersion: 9, revision: 1, items: t.items }, ids) as BlobPart], 'PlayerArenaModel.dat');
    const gear = new File([encodeGear(sample.gear) as BlobPart], 'PlayerRelicsModel.dat');
    const ok = await importSnapshots([gear, good], null, '0.61');
    expect(ok.doc.trophies).toEqual(t.items);
    expect(ok.updated).toContain('trophies');
    const bad = await importSnapshots([gear, new File([Uint8Array.of(9, 1)], 'PlayerArenaModel.dat')], null, '0.61');
    expect(bad.doc.trophies).toBeUndefined();
    expect(bad.updated).toEqual(['gear']);
    expect(bad.notes.join(' ')).toMatch(/Trophy Room/);
  });
});

describe('file picking', () => {
  it('only opens the box files', () => {
    expect(partFor('PlayerArenaModel.dat')).toBe('trophies');
    expect(partFor('PlayerHeroesModel.dat')).toBe('heroes');
    expect(partFor('playerrelicsmodel.dat')).toBe('gear');
    expect(partFor('PlayerAccessoriesModel.dat')).toBe('accessories');
    expect(partFor('PlayerModel.dat')).toBeNull();
    expect(partFor('PlayerAnimasModel.dat')).toBeNull();
  });
});

describe('backups', () => {
  const doc = {
    schema: 1, importedAt: '2026-10-01T00:00:00Z', gameVersion: '0.61.1516', files: {},
    heroes: sample.heroes.items.map((h: object, n: number) => ({ ...h, configId: configIds[n] })),
    gear: sample.gear.items, accessories: sample.accessories.items,
  };
  const file = (v: unknown) => new File([JSON.stringify(v)], 'backup.json');

  it('loads a good backup', async () => {
    expect((await importBackup(file(doc))).gear).toHaveLength(10);
  });

  it('rejects a backup with a malformed item', async () => {
    const { subStats: _, ...broken } = sample.gear.items[0];
    await expect(importBackup(file({ ...doc, gear: [broken] }))).rejects.toThrow();
  });
});
