// What each owned invoker still needs, worked out from the saved box and the cost tables.
// Pure functions with no data imports, so the planner page can bundle them and tests can feed them fixtures.
import type { BoxGear, BoxHero } from '../box/decode';

export type Cost = Record<string, number>;

export interface SkillStep {
  toLevel: number;
  cost: Cost;
}

/** One row of the gear upgrade price list: what it costs to take a piece to `toLevel`. */
export interface GearCostRow {
  rarity: string;
  stars: number;
  toLevel: number;
  gold?: number;
  memorium?: number;
}

export interface Levelling {
  maxLevel: number;
  /** Total XP from level 1 to each level (index = level). */
  xpTo: number[];
  /** One row per ascension: `count` Echoes (or same-star invokers) named `echo`, and Gold by rarity. */
  ascension: { from: number; count: number; echo: string; gold: Record<string, number> }[];
}

/** Hero facts the planner needs, keyed by the box's exact config id. */
export interface PlanHero {
  id: string;
  slug: string;
  name: string;
  rarity: string;
  faction: string;
  element: string;
  class: string;
  art?: string;
}

export interface PlanData {
  /** Currencies in display order, with their English names. */
  currencies: { id: string; name: string }[];
  /** rarity → skill → price list for levels 2..max. */
  skills: Record<string, Record<string, SkillStep[]>>;
  /** Gear upgrade prices, or null until they are in the data pack. */
  gear: GearCostRow[] | null;
  /** XP per level and ascension steps, for what's left to 6 stars and the level cap. */
  levelling: Levelling;
  heroes: Record<string, PlanHero>;
  gameVersion: string;
  heroBase: string;
  boxHref: string;
}

export const RANKS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'];
export const MAX_STARS = 6;
export const MAX_HERO_LEVEL = 60;
export const MAX_GEAR_LEVEL = 20;
export const GEAR_SLOTS = ['Weapon', 'Shield', 'Helmet', 'Pauldrons', 'Gauntlets', 'Chestplate', 'Belt', 'Boots'];

export const stars = (rank: string): number => RANKS.indexOf(rank) + 1;

export function addCost(a: Cost, b: Cost): Cost {
  const out: Cost = { ...a };
  for (const [k, v] of Object.entries(b)) if (v) out[k] = (out[k] ?? 0) + v;
  return out;
}

export const isEmptyCost = (c: Cost): boolean => !Object.values(c).some((v) => v > 0);

/**
 * Price list for one skill. Tolerance skills of a rarity all share one price list, so a tolerance slot the
 * table doesn't list for that rarity uses the one it does.
 */
export function skillSchedule(data: PlanData, rarity: string, skill: string): SkillStep[] | null {
  const byRarity = data.skills[rarity];
  if (!byRarity) return null;
  if (byRarity[skill]) return byRarity[skill];
  if (skill.startsWith('Tolerance')) {
    const other = Object.keys(byRarity).find((s) => s.startsWith('Tolerance'));
    if (other) return byRarity[other];
  }
  return null;
}

export interface SkillPlan {
  skill: string;
  level: number;
  max: number;
  cost: Cost;
  /** False when there's no price list for this skill, so its cost is left out of the totals. */
  priced: boolean;
}

export interface GearPlan {
  /** Slots with a piece in them. */
  equipped: number;
  empty: string[];
  /** Equipped pieces below the level cap. */
  belowMax: number;
  /** Gold and Memorium to take every equipped piece to the cap, or null while prices aren't available. */
  cost: Cost | null;
}

export interface HeroPlan {
  hero: BoxHero;
  ref: PlanHero | undefined;
  stars: number;
  skills: SkillPlan[];
  skillLevels: number;
  skillMax: number;
  skillCost: Cost;
  gear: GearPlan;
  /** 6 stars and level 60. */
  maxedLevel: boolean;
  level: LevelPlan;
}

export interface LevelPlan {
  /** XP still needed to reach the level cap at 6 stars. */
  xp: number;
  /** Ascension Gold still to pay. */
  gold: number;
  /** Echoes (or same-star invokers) still needed, by the star they ascend from. */
  echoes: Record<number, number>;
}

/** XP, ascension Gold and Echoes to take an invoker from its stars and level to 6 stars and the level cap. */
export function planLevel(data: PlanData, rarity: string | undefined, heroStars: number, level: number): LevelPlan {
  const l = data.levelling;
  const xpTo = (n: number) => l.xpTo[Math.min(Math.max(n, 0), l.maxLevel)] ?? 0;
  const out: LevelPlan = { xp: Math.max(0, xpTo(l.maxLevel) - xpTo(level)), gold: 0, echoes: {} };
  for (const step of l.ascension) {
    if (step.from < heroStars) continue;
    out.gold += (rarity && step.gold[rarity]) || 0;
    out.echoes[step.from] = (out.echoes[step.from] ?? 0) + step.count;
  }
  return out;
}

export function addLevel(a: LevelPlan, b: LevelPlan): LevelPlan {
  const echoes = { ...a.echoes };
  for (const [k, v] of Object.entries(b.echoes)) echoes[Number(k)] = (echoes[Number(k)] ?? 0) + v;
  return { xp: a.xp + b.xp, gold: a.gold + b.gold, echoes };
}

