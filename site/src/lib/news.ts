// News entries: the "by the numbers" box that sits under each report, worked out from the hero data so every
// figure matches the rest of the site.
import { heroes, type Hero, type HeroStats } from './data';
import { fullyAwakened } from './awakening';
import { heroTiers, tierNames } from './tierData';
import { similarTo } from './similar';
import summons from '../data/summons.json';

export const newsKinds = {
  spotlight: 'Chase hero spotlight',
  patch: 'Patch notes',
  event: 'Event',
  announcement: 'Announcement',
} as const;
export type NewsKind = keyof typeof newsKinds;

export function heroByName(name: string): Hero {
  const h = heroes.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!h) throw new Error(`News names an unknown Invoker: "${name}"`);
  return h;
}

const maxed = (h: Hero): HeroStats => fullyAwakened(h)?.stats ?? h.maxStats;

/** 1-based place of `hero` among `pool` for one stat, highest first. */
function place(hero: Hero, pool: Hero[], key: keyof HeroStats): number {
  const v = maxed(hero)[key];
  return pool.filter((h) => maxed(h)[key] > v).length + 1;
}

export interface HeroFacts {
  hero: Hero;
  stats: HeroStats;
  awakened: boolean;
  /** Place among all Legendaries and among Legendaries of the same class, for HP, ATK and DEF. */
  ranks: { key: 'hp' | 'atk' | 'def'; label: string; value: number; legendary: number; legendaryOf: number; cls: number; clsOf: number }[];
  tiers: { id: string; label: string; tier: string }[];
  topTiers: number;
  summonable: boolean;
  similar: Hero[];
}

export function heroFacts(name: string): HeroFacts {
  const hero = heroByName(name);
  const legendaries = heroes.filter((h) => h.rarity === hero.rarity);
  const sameClass = legendaries.filter((h) => String(h.class) === String(hero.class));
  const stats = maxed(hero);
  const tiers = heroTiers(hero.id)
    .map((t) => ({ id: t.list.id, label: t.list.label, tier: t.tier }))
    .sort((a, b) => tierNames.indexOf(a.tier as never) - tierNames.indexOf(b.tier as never));
  return {
    hero,
    stats,
    awakened: !!fullyAwakened(hero),
    ranks: (
      [
        ['hp', 'HP'],
        ['atk', 'ATK'],
        ['def', 'DEF'],
      ] as const
    ).map(([key, label]) => ({
      key,
      label,
      value: Math.round(stats[key]),
      legendary: place(hero, legendaries, key),
      legendaryOf: legendaries.length,
      cls: place(hero, sameClass, key),
      clsOf: sameClass.length,
    })),
    tiers,
    topTiers: tiers.filter((t) => t.tier === 'S').length,
    summonable: !summons.unsummonable.includes(hero.name),
    similar: similarTo(hero, 4),
  };
}
