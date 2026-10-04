// The tier lists: one per game mode and per boss, for Invokers and for Titans. Each list says what helps there
// (from the boss's own dos and don'ts, or the mode's tips), which drives the "brings" chips on the tier pages
// and the draft scores in scripts/draft-tiers.ts. Pure: no Astro or Vite imports.
import type { Kit, Tag } from './kit.ts';

export const tierNames = ['S', 'A', 'B', 'C', 'D'] as const;
export type TierName = (typeof tierNames)[number];

/** Numeric strengths, compared as a percentile within Invokers or within Titans. */
export type Stat = 'single' | 'aoe' | 'bulk' | 'acc' | 'res' | 'skillRecovery' | 'manaGen' | 'runSpeed';
export type Factor = Stat | Tag;

export interface TierListDef {
  /** URL part; for a boss it matches the boss page slug (bossSlug in lib/data). */
  id: string;
  label: string;
  group: 'Modes' | 'Relic bosses' | 'Clan boss' | 'Crest bosses' | 'Pentiax' | 'Omnissi';
  /** One line on what wins here, shown above the list. */
  summary: string;
  /** What helps, by weight. Negative weights are things the boss punishes. */
  weights: Partial<Record<Factor, number>>;
  /** Invoker class bonus or penalty (Titans have no class). */
  classes?: Record<string, number>;
  /** Invoker element bonus (Light and Dark have advantage over each other). */
  elements?: Record<string, number>;
}

