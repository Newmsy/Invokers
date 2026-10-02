// Summon odds maths, shared by the Summons page and its browser script. Only the small summons.json is
// imported here, so the page script stays light; hero pools are worked out at build time in ./index.
import summonsJson from '../../data/summons.json';
import type { SummonData, SummonItem } from './types';

export const summons = summonsJson as unknown as SummonData;

export function summonItem(id: string): SummonItem | undefined {
  return summons.items.find((i) => i.id === id);
}

/** Summon items a player can own and pull (pity entries left out). */
export const pullableItems = summons.items.filter((i) => !i.pity);

/** How a summon item reads on the page: its name, or "random Legendary Invoker" for a pity entry. */
export function bonusLabel(id: string): string {
  const item = summonItem(id);
  if (!item) return id;
  return item.pity ? `random ${Object.keys(item.rates)[0]} ${item.kind === 'titan' ? 'Titan' : 'Invoker'}` : item.name;
}

/** Chance of at least one hit in n independent pulls at chance p. */
export function atLeastOne(p: number, n: number): number {
  if (n <= 0 || p <= 0) return 0;
  if (p >= 1) return 1;
  return 1 - (1 - p) ** n;
}

/** Pulls needed for an `q` chance of at least one hit at chance p per pull. */
export function pullsFor(p: number, q: number): number {
  if (p >= 1) return 1;
  if (p <= 0) return Infinity;
  return Math.ceil(Math.log(1 - q) / Math.log(1 - p));
}

/** Bonus items earned from n uses of an item (bonus items themselves not counted). */
export function bonusFrom(itemId: string, n: number): { item: string; count: number }[] {
  return summons.bonus
    .filter((b) => b.uses.includes(itemId))
    .map((b) => ({ item: b.gives, count: Math.floor(n / b.every) }))
    .filter((b) => b.count > 0);
}

export interface OddsInput {
  item: string;
  rarity: string;
  pulls: number;
  /** Size of the hero pool when asking for one specific hero (Legendary from Destiny or Radiant Stars). */
  poolSize?: number;
  /** Apply the estimated mercy counts. */
  mercy?: boolean;
  /** Pulls already made since the last pull of this rarity. */
  since?: number;
  /** No pull of this rarity from this item yet (Destiny Star first-Legendary rule). */
  firstTime?: boolean;
  /** Add the bonus items these pulls earn. */
  bonus?: boolean;
}

export interface OddsResult {
  /** Chance per pull of the chosen item. */
  perPull: number;
  /** Chance of at least one in the pulls (and bonus pulls, if counted). */
  chance: number;
  /** Average number you'd get across many players making the same pulls. */
  expected: number;
  /** Pull count at which the estimated mercy guarantees one, if within the pulls. */
  guaranteedBy?: number;
  /** Bonus items counted. */
  bonusItems: { item: string; count: number }[];
}

export function odds(input: OddsInput): OddsResult {
  const item = summonItem(input.item);
  if (!item) return { perPull: 0, chance: 0, expected: 0, bonusItems: [] };
  const n = Math.max(0, Math.floor(input.pulls));
  let perPull = item.rates[input.rarity] ?? 0;
  const specific = !!input.poolSize;
  if (specific) perPull /= input.poolSize!;

  let miss = n > 0 ? (1 - perPull) ** n : 1;
  let expected = n * perPull;
  const bonusItems: { item: string; count: number }[] = [];
  // Specific-hero odds stay on the chosen item: other items' pools are not known hero by hero.
  if (input.bonus && !specific) {
    for (const b of bonusFrom(item.id, n)) {
      const p = summonItem(b.item)?.rates[input.rarity] ?? 0;
      if (p <= 0) continue;
      bonusItems.push(b);
      miss *= (1 - p) ** b.count;
      expected += b.count * p;
    }
  }

  let guaranteedBy: number | undefined;
  if (input.mercy && !specific) {
    const limit = (input.firstTime && item.firstMercy?.[input.rarity]) || item.mercy?.[input.rarity];
    if (limit) {
      const left = Math.max(1, limit - Math.max(0, Math.floor(input.since ?? 0)));
      if (n >= left) {
        guaranteedBy = left;
        miss = 0;
      }
    }
  }
  return { perPull, chance: n > 0 ? 1 - miss : 0, expected, guaranteedBy, bonusItems };
}
