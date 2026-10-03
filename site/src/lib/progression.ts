// Ascension and Awakening: which items an Invoker needs at each step. Ascension counts, Gold and XP come from
// data/progression.json. Awakening amounts come from data/awakening.json once it lands (PR #75); until then a
// per-rarity snapshot of the same numbers is used.
import progressionJson from '../../../data/progression.json';
import awakeningSnapshot from '../data/awakening-costs.json';
import type { Hero } from './data';
import { itemName } from './data';
import { rankNumber, rankOrder } from './format';

interface AscensionRow {
  fromRank: string;
  toRank: string;
  levelRequired: number;
  fodderCount: number;
  goldByRarity: Record<string, number>;
}
const progression = progressionJson as unknown as {
  ascension: AscensionRow[];
  xpPerLevel: { level: number; xpToNext: number; totalXp: number }[];
};

export const MAX_STARS = 6;
export const MAX_AWAKENING = 6;

/** Level cap at each star: 10 levels per star. */
export const levelCap = (stars: number) => stars * 10;

/** The Echo used to ascend from `stars` to `stars + 1`. */
export const echoFor = (stars: number) => `ASC_Stars${stars}`;

export interface AscensionStep {
  from: number;
  to: number;
  echo: string;
  levelCapAfter: number;
  /** Level the Invoker must reach first. */
  levelRequired?: number;
  /** Echoes (or Invokers) of the current star the step takes. */
  count?: number;
  /** Gold for this step at the given rarity. */
  gold?: number;
}

const ascensionRow = (from: number) => progression.ascension.find((r) => rankNumber(r.fromRank) === from);

/** Every ascension from the Invoker's starting star to 6★; counts and Gold when a rarity is given. */
export function ascensionSteps(baseStars: number, rarity?: string): AscensionStep[] {
  const steps: AscensionStep[] = [];
  for (let s = baseStars; s < MAX_STARS; s++) {
    const row = ascensionRow(s);
    steps.push({
      from: s,
      to: s + 1,
      echo: echoFor(s),
      levelCapAfter: levelCap(s + 1),
      levelRequired: row?.levelRequired,
      count: row?.fodderCount,
      gold: rarity ? row?.goldByRarity[rarity] : undefined,
    });
  }
  return steps;
}

/** Each ascension step with its level requirement, count and Gold per rarity. */
export const ascensionTable = progression.ascension
  .map((r) => ({ from: rankNumber(r.fromRank), to: rankNumber(r.toRank), levelRequired: r.levelRequired, count: r.fodderCount, gold: r.goldByRarity }))
  .sort((a, b) => a.from - b.from);

/** Total XP from level 1 to `level`. */
export function xpToLevel(level: number): number {
  return progression.xpPerLevel.filter((r) => r.level < level).reduce((sum, r) => sum + r.xpToNext, 0);
}
export const maxLevel = levelCap(rankOrder.length);

/** Awakening materials come in three tiers: levels 1–2, 3–4 and 5–6. */
export const awakeningTiers = [
  { tier: 1, levels: [1, 2] },
  { tier: 2, levels: [3, 4] },
  { tier: 3, levels: [5, 6] },
] as const;

export interface AwakeningMaterials {
  tier: number;
  levels: readonly number[];
  rune: string;
  essence: string;
  astral: string;
  crest: string;
}

/** The faction rune, element essence, Astral essence and class crest for each awakening tier. */
export function awakeningMaterials(hero: Pick<Hero, 'faction' | 'element' | 'class'>): AwakeningMaterials[] {
  return awakeningTiers.map(({ tier, levels }) => ({
    tier,
    levels,
    rune: `FM_Tier${tier}${hero.faction}`,
    essence: `EE_Tier${tier}${hero.element}`,
    astral: `AE_ManaTier${tier}`,
    crest: `RM_Tier${tier}${hero.class}`,
  }));
}

export const baseStars = (hero: Pick<Hero, 'baseRank'>) => rankNumber(hero.baseRank);