export const tierLists: TierListDef[] = [
  {
    id: 'campaign',
    label: 'Campaign',
    group: 'Modes',
    summary: 'Waves of enemies: AoE damage first, then sustain.',
    weights: { aoe: 3, single: 1, bulk: 1, teamHeal: 1, shields: 0.5, cleanse: 0.5, hardCC: 0.5, teamBuffs: 0.5, runSpeed: 0.3 },
  },
  {
    id: 'spires',
    label: 'Spires',
    group: 'Modes',
    summary: 'Wave clear, sustain and Titans for the big waves. Each floor has its own buffs and debuffs.',
    weights: { aoe: 2.5, single: 1.5, bulk: 1, teamHeal: 1, titanMana: 1, cleanse: 0.7, immunity: 0.5, hardCC: 0.5, teamBuffs: 0.5, shields: 0.5 },
  },
  {
    id: 'arena',
    label: 'Arena',
    group: 'Modes',
    summary: 'Skills start at 50% cooldown: control, burst, Skill Recovery and an early Titan win fights.',
    weights: {
      single: 2.5, aoe: 0.5, bulk: 1, hardCC: 2, taunt: 0.5, acc: 0.8, skillRecovery: 0.8, manaGen: 0.6, titanMana: 0.8,
      stripBuffs: 0.6, stealBuffs: 0.8, immunity: 0.7, cleanse: 0.7, revive: 0.6, unkillable: 0.6, blockRevive: 0.6,
      healReduction: 0.5, shields: 0.5,
    },
  },
  {
    id: 'ulgorim',
    label: 'Ulgorim',
    group: 'Relic bosses',
    summary: 'Heal Reduction and high damage to break the Power Totems. He is immune to crowd control.',
    weights: { healReduction: 3, single: 2, aoe: 1, bulk: 0.5 },
  },
  {
    id: 'althar',
    label: 'Althar',
    group: 'Relic bosses',
    summary: 'A race: Block Revive, high damage, AoE for his minions and Move SPD to keep up.',
    weights: { blockRevive: 3, single: 2, aoe: 1.5, runSpeed: 1, moveSpdUp: 1, bulk: 0.5 },
  },
  {
    id: 'sakiel',
    label: 'Sakiel',
    group: 'Relic bosses',
    summary: 'Mindworm, Heal Reduction and ACC to steal buffs. Bleed and Burn are weak here.',
    weights: { mindworm: 3, healReduction: 1.5, stealBuffs: 1.5, hardCC: 1, acc: 1, res: 0.7, single: 1.5, bulk: 0.5, bleedBurn: -1 },
  },
  {
    id: 'sorgott',
    label: 'Sorgott',
    group: 'Clan boss',
    summary: 'Jinx or buff steals, Immunity, debuff removal and AoE for the Crypt Rats. Mindworm does nothing.',
    weights: { jinx: 2, stealBuffs: 2, stripBuffs: 1.5, immunity: 1.5, cleanse: 1.5, res: 1, aoe: 2, single: 1, bulk: 0.5 },
  },
  {
    id: 'pentiax',
    label: 'Pentiax',
    group: 'Pentiax',
    summary: 'Titans do the work: Titan Mana, heals and a way past the Burns.',
    weights: { titanMana: 3, manaGen: 1.5, teamHeal: 1.5, cleanse: 1, immunity: 1, single: 1.5, bulk: 0.5 },
  },
  {
    id: 'hyxxis',
    label: 'Hyxxis',
    group: 'Crest bosses',
    summary: 'Tanks, a dedicated healer and AoE for the Brood Eggs. She is immune to crowd control.',
    weights: { teamHeal: 2, aoe: 1.5, single: 1, bulk: 1 },
    classes: { Tank: 2.5 },
  },
  {
    id: 'galvos',
    label: 'Galvos',
    group: 'Crest bosses',
    summary: 'One Tank plus Supports that keep it buffed, with a balance of buffs and debuffs.',
    weights: { teamBuffs: 1.5, weaken: 0.5, defDown: 0.5, single: 1, bulk: 0.7 },
    classes: { Tank: 1.5, Support: 1.5 },
  },
  {
    id: 'yskara',
    label: 'Yskara',
    group: 'Crest bosses',
    summary: 'Melee Attackers get +100% ATK here. Bring AoE for the minion waves and Move SPD.',
    weights: { aoe: 2, single: 1.5, runSpeed: 1, moveSpdUp: 0.5, bulk: 0.5 },
    classes: { MeleeAttacker: 2.5, RangedAttacker: -2 },
  },
  {
    id: 'koltmos',
    label: 'Koltmos',
    group: 'Crest bosses',
    summary: 'Ranged Attackers and burst damage to take out the Doomclaws.',
    weights: { single: 2, aoe: 1.5, bulk: 0.5 },
    classes: { RangedAttacker: 2.5, MeleeAttacker: -0.5 },
  },
  {
    id: 'omnissi-astral',
    label: 'Omnissi (Astral)',
    group: 'Omnissi',
    summary: 'Heavy damage and a healer. Buffs help less.',
    weights: { single: 2.5, aoe: 0.5, teamHeal: 2, bulk: 0.7, teamBuffs: -0.8 },
  },
  {
    id: 'omnissi-fire',
    label: 'Omnissi (Fire)',
    group: 'Omnissi',
    summary: 'Immunity and debuff removal, with enough RES. You will not out-heal the Burns.',
    weights: { immunity: 3, cleanse: 2.5, res: 1.5, single: 1.5, bulk: 0.7 },
  },
  {
    id: 'omnissi-dark',
    label: 'Omnissi (Dark)',
    group: 'Omnissi',
    summary: 'Combo SPD Down, debuff extensions and ACC. Enemy MAX HP damage and buffs fall short.',
    weights: { comboSpdDown: 3, extendDebuffs: 2, acc: 1.5, single: 1.5, bulk: 0.5, maxHpDamage: -1, teamBuffs: -0.5 },
    elements: { Light: 1.5 },
  },
  {
    id: 'omnissi-wind',
    label: 'Omnissi (Wind)',
    group: 'Omnissi',
    summary: 'Several sources of Move SPD Down, or someone who extends it.',
    weights: { moveSpdDown: 3, extendDebuffs: 1.5, single: 1.5, bulk: 0.5 },
  },
  {
    id: 'omnissi-water',
    label: 'Omnissi (Water)',
    group: 'Omnissi',
    summary: 'Debuff removal and Immunity: her slow hurts.',
    weights: { cleanse: 3, immunity: 3, single: 1.5, bulk: 0.7 },
  },
  {
    id: 'omnissi-earth',
    label: 'Omnissi (Earth)',
    group: 'Omnissi',
    summary: 'Block, remove or steal her buffs, on durable Invokers.',
    weights: { stealBuffs: 2.5, stripBuffs: 2, jinx: 1.5, bulk: 2, single: 1.5 },
  },
  {
    id: 'omnissi-light',
    label: 'Omnissi (Light)',
    group: 'Omnissi',
    summary: 'Damage and shields beat healing here.',
    weights: { single: 3, shields: 2, unkillable: 1, bulk: 0.3, teamHeal: -1 },
    elements: { Dark: 1.5 },
  },
];

