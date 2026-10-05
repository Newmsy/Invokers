// Toughness against Ulgorim: effective HP (HP divided by the share of a hit that gets through DEF), how many of
// Ulgorim's hits the Invoker survives, and how much one normal HP or DEF substat roll adds to it.
import * as C from './constants';
import { addStat, defenseFactor, finalStat, selfDefence, type BossStage, type DpsData, type FightInput, type Totals } from './model';

export interface Toughness {
  hp: number;
  def: number;
  /** Share of a hit's damage that gets through this DEF (0.25 = takes 25%). */
  taken: number;
  /** HP ÷ taken: raw damage the Invoker can take before falling. */
  ehp: number;
  /** Estimated damage of one of the boss's hits after DEF. */
  bossHit: number;
  /** Estimated boss hits survived (fractional). */
  hits: number;
}

export function toughness(data: DpsData, totals: Totals, stage: BossStage): Toughness {
  const hp = finalStat(totals, 'hp');
  const def = finalStat(totals, 'def');
  const taken = defenseFactor(data.defense, def);
  const ehp = taken > 0 ? hp / taken : Infinity;
  const bossHit = stage.atk * C.BOSS_HIT_ATK * taken;
  return { hp, def, taken, ehp, bossHit, hits: bossHit > 0 ? hp / bossHit : Infinity };
}

export interface ToughValue {
  stat: string;
  value: number;
  ehp: number;
  /** Effective HP gain as a fraction (0.012 = +1.2%). */
  gain: number;
}

/** Effective HP gained from one normal 5★ roll of each HP and DEF substat, largest first. */
export function toughValues(data: DpsData, totals: Totals, stage: BossStage, rolls = data.toughRoll): { base: Toughness; values: ToughValue[] } {
  const base = toughness(data, totals, stage);
  const values = rolls.map(({ stat, value }) => {
    const t: Totals = structuredClone(totals);
    addStat(t, stat, value);
    const ehp = toughness(data, t, stage).ehp;
    return { stat, value, ehp, gain: base.ehp > 0 ? ehp / base.ehp - 1 : 0 };
  });
  return { base, values: values.sort((a, b) => b.gain - a.gain) };
}

export interface BuffedToughness {
  /** Effective HP counting its own DEF Up (by uptime) and the shield it keeps up on average. */
  ehp: number;
  /** Share of a hit that gets through on average. */
  taken: number;
  defUp: { pct: number; uptime: number }[];
  /** Shield HP standing on average over the fight, its size per cast, and casts per fight. */
  shieldAvg: number;
  shieldSize: number;
  shieldCasts: number;
}

/** Toughness with the DEF Up and shields the Invoker casts on itself in a PvE fight (null when it casts neither). */
export function buffedToughness(data: DpsData, input: FightInput): BuffedToughness | null {
  const sd = selfDefence(data, { ...input, mode: 'pve' });
  if (!sd.defUp.length && !sd.shieldCasts) return null;
  const hp = finalStat(input.totals, 'hp');
  const def = finalStat(input.totals, 'def');
  // Several DEF Up buffs: counted as up together for the longest one's uptime (buffs multiply final DEF).
  const up = Math.max(0, ...sd.defUp.map((d) => d.uptime));
  const mult = sd.defUp.reduce((m, d) => m * (1 + d.pct), 1);
  const taken = (1 - up) * defenseFactor(data.defense, def) + up * defenseFactor(data.defense, def * mult);
  return { ehp: taken > 0 ? (hp + sd.shieldAvg) / taken : Infinity, taken, defUp: sd.defUp, shieldAvg: sd.shieldAvg, shieldSize: sd.shieldSize, shieldCasts: sd.shieldCasts };
}
