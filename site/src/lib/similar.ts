// "Similar Invokers" on hero pages: others who could fill the same slot, so a player missing one can find a stand-in.
import { heroes, type Hero } from './data';
import { rarityOrder } from './format';
import { bestTier, tierNames } from './tierData';

const tierRank = (h: Hero) => {
  const best = bestTier(h.id);
  return best ? tierNames.indexOf(best.tier) : tierNames.length;
};
const byStrength = (a: Hero, b: Hero) =>
  tierRank(a) - tierRank(b) || rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity) || a.name.localeCompare(b.name);

/** Same class and element first (the closest swap), then same class in another element; best tier and rarity first. */
export function similarTo(hero: Hero, count = 8): Hero[] {
  const others = heroes.filter((h) => h.id !== hero.id && String(h.class) === String(hero.class));
  const same = others.filter((h) => h.element === hero.element).sort(byStrength);
  const rest = others.filter((h) => h.element !== hero.element).sort(byStrength);
  return [...same, ...rest].slice(0, count);
}
