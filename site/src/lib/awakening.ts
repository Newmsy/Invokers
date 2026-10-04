// Awakening types (soul signs) and full-Awakening stats, from data/awakening.json.
// Percent bonuses are of the 1★ level 1 stats and add to the 6★ level 60 base; flat bonuses add
// directly. Checked against the game's max stats for Skoloss the Tomb Baron (12,294 HP, 364 ATK, 1,261 DEF).
import awakeningJson from '../../../data/awakening.json';
import statsJson from '../../../data/stats.json';
import type { Hero, HeroStats } from './data';

interface Bonus {
  stat: string;
  value: number;
  valueType: string;
}
interface Node {
  id: number;
  parentId: number | null;
  bonuses: Bonus[];
  costByRarity: Record<string, { itemId: string; amount: number }[]>;
}
export interface SoulSign {
  soulSign: string;
  name: string;
  title: string;
  description: string;
  baseBonus: Record<string, number>;
  levels: { awakenLevel: number; nodes: Node[] }[];
}

export const soulSigns = (awakeningJson as unknown as { soulSigns: SoulSign[] }).soulSigns;

/** Page anchor for an Awakening type on the Ascension page, e.g. "type-vess". */
export const soulSignAnchor = (s: Pick<SoulSign, 'name'>) => `type-${s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

/** The Invoker's Awakening type. */
export function awakeningType(hero: Pick<Hero, 'soulSign'>): SoulSign | undefined {
  return soulSigns.find((s) => s.soulSign === hero.soulSign);
}

// Node bonus stat → hero stat it adds to (percent = share of base HP/ATK/DEF).
const nodeStat: Record<string, { key: keyof HeroStats | 'titanTime'; percentOfBase?: boolean }> = {
  AttackPercent: { key: 'atk', percentOfBase: true },
  DefensePercent: { key: 'def', percentOfBase: true },
  HealthPercent: { key: 'hp', percentOfBase: true },
  CriticalRatePercent: { key: 'critRate' },
  CriticalDamagePercent: { key: 'critDmg' },
  AccuracyFlat: { key: 'acc' },
  ResistanceFlat: { key: 'res' },
  InstinctRatingFlat: { key: 'instinct' },
  ComboSpeedFlat: { key: 'comboSpeed' },
  SkillSpeedFlat: { key: 'skillSpeed' },
  SkillRecoveryFlat: { key: 'skillRecovery' },
  ManaGenerationFlat: { key: 'manaGen' },
  MoveSpeedFlat: { key: 'runSpeed' },
  AnimaDuration: { key: 'titanTime' },
};

/** Every node bonus of the given Awakening levels, summed per stat id (in first-seen order). */
export function sumBonuses(sign: SoulSign, levels = sign.levels.map((l) => l.awakenLevel)): Map<string, number> {
  const out = new Map<string, number>();
  for (const l of sign.levels) {
    if (!levels.includes(l.awakenLevel)) continue;
    for (const n of l.nodes) for (const b of n.bonuses) out.set(b.stat, (out.get(b.stat) ?? 0) + b.value);
  }
  return out;
}

// ---- Plain-language labels ----

const stats = statsJson as { id: string; name: string; short?: string; kind?: string; percent?: boolean }[];
const percentStats = new Set(['AttackPercent', 'DefensePercent', 'HealthPercent', 'CriticalRatePercent', 'CriticalDamagePercent']);

/** English name of a node bonus or base-bonus stat, e.g. "InstinctRatingFlat" → "Instinct", "AccuracyRating" → "Accuracy". */
export function bonusStatName(stat: string): string {
  if (stat.endsWith('Rating')) {
    const rating = stats.find((s) => s.kind === 'rating' && s.id === stat.replace(/Rating$/, ''));
    if (rating) return rating.name;
  }
  return stats.find((s) => s.id === stat)?.name ?? stat;
}

const trim = (v: number) => String(Math.round(v * 1000) / 1000);

/** "+25% ATK", "+6 Instinct", "+1s Titan Invokation Time". */
export function bonusText(stat: string, value: number): string {
  if (percentStats.has(stat)) return `+${trim(value * 100)}% ${bonusStatName(stat)}`;
  if (stat === 'AnimaDuration') return `+${trim(value)}s ${bonusStatName(stat)}`;
  return `+${trim(value)} ${bonusStatName(stat)}`;
}

// ---- Full Awakening ----

/** 6★ level 60 stats with every Awakening node, plus the extra Titan Invokation Time in seconds. */
export function fullyAwakened(hero: Hero): { stats: HeroStats; titanTime: number } | undefined {
  const type = awakeningType(hero);
  if (!type) return undefined;
  const result = { ...hero.maxStats };
  const base = hero.statsByRank.One['1'];
  let titanTime = 0;
  for (const [stat, v] of sumBonuses(type)) {
    const target = nodeStat[stat];
    if (!target) continue;
    if (target.key === 'titanTime') titanTime += v;
    else if (target.percentOfBase) result[target.key] += base[target.key] * v;
    else result[target.key] += v;
  }
  return { stats: result, titanTime };
}
