// What each boss does in battle and who counters it, for the boss guides (src/data/boss-abilities.json).
import abilitiesJson from '../data/boss-abilities.json';
import { heroes, type Hero } from './data';

export interface BossAbility {
  name: string;
  text: string;
}

/** why: "both" = has both of the boss's corruption tolerances; "pick" = a strong choice; else an effect it brings. */
export interface BossPick {
  hero: Hero;
  why: string;
}

interface RawBoss {
  passive: string;
  abilities: BossAbility[];
  picks: { name: string; why: string }[];
}

const raw = (abilitiesJson as { bosses: Record<string, RawBoss> }).bosses;

export function bossAbilities(bossId: string): { passive: string; abilities: BossAbility[]; picks: BossPick[] } | undefined {
  const b = raw[bossId];
  if (!b) return undefined;
  const picks = b.picks.map((p) => {
    const hero = heroes.find((h) => h.name === p.name);
    if (!hero) throw new Error(`boss-abilities.json: no Invoker named "${p.name}"`);
    return { hero, why: p.why };
  });
  return { passive: b.passive, abilities: b.abilities, picks };
}

export const bossAbilityIds = Object.keys(raw);
