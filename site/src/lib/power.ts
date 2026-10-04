// Invoker power, as the game shows it on each card: multiplier x (ATK + DEF + HP / 10).
// Formula and checks in data/power.json.
import type { BoxHero } from './box/decode';
import type { BoxDoc } from './box/store';
import { trophyBonuses } from './box/trophies';
import { boxEquipment } from './dps/box';
import { addStat, finalStat, totalsFor, type DpsData } from './dps/model';

const BASE = 0.97667;
const SKILLS = ['ActiveSkill1', 'ActiveSkill2', 'ActiveSkill3', 'Ultimate', 'Combo'];

/** Grows with skill upgrades, Awakening level and unlocked Awakening nodes (each level's root node doesn't count). */
export function powerMultiplier(hero: Pick<BoxHero, 'skills' | 'awakenLevel' | 'awakenNodeIds'>): number {
  const upgrades = SKILLS.map((k) => hero.skills.find((s) => s.skill === k)?.level ?? 0);
  const skill = upgrades.reduce((a, b) => a + b, 0) / SKILLS.length / 10;
  const awaken = (hero.awakenLevel ?? 0) / 6;
  const nodes = (hero.awakenNodeIds ?? []).filter((id) => id % 100 !== 1).length / 60;
  return BASE * (1 + 0.5 * skill) * (1 + 0.4 * awaken) * (1 + 0.6 * nodes);
}

export function power(multiplier: number, atk: number, def: number, hp: number): number {
  return multiplier * (atk + def + hp / 10);
}

/** Most power an Invoker can reach without gear: 6★ level 60 stats, max skills, fully awakened. */
export function maxPower(stats: { atk: number; def: number; hp: number }, canAwaken: boolean): number {
  return power(BASE * 1.5 * (canAwaken ? 1.4 * 1.6 : 1), stats.atk, stats.def, stats.hp);
}

/**
 * An owned Invoker's power. Awakening counts through the multiplier, not its stat bonuses; gear, accessories, sets
 * and Trophy Room bonuses count through ATK, DEF and HP.
 */
export function boxPower(data: DpsData, box: BoxDoc, owned: BoxHero): number | null {
  const hero = data.heroes.find((h) => h.configId === owned.configId);
  if (!hero) return null;
  const t = totalsFor(data, hero, owned.rank, owned.level, [], boxEquipment(box, owned));
  for (const [stat, v] of trophyBonuses(box.trophies, hero.element)) addStat(t, stat, v);
  return power(powerMultiplier(owned), finalStat(t, 'atk'), finalStat(t, 'def'), finalStat(t, 'hp'));
}

/** 43,660 → "43.66K", like the game's cards. */
export function formatPower(p: number): string {
  if (p < 1000) return String(Math.round(p));
  const k = Math.floor(p / 10) / 100;
  return `${Number.isInteger(k) ? k : k.toFixed(2).replace(/0$/, '')}K`;
}
