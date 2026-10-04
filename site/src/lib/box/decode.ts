// Decodes the game's local "box" snapshots (heroes, gear, accessories) into plain JSON.
// TypeScript port of datamine/scripts/decode_box.py; the member order per model is documented there.
// Files live in %USERPROFILE%\AppData\LocalLow\Hit_Zone\Invokers\aggregate_snapshots\.
import { ENUMS } from './enums';
import { Reader, bool, f64, i32, i64, nullableI32, uint } from './memorypack';
import type { BoxTrophy } from './trophies';

export interface StatRoll {
  id: number;
  stat: string;
  value: number;
  upgrades: number;
  rollsSum: number;
}

export interface BoxGear {
  id: number;
  slot: string;
  rank: string;
  rarity: string;
  set: string;
  equippedHeroId: number | null;
  level: number;
  seen: boolean;
  mainStat: StatRoll | null;
  subStats: StatRoll[];
}

export interface BoxAccessory extends Omit<BoxGear, 'set'> {
  faction: string;
}

export interface BoxHero {
  id: number;
  /** int64 hero config id as a decimal string (too big for a JS number). Matches heroes.json configId. */
  configId: string;
  rank: string;
  level: number;
  locked: boolean;
  inStorage: boolean;
  marker: string;
  skills: { skill: string; level: number }[];
  gearBySlot: Record<string, number>;
  accessoryBySlot: Record<string, number>;
  awakenLevel: number;
  awakenNodeIds: number[];
  chroma: boolean;
  skin: string | null;
}

export interface Snapshot<T> {
  formatVersion: number;
  /** Increases every time the game rewrites this area; a higher number is a newer file. */
  revision: string;
  items: T[];
}

/** The import files, by the name the game gives them. PlayerModel.dat (the profile) is deliberately absent. */
export const BOX_FILES = {
  heroes: 'PlayerHeroesModel.dat',
  gear: 'PlayerRelicsModel.dat',
  accessories: 'PlayerAccessoriesModel.dat',
  trophies: 'PlayerArenaModel.dat',
} as const;
export type BoxPart = keyof typeof BOX_FILES;

/** Format byte each decoder was written against (game 0.61.1516). */
export const KNOWN_FORMAT: Record<BoxPart, number> = { heroes: 2, gear: 4, accessories: 5, trophies: 9 };

/** Trophy Room element ids. */
const ELEMENTS: Record<number, string> = { 1: 'Fire', 2: 'Earth', 3: 'Wind', 4: 'Water', 5: 'Light', 6: 'Dark' };

const enumName = (kind: string, value: number): string => ENUMS[kind]?.[String(value)] ?? String(value);

function readSnapshot(data: Uint8Array): { formatVersion: number; revision: string; model: Uint8Array[] } {
  if (data.length < 2) throw new RangeError('File is empty');
  const outer = new Reader(data, 1).requiredObject();
  return {
    formatVersion: data[0],
    revision: i64(outer[0]).toString(),
    model: new Reader(outer[2]).requiredObject(),
  };
}

/** Iterates a dictionary<int, object> member, yielding each value's members. */
function* dictValues(blob: Uint8Array): Generator<Uint8Array[]> {
  const r = new Reader(blob);
  const count = r.i32();
  for (let n = 0; n < count; n++) {
    r.i32(); // key = InventoryId, repeated inside the value
    yield r.requiredObject();
  }
}

function bonuses(blob: Uint8Array): StatRoll[] {
  if (blob.length === 0) return [];
  const r = new Reader(blob);
  const out: StatRoll[] = [];
  const count = r.i32();
  for (let n = 0; n < count; n++) {
    const b = r.requiredObject();
    out.push({
      id: i32(b[0]),
      stat: enumName('CharacterStatBonus', i32(b[1])),
      value: round(f64(b[2])),
      upgrades: i32(b[3]),
      rollsSum: round(f64(b[4])),
    });
  }
  return out;
}

const round = (v: number): number => Math.round(v * 1e6) / 1e6;