export const tierListById = new Map(tierLists.map((l) => [l.id, l]));

export interface Candidate {
  /** Slug used in tiers.json and URLs. */
  slug: string;
  kit: Kit;
  /** Raw numeric strengths; scoring turns each into a percentile within the candidates. */
  stats: Partial<Record<Stat, number>>;
  class?: string;
  element?: string;
}

/** Where `v` sits among `all`, 0 (lowest) to 1 (highest). */
function percentile(all: number[], v: number): number {
  if (all.length < 2) return 0;
  let below = 0;
  for (const x of all) if (x < v) below++;
  return below / (all.length - 1);
}

/** Draft score for every candidate on one list. */
export function scoreList(list: TierListDef, candidates: Candidate[]): Map<string, number> {
  const columns = new Map<Stat, number[]>();
  const statOf = (c: Candidate, s: Stat) => (s === 'single' ? c.kit.single : s === 'aoe' ? c.kit.aoe : (c.stats[s] ?? 0));
  const column = (f: Stat) => {
    if (!columns.has(f)) columns.set(f, candidates.map((x) => statOf(x, f)));
    return columns.get(f)!;
  };
  // A tool on a weak pick is worth less: tag, class and element bonuses scale with raw power (damage and bulk),
  // so a Common with Heal Reduction doesn't outrank a Legendary carry.
  const power = (c: Candidate) => (percentile(column('single'), c.kit.single) + percentile(column('bulk'), statOf(c, 'bulk'))) / 2;
  const scores = new Map<string, number>();
  for (const c of candidates) {
    let base = 0;
    let bonus = 0;
    for (const [f, w] of Object.entries(list.weights) as [Factor, number][]) {
      if (isStat(f)) base += w * percentile(column(f), statOf(c, f));
      else if (c.kit.tags.has(f)) bonus += w;
    }
    if (c.class) bonus += list.classes?.[c.class] ?? 0;
    if (c.element) bonus += list.elements?.[c.element] ?? 0;
    scores.set(c.slug, base + bonus * (0.4 + 0.6 * power(c)));
  }
  return scores;
}

const stats: Stat[] = ['single', 'aoe', 'bulk', 'acc', 'res', 'skillRecovery', 'manaGen', 'runSpeed'];
function isStat(f: Factor): f is Stat {
  return (stats as string[]).includes(f);
}

/** Share of a list in each tier, best first (S 8%, A 17%, B 25%, C 25%, D the rest). */
const tierCuts = [0.08, 0.25, 0.5, 0.75, 1];

/** Splits scores into tiers by rank. */
export function toTiers(scores: Map<string, number>): Record<TierName, string[]> {
  const ranked = [...scores].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([slug]) => slug);
  const out = Object.fromEntries(tierNames.map((t) => [t, [] as string[]])) as Record<TierName, string[]>;
  ranked.forEach((slug, i) => {
    const t = tierCuts.findIndex((cut) => i < Math.round(cut * ranked.length));
    out[tierNames[t === -1 ? tierNames.length - 1 : t]].push(slug);
  });
  return out;
}

/** What a pick brings that this list asks for, most important first (for the chips). */
export function brings(list: TierListDef, kit: Kit): Tag[] {
  return (Object.entries(list.weights) as [Factor, number][])
    .filter(([f, w]) => w >= 1 && !isStat(f) && kit.tags.has(f as Tag))
    .sort((a, b) => b[1] - a[1])
    .map(([f]) => f as Tag)
    .concat(list.weights.aoe && list.weights.aoe >= 1.5 && kit.tags.has('aoe') ? ['aoe' as Tag] : [])
    .filter((t, i, a) => a.indexOf(t) === i)
    .slice(0, 3);
}
