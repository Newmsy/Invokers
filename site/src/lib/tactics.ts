// Tactics (team formations): slots by line, the line bonuses and the level-up price.
import tacticsJson from '../../../data/tactics.json';

export type Line = 'Front' | 'Mid' | 'Back';

export interface TacticBonus {
  line: Line;
  /** Classes the bonus applies to; null means everyone in that line. */
  class: string[] | null;
  stats: string[];
  valueType: 'percent' | 'flat';
  valuesByLevel: number[];
}

export interface Tactic {
  id: string;
  name: string;
  requiredPlayerLevel: number;
  slots: { position: string; line: Line }[];
  bonuses: TacticBonus[];
}

const pack = tacticsJson as unknown as {
  maxLevel: number;
  levelUpPrice: Record<string, Record<string, number>[]>;
  tactics: Tactic[];
};

export const tactics: Tactic[] = pack.tactics;
export const maxTacticLevel = pack.maxLevel;
export const lines: Line[] = ['Back', 'Mid', 'Front'];

/** Level-up prices; the 4- and 5-slot lists are shown once when they match. */
export const levelUpPrices = pack.levelUpPrice;
export const samePrices = JSON.stringify(levelUpPrices.fourSlot) === JSON.stringify(levelUpPrices.fiveSlot);

const statNames: Record<string, string> = {
  AttackPercent: 'ATK',
  HealthPercent: 'HP',
  DefensePercent: 'DEF',
  ManaGenerationFlat: 'Mana Generation',
  SkillRecoveryFlat: 'Skill Recovery',
  SkillSpeedFlat: 'Skill Speed',
  ComboSpeedFlat: 'Combo Speed',
  RunSpeedBonusOutOfCombat: 'Move Speed out of battle',
  DecreaseDamageTaken: 'Damage taken',
  IncreaseHealingDone: 'Heal size',
  IncreaseShieldDone: 'Shield size',
  ResistanceFlat: 'RES',
  AccuracyFlat: 'ACC',
  CriticalDamagePercent: 'Crit DMG',
  CriticalRatePercent: 'Crit Rate',
  IgnoreDefensePercent: 'Ignore DEF',
};

/** "Heal and shield size", "ATK". */
export function bonusName(b: TacticBonus): string {
  if (b.stats.length === 2 && b.stats.includes('IncreaseHealingDone') && b.stats.includes('IncreaseShieldDone')) return 'Heal and shield size';
  return b.stats.map((s) => statNames[s] ?? s).join(' and ');
}

/** "+25%", "+100", or "−15%" for damage taken. */
export function bonusValue(b: TacticBonus, value: number): string {
  const sign = b.stats.includes('DecreaseDamageTaken') ? '−' : '+';
  return b.valueType === 'percent' ? `${sign}${+(value * 100).toFixed(1)}%` : `${sign}${value.toLocaleString('en-GB')}`;
}
