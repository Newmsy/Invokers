// Skill upgrade costs from data/skill_costs.json, grouped for the cost guide.
import costsJson from '../../../data/skill_costs.json';
import itemsJson from '../../../data/items.json';
import { rarityOrder } from './format';

interface CostRow {
  rarity: string;
  skill: string;
  toLevel: number;
  cost: Record<string, number>;
}

export type Cost = Record<string, number>;

const rows = costsJson as CostRow[];
const itemNames = new Map((itemsJson as { id: string; name: string }[]).map((i) => [i.id, i.name]));

/** Currencies in display order: gold first, then codices from rare to legendary. */
export const currencies = ['Gold', 'Codex_Rare', 'Codex_Epic', 'Codex_Legendary'].filter((c) =>
  rows.some((r) => c in r.cost),
);

export function currencyName(id: string): string {
  return itemNames.get(id) ?? id;
}

const skillOrder = ['ActiveSkill1', 'ActiveSkill2', 'ActiveSkill3', 'Combo', 'Ultimate', 'Tolerance1', 'Tolerance2'];
const skillNames: Record<string, string> = {
  ActiveSkill1: 'Skill 1',
  ActiveSkill2: 'Skill 2',
  ActiveSkill3: 'Skill 3',
  Combo: 'Combo',
  Ultimate: 'Ultimate',
  Tolerance1: 'Tolerance 1',
  Tolerance2: 'Tolerance 2',
};

export function skillName(s: string): string {
  return skillNames[s] ?? s;
}

export const rarities = rarityOrder.filter((r) => rows.some((x) => x.rarity === r));

/**
 * The price table also lists a Legendary "Passive" slot, but no Invoker has a Passive skill (every Invoker has
 * Skills 1-3, Combo and Ultimate, plus one tolerance skill below Epic and two from Epic up), so it isn't counted.
 */
const unusedSlots = new Set(['Passive']);

export function skillsOf(rarity: string): string[] {
  const present = new Set(rows.filter((r) => r.rarity === rarity && !unusedSlots.has(r.skill)).map((r) => r.skill));
  return skillOrder.filter((s) => present.has(s)).concat([...present].filter((s) => !skillOrder.includes(s)));
}

/** Cost per target level (2..max) for one rarity and skill. */
export function schedule(rarity: string, skill: string): { toLevel: number; cost: Cost }[] {
  return rows
    .filter((r) => r.rarity === rarity && r.skill === skill)
    .sort((a, b) => a.toLevel - b.toLevel)
    .map((r) => ({ toLevel: r.toLevel, cost: r.cost }));
}

export function addCost(a: Cost, b: Cost): Cost {
  const out: Cost = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
  return out;
}

export function costBetween(rarity: string, skill: string, from: number, to: number): Cost {
  return schedule(rarity, skill)
    .filter((s) => s.toLevel > from && s.toLevel <= to)
    .reduce((acc, s) => addCost(acc, s.cost), {} as Cost);
}

export function maxLevel(rarity: string): number {
  return Math.max(...rows.filter((r) => r.rarity === rarity).map((r) => r.toLevel));
}

/**
 * Skills of one rarity whose price lists are identical share a column in the guide,
 * e.g. "Skill 1, Skill 2, Skill 3, Tolerance 1" vs "Combo, Ultimate".
 */
export function groups(rarity: string): { skills: string[]; schedule: { toLevel: number; cost: Cost }[] }[] {
  const byKey = new Map<string, { skills: string[]; schedule: { toLevel: number; cost: Cost }[] }>();
  for (const skill of skillsOf(rarity)) {
    const sch = schedule(rarity, skill);
    const key = JSON.stringify(sch);
    const g = byKey.get(key);
    if (g) g.skills.push(skill);
    else byKey.set(key, { skills: [skill], schedule: sch });
  }
  return [...byKey.values()];
}

/** Everything an Invoker of this rarity needs to take every skill from level 1 to max. */
export function maxAll(rarity: string): Cost {
  return skillsOf(rarity).reduce((acc, s) => addCost(acc, costBetween(rarity, s, 1, maxLevel(rarity))), {} as Cost);
}

/** Raw rows for the in-page calculator. */
export function calculatorData() {
  return rarities.map((r) => ({
    rarity: r,
    skills: skillsOf(r).map((s) => ({ id: s, name: skillName(s), schedule: schedule(r, s) })),
  }));
}
