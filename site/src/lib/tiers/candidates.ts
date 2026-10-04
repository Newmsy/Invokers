// Turns the data pack's heroes and Titans into tier list candidates. Pure, so scripts/draft-tiers.ts and the
// tier pages share it.
import { makeHeroSlugs, slugify } from '../slugs.ts';
import { maxText, readKit, type SkillText } from './kit.ts';
import { corruptionKey, type Candidate } from './lists.ts';

export interface HeroLike {
  id: string;
  name: string;
  element: string;
  class: string;
  faction: string;
  maxStats: { hp: number; atk: number; def: number; acc: number; res: number; skillRecovery: number; manaGen: number; runSpeed: number };
  /** Corruption tolerance stats, e.g. ManaShockTolerance. */
  tolerances?: { stat: string }[];
}

export interface SkillSetLike {
  heroId: string;
  kind: 'hero' | 'titan';
  name: string;
  skills: SkillText[];
}

export function heroCandidates(heroes: HeroLike[], skillSets: SkillSetLike[]): Candidate[] {
  const skills = new Map(skillSets.map((s) => [s.heroId, s.skills]));
  const slugs = makeHeroSlugs(heroes);
  return heroes.map((h) => {
    const s = h.maxStats;
    return {
      slug: slugs.get(h.id)!,
      kit: readKit(skills.get(h.id) ?? [], s),
      stats: {
        bulk: s.hp * (1 + s.def / 1000),
        acc: s.acc,
        res: s.res,
        skillRecovery: s.skillRecovery,
        manaGen: s.manaGen,
        runSpeed: s.runSpeed,
      },
      class: String(h.class),
      element: h.element,
      tolerances: (h.tolerances ?? []).map((t) => corruptionKey(t.stat)),
    };
  });
}

export interface TitanInfo {
  id: string;
  slug: string;
  name: string;
  /** The faction whose Invokers can bind it, or undefined for a Titan any Invoker can use. */
  faction?: string;
  /** Rare, Epic, Legendary or Mythical. */
  rarity?: string;
  /** "Melee Attacker" or "Tank", as the game shows it. */
  role?: string;
}

/** Titan ids carry the same faction code as hero ids (e.g. LTS); a code no hero shares means any faction. */
export function titanInfo(heroes: HeroLike[], skillSets: SkillSetLike[]): TitanInfo[] {
  const factionByCode = new Map(heroes.map((h) => [h.id.match(/^[A-Z]+/)?.[0] ?? '', h.faction]));
  return skillSets
    .filter((s) => s.kind === 'titan')
    .map((s) => ({
      id: s.heroId,
      slug: slugify(s.name),
      name: s.name,
      faction: factionByCode.get(s.heroId.replace(/^ANIM/, '').match(/^[A-Z]+/)?.[0] ?? ''),
    }));
}

/**
 * Titans have no stats of their own; their passive raises the bound Invoker's. A passive that raises HP, DEF,
 * ACC, RES, Mana Gen, Skill Recovery or Move SPD counts towards that stat; one that raises ATK or crit adds
 * a quarter to its damage, and Combo or Skill SPD adds 15%.
 */
export function titanCandidates(heroes: HeroLike[], skillSets: SkillSetLike[]): Candidate[] {
  const bySlug = new Map(titanInfo(heroes, skillSets).map((t) => [t.id, t.slug]));
  return skillSets
    .filter((s) => s.kind === 'titan')
    .map((s) => {
      const kit = readKit(s.skills);
      const passive = s.skills.filter((k) => k.type === 'PassiveBonus').map(maxText).join(' ');
      const raises = (re: RegExp) => (new RegExp(`Bound Invoker's ${re.source}`).test(passive) ? 1 : 0);
      const boost = raises(/(?:ATK|Crit)/) ? 1.25 : raises(/(?:Combo|Skill) SPD/) ? 1.15 : 1;
      kit.single *= boost;
      kit.aoe *= boost;
      return {
        slug: bySlug.get(s.heroId)!,
        kit,
        stats: {
          bulk: raises(/(?:HP|DEF|MAX HP)/),
          acc: raises(/ACC/),
          res: raises(/RES/),
          skillRecovery: raises(/Skill Recovery/),
          manaGen: raises(/Mana Gen/),
          runSpeed: raises(/Move SPD/),
        },
      };
    });
}
