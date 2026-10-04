// Toughness against Ulgorim: effective HP (HP divided by the share of a hit that gets through DEF), how many of
// Ulgorim's hits the Invoker survives, and how much one normal HP or DEF substat roll adds to it.
import * as C from './constants';
import { addStat, defenseFactor, finalStat, type BossStage, type DpsData, type Totals } from './model';

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
