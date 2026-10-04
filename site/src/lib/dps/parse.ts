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

export interface ParsedSkill {
  hits: Hit[];
  dots: Dot[];
  debuffs: Debuff[];
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
  // "[1.5% Burn] debuff on the target, lasting 4s. The [Burn] ticks every 2s, damaging targets by 1.5% of their MAX HP"
  const cast = new RegExp(`\\[[\\d.]+% ${kind}\\] debuff on (?:the targets?|\\d+ enem)[^\\n]*?lasting ([\\d.]+)s`).exec(text);
  const tick = new RegExp(`\\[${kind}\\] ticks every ([\\d.]+)s, damaging targets by ([\\d.]+)% of their MAX HP`).exec(text);
  if (!cast || !tick) return null;
  return { kind, pct: num(tick[2]) / 100, capAtk, everySec: num(tick[1]), durationSec: num(cast[1]) };
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

/** Hits and damage-over-time debuffs of an active skill or Ultimate at one level. */
export function parseSkillText(text: string): ParsedSkill {
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
  return { hits, dots, debuffs: parseDebuffs(text) };
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
