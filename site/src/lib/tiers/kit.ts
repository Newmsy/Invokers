// What an Invoker's or Titan's kit brings, read from its max-level skill text: damage multipliers, how many
// enemies it hits, and the tools that boss guides and game modes ask for (Heal Reduction, Block Revive, ...).
// The draft-tiers script scores these to seed tiers.json; the tier pages show the matching tools as chips.
// Pure: no Astro or Vite imports, so scripts can use it.

export type Tag =
  | 'healReduction'
  | 'blockRevive'
  | 'mindworm'
  | 'jinx'
  | 'immunity'
  | 'cleanse'
  | 'stripBuffs'
  | 'stealBuffs'
  | 'teamHeal'
  | 'shields'
  | 'revive'
  | 'unkillable'
  | 'hardCC'
  | 'taunt'
  | 'comboSpdDown'
  | 'moveSpdDown'
  | 'moveSpdUp'
  | 'extendDebuffs'
  | 'teamBuffs'
  | 'cooldownCuts'
  | 'titanMana'
  | 'ultMana'
  | 'defDown'
  | 'weaken'
  | 'aoe'
  | 'maxHpDamage'
  | 'bleedBurn';

export const tagLabels: Record<Tag, string> = {
  healReduction: 'Heal Reduction',
  blockRevive: 'Block Revive',
  mindworm: 'Mindworm',
  jinx: 'Jinx',
  immunity: 'Immunity',
  cleanse: 'Removes debuffs',
  stripBuffs: 'Removes buffs',
  stealBuffs: 'Steals buffs',
  teamHeal: 'Heals allies',
  shields: 'Shields',
  revive: 'Revive',
  unkillable: 'Unkillable',
  hardCC: 'Stun / Freeze / Shock',
  taunt: 'Taunt',
  comboSpdDown: 'Combo SPD Down',
  moveSpdDown: 'Move SPD Down',
  moveSpdUp: 'Move SPD Up',
  extendDebuffs: 'Extends debuffs',
  teamBuffs: 'Team buffs',
  cooldownCuts: 'Cooldown cuts',
  titanMana: 'Titan Mana',
  ultMana: 'Ultimate Mana',
  defDown: 'DEF Down',
  weaken: 'Weaken',
  aoe: 'AoE damage',
  maxHpDamage: 'MAX HP damage',
  bleedBurn: 'Bleed / Burn',
};

export interface Kit {
  /** Summed damage multipliers of the active skills and Ultimate, applied to the caster's ATK/DEF where known. */
  single: number;
  /** The same, weighted by how many enemies each skill hits (skills hitting 3 or more). */
  aoe: number;
  tags: Set<Tag>;
}

export interface SkillText {
  type: string;
  levels?: { level: number; text: string }[];
  empowerments?: { empowerment: number; text: string }[];
}

const plain = (t: string) => t.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');

const num = (s: string) => Number(s.replace(/,/g, ''));

/** Max-level text of a skill, tags stripped (a Titan's passive uses its top empowerment). */
export function maxText(s: SkillText): string {
  const last = s.levels?.at(-1)?.text ?? s.empowerments?.at(-1)?.text ?? '';
  return plain(last);
}

