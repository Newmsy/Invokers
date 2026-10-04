// Display helpers: labels, colours and the game's rich-text tags.
import type { HeroStats } from './data';

export const rarityOrder = ['Legendary', 'Epic', 'Rare', 'Uncommon', 'Common'];
export const rankOrder = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'];

export const rarityColor: Record<string, string> = {
  Legendary: '#F5C451',
  Epic: '#C29BFF',
  Rare: '#6FB8FF',
  Uncommon: '#7BE0A0',
  Common: '#C9BEA6',
};

export const elementColor: Record<string, string> = {
  Fire: '#FF8A65',
  Water: '#4FA8FF',
  Earth: '#C9A06A',
  Wind: '#6FE0B0',
  Light: '#F5E27A',
  Dark: '#A98BFF',
};

export const tierColor: Record<string, string> = {
  S: '#F5C451',
  A: '#E8875A',
  B: '#7BE0A0',
  C: '#C29BFF',
  D: '#C9BEA6',
};

const classNames: Record<string, string> = {
  MeleeAttacker: 'Melee',
  RangedAttacker: 'Ranged',
};

export function className(c: string): string {
  return classNames[c] ?? c;
}

export function rankNumber(rank: string): number {
  return rankOrder.indexOf(rank) + 1;
}

const skillTypeNames: Record<string, string> = {
  ActiveSkill1: 'Skill 1',
  ActiveSkill2: 'Skill 2',
  ActiveSkill3: 'Skill 3',
  Combo: 'Combo',
  Ultimate: 'Ultimate',
  Invocation: 'Invocation',
  PassiveBonus: 'Passive',
};

export function skillTypeName(t: string): string {
  return skillTypeNames[t] ?? t;
}

/** Stats in display order. `percent` stats are stored as fractions. */
export const statFields: { key: keyof HeroStats; label: string; short: string; percent?: boolean }[] = [
  { key: 'hp', label: 'Health', short: 'HP' },
  { key: 'atk', label: 'Attack', short: 'ATK' },
  { key: 'def', label: 'Defense', short: 'DEF' },
  { key: 'critRate', label: 'Crit Rate', short: 'Crit rate', percent: true },
  { key: 'critDmg', label: 'Crit Damage', short: 'Crit dmg', percent: true },
  { key: 'acc', label: 'Accuracy', short: 'ACC' },
  { key: 'res', label: 'Resistance', short: 'RES' },
  { key: 'instinct', label: 'Instinct', short: 'Instinct' },
  { key: 'comboSpeed', label: 'Combo Speed', short: 'Combo SPD' },
  { key: 'skillSpeed', label: 'Skill Speed', short: 'Skill SPD' },
  { key: 'skillRecovery', label: 'Skill Recovery', short: 'Skill RECOV' },
  { key: 'manaGen', label: 'Mana Generation', short: 'Mana gen' },
  { key: 'runSpeed', label: 'Movement Speed', short: 'Move SPD' },
];

export function formatStat(value: number, percent?: boolean): string {
  if (percent) return `${Math.round(value * 1000) / 10}%`;
  return Math.round(value).toLocaleString('en-GB');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Turns the game's rich text into safe HTML. Only <b>, <i>, <br> and
 * <color=#RRGGBB> survive; everything else stays escaped.
 */
export function richText(text: string): string {
  return escapeHtml(text)
    .replace(/&lt;br\s*\/?&gt;/g, '<br>')
    .replace(/&lt;(\/?)(b|i)&gt;/g, '<$1$2>')
    .replace(/&lt;color=(#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?)&gt;/g, '<span style="color:$1">')
    .replace(/&lt;\/color&gt;/g, '</span>');
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => !/^(the|of)$/i.test(w))
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
