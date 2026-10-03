// Full-Awakening stats: every node of Awakening levels 1-6 for an Invoker's Awakening type.
// Percent bonuses are of the 1★ level 1 stats and add to the 6★ level 60 base; flat bonuses add
// directly. Checked against the game's max stats for Skoloss the Tomb Baron (12,294 HP, 364 ATK, 1,261 DEF).
import totals from '../data/awakening-totals.json';
import type { Hero, HeroStats } from './data';

type Totals = (typeof totals.types)[number];

const BASE_RES = 10;

/** The Awakening type whose base ratings match this Invoker's (every type sets a distinct mix). */
export function awakeningType(hero: Hero): Totals | undefined {
  const base = hero.maxStats;
  return totals.types.find((t) => {
    const r = t.baseRatings as Partial<Record<keyof HeroStats, number>>;
    return (['acc', 'instinct', 'comboSpeed', 'skillSpeed', 'skillRecovery', 'manaGen'] as const).every(
      (k) => base[k] === (r[k] ?? 0),
    ) && base.res === BASE_RES + (r.res ?? 0);
  });
}

/** 6★ level 60 stats with every Awakening node, plus the extra Titan Invokation Time in seconds. */
export function fullyAwakened(hero: Hero): { stats: HeroStats; titanTime: number } | undefined {
  const type = awakeningType(hero);
  if (!type) return undefined;
  const stats = { ...hero.maxStats };
  const base = hero.statsByRank.One['1'];
  for (const [k, v] of Object.entries(type.percent)) stats[k as keyof HeroStats] += base[k as keyof HeroStats] * v;
  let titanTime = 0;
  for (const [k, v] of Object.entries(type.flat)) {
    if (k === 'titanTime') titanTime += v;
    else stats[k as keyof HeroStats] += v;
  }
  return { stats, titanTime };
}