/** ATK and DEF multipliers (as fractions) in a skill's "Damage:" lines, times the hit count. */
export function damageOf(text: string): { atk: number; def: number; targets: number } {
  let atk = 0;
  let def = 0;
  for (const part of text.split(/Damage:/).slice(1)) {
    const line = part.split(/#\d|Heal:|Damage Limit/)[0];
    for (const m of line.matchAll(/([\d.,]+)% \*? ?(ATK|DEF)/g)) {
      if (m[2] === 'ATK') atk += num(m[1]) / 100;
      else def += num(m[1]) / 100;
    }
  }
  const times = Math.max(1, ...[...text.matchAll(/(\d+) times/g)].map((m) => Number(m[1])));
  const targets = Math.max(1, ...[...text.matchAll(/Attacks (?:the )?(\d+) enem/g)].map((m) => Number(m[1])));
  return { atk: atk * times, def: def * times, targets };
}

const debuff = (name: string) => new RegExp(`\\[[\\d.%+ ]*${name}\\]`);

const tagTests: [Tag, RegExp][] = [
  ['healReduction', debuff('Heal Reduction')],
  ['blockRevive', debuff('Block Revive')],
  ['mindworm', debuff('Mindworm')],
  ['jinx', debuff('Jinx')],
  ['immunity', debuff('Immunity')],
  ['cleanse', /Removes (?:all|a|\d+)(?: random)? debuffs? from/],
  ['stripBuffs', /Removes (?:all|a|\d+)(?: random)? buffs? from/],
  ['stealBuffs', /Steals (?:all|a|\d+)(?: random)? buffs?/],
  ['shields', /\[[\d.%+ ]*(?:HP Shield|Shield|Damage Filter|Deflection|Invincibility|Harden)\]/],
  ['revive', /Revives /],
  ['unkillable', debuff('Unkillable')],
  ['hardCC', /\[(?:Stun|Freeze|Shock|Disable)\]/],
  ['taunt', debuff('Taunt')],
  ['comboSpdDown', debuff('Combo SPD Down')],
  ['moveSpdDown', debuff('Move SPD Down')],
  ['moveSpdUp', debuff('Move SPD Up')],
  ['extendDebuffs', /Extends the duration of (?:up to \d+|all|\d+)(?: random)? (?:\[[^\]]+\] )?debuffs?/],
  ['cooldownCuts', /Reduces the cooldown of [^.]*?(?:on (?:\d+ )?(?:random )?all(?:y|ies)|ally|allies)/],
  ['titanMana', /Titan Mana/],
  ['ultMana', /(?:ally|allies) gains? \d+%? Ultimate Mana|Bound Invoker gains \d+ Ultimate Mana/],
  ['defDown', debuff('DEF Down')],
  ['weaken', debuff('Weaken')],
  ['maxHpDamage', /% of their MAX HP|\* Target's MAX HP\)? damage|enemy MAX HP/],
  ['bleedBurn', /\[[\d.%+ ]*(?:Bleed|Burn)\]/],
];

/** Sentences that heal (or give Regeneration to) or buff someone other than the caster. */
function hasTeamHeal(text: string): boolean {
  return text
    .split(/(?<=\.)\s/)
    .some(
      (s) =>
        (/\bHeals?\b/.test(s) && /(all(?:y|ies)|the target|Bound Invoker|targets)/.test(s) && !/Heal Reduction/.test(s)) ||
        /\[[\d.%+ ]*Regeneration\] buff on (?:the )?(?:\d+ )?(?:all(?:y|ies)|targets|Bound Invoker)/.test(s),
    );
}

function hasTeamBuffs(text: string): boolean {
  return text
    .split(/(?<=\.)\s/)
    .some((s) => /Casts? an? \[[^\]]+\] buff on (?:the )?(?:\d+ )?(?:all(?:y|ies)|targets|Bound Invoker)/.test(s) && !/enem/.test(s));
}

export interface StatLine {
  atk: number;
  def: number;
}

/**
 * Reads a kit. `skills` are the hero's or Titan's skills; `stats` (heroes only) turns multipliers into damage,
 * so a hard-hitting Legendary outscores a Common with the same percentages. Titans pass none and are compared
 * on multipliers alone, since they borrow the bound Invoker's stats.
 */
export function readKit(skills: SkillText[], stats?: StatLine): Kit {
  const tags = new Set<Tag>();
  let single = 0;
  let aoe = 0;
  for (const s of skills) {
    const text = maxText(s);
    for (const [tag, re] of tagTests) if (re.test(text)) tags.add(tag);
    if (hasTeamHeal(text)) tags.add('teamHeal');
    if (hasTeamBuffs(text)) tags.add('teamBuffs');
    if (s.type === 'Combo' || s.type === 'PassiveBonus') continue;
    const d = damageOf(text);
    const dmg = stats ? d.atk * stats.atk + d.def * stats.def : d.atk + d.def;
    single += dmg;
    if (d.targets >= 3) {
      aoe += dmg * Math.min(d.targets, 6);
      tags.add('aoe');
    }
  }
  return { single, aoe, tags };
}
