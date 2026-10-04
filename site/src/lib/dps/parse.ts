// Reads damage hits out of skill text: each "#N Damage: 245% ATK" line is one hit on the target, a Combo has one
// block per step, and a "Burn/Bleed Damage Limit" line is one damage-over-time debuff (its tick size and length come
// from the sentence that casts it). Healing, shields and "Target Allies" splash are left out (single target).

/** One hit: multipliers of the attacker's ATK, DEF and max HP (fractions, 2.45 = 245%). */
export interface Hit {
  atk: number;
  def: number;
  hp: number;
}

/** A damage-over-time debuff on the target: `pct` of the target's max HP per tick, capped at `capAtk` × ATK. */
export interface Dot {
  kind: string;
  /** Needs Accuracy to land (listed under "Accuracy required for"). */
  acc?: boolean;
  pct: number;
  capAtk: number;
  everySec: number;
  durationSec: number;
}

/** A debuff or control effect the skill puts on enemies. */
export interface Debuff {
  /** Effect name as the game shows it, e.g. "DEF Down", "Stun", "Launch". */
  name: string;
  /** Chance the skill tries to cast it (1 unless the text gives "Has a 20% chance"). */
  chance: number;
  /** True when the text lists it under "Accuracy required for" (the target's RES can resist it). */
  acc: boolean;
}

/** Stats a self buff changes. Buffs multiply the final stat (Newms): ATK Up 40% = final ATK × 1.4. */
export type BuffStat = 'atk' | 'critRate' | 'critDmg' | 'skillRecovery' | 'skillSpeed' | 'comboSpeed';

/** A buff the skill casts on its own Invoker (directly, or on allies around it). */
export interface SelfBuff {
  /** Name as the game shows it, e.g. "Crit DMG Up". */
  name: string;
  stat: BuffStat;
  /** 0.4 = +40%. */
  pct: number;
  sec: number;
  /** Only cast when the hit crits. */
  onCrit?: boolean;
}

/** Something a skill does for its own Invoker besides damage: cuts its own cooldowns or adds Ultimate Mana. */
export interface SelfEffect {
  kind: 'cooldown' | 'mana';
  /** Seconds cut, or mana gained. */
  amount: number;
  /** Which cooldown: Skill 1-3, a random one, or all three (cooldown cuts only). */
  skill?: 1 | 2 | 3 | 'random' | 'all';
  /** Only on a crit, only on a non-crit, or if any hit crits. */
  when?: 'crit' | 'noncrit' | 'anycrit';
  /** Once per hit instead of once per use. */
  each?: boolean;
  /** "…gains 40 instead" on a crit: replaces the amount before it rather than adding. */
  instead?: boolean;
}

export interface ParsedSkill {
  hits: Hit[];
  dots: Dot[];
  debuffs: Debuff[];
  buffs: SelfBuff[];
  effects: SelfEffect[];
}

const num = (s: string) => Number(s.replace(/,/g, ''));
const plain = (text: string) =>
  text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ');

/** "245% ATK + 40% DEF", "965% * ATK", "1,100% ATK" → a hit. Null if the line names no ATK/DEF/HP multiplier. */
export function parseHit(formula: string): Hit | null {
  const hit: Hit = { atk: 0, def: 0, hp: 0 };
  let found = false;
  for (const m of formula.matchAll(/([\d,.]+)%\s*\*?\s*(MAX HP|ATK|DEF)/g)) {
    const v = num(m[1]) / 100;
    if (!Number.isFinite(v)) continue;
    found = true;
    if (m[2] === 'ATK') hit.atk += v;
    else if (m[2] === 'DEF') hit.def += v;
    else hit.hp += v;
  }
  return found ? hit : null;
}

