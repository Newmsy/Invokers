// Pack value maths for the Packs page: average pulls from a pack's summon items (bonus summons included,
// mercy left out) and its gems and energy counted in gems.
import packsJson from '../data/packs.json';
import guide from '../data/event-guide.json';
import { summonItem, summons } from './summons/odds';

export interface PackItem { item: string; count: number }
export interface Pack { id: string; name: string; price: number; limit: string; perMonth: number; items: PackItem[] }
export const packData = packsJson as { seen: string; currency: string; packs: Pack[] };
export const energyPerGem = guide.income.energyPerGem;

type Rarities = Record<string, number>;

const add = (a: Rarities, b: Rarities, k = 1) => {
  for (const [r, v] of Object.entries(b)) a[r] = (a[r] ?? 0) + v * k;
  return a;
};

/**
 * Average pulls by rarity from one summon item, counting the bonus items its use earns on average
 * (a Destiny Star is 1/85 of a Divine Star; a Radiant Star's own bonus repeats, 1 + 1/10 + 1/100 ...).
 */
export function averagePerItem(id: string, seen: string[] = []): Rarities {
  const item = summonItem(id);
  if (!item || seen.includes(id)) return {};
  const out = add({}, item.rates);
  let repeat = 1;
  for (const b of summons.bonus.filter((b) => b.uses.includes(id))) {
    if (b.gives === id) repeat /= 1 - 1 / b.every;
    else add(out, averagePerItem(b.gives, [...seen, id]), 1 / b.every);
  }
  for (const r of Object.keys(out)) out[r] *= repeat;
  return out;
}

export interface PackValue {
  /** Average Invokers by rarity from the pack's stars. */
  pulls: Rarities;
  gems: number;
  energy: number;
  /** Gems plus energy at the refill price. */
  gemValue: number;
  /** Price per average Legendary, counting the whole price. */
  perLegendary: number;
  perEpic: number;
}

export function packValue(pack: Pack): PackValue {
  const pulls: Rarities = {};
  let gems = 0;
  let energy = 0;
  for (const { item, count } of pack.items) {
    if (item === 'Gem') gems += count;
    else if (item === 'Energy') energy += count;
    else add(pulls, averagePerItem(item), count);
  }
  const gemValue = gems + energy / energyPerGem;
  const per = (n = 0) => (n > 0 ? pack.price / n : Infinity);
  return { pulls, gems, energy, gemValue, perLegendary: per(pulls.Legendary), perEpic: per(pulls.Epic) };
}

/** Price per average Legendary once the pack's gems and energy are counted at `pricePerGem`. */
export function starPricePerLegendary(pack: Pack, pricePerGem: number): number {
  const v = packValue(pack);
  const starPrice = Math.max(0, pack.price - v.gemValue * pricePerGem);
  return v.pulls.Legendary ? starPrice / v.pulls.Legendary : Infinity;
}
