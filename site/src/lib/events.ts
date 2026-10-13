// Event planner maths, shared by the Events page script and the tests. No data imports, so the page
// script stays small; the page passes in the figures from site/src/data/event-guide.json.

export interface EnergyRow {
  name: string;
  energy: number;
  /** Set when the energy comes once every this many days (e.g. a 30-day login calendar): it counts as energy ÷ days a day. */
  everyDays?: number;
}

/** A daily row's energy per day. */
export function perDay(r: EnergyRow): number {
  const energy = Number.isFinite(r.energy) ? Math.max(0, r.energy) : 0;
  return r.everyDays && r.everyDays > 0 ? energy / r.everyDays : energy;
}

/** Energy a day: the natural recharge (one per `rechargeMinutes`) plus every daily source. */
export function dailyIncome(rows: EnergyRow[], rechargeMinutes: number): number {
  const recharge = rechargeMinutes > 0 ? Math.floor((24 * 60) / rechargeMinutes) : 0;
  return recharge + rows.reduce((sum, r) => sum + perDay(r), 0);
}

export interface ChestItem {
  group: number;
  itemId: string;
  amount: number;
  weight: number;
  groupChanceInPicks: number;
}

/** Average amount of one item per chest: each group's chance to be among the picks × its weighted average amount. */
export function chestAverage(items: ChestItem[], itemId: string): number {
  const groups = new Map<number, ChestItem[]>();
  for (const i of items) groups.set(i.group, [...(groups.get(i.group) ?? []), i]);
  let total = 0;
  for (const rows of groups.values()) {
    const weight = rows.reduce((n, r) => n + r.weight, 0);
    if (weight <= 0) continue;
    total += rows[0].groupChanceInPicks * rows.filter((r) => r.itemId === itemId).reduce((n, r) => n + r.weight * r.amount, 0) / weight;
  }
  return total;
}

/** Energy over a period: daily income times days, plus one-off extras. */
export function periodIncome(daily: number, days: number, extras: EnergyRow[]): number {
  return daily * Math.max(0, days) + extras.reduce((sum, r) => sum + Math.max(0, r.energy || 0), 0);
}

/** Runs and energy to reach a points target, at a steady score per run. */
export function toFinish(target: number, pointsPerRun: number, energyPerRun: number): { runs: number; energy: number } {
  if (target <= 0) return { runs: 0, energy: 0 };
  if (pointsPerRun <= 0) return { runs: Infinity, energy: Infinity };
  const runs = Math.ceil(target / pointsPerRun);
  return { runs, energy: runs * Math.max(0, energyPerRun) };
}

/** Energy still missing, and the gems that buy it. */
export function shortfall(need: number, income: number, energyPerGem: number): { energy: number; gems: number } {
  const energy = Math.max(0, need - income);
  // The small nudge keeps float noise (e.g. 100/150 energy per gem) from adding a gem.
  return { energy, gems: energyPerGem > 0 ? Math.max(0, Math.ceil(energy / energyPerGem - 1e-9)) : Infinity };
}

export interface ArenaInput {
  battlesPerDay: number;
  /** 0 to 1. */
  winRate: number;
  winPoints: number;
  lossPoints: number;
  days: number;
  doubleDays: number;
  target: number;
}

export function arena(input: ArenaInput): { perBattle: number; perDay: number; total: number; daysToTarget: number } {
  const rate = Math.min(1, Math.max(0, input.winRate));
  const perBattle = input.winPoints * rate + input.lossPoints * (1 - rate);
  const perDay = perBattle * Math.max(0, input.battlesPerDay);
  const days = Math.max(0, input.days);
  const doubles = Math.min(days, Math.max(0, input.doubleDays));
  const total = perDay * (days + doubles);
  // Double days are spent first, since each one is worth two normal days.
  let daysToTarget = Infinity;
  if (perDay > 0) {
    const fromDoubles = Math.ceil(input.target / (2 * perDay));
    daysToTarget = fromDoubles <= doubles ? fromDoubles : doubles + Math.ceil((input.target - 2 * perDay * doubles) / perDay);
  }
  return { perBattle, perDay, total, daysToTarget };
}

/** One kind of drop a stage can give: its chance per roll and the amount range when it drops. */
export interface StageDrop {
  /** Key into the family's points table, e.g. "5★ Epic", "Legendary" or "Spark". */
  key: string;
  /** Chance per roll (0 to 1), or the expected number of that drop per run when the table counts rolls itself. */
  chance: number;
  min: number;
  max: number;
}

/** A group of farming events that share drop tables and scoring (relic and clan bosses, Crest and Omnissi, Pentiax). */
export interface ScoringFamily {
  id: string;
  /** Boss modes (as in bosses.json) that use these tables. */
  modes: string[];
  rollsPerRun: number;
  points: Record<string, number>;
  stages: { stage: number; drops: StageDrop[] }[];
}

/** Expected points from one drop line: chance × average amount × points per item. */
export function dropPoints(drop: StageDrop, points: Record<string, number>): number {
  const chance = Math.max(0, drop.chance);
  return chance * ((drop.min + drop.max) / 2) * (points[drop.key] ?? 0);
}

/** Average points a run: rolls per run × the expected points of every drop the stage can give. */
export function expectedPointsPerRun(family: Pick<ScoringFamily, 'rollsPerRun' | 'points'>, drops: StageDrop[]): number {
  return Math.max(0, family.rollsPerRun) * drops.reduce((sum, d) => sum + dropPoints(d, family.points), 0);
}
