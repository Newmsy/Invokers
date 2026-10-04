// Titans for the Titan pages: their skills, and the bonus their passive gives the bound Invoker at each Empowerment.
import { heroes, skillsFor, titans, type Hero, type Skill } from './data';
import { rarityOrder } from './format';
import type { TitanInfo } from './tiers/candidates';
import { parseBonus, recommendTitans, type PickTitan, type TitanBonus, type TitanPick } from './titanPicks';

export { bonusLabel, parseBonus, type TitanBonus } from './titanPicks';

// Titan rarity, once the data pack has it (issue #149).
const rarityFiles = import.meta.glob<{ default: { id: string; rarity?: string }[] }>('../../../data/titans.json', { eager: true });
const rarityById = new Map(Object.values(rarityFiles).flatMap((f) => f.default).map((t) => [t.id, t.rarity]));

/** A Titan's rarity, or undefined until it's known. */
export const titanRarity = (titanId: string): string | undefined => rarityById.get(titanId);

const pickTitans: PickTitan[] = titans.map((t) => ({ ...t, rarity: titanRarity(t.id), skills: skillsFor(t.id) }));

/** Top Titans for an Invoker page. */
export function titanPicksFor(hero: Hero, count = 3): TitanPick[] {
  return recommendTitans({ faction: hero.faction, class: String(hero.class), skills: skillsFor(hero.id) }, pickTitans, count);
}

/** Empowerments 0-6, each with its bonus. */
export interface TitanPassive {
  empowerment: number;
  bonus?: TitanBonus;
  text: string;
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
