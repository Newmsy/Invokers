// Summon data for the Summons page at build time: the item list and which heroes each Legendary pull can give.
import { heroes } from '../data';
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

