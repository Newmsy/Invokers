// Summon data for the Summons page at build time: the item list and which heroes each Legendary pull can give.
import { heroes, titans } from '../data';
import { summons } from './odds';
import type { SummonItem } from './types';

export * from './odds';
export type * from './types';

export const summonRarities = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
/** Heroes a Legendary pull from this item can give (inside a rarity every hero has the same weight). */
export function legendaryPool(item: SummonItem): { id: string; name: string }[] {
  if (!item.legendaryPool) return [];
  const lightDark = (e: string) => e === 'Light' || e === 'Dark';
  return heroes
    .filter((h) => h.rarity === 'Legendary' && !summons.unsummonable.includes(h.name))
    .filter((h) => (item.legendaryPool === 'lightDark' ? lightDark(h.element) : !lightDark(h.element)))
    .map((h) => ({ id: h.id, name: h.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}


const lightDark = (e: string) => e === 'Light' || e === 'Dark';
const groupName = { elemental: 'Fire, Water, Earth or Wind', lightDark: 'Light or Dark' };

/** A "specific one" choice in the odds calculator: one of `size` equally likely heroes or Titans sharing `rate`. */
export interface PoolChoice {
  label: string;
  size: number;
  rate: number;
  noun: string;
}

/** The specific-pick choices for a rarity from an item: one, or one per group when the item splits the rate. */
export function poolChoices(item: SummonItem, rarity: string): PoolChoice[] {
  const rate = item.rates[rarity];
  if (!rate || rate >= 1) return [];
  if (item.kind === 'titan') {
    const size = titans.filter((t) => (t.rarity === 'Mythical' ? 'Mythic' : t.rarity) === rarity).length;
    return size > 1 ? [{ label: `Specific ${rarity}`, size, rate, noun: `${rarity} Titans` }] : [];
  }
  const ofRarity = heroes.filter((h) => h.rarity === rarity && !summons.unsummonable.includes(h.name));
  const count = (g: 'elemental' | 'lightDark') => ofRarity.filter((h) => lightDark(h.element) === (g === 'lightDark')).length;
  const split = item.split?.[rarity];
  if (split) {
    return (['elemental', 'lightDark'] as const).map((g) => ({
      label: `Specific ${groupName[g]} ${rarity}`,
      size: count(g),
      rate: split[g],
      noun: `${groupName[g]} ${rarity}s`,
    }));
  }
  const pool = rarity === 'Legendary' ? item.legendaryPool ?? item.pool : item.pool;
  const size = pool ? count(pool) : ofRarity.length;
  return size > 1 ? [{ label: `Specific ${rarity}`, size, rate, noun: `${rarity}s` }] : [];
}
