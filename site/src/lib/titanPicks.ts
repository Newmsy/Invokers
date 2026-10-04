// "Recommended Titans" on Invoker pages: the Titans an Invoker can bind, ranked by rarity, by how well the bonus
// suits the Invoker's role, and by what the Titan's skills bring. Pure, so tests can call it.
import { maxText, readKit, type SkillText, type Tag } from './tiers/kit.ts';

export interface TitanBonus {
  /** Stat name as the game shows it, e.g. "ATK", "Combo SPD". */
  stat: string;
  /** "+42%" or "+196". */
  value: string;
  /** Bonus that applies everywhere except boss fights, when the passive splits them. */
  elsewhere?: string;
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

export type Role = 'attacker' | 'support' | 'tank';

export interface PickHero {
  faction: string;
  class: string;
  /** The Invoker's own skills, to see whether it needs ACC to land debuffs. */
  skills: SkillText[];
}

export interface PickTitan {
  id: string;
  slug: string;
  name: string;
  /** Undefined for a Titan any Invoker can bind. */
  faction?: string;
  /** Rare, Epic, Legendary or Mythical, once known. */
  rarity?: string;
  skills: SkillText[];
}

export interface TitanPick {
  titan: PickTitan;
  bonus?: TitanBonus;
  score: number;
  reason: string;
}

export function roleOf(heroClass: string): Role {
  if (heroClass === 'Support') return 'support';
  if (heroClass === 'Tank') return 'tank';
  return 'attacker';
}

type Stat = 'ATK' | 'HP' | 'DEF' | 'ACC' | 'RES' | 'Combo SPD' | 'Skill SPD';

/** How much each stat helps each role, 0-1. */
const statFit: Record<Role, Record<Stat, number>> = {
  attacker: { ATK: 1, 'Combo SPD': 0.75, 'Skill SPD': 0.7, ACC: 0.3, HP: 0.3, DEF: 0.2, RES: 0.2 },
  support: { ACC: 0.7, HP: 0.75, 'Skill SPD': 0.7, RES: 0.55, DEF: 0.45, ATK: 0.35, 'Combo SPD': 0.3 },
  tank: { HP: 1, DEF: 1, RES: 0.6, ACC: 0.4, 'Skill SPD': 0.4, 'Combo SPD': 0.25, ATK: 0.25 },
};

/** What each role wants from a Titan's own skills. */
const tagFit: Record<Role, Partial<Record<Tag, number>>> = {
  attacker: { defDown: 0.35, weaken: 0.35, maxHpDamage: 0.2, teamBuffs: 0.2, bleedBurn: 0.15, aoe: 0.1 },
  support: { teamHeal: 0.4, shields: 0.3, cleanse: 0.3, revive: 0.3, teamBuffs: 0.25, cooldownCuts: 0.25, titanMana: 0.2, ultMana: 0.2, immunity: 0.2 },
  tank: { taunt: 0.4, shields: 0.3, unkillable: 0.3, teamHeal: 0.25, hardCC: 0.2, cleanse: 0.15 },
};

/** Short phrases for the reason line, in the order they're worth mentioning. */
const tagPhrase: Partial<Record<Tag, string>> = {
  teamHeal: 'heal allies',
  shields: 'shield allies',
  revive: 'revive allies',
  cleanse: 'remove debuffs',
  taunt: 'taunt',
  unkillable: 'cast Unkillable',
  defDown: 'cast DEF Down',
  weaken: 'cast Weaken',
  cooldownCuts: 'cut cooldowns',
  teamBuffs: 'buff allies',
  titanMana: 'give Titan Mana',
  ultMana: 'give Ultimate Mana',
  immunity: 'cast Immunity',
  maxHpDamage: 'deal MAX HP damage',
  bleedBurn: 'cast Bleed or Burn',
  hardCC: 'stun or freeze',
};

const statWhy: Record<Stat, string> = {
  ATK: 'hits harder',
  HP: 'stays alive longer',
  DEF: 'takes less damage',
  ACC: 'lands debuffs',
  RES: 'shrugs off debuffs',
  'Combo SPD': 'combos faster',
  'Skill SPD': 'casts faster',
};

const roleNoun: Record<Role, string> = { attacker: 'damage dealer', support: 'support', tank: 'tank' };

/** Rarity counts most. Until it's known, a Titan's bonus against the best bonus for that stat stands in for it. */
const rarityScore: Record<string, number> = { Rare: 0.25, Epic: 0.5, Legendary: 0.8, Mythical: 1 };

const weights = { rarity: 0.5, stat: 0.35, kit: 0.15 };

const bonusNumber = (b?: TitanBonus) => (b ? Number(b.value.replace(/[+%]/g, '')) : 0);
const statOf = (b?: TitanBonus) => (b && b.stat in statFit.attacker ? (b.stat as Stat) : undefined);

/** Debuffs the Invoker must land with ACC ("Accuracy required for"). */
export function needsAccuracy(skills: SkillText[]): boolean {
  return skills.some((s) => /Accuracy required for/.test(maxText(s)));
}

function passiveText(t: PickTitan): string {
  const p = t.skills.find((s) => s.type === 'PassiveBonus');
  return p?.empowerments?.at(-1)?.text ?? '';
}

/** Titans this Invoker can bind: its own faction's, plus any Titan without a faction. */
export function bindable(hero: PickHero, titans: PickTitan[]): PickTitan[] {
  return titans.filter((t) => !t.faction || t.faction === hero.faction);
}

/** The best `count` Titans for an Invoker, best first, each with a one-line reason. */
export function recommendTitans(hero: PickHero, titans: PickTitan[], count = 3): TitanPick[] {
  const role = roleOf(String(hero.class));
  const accHungry = needsAccuracy(hero.skills);
  const bonuses = new Map(titans.map((t) => [t.id, parseBonus(passiveText(t))]));

  // Best bonus per stat across every Titan, for the rarity stand-in.
  const bestFor = new Map<string, number>();
  for (const b of bonuses.values()) if (b) bestFor.set(b.stat, Math.max(bestFor.get(b.stat) ?? 0, bonusNumber(b)));

  const picks = bindable(hero, titans).map((titan) => {
    const bonus = bonuses.get(titan.id);
    const stat = statOf(bonus);
    const rarity = titan.rarity
      ? (rarityScore[titan.rarity] ?? 0.5)
      : bonus ? bonusNumber(bonus) / (bestFor.get(bonus.stat) || 1) : 0;
    let fit = stat ? statFit[role][stat] : 0;
    if (stat === 'ACC' && accHungry) fit = Math.min(1, fit + 0.3);
    const kit = readKit(titan.skills.filter((s) => s.type !== 'PassiveBonus'));
    const helps = (Object.entries(tagFit[role]) as [Tag, number][]).filter(([tag]) => kit.tags.has(tag));
    const kitScore = Math.min(1, helps.reduce((sum, [, w]) => sum + w, 0));
    const score = weights.rarity * rarity + weights.stat * fit + weights.kit * kitScore;
    return { titan, bonus, score, reason: reasonFor(role, stat, bonus, helps.map(([tag]) => tag), accHungry) };
  });

  return picks.sort((a, b) => b.score - a.score || a.titan.name.localeCompare(b.titan.name)).slice(0, count);
}

function reasonFor(role: Role, stat: Stat | undefined, bonus: TitanBonus | undefined, tags: Tag[], accHungry: boolean): string {
  const parts: string[] = [];
  if (bonus && stat) {
    const amount = bonus.elsewhere ? `${bonus.value} ${stat} in boss fights` : `${bonus.value} ${stat}`;
    const why = stat === 'ACC' && accHungry ? 'lands its debuffs' : statWhy[stat];
    parts.push(`${amount}, so your ${roleNoun[role]} ${why}.`);
  }
  const phrases = (Object.keys(tagPhrase) as Tag[]).filter((t) => tags.includes(t)).slice(0, 2).map((t) => tagPhrase[t]!);
  if (phrases.length) parts.push(`Its skills ${phrases.join(' and ').replace(/ and cast /, ' and ')}.`);
  return parts.join(' ');
}