function dotFor(kind: string, capAtk: number, text: string): Dot | null {
  // "[1.5% Burn] debuff on the target, lasting 4s. The [Burn] ticks every 2s, damaging targets by 1.5% of their MAX HP".
  // "Casts 2 [1.25% Bleed] debuffs on …" puts two stacks on, each ticking and capped on its own.
  const cast = new RegExp(`(?:(\\d+) )?\\[[\\d.]+% ${kind}\\] debuffs? on (?:the targets?|each target|\\d+ enem)[^\\n]*?lasting ([\\d.]+)s`).exec(text);
  const tick = new RegExp(`\\[${kind}\\] ticks every ([\\d.]+)s, damaging targets by ([\\d.]+)% of their MAX HP`).exec(text);
  if (!cast || !tick) return null;
  const stacks = cast[1] ? Number(cast[1]) : 1;
  return { kind, pct: (stacks * num(tick[2])) / 100, capAtk: stacks * capAtk, everySec: num(tick[1]), durationSec: num(cast[2]) };
}

// Who a "[X] debuff on …" lands on: enemies only (not the caster or allies).
const ENEMY_TARGET = /^(?:the targets?|\d+ (?:random )?enem|each target|all enemies|the \d+ enemies)/;

/** Debuffs and control effects cast on enemies, from "[18% DEF Down] debuff on the targets" and "Accuracy required for". */
export function parseDebuffs(text: string): Debuff[] {
  const t = plain(text);
  const needAcc = new Set(
    [...t.matchAll(/Accuracy required for:\s*([^\n#]+)/g)].flatMap((m) => m[1].split(',').map((x) => x.trim()).filter(Boolean)),
  );
  const out: Debuff[] = [];
  const seen = new Set<string>();
  for (const m of t.matchAll(/(?:Has an? ([\d.]+)% chance to casts? an? )?\[(?:[\d.]+% )?([^\]]+)\] debuff(?: on ([^,.\n]+))?/g)) {
    const name = m[2].trim();
    seen.add(name);
    // "[Shock] debuff, lasting 6s, instead of the [Stun]" names no target: it goes where the skill's other debuff goes.
    if (m[3] && !ENEMY_TARGET.test(m[3].trim())) continue;
    out.push({ name, chance: m[1] ? Number(m[1]) / 100 : 1, acc: needAcc.has(name) });
  }
  // Control effects that aren't bracketed (Launch, Pull, Buff Steal …) still need Accuracy to land.
  for (const name of needAcc) if (!seen.has(name)) out.push({ name, chance: 1, acc: true });
  return out;
}

const BUFF_STATS: Record<string, BuffStat> = {
  'ATK Up': 'atk',
  'Crit Rate Up': 'critRate',
  'Crit DMG Up': 'critDmg',
  'Skill Recovery Up': 'skillRecovery',
  'Skill SPD Up': 'skillSpeed',
  'Combo SPD Up': 'comboSpeed',
};
const BUFF_RE = new RegExp(`\\[([\\d.]+)% (${Object.keys(BUFF_STATS).join('|')})\\] buff on (.+?),? lasting ([\\d.]+)s(.*)$`);

/**
 * Damage buffs that reach the caster: "[100% Crit DMG Up] buff on Devi of the Six, lasting 16s", or on a group of allies
 * around it ("10 allies in a 15m radius"; "the targets" in a later sentence means the same group). Buffs that need a
 * kill or go to a single other ally are left out; "if the hit lands as a critical hit" makes it crit-only.
 */
export function parseSelfBuffs(text: string, self: string): SelfBuff[] {
  const out: SelfBuff[] = [];
  let lastReachedSelf = false;
  for (const sentence of plain(text).split(/(?<=\.)\s+|\n/)) {
    const m = BUFF_RE.exec(sentence);
    if (!m) continue;
    const target = m[3].trim();
    const reaches: boolean =
      target.startsWith(self) || (/\ballies\b/.test(target) && !/^the ally\b/.test(target)) || (/^the targets?\b/.test(target) && lastReachedSelf);
    lastReachedSelf = reaches;
    const rest = sentence.slice(0, m.index) + ' ' + m[5];
    if (!reaches || /kills|non-critical/.test(rest)) continue;
    const buff: SelfBuff = { name: m[2], stat: BUFF_STATS[m[2]], pct: num(m[1]) / 100, sec: num(m[4]) };
    if (/critical hit/.test(rest)) buff.onCrit = true;
    out.push(buff);
  }
  return out;
}

/**
 * Cooldown cuts and Ultimate Mana the skill gives its own Invoker: "Reduces the cooldown of Active Skill 2 on Devi of
 * the Six by 3s, if the hit lands as a critical hit", "Each hit Devi of the Six gains 20 Ultimate Mana". Effects that
 * depend on kills, debuff or buff counts, or that give a % of the bar, are left out.
 */
export function parseSelfEffects(text: string, self: string): SelfEffect[] {
  const out: SelfEffect[] = [];
  for (const sentence of plain(text).split(/(?<=\.)\s+|\n/)) {
    if (!sentence.includes(self) || /kills|debuff|buffs|control|allies|ally|per |Miniboss/.test(sentence)) continue;
    const when: SelfEffect['when'] = /non-critical/.test(sentence)
      ? 'noncrit'
      : /any hit lands as a critical/.test(sentence)
        ? 'anycrit'
        : /critical hit/.test(sentence)
          ? 'crit'
          : undefined;
    const each = /^\s*Each hit|on each hit|for each (?:non-)?critical hit/.test(sentence);
    const cd = new RegExp(`[Rr]educes? the cooldown of (Active Skill (\\d)|a random Active Skill|all Active Skills) on ${escape(self)} by ([\\d.]+)s(?: (\\d+) times)?`).exec(sentence);
    if (cd) {
      const skill = cd[2] ? (Number(cd[2]) as 1 | 2 | 3) : cd[1].startsWith('a random') ? 'random' : 'all';
      out.push({ kind: 'cooldown', skill, amount: num(cd[3]) * (cd[4] ? Number(cd[4]) : 1), ...(when ? { when } : {}), ...(each ? { each } : {}) });
      continue;
    }
    const mana = new RegExp(`${escape(self)} gains ([\\d,.]+) Ultimate Mana`).exec(sentence);
    if (mana) {
      const instead = /instead/.test(sentence);
      out.push({ kind: 'mana', amount: num(mana[1]), ...(when ? { when } : {}), ...(each ? { each } : {}), ...(instead ? { instead } : {}) });
    }
  }
  return out;
}
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Hits and damage-over-time debuffs of an active skill or Ultimate at one level. */
export function parseSkillText(text: string, self = ''): ParsedSkill {
  const t = plain(text);
  const hits: Hit[] = [];
  const dots: Dot[] = [];
  for (const line of t.split('\n')) {
    const dmg = /^\s*#\d+\s+Damage:\s*(.+)$/.exec(line);
    if (dmg) {
      const hit = parseHit(dmg[1]);
      if (hit) hits.push(hit);
      continue;
    }
    const limit = /^\s*#\d+\s+(\w+) Damage Limit:\s*([\d,.]+)% ATK per tick/.exec(line);
    if (limit) {
      const dot = dotFor(limit[1], num(limit[2]) / 100, t);
      if (dot && new RegExp(`Accuracy required for:[^\\n]*\\b${limit[1]}\\b`).test(t)) dot.acc = true;
      if (dot) dots.push(dot);
    }
  }
  return { hits, dots, debuffs: parseDebuffs(text), buffs: self ? parseSelfBuffs(text, self) : [], effects: self ? parseSelfEffects(text, self) : [] };
}

/** Combo text → the cooldown cuts and Ultimate Mana each step gives its own Invoker. */
export function parseComboEffects(text: string, self: string): SelfEffect[][] {
  return plain(text)
    .split(/(?:^|\n)\s*#\d+\s+/)
    .slice(1)
    .map((block) => parseSelfEffects(block, self));
}

/** Combo text → the hits of each step, in order (steps 1-5). */
export function parseComboText(text: string): Hit[][] {
  const t = plain(text);
  const steps: Hit[][] = [];
  for (const block of t.split(/(?:^|\n)\s*#\d+\s+/).slice(1)) {
    const hits: Hit[] = [];
    for (const m of block.matchAll(/Damage:\s*([^\n]+)/g)) {
      const hit = parseHit(m[1]);
      if (hit) hits.push(hit);
    }
    steps.push(hits);
  }
  return steps;
}