/** Item name without the game's sprite tags, e.g. "1★ Echo". */
export function plainItemName(id: string): string {
  return itemName(id)
    .replace(/\s*<sprite[^>]*>\s*/g, '★ ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---- Food route: building same-star food Invokers from 1★ Commons ----

/**
 * Cost of building one food Invoker of `stars` from 1★ Commons only. Assumes food can be any level, ascending keeps
 * the Invoker's level, and every step uses Common Gold. `commons` is stars! (one main plus its food at each step).
 */
export interface FoodCost {
  stars: number;
  commons: number;
  xp: number;
  gold: number;
}
export const foodCost: FoodCost[] = (() => {
  const out: FoodCost[] = [{ stars: 1, commons: 1, xp: 0, gold: 0 }];
  for (let s = 1; s < MAX_STARS; s++) {
    const prev = out[s - 1];
    const levelling = xpToLevel(levelCap(s)) - xpToLevel(Math.max(1, levelCap(s - 1)));
    const gold = ascensionRow(s)?.goldByRarity.Common ?? 0;
    out.push({ stars: s + 1, commons: (s + 1) * prev.commons, xp: (s + 1) * prev.xp + levelling, gold: (s + 1) * prev.gold + gold });
  }
  return out;
})();

/** One ascension paid with food built from Commons: `count` food of the current star. */
export function foodStep(from: number) {
  const row = ascensionRow(from)!;
  const one = foodCost[from - 1];
  return {
    from,
    to: from + 1,
    count: row.fodderCount,
    levelRequired: row.levelRequired,
    perFood: one.commons,
    commons: row.fodderCount * one.commons,
    xp: row.fodderCount * one.xp,
    gold: row.fodderCount * one.gold,
  };
}

/** Ascending an Invoker of `rarity` from its starting star to 6★, all food built from Commons. */
export function fullAscension(rarity: string, startStars: number) {
  const steps = ascensionSteps(startStars, rarity).map((s) => foodStep(s.from));
  const sum = (k: 'commons' | 'xp' | 'gold') => steps.reduce((t, s) => t + s[k], 0);
  const ownGold = ascensionSteps(startStars, rarity).reduce((t, s) => t + (s.gold ?? 0), 0);
  const ownXp = xpToLevel(levelCap(MAX_STARS - 1));
  const echoes = steps.reduce((t, s) => t + s.count, 0);
  return { rarity, startStars, echoes, commons: sum('commons'), foodXp: sum('xp'), foodGold: sum('gold'), ownGold, ownXp };
}

// ---- Awakening amounts per rarity ----

type Costs = Record<string, number>;
interface AwakeningFile {
  soulSigns: { levels: { nodes: { costByRarity: Record<string, { itemId: string; amount: number }[]> }[] }[] }[];
}
const awakeningFiles = import.meta.glob<{ default: AwakeningFile }>('../../../data/awakening.json', { eager: true });
const awakeningFile = Object.values(awakeningFiles)[0]?.default;

/** Items per Awakening level for each rarity (index 0 = level 1). The same for every Invoker of a rarity. */
export const awakeningByRarity: Record<string, Costs[]> = awakeningFile
  ? Object.fromEntries(
      Object.keys(awakeningFile.soulSigns[0].levels[0].nodes[0].costByRarity).map((rarity) => [
        rarity,
        awakeningFile.soulSigns[0].levels.map((level) => {
          const c: Costs = {};
          for (const node of level.nodes) for (const { itemId, amount } of node.costByRarity[rarity] ?? []) c[itemId] = (c[itemId] ?? 0) + amount;
          return c;
        }),
      ]),
    )
  : (awakeningSnapshot.byRarity as unknown as Record<string, Costs[]>);

/** Totals from Awakening 0 to 6 for a rarity. */
export function awakeningTotal(rarity: string): Costs {
  const t: Costs = {};
  for (const level of awakeningByRarity[rarity] ?? []) for (const [id, n] of Object.entries(level)) t[id] = (t[id] ?? 0) + n;
  return t;
}
