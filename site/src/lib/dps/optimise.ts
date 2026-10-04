// Gear optimiser: picks the gear and accessories from the box that give one Invoker the most estimated DPS.
// Each candidate is scored by swapping it into the current build; the best few per slot (plus enough pieces of each
// set to complete it) go into a search that starts from the current gear, from the best single pieces, and from each
// set filled first, then swaps one slot at a time until nothing improves.
import type { BoxAccessory, BoxGear, BoxHero } from '../box/decode';
import type { BoxDoc } from '../box/store';
import { trophyBonuses } from '../box/trophies';
import { simulate, totalsFor, type BossStage, type DpsData, type DpsHero, type Equipment, type Mode, type SkillSlot } from './model';

export const GEAR_SLOTS = ['Weapon', 'Shield', 'Helmet', 'Pauldrons', 'Gauntlets', 'Chestplate', 'Belt', 'Boots'];
/** Accessory slots and the Awakening level that opens each one. */
export const ACCESSORY_SLOTS: [slot: string, awakenLevel: number][] = [
  ['Amulet', 0],
  ['Earrings', 2],
  ['Banner', 4],
  ['Talisman', 5],
  ['Flasks', 6],
];
const KEEP_PER_SLOT = 6;
const KEEP_PER_SET_SLOT = 2;
const MAX_PASSES = 6;

export type Piece = (BoxGear | BoxAccessory) & { kind: 'gear' | 'accessory' };
/** Slot → chosen piece (missing = empty). */
export type Loadout = Record<string, Piece | undefined>;

export interface OptimiseOptions {
  mode: Mode;
  stage: BossStage;
  /** Also consider pieces other Invokers are wearing. */
  takeFromOthers: boolean;
  seconds?: number;
}

export interface OptimiseResult {
  before: number;
  after: number;
  current: Loadout;
  best: Loadout;
  /** Slots whose piece changes. */
  changed: string[];
  /** Per changed slot: DPS gained by that swap, as best gear vs best gear with only that slot put back (fraction). */
  gainBySlot: Record<string, number>;
}

const equipmentOf = (p: Piece): Equipment => ({
  set: p.kind === 'gear' ? (p as BoxGear).set : undefined,
  stats: [p.mainStat, ...p.subStats].filter((s) => !!s).map((s) => [s!.stat, s!.value]),
});

export function openSlots(owned: BoxHero): string[] {
  return [...GEAR_SLOTS, ...ACCESSORY_SLOTS.filter(([, lv]) => (owned.awakenLevel ?? 0) >= lv).map(([s]) => s)];
}

/** Pieces that can go in each slot for this Invoker. */
export function candidates(box: BoxDoc, owned: BoxHero, hero: DpsHero, takeFromOthers: boolean): Record<string, Piece[]> {
  const free = (p: { equippedHeroId: number | null }) => takeFromOthers || p.equippedHeroId === null || p.equippedHeroId === owned.id;
  const out: Record<string, Piece[]> = Object.fromEntries(openSlots(owned).map((s) => [s, []]));
  for (const g of box.gear) if (out[g.slot] && free(g)) out[g.slot].push({ ...g, kind: 'gear' });
  for (const a of box.accessories) {
    // Accessories are faction-locked.
    if (out[a.slot] && free(a) && (!a.faction || a.faction === hero.faction)) out[a.slot].push({ ...a, kind: 'accessory' });
  }
  return out;
}

