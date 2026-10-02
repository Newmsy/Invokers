// Gear sets for the Gear page: bonuses in plain words, grouped by what they're for, and the bosses each
// corruption-tolerance set counters (from the boss list, not the set's own text).
import setsJson from '../../../data/sets.json';
import { bosses, type Boss } from './data';

interface RawBonus {
  stat: string;
  statName: string;
  value: number;
}

interface RawSet {
  id: string;
  name: string;
  bonuses: Record<string, RawBonus[]>;
  recommendation: string;
}

export interface GearSet {
  id: string;
  name: string;
  group: string;
  /** Piece count → bonus lines, e.g. 3 → ["+10% ATK"]. */
  bonuses: { pieces: number; lines: string[] }[];
  /** The game's own description (rich text), without its boss list. */
  description: string;
  /** For tolerance sets: the corruption it reduces and the bosses that use it. */
  corruption?: string;
  bosses: Boss[];
}

export const gearGroups = [
  { id: 'damage', title: 'Damage and speed' },
  { id: 'survival', title: 'Survival' },
  { id: 'utility', title: 'Support and utility' },
  { id: 'tolerance', title: 'Corruption tolerance' },
];

const groupOf: Record<string, string> = {
  Attack: 'damage',
  CriticalRate: 'damage',
  CriticalDamage: 'damage',
  IgnoreDefense: 'damage',
  LifeSteal: 'damage',
  SkillSpeed: 'damage',
  SkillRecovery: 'damage',
  ManaGeneration: 'damage',
  EventSet2: 'damage',
  Accuracy: 'damage',
  Health: 'survival',
  Defense: 'survival',
  Resistance: 'survival',
  EventSet1: 'survival',
  ClanBossSet1: 'survival',
  ClanBossSet2: 'survival',
  Support: 'utility',
  ReduceBuffDuration: 'utility',
  Instinct: 'utility',
};

// Effects that aren't a plain stat, worded as in the "Every gear set" blog post.
const special: Record<string, (b: RawBonus) => string> = {
  IncreaseHealingDone: (b) => `+${Math.round(b.value * 100)}% heal size`,
  IncreaseShieldDone: (b) => `+${Math.round(b.value * 100)}% shield size`,
  RunSpeedBonusOutOfCombat: () => 'Allies move faster out of combat',
  LifeStealByCombos: (b) => `Lifesteal: ${Math.round(b.value * 100)}% of combo damage`,
  LifeStealByOtherSkills: (b) => `Lifesteal: ${Math.round(b.value * 100)}% of skill damage`,
  BuffReductionDoneWithCombo3and5: (b) =>
    b.value <= 1 ? 'Combo attacks 3 and 5 shorten 1 enemy buff' : 'A stronger version of the same effect',
};

// Bonuses that are effects outside the stat list, so the pack leaves them out (see the blog post).
const extraLines: Record<string, Record<number, string[]>> = {
  ClanBossSet1: { 5: ["All allies get a shield worth 20% of the wearer's max HP for 12 seconds"] },
  ClanBossSet2: { 3: ['Willpower and Immunity buffs at the start of battle'] },
};

function line(b: RawBonus): string {
  const fn = special[b.stat];
  if (fn) return fn(b);
  const percent = /Percent$/.test(b.stat);
  const value = percent ? `${Math.round(b.value * 1000) / 10}%` : String(b.value);
  return `+${value} ${b.statName.replace(/ Tol\.$/, ' Tolerance')}`;
}

const lc = (s: string) => s.toLowerCase().replace(/\s+/g, '');

export const gearSets: GearSet[] = (setsJson as RawSet[]).map((s) => {
  const tolerance = /Tolerance$/.test(s.id);
  const corruption = tolerance ? s.name.replace(/ Tolerance$/, '') : undefined;
  return {
    id: s.id,
    name: s.name,
    group: tolerance ? 'tolerance' : (groupOf[s.id] ?? 'utility'),
    bonuses: [3, 5, 8]
      .map((pieces) => ({ pieces, lines: [...(s.bonuses[pieces] ?? []).map(line), ...(extraLines[s.id]?.[pieces] ?? [])] }))
      .filter((b) => b.lines.length > 0),
    // Tolerance texts end with "The following Bosses have …"; the page lists the bosses itself.
    description: s.recommendation.replace(/(<br>)*\s*The following Bosses have[\s\S]*$/, '').trim(),
    corruption,
    bosses: corruption ? bosses.filter((b) => b.corruptions.some((c) => lc(c) === lc(corruption))) : [],
  };
});
