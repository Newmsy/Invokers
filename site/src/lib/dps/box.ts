// Turns an imported box hero (or any Invoker at 6★ level 60, fully awakened, no gear) into simulator input.
import type { BoxDoc } from '../box/store';
import type { BoxHero } from '../box/decode';
import { trophyBonuses } from '../box/trophies';
import { addStat, totalsFor, MAX_SKILL_LEVEL, type DpsData, type DpsHero, type Equipment, type SkillSlot, type Totals } from './model';

export interface Build {
  hero: DpsHero;
  totals: Totals;
  skillLevels: Partial<Record<SkillSlot, number>>;
  /** Pieces worn (gear + accessories). */
  pieces: number;
}

/** 6★ level 60, every Awakening node, max skills, no gear. */
export function bareBuild(data: DpsData, hero: DpsHero): Build {
  const nodes = hero.sign ? (data.signs[hero.sign] ?? []) : [];
  return { hero, totals: totalsFor(data, hero, 'Six', 60, nodes, []), skillLevels: {}, pieces: 0 };
}

/** The Invoker as it is in the box: stars, level, Awakening, skills, gear and accessories. */
export function boxBuild(data: DpsData, box: BoxDoc, owned: BoxHero): Build | null {
  const hero = data.heroes.find((h) => h.configId === owned.configId);
  if (!hero) return null;
  const gear = new Map(box.gear.map((g) => [g.id, g]));
  const acc = new Map(box.accessories.map((a) => [a.id, a]));
  const equipment: Equipment[] = [];
  for (const id of Object.values(owned.gearBySlot ?? {})) {
    const g = gear.get(id);
    if (g) equipment.push({ set: g.set, stats: [g.mainStat, ...g.subStats].filter((s) => !!s).map((s) => [s!.stat, s!.value]) });
  }
  for (const id of Object.values(owned.accessoryBySlot ?? {})) {
    const a = acc.get(id);
    if (a) equipment.push({ stats: [a.mainStat, ...a.subStats].filter((s) => !!s).map((s) => [s!.stat, s!.value]) });
  }
  // Box skill levels are on the same 1-11 scale as the skill text (0 = not upgraded = level 1).
  const skillLevels: Partial<Record<SkillSlot, number>> = {};
  for (const s of owned.skills) skillLevels[s.skill as SkillSlot] = Math.max(1, Math.min(MAX_SKILL_LEVEL, s.level));
  const totals = totalsFor(data, hero, owned.rank, owned.level, owned.awakenNodeIds ?? [], equipment);
  // Trophy Room bonuses for the Invoker's element (percents are of its own stats, like gear).
  for (const [stat, v] of trophyBonuses(box.trophies, hero.element)) addStat(totals, stat, v);
  return {
    hero,
    totals,
    skillLevels,
    pieces: equipment.length,
  };
}