export function optimise(data: DpsData, box: BoxDoc, owned: BoxHero, opts: OptimiseOptions): OptimiseResult | null {
  const hero = data.heroes.find((h) => h.configId === owned.configId);
  if (!hero) return null;
  const slots = openSlots(owned);
  const pool = candidates(box, owned, hero, opts.takeFromOthers);
  const skillLevels: Partial<Record<SkillSlot, number>> = {};
  for (const s of owned.skills) skillLevels[s.skill as SkillSlot] = Math.max(1, Math.min(11, s.level));

  // Trophy Room bonuses count like one more piece with no set.
  const trophies: Equipment = { stats: trophyBonuses(box.trophies, hero.element) };
  const cache = new Map<string, number>();
  const score = (l: Loadout): number => {
    const key = slots.map((s) => l[s]?.id ?? '-').join(',');
    let v = cache.get(key);
    if (v === undefined) {
      const equipment = [trophies, ...slots.flatMap((s) => (l[s] ? [equipmentOf(l[s]!)] : []))];
      const totals = totalsFor(data, hero, owned.rank, owned.level, owned.awakenNodeIds ?? [], equipment);
      v = simulate(data, { hero, totals, skillLevels, mode: opts.mode, stage: opts.stage, seconds: opts.seconds }).dps;
      cache.set(key, v);
    }
    return v;
  };

  const byId = new Map<string, Piece>();
  for (const s of slots) for (const p of pool[s]) byId.set(`${p.kind}:${p.id}`, p);
  const current: Loadout = {};
  for (const [slot, id] of Object.entries(owned.gearBySlot ?? {})) if (slots.includes(slot)) current[slot] = byId.get(`gear:${id}`);
  for (const [slot, id] of Object.entries(owned.accessoryBySlot ?? {})) if (slots.includes(slot)) current[slot] = byId.get(`accessory:${id}`);

  // Shortlist: best single swaps per slot, plus the best pieces of each set in each slot.
  const shortlist: Record<string, Piece[]> = {};
  const swapScore = new Map<Piece, number>();
  for (const s of slots) {
    for (const p of pool[s]) swapScore.set(p, score({ ...current, [s]: p }));
    const ranked = [...pool[s]].sort((a, b) => swapScore.get(b)! - swapScore.get(a)!);
    const keep = new Set(ranked.slice(0, KEEP_PER_SLOT));
    const perSet = new Map<string, number>();
    for (const p of ranked) {
      if (p.kind !== 'gear') continue;
      const set = (p as BoxGear).set;
      const n = perSet.get(set) ?? 0;
      if (n < KEEP_PER_SET_SLOT) keep.add(p);
      perSet.set(set, n + 1);
    }
    if (current[s]) keep.add(current[s]!);
    shortlist[s] = [...keep];
  }

  const bestSingle: Loadout = Object.fromEntries(slots.map((s) => [s, shortlist[s][0]]));
  const seeds: Loadout[] = [current, bestSingle];
  const sets = new Set(slots.flatMap((s) => shortlist[s].filter((p) => p.kind === 'gear').map((p) => (p as BoxGear).set)));
  for (const set of sets) {
    const seed: Loadout = { ...bestSingle };
    for (const s of GEAR_SLOTS) {
      const pick = shortlist[s]?.find((p) => p.kind === 'gear' && (p as BoxGear).set === set);
      if (pick) seed[s] = pick;
    }
    seeds.push(seed);
  }

  // A piece can only be worn once: slots never share a piece because each slot only holds its own slot's pieces.
  let best = current;
  let bestScore = score(current);
  for (const seed of seeds) {
    let l = { ...seed };
    let v = score(l);
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      let improved = false;
      for (const s of slots) {
        for (const p of [undefined, ...shortlist[s]]) {
          if (p === l[s]) continue;
          const next = { ...l, [s]: p };
          const nv = score(next);
          if (nv > v + 1e-9) {
            l = next;
            v = nv;
            improved = true;
          }
        }
      }
      if (!improved) break;
    }
    if (v > bestScore + 1e-9) {
      best = l;
      bestScore = v;
    }
  }

  const changed = slots.filter((s) => current[s]?.id !== best[s]?.id || current[s]?.kind !== best[s]?.kind);
  const gainBySlot = Object.fromEntries(
    changed.map((s) => {
      const without = score({ ...best, [s]: current[s] });
      return [s, without > 0 ? bestScore / without - 1 : 0];
    }),
  );
  return { before: score(current), after: bestScore, current, best, changed, gainBySlot };
}

/** Gear sets a loadout completes: set id, pieces worn and the bonus tiers (3, 5 …) that are active. */
export function activeSets(data: DpsData, loadout: Loadout): { set: string; pieces: number; tiers: number[] }[] {
  const counts = new Map<string, number>();
  for (const p of Object.values(loadout)) if (p?.kind === 'gear') counts.set((p as BoxGear).set, (counts.get((p as BoxGear).set) ?? 0) + 1);
  return [...counts]
    .map(([set, pieces]) => ({ set, pieces, tiers: Object.keys(data.sets[set] ?? {}).map(Number).filter((n) => n <= pieces).sort((a, b) => a - b) }))
    .filter((s) => s.tiers.length)
    .sort((a, b) => b.pieces - a.pieces);
}
