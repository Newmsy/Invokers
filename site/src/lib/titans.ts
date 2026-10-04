// Titans for the Titan pages: their skills, and the bonus their passive gives the bound Invoker at each Empowerment.
import { heroes, skillsFor, titans, type Skill } from './data';
import { rarityOrder } from './format';
import type { TitanInfo } from './tiers/candidates';

export interface TitanBonus {
  /** Stat name as the game shows it, e.g. "ATK", "Combo SPD". */
  stat: string;
  /** "+42%" or "+196". */
  value: string;
  /** Bonus that applies everywhere except boss fights, when the passive splits them. */
  elsewhere?: string;
}

/** Empowerments 0-6, each with its bonus. */
export interface TitanPassive {
  empowerment: number;
  bonus?: TitanBonus;
  text: string;
}

const plain = (t: string) => t.replace(/<[^>]+>/g, '');
const line = /Increases Bound Invoker's (.+?)( in Boss Fights on Boss Mode| in all other areas)? by ([\d.]+%?)\./g;

/** Reads "Increases Bound Invoker's ATK in Boss Fights on Boss Mode by 42%. … in all other areas by 24%." */
export function parseBonus(text: string): TitanBonus | undefined {
  const parts = [...plain(text).matchAll(line)];
  if (!parts.length) return undefined;
  const boss = parts.find((p) => p[2]?.includes('Boss')) ?? parts[0];
  const other = parts.find((p) => p[2]?.includes('other'));
  return { stat: boss[1], value: `+${boss[3]}`, elsewhere: other ? `+${other[3]}` : undefined };
}

/** "ATK +42% in boss fights, +24% elsewhere" or "HP +36%". */
export function bonusLabel(b: TitanBonus): string {
  return b.elsewhere ? `${b.stat} ${b.value} in boss fights, ${b.elsewhere} elsewhere` : `${b.stat} ${b.value}`;
}

export function titanPassive(titanId: string): TitanPassive[] {
  const passive = skillsFor(titanId).find((s) => s.type === 'PassiveBonus') as
    | (Skill & { empowerments?: { empowerment: number; text: string }[] })
    | undefined;
  return (passive?.empowerments ?? []).map((e) => ({ empowerment: e.empowerment, bonus: parseBonus(e.text), text: e.text }));
}

/** Skill 1, Skill 2, Combo and Invokation, with their levels. */
export function titanSkills(titanId: string): Skill[] {
  return skillsFor(titanId).filter((s) => s.type !== 'PassiveBonus' && s.levels && s.levels.length > 0);
}

/** Bonus at full Empowerment, for cards. */
export function maxBonus(titanId: string): TitanBonus | undefined {
  return titanPassive(titanId).at(-1)?.bonus;
}

/** Invokers who can bind this Titan: its faction, or everyone for a Titan any Invoker can use. Best rarity first. */
export function binders(t: TitanInfo) {
  return heroes
    .filter((h) => !t.faction || h.faction === t.faction)
    .sort((a, b) => rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity) || a.name.localeCompare(b.name));
}

/** Titans grouped by the faction that binds them, A to Z, with any-faction Titans last. */
export function titansByFaction(): { faction?: string; titans: TitanInfo[] }[] {
  const factions = [...new Set(titans.map((t) => t.faction))].sort((a, b) => (a ?? '~').localeCompare(b ?? '~'));
  return factions.map((faction) => ({
    faction,
    titans: titans.filter((t) => t.faction === faction).sort((a, b) => a.name.localeCompare(b.name)),
  }));
}
