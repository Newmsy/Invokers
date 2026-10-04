// Test helper: encodes decoded box JSON back into the game's MemoryPack snapshot layout, so the decoder can be
// tested without committing raw game files. Mirrors the layout in datamine/samples/README.md.
import { ENUMS } from '../src/lib/box/enums';

type Bytes = Uint8Array;

const concat = (parts: Bytes[]): Bytes => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
};

const num = (size: number, write: (v: DataView) => void): Bytes => {
  const b = new Uint8Array(size);
  write(new DataView(b.buffer));
  return b;
};

export const i32 = (v: number): Bytes => num(4, (d) => d.setInt32(0, v, true));
export const i64 = (v: bigint): Bytes => num(8, (d) => d.setBigInt64(0, v, true));
export const u8 = (v: number): Bytes => Uint8Array.of(v);
export const f64 = (v: number): Bytes => i64(BigInt(Math.round(v * 2 ** 32)));
export const nullableI32 = (v: number | null): Bytes =>
  v === null ? new Uint8Array(8) : concat([Uint8Array.of(1, 0, 0, 0), i32(v)]);

/** Lengths use the short form, the u16 form and the i32 form, so every VarInt path the files use is exercised. */
const varint = (n: number): Bytes =>
  n <= 127
    ? Uint8Array.of(n)
    : n <= 0xffff
      ? concat([Uint8Array.of(0x100 - 123), num(2, (d) => d.setUint16(0, n, true))])
      : concat([Uint8Array.of(0x100 - 126), i32(n)]);

export const object = (members: Bytes[]): Bytes => concat([u8(members.length), ...members.map((m) => varint(m.length)), ...members]);

const list = <T>(items: T[], write: (t: T) => Bytes): Bytes => concat([i32(items.length), ...items.map(write)]);

export const code = (kind: string, name: string): number => {
  const hit = Object.entries(ENUMS[kind]).find(([, v]) => v === name);
  if (!hit) throw new Error(`No ${kind} named ${name}`);
  return Number(hit[0]);
};

const snapshot = (formatVersion: number, revision: bigint, model: Bytes): Bytes =>
  concat([u8(formatVersion), object([i64(revision), new Uint8Array(8), model])]);

const dict = <T extends { id: number }>(items: T[], value: (t: T) => Bytes): Bytes =>
  concat([i32(items.length), ...items.flatMap((t) => [i32(t.id), value(t)])]);

interface Roll { id: number; stat: string; value: number; upgrades: number; rollsSum: number }
const bonuses = (rolls: Roll[]): Bytes =>
  list(rolls, (r) => object([i32(r.id), i32(code('CharacterStatBonus', r.stat)), f64(r.value), i32(r.upgrades), f64(r.rollsSum)]));

/* eslint-disable @typescript-eslint/no-explicit-any */
export function encodeGear(s: { formatVersion: number; revision: number; items: any[] }): Bytes {
  const relic = (g: any) =>
    object([
      i32(g.id), i32(code('RelicSlot', g.slot)), i32(code('Rank', g.rank)), i32(code('RelicRarity', g.rarity)),
      i32(code('RelicSet', g.set)), nullableI32(g.equippedHeroId), i32(g.level), u8(g.seen ? 1 : 0),
      bonuses([g.mainStat, ...g.subStats]),
    ]);
  return snapshot(s.formatVersion, BigInt(s.revision), object([i32(99999), dict(s.items, relic), new Uint8Array()]));
}

export function encodeAccessories(s: { formatVersion: number; revision: number; items: any[] }): Bytes {
  const acc = (a: any) =>
    object([
      i32(a.id), i32(code('AccessorySlot', a.slot)), i32(code('Rank', a.rank)), i32(code('AccessoryRarity', a.rarity)),
      num(2, (d) => d.setUint16(0, code('CharacterFaction', a.faction), true)), nullableI32(a.equippedHeroId),
      i32(a.level), u8(a.seen ? 1 : 0), bonuses([a.mainStat, ...a.subStats]),
    ]);
  return snapshot(s.formatVersion, BigInt(s.revision), object([i32(99999), dict(s.items, acc), new Uint8Array()]));
}

export function encodeHeroes(s: { formatVersion: number; revision: number; items: any[] }, configIds: string[]): Bytes {
  const slots = (m: Record<string, number>, kind: string) =>
    list(Object.entries(m), ([slot, id]) => concat([i32(code(kind, slot)), i32(id)]));
  const hero = (h: any, n: number) => {
    const members: Bytes[] = Array.from({ length: 22 }, () => new Uint8Array());
    members[0] = i32(h.id);
    members[1] = i64(BigInt(configIds[n]));
    members[2] = i32(code('Rank', h.rank));
    members[3] = i32(h.level);
    members[4] = i32(0);
    members[5] = i32(0);
    members[6] = u8(h.locked ? 1 : 0);
    members[7] = u8(h.inStorage ? 1 : 0);
    members[8] = i32(code('CharacterMarker', h.marker));
    members[11] = slots(h.gearBySlot, 'RelicSlot');
    members[12] = slots(h.accessoryBySlot, 'AccessorySlot');
    members[15] = i32(h.awakenLevel);
    members[16] = list(h.awakenNodeIds as number[], i32);
    members[17] = u8(h.chroma ? 1 : 0);
    members[18] = i32(code('CharacterSkin', h.skin));
    members[21] = list(h.skills as any[], (k) => concat([i32(code('SkillKind', k.skill)), i32(k.level)]));
    return object(members);
  };
  const body = concat([i32(s.items.length), ...s.items.flatMap((h, n) => [i32(h.id), hero(h, n)])]);
  return snapshot(s.formatVersion, BigInt(s.revision), object([i32(99999), body]));
}

/** Arena snapshot: only member 8 (Trophy Room) is real; the rest stand in for opponent lists etc. */
export function encodeTrophies(s: { formatVersion: number; revision: number; items: any[] }, elementIds: Record<string, number>): Bytes {
  const members: Bytes[] = Array.from({ length: 12 }, (_, n) => new Uint8Array(n === 3 ? 300 : 0).fill(0xff));
  members[8] = list(s.items, (t) => object([i32(elementIds[t.element]), i32(code('CharacterStatBonus', t.stat)), i32(t.level)]));
  return snapshot(s.formatVersion, BigInt(s.revision), object(members));
}