export function decodeGear(data: Uint8Array): Snapshot<BoxGear> {
  // PlayerRelicsModel: LastId, RelicsById, Randoms
  // PlayerRelic: InventoryId, Slot, Rank, Rarity, Set, EquippedHeroId (int?), Level, IsSeen, Bonuses
  const { model, ...meta } = readSnapshot(data);
  const items: BoxGear[] = [];
  for (const m of dictValues(model[1])) {
    const b = bonuses(m[8]);
    items.push({
      id: i32(m[0]),
      slot: enumName('RelicSlot', i32(m[1])),
      rank: enumName('Rank', i32(m[2])),
      rarity: enumName('RelicRarity', i32(m[3])),
      set: enumName('RelicSet', i32(m[4])),
      equippedHeroId: nullableI32(m[5]),
      level: i32(m[6]),
      seen: bool(m[7]),
      mainStat: b[0] ?? null,
      subStats: b.slice(1),
    });
  }
  return { ...meta, items };
}

export function decodeAccessories(data: Uint8Array): Snapshot<BoxAccessory> {
  // PlayerAccessory: InventoryId, Slot, Rank, Rarity, Faction (16-bit enum), EquippedHeroId, Level, IsSeen, Bonuses
  const { model, ...meta } = readSnapshot(data);
  const items: BoxAccessory[] = [];
  for (const m of dictValues(model[1])) {
    const b = bonuses(m[8]);
    items.push({
      id: i32(m[0]),
      slot: enumName('AccessorySlot', i32(m[1])),
      rank: enumName('Rank', i32(m[2])),
      rarity: enumName('AccessoryRarity', i32(m[3])),
      faction: enumName('CharacterFaction', uint(m[4])),
      equippedHeroId: nullableI32(m[5]),
      level: i32(m[6]),
      seen: bool(m[7]),
      mainStat: b[0] ?? null,
      subStats: b.slice(1),
    });
  }
  return { ...meta, items };
}

export function decodeHeroes(data: Uint8Array): Snapshot<BoxHero> {
  // PlayerHeroesModel: LastId, HeroesById, ...
  // PlayerHero (22 members, removed fields stay as empty slots):
  //   0 InventoryId, 1 ConfigId (int64), 2 Rank, 3 Level, 6 Locked, 7 InStorage, 8 Marker,
  //   11 RelicIdBySlot, 12 AccessoryIdBySlot, 15 AwakeLevel, 16 AwakeNodeIds, 17 ChromaEnabled, 18 Skin,
  //   21 SkillLevels (int32 pairs: Kind, Level)
  const { model, ...meta } = readSnapshot(data);
  const items: BoxHero[] = [];
  for (const m of dictValues(model[1])) {
    items.push({
      id: i32(m[0]),
      configId: i64(m[1]).toString(),
      rank: enumName('Rank', i32(m[2])),
      level: i32(m[3]),
      locked: bool(m[6]),
      inStorage: bool(m[7]),
      marker: enumName('CharacterMarker', i32(m[8])),
      skills: list(m[21], (r) => ({ skill: enumName('SkillKind', r.i32()), level: r.i32() })),
      gearBySlot: slotMap(m[11], 'RelicSlot'),
      accessoryBySlot: slotMap(m[12], 'AccessorySlot'),
      awakenLevel: i32(m[15]),
      awakenNodeIds: list(m[16], (r) => r.i32()),
      chroma: m[17] ? bool(m[17]) : false,
      skin: m[18]?.length ? enumName('CharacterSkin', i32(m[18])) : null,
    });
  }
  return { ...meta, items };
}

export function decodeTrophies(data: Uint8Array): Snapshot<BoxTrophy> {
  // PlayerArenaModel: ONLY member 8 is read, the Trophy Room: a list of {Element, Stat (CharacterStatBonus), Level}.
  // The other members hold Arena opponents (other players' names, ids and teams), the defense team and shop state;
  // they are never decoded.
  const { model, ...meta } = readSnapshot(data);
  const items = list(model[8], (r) => r.requiredObject())
    .map((m) => ({ element: ELEMENTS[i32(m[0])] ?? String(i32(m[0])), stat: enumName('CharacterStatBonus', i32(m[1])), level: i32(m[2]) }))
    .filter((t) => t.level > 0);
  return { ...meta, items };
}

function list<T>(blob: Uint8Array | undefined, read: (r: Reader) => T): T[] {
  if (!blob?.length) return [];
  const r = new Reader(blob);
  const count = Math.max(0, r.i32());
  return Array.from({ length: count }, () => read(r));
}

function slotMap(blob: Uint8Array, kind: string): Record<string, number> {
  const out: Record<string, number> = {};
  if (!blob.length) return out;
  const r = new Reader(blob);
  const count = Math.max(0, r.i32());
  for (let n = 0; n < count; n++) {
    const slot = enumName(kind, r.i32());
    out[slot] = r.i32();
  }
  return out;
}