export function planSkills(data: PlanData, rarity: string | undefined, hero: BoxHero): SkillPlan[] {
  return hero.skills.map(({ skill, level }) => {
    const schedule = rarity ? skillSchedule(data, rarity, skill) : null;
    if (!schedule?.length) return { skill, level, max: level, cost: {}, priced: false };
    const max = Math.max(...schedule.map((s) => s.toLevel));
    const cost = schedule.filter((s) => s.toLevel > level).reduce((acc, s) => addCost(acc, s.cost), {} as Cost);
    return { skill, level: Math.min(level, max), max, cost, priced: true };
  });
}

/** Gold and Memorium to take one piece from its level to the cap. */
export function gearCost(rows: GearCostRow[], piece: Pick<BoxGear, 'rarity' | 'rank' | 'level'>): Cost | null {
  const s = stars(piece.rank);
  const steps = rows.filter((r) => r.rarity === piece.rarity && r.stars === s);
  if (!steps.length) return null;
  const cost: Cost = {};
  for (const r of steps) {
    if (r.toLevel <= piece.level || r.toLevel > MAX_GEAR_LEVEL) continue;
    if (r.gold) cost.Gold = (cost.Gold ?? 0) + r.gold;
    if (r.memorium) cost.Memorium = (cost.Memorium ?? 0) + r.memorium;
  }
  return cost;
}

export function planGear(data: PlanData, hero: BoxHero, gearById: Map<number, BoxGear>): GearPlan {
  const pieces = GEAR_SLOTS.map((slot) => gearById.get(hero.gearBySlot[slot] ?? -1));
  const equipped = pieces.filter((p): p is BoxGear => !!p);
  let cost: Cost | null = data.gear ? {} : null;
  for (const p of equipped) {
    if (!cost || !data.gear) break;
    const c = gearCost(data.gear, p);
    cost = c ? addCost(cost, c) : null;
  }
  return {
    equipped: equipped.length,
    empty: GEAR_SLOTS.filter((_, i) => !pieces[i]),
    belowMax: equipped.filter((p) => p.level < MAX_GEAR_LEVEL).length,
    cost,
  };
}

export function planHero(data: PlanData, hero: BoxHero, gearById: Map<number, BoxGear>): HeroPlan {
  const ref = data.heroes[hero.configId];
  const skills = planSkills(data, ref?.rarity, hero);
  const priced = skills.filter((s) => s.priced);
  return {
    hero,
    ref,
    stars: stars(hero.rank),
    skills,
    skillLevels: priced.reduce((n, s) => n + s.level, 0),
    skillMax: priced.reduce((n, s) => n + s.max, 0),
    skillCost: priced.reduce((acc, s) => addCost(acc, s.cost), {} as Cost),
    gear: planGear(data, hero, gearById),
    maxedLevel: stars(hero.rank) >= MAX_STARS && hero.level >= MAX_HERO_LEVEL,
    level: planLevel(data, ref?.rarity, stars(hero.rank), hero.level),
  };
}

export interface PlanTotals {
  heroes: number;
  skillCost: Cost;
  skillsToGo: number;
  emptySlots: number;
  gearBelowMax: number;
  /** Null when any piece's price is unknown. */
  gearCost: Cost | null;
  belowMaxLevel: number;
  level: LevelPlan;
}

export function totals(plans: HeroPlan[]): PlanTotals {
  let gearCostSum: Cost | null = {};
  for (const p of plans) gearCostSum = gearCostSum && p.gear.cost ? addCost(gearCostSum, p.gear.cost) : null;
  return {
    heroes: plans.length,
    skillCost: plans.reduce((acc, p) => addCost(acc, p.skillCost), {} as Cost),
    skillsToGo: plans.reduce((n, p) => n + p.skillMax - p.skillLevels, 0),
    emptySlots: plans.reduce((n, p) => n + p.gear.empty.length, 0),
    gearBelowMax: plans.reduce((n, p) => n + p.gear.belowMax, 0),
    gearCost: gearCostSum,
    belowMaxLevel: plans.filter((p) => !p.maxedLevel).length,
    level: plans.reduce((acc, p) => addLevel(acc, p.level), { xp: 0, gold: 0, echoes: {} } as LevelPlan),
  };
}

export interface RosterGroup {
  key: string;
  owned: number;
  total: number;
}

/** Owned vs available invokers, grouped by one field (faction, element, class or rarity). */
export function roster(data: PlanData, owned: BoxHero[], field: keyof Pick<PlanHero, 'faction' | 'element' | 'class' | 'rarity'>): RosterGroup[] {
  const have = new Set(owned.map((h) => h.configId));
  const groups = new Map<string, RosterGroup>();
  for (const [configId, ref] of Object.entries(data.heroes)) {
    const key = ref[field];
    const g = groups.get(key) ?? { key, owned: 0, total: 0 };
    g.total++;
    if (have.has(configId)) g.owned++;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
}

/** Invokers the player doesn't own yet. */
export function missing(data: PlanData, owned: BoxHero[]): PlanHero[] {
  const have = new Set(owned.map((h) => h.configId));
  return Object.entries(data.heroes)
    .filter(([configId]) => !have.has(configId))
    .map(([, ref]) => ref);
}
