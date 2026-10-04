// DPS simulator core (pure, runs in the browser and in tests). Totals an Invoker's stats from its level, Awakening,
// gear, accessories and sets, then plays a fixed-length fight against one boss stage: Ultimate when its mana is
// full, otherwise the readiest skill (3, 2, 1), otherwise the next combo step. Damage uses expected crits.
// Battle rules that aren't exported yet are in constants.ts.
import * as C from './constants';
import type { Debuff, Dot, Hit } from './parse';

// ---- Data shapes (built at build time by data.ts) ----

export type StatPairs = [stat: string, value: number][];

/** A hit as multipliers of [ATK, DEF, max HP], trailing zeros dropped (keeps the page's data small). */
export type HitT = number[];
export const toHitT = (h: Hit): HitT => {
  const t = [h.atk, h.def, h.hp];
  while (t.length > 1 && !t[t.length - 1]) t.pop();
  return t;
};

/** One skill level: hits and damage-over-time debuffs. */
export interface SkillLevelT {
  h: HitT[];
  d?: Dot[];
  /** Debuffs and control effects cast on the target. */
  x?: Debuff[];
}

export interface DpsSkill {
  cooldown: number;
  manaCost?: number;
  /** Index = skill level - 1. */
  levels: SkillLevelT[];
}

export interface DpsHero {
  configId: string;
  name: string;
  slug: string;
  /** Portrait URL. */
  art?: string;
  rarity: string;
  faction: string;
  element: string;
  sign?: string;
  /** rank → level → [hp, atk, def] at the levels the data lists (1, 10, 20 …). */
  base: Record<string, Record<string, [number, number, number]>>;
  /** Stats that don't grow with level: critRate, critDmg, acc, comboSpeed, skillSpeed, skillRecovery, manaGen, instinct. */
  fixed: Record<string, number>;
  skills: Partial<Record<'ActiveSkill1' | 'ActiveSkill2' | 'ActiveSkill3' | 'Ultimate', DpsSkill>>;
  /** Combo hits per step, index = skill level - 1. */
  combo: HitT[][][];
}

export interface BossStage {
  stage: number;
  level: number;
  element: string;
  hp: number;
  def: number;
  /** The boss's RES, which resists debuffs that need Accuracy. */
  res: number;
}

export interface Curves {
  skillSpeed: number[];
  skillRecovery: number[];
  manaGen: number[];
  comboSpeed: number[];
  defense: number[];
  /** Resist chance (%) by target RES - attacker ACC + 1,500. */
  resist: number[];
}

export interface DpsData {
  gameVersion: string;
  heroes: DpsHero[];
  /** Awakening node id → bonuses. */
  nodes: Record<string, StatPairs>;
  /** Awakening type → every node id (for "fully awakened"). */
  signs: Record<string, number[]>;
  /** Gear set id → piece count → bonuses. */
  sets: Record<string, Record<string, StatPairs>>;
  curves: Curves;
  stages: BossStage[];
}

// ---- Stats ----

export interface Totals {
  base: { hp: number; atk: number; def: number };
  pct: { hp: number; atk: number; def: number };
  flat: { hp: number; atk: number; def: number };
  critRate: number;
  critDmg: number;
  acc: number;
  comboSpeed: number;
  skillSpeed: number;
  skillRecovery: number;
  manaGen: number;
  instinct: number;
  ignoreDef: number;
}

export const RANKS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'];
export const MAX_SKILL_LEVEL = 11;

/** [hp, atk, def] at a rank and level, straight-line between the listed levels. */
export function baseAt(hero: DpsHero, rank: string, level: number): [number, number, number] {
  const byLevel = hero.base[rank] ?? hero.base.Six;
  const points = Object.keys(byLevel)
    .map(Number)
    .sort((a, b) => a - b);
  const lo = [...points].reverse().find((p) => p <= level) ?? points[0];
  const hi = points.find((p) => p >= level) ?? points[points.length - 1];
  const a = byLevel[String(lo)];
  const b = byLevel[String(hi)];
  if (hi === lo) return [...a];
  const t = (level - lo) / (hi - lo);
  return [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as [number, number, number];
}

/** Adds one stat bonus (gear, accessory, set, awakening flat stats) to the totals. */
export function addStat(t: Totals, stat: string, value: number): void {
  switch (stat) {
    case 'AttackFlat': t.flat.atk += value; break;
    case 'DefenseFlat': t.flat.def += value; break;
    case 'HealthFlat': t.flat.hp += value; break;
    case 'AttackPercent': t.pct.atk += value; break;
    case 'DefensePercent': t.pct.def += value; break;
    case 'HealthPercent': t.pct.hp += value; break;
    case 'CriticalRatePercent': t.critRate += value; break;
    case 'CriticalDamagePercent': t.critDmg += value; break;
    case 'AccuracyFlat': t.acc += value; break;
    case 'ComboSpeedFlat': t.comboSpeed += value; break;
    case 'SkillSpeedFlat': t.skillSpeed += value; break;
    case 'SkillRecoveryFlat': t.skillRecovery += value; break;
    case 'ManaGenerationFlat': t.manaGen += value; break;
    case 'InstinctRatingFlat': t.instinct += value; break;
    case 'IgnoreDefensePercent': t.ignoreDef += value; break;
  }
}

export interface Equipment {
  stats: StatPairs;
  /** Gear set id, for set bonuses (accessories have none). */
  set?: string;
}

/** The Invoker's stats at a rank and level, with the given Awakening nodes and equipment. */
export function totalsFor(data: DpsData, hero: DpsHero, rank: string, level: number, nodeIds: number[], equipment: Equipment[]): Totals {
  const [hp, atk, def] = baseAt(hero, rank, level);
  const [hp1, atk1, def1] = baseAt(hero, 'One', 1);
  const f = hero.fixed;
  const t: Totals = {
    base: { hp, atk, def },
    pct: { hp: 0, atk: 0, def: 0 },
    flat: { hp: 0, atk: 0, def: 0 },
    critRate: f.critRate ?? 0,
    critDmg: f.critDmg ?? 0,
    acc: f.acc ?? 0,
    comboSpeed: f.comboSpeed ?? 0,
    skillSpeed: f.skillSpeed ?? 0,
    skillRecovery: f.skillRecovery ?? 0,
    manaGen: f.manaGen ?? 0,
    instinct: f.instinct ?? 0,
    ignoreDef: 0,
  };
  // Awakening percents are of the 1★ level 1 stats and add to the base (see lib/awakening.ts).
  for (const id of nodeIds) {
    for (const [stat, v] of data.nodes[String(id)] ?? []) {
      if (stat === 'AttackPercent') t.base.atk += atk1 * v;
      else if (stat === 'DefensePercent') t.base.def += def1 * v;
      else if (stat === 'HealthPercent') t.base.hp += hp1 * v;
      else addStat(t, stat, v);
    }
  }
  const setCounts = new Map<string, number>();
  for (const e of equipment) {
    for (const [stat, v] of e.stats) addStat(t, stat, v);
    if (e.set) setCounts.set(e.set, (setCounts.get(e.set) ?? 0) + 1);
  }
  for (const [set, n] of setCounts) {
    const tiers = Object.keys(data.sets[set] ?? {}).map(Number).filter((p) => p <= n).sort((a, b) => a - b);
    const used = C.SET_BONUSES_STACK ? tiers : tiers.slice(-1);
    for (const p of used) for (const [stat, v] of data.sets[set][String(p)]) addStat(t, stat, v);
  }
  return t;
}

/** Final ATK / DEF / HP. */
export function finalStat(t: Totals, key: 'atk' | 'def' | 'hp'): number {
  return t.base[key] * (1 + t.pct[key]) + t.flat[key];
}

// ---- Curves ----

const at = (curve: number[], rating: number) => curve[Math.max(0, Math.min(curve.length - 1, Math.round(rating)))] ?? 0;

/** Damage multiplier at the target's DEF. The curve stops at 3,000; above that it keeps its last rate of decay. */
export function defenseFactor(curve: number[], def: number): number {
  const last = curve.length - 1;
  if (def <= last) return at(curve, def);
  const step = 100;
  const decay = Math.log(curve[last - step] / curve[last]) / step;
  return curve[last] * Math.exp(-decay * (def - last));
}

/** Chance a debuff that needs Accuracy lands: 1 - resist chance at (target RES - ACC). */
export function landChance(curve: number[], res: number, acc: number): number {
  const offset = (curve.length - 1) / 2;
  return 1 - Math.max(0, Math.min(100, at(curve, res - acc + offset))) / 100;
}

// ---- Fight ----

export type Mode = 'pve' | 'arena';
export type SkillSlot = 'ActiveSkill1' | 'ActiveSkill2' | 'ActiveSkill3' | 'Ultimate' | 'Combo';
export const ACTIVE = ['ActiveSkill3', 'ActiveSkill2', 'ActiveSkill1'] as const;

export interface FightInput {
  hero: DpsHero;
  totals: Totals;
  /** Skill level 1-11 per slot (missing = max). */
  skillLevels: Partial<Record<SkillSlot, number>>;
  mode: Mode;
  stage: BossStage;
  seconds?: number;
}

export interface SourceResult {
  slot: SkillSlot;
  casts: number;
  damage: number;
}

export interface DebuffResult {
  slot: SkillSlot;
  name: string;
  /** Casts that tried to apply it, in a fight of `seconds`. */
  tries: number;
  /** Chance one try lands (cast chance x not resisted). */
  chance: number;
  /** Expected number landed. */
  landed: number;
}

export interface FightResult {
  /** Average damage per second over fights of FIGHT_WINDOW_SEC either side of `seconds` (smooths out cooldown timing). */
  dps: number;
  /** Damage in a fight of exactly `seconds`. */
  total: number;
  seconds: number;
  sources: SourceResult[];
  debuffs: DebuffResult[];
  /** Chance a debuff that needs Accuracy lands on this boss stage. */
  accChance: number;
}


const levelOf = (input: FightInput, slot: SkillSlot, count: number) =>
  Math.max(1, Math.min(count, input.skillLevels[slot] ?? count)) - 1;

interface Event {
  at: number;
  slot: SkillSlot;
  damage: number;
  /** Debuffs tried by this cast. */
  debuffs?: Debuff[];
  /** True for the action itself (counts as a cast); false for later Burn/Bleed ticks. */
  cast: boolean;
}

/** Every damage event in a fight of `until` seconds. */
function timeline(data: DpsData, input: FightInput, until: number): Event[] {
  const { hero, totals: t, mode, stage } = input;
  const atk = finalStat(t, 'atk');
  const def = finalStat(t, 'def');
  const hp = finalStat(t, 'hp');
  const critRate = Math.max(0, Math.min(C.CRIT_RATE_CAP, t.critRate));
  const critFactor = 1 + critRate * t.critDmg;
  const defFactor = defenseFactor(data.curves.defense, stage.def * Math.max(0, 1 - t.ignoreDef));
  const hitScale = critFactor * defFactor * C.ELEMENT_FACTOR;
  const hitDamage = (h: HitT) => ((h[0] ?? 0) * atk + (h[1] ?? 0) * def + (h[2] ?? 0) * hp) * hitScale;
  const accChance = landChance(data.curves.resist, stage.res, t.acc);
  const tickDamage = (d: Dot) =>
    Math.min(d.pct * stage.hp, d.capAtk * atk) * (C.DOT_USES_DEF ? defFactor : 1) * (d.acc ? accChance : 1);

  const pctOf = (curve: number[], rating: number) => at(curve, rating) / 100;
  const skillSpeed = 1 + pctOf(data.curves.skillSpeed, t.skillSpeed);
  const recovery = 1 + pctOf(data.curves.skillRecovery, t.skillRecovery);
  const comboSpeed = 1 + pctOf(data.curves.comboSpeed, t.comboSpeed);
  const manaGain = (1 + pctOf(data.curves.manaGen, t.manaGen)) * C.MANA_MULTIPLIER[mode];

  const events: Event[] = [];
  const startFactor = mode === 'arena' ? 0.5 : 0;
  const ready = new Map<SkillSlot, number>();
  for (const slot of ACTIVE) {
    const s = hero.skills[slot];
    if (s?.levels.length) ready.set(slot, (s.cooldown * startFactor) / recovery);
  }
  const ult = hero.skills.Ultimate;
  const ultRecovery = C.RECOVERY_APPLIES_TO_ULTIMATE ? recovery : 1;
  let ultReady = ult ? (ult.cooldown * startFactor) / ultRecovery : Infinity;
  const comboLevel = hero.combo.length ? hero.combo[levelOf(input, 'Combo', hero.combo.length)] : [];
  let mana = 0;
  let step = 0;
  let now = 0;

  const cast = (slot: SkillSlot, s: DpsSkill, castSec: number) => {
    const level = s.levels[levelOf(input, slot, s.levels.length)];
    events.push({ at: now, slot, damage: level.h.reduce((n, h) => n + hitDamage(h), 0), cast: true, debuffs: level.x });
    for (const d of level.d ?? []) {
      const ticks = Math.floor(d.durationSec / d.everySec);
      for (let i = 1; i <= ticks; i++) events.push({ at: now + i * d.everySec, slot, damage: tickDamage(d), cast: false });
    }
    now += castSec / skillSpeed;
    if (C.COMBO_RESETS_AFTER_SKILL) step = 0;
  };

  while (now < until) {
    if (ult?.levels.length && ult.manaCost && mana >= ult.manaCost && now >= ultReady) {
      mana = 0;
      ultReady = now + ult.cooldown / ultRecovery;
      cast('Ultimate', ult, C.ULTIMATE_CAST_SEC);
      continue;
    }
    const slot = ACTIVE.find((s) => (ready.get(s) ?? Infinity) <= now);
    if (slot) {
      const s = hero.skills[slot]!;
      ready.set(slot, now + s.cooldown / recovery);
      mana += C.MANA_PER_SKILL_CAST * manaGain;
      cast(slot, s, C.SKILL_CAST_SEC);
      continue;
    }
    if (comboLevel.length) {
      const hits = comboLevel[step % comboLevel.length];
      events.push({ at: now, slot: 'Combo', damage: hits.reduce((n, h) => n + hitDamage(h), 0), cast: true });
      mana += C.MANA_PER_COMBO_HIT * hits.length * manaGain;
      step += 1;
      now += C.COMBO_STEP_SEC / comboSpeed;
    } else {
      // No combo to fill the gap: wait for the next cooldown.
      const next = Math.min(ultReady, ...ACTIVE.map((s) => ready.get(s) ?? Infinity));
      if (!Number.isFinite(next) || next <= now) break;
      now = next;
    }
  }
  return events;
}

export function simulate(data: DpsData, input: FightInput): FightResult {
  const T = input.seconds ?? C.FIGHT_SEC[input.mode];
  const WINDOW = C.FIGHT_WINDOW_SEC[input.mode];
  const lo = Math.max(1, T - WINDOW);
  const events = timeline(data, input, T + WINDOW);
  const damageBy = (until: number) => events.reduce((n, e) => (e.at < until ? n + e.damage : n), 0);

  let sum = 0;
  let count = 0;
  for (let len = lo; len <= T + WINDOW; len += 0.5) {
    sum += damageBy(len) / len;
    count += 1;
  }

  const results = new Map<SkillSlot, SourceResult>();
  for (const e of events) {
    if (e.at >= T) continue;
    const r = results.get(e.slot) ?? { slot: e.slot, casts: 0, damage: 0 };
    if (e.cast) r.casts += 1;
    r.damage += e.damage;
    results.set(e.slot, r);
  }
  const sources = [...results.values()].sort((a, b) => b.damage - a.damage);
  const accChance = landChance(data.curves.resist, input.stage.res, input.totals.acc);
  const debuffs = new Map<string, DebuffResult>();
  for (const e of events) {
    if (e.at >= T || !e.debuffs) continue;
    for (const d of e.debuffs) {
      const key = `${e.slot}:${d.name}`;
      const chance = d.chance * (d.acc ? accChance : 1);
      const r = debuffs.get(key) ?? { slot: e.slot, name: d.name, tries: 0, chance, landed: 0 };
      r.tries += 1;
      r.landed += chance;
      debuffs.set(key, r);
    }
  }
  return { dps: sum / count, total: sources.reduce((n, s) => n + s.damage, 0), seconds: T, sources, debuffs: [...debuffs.values()], accChance };
}

// ---- Stat value table ----

export interface StatValue {
  stat: string;
  value: number;
  dps: number;
  /** DPS gain as a fraction (0.012 = +1.2%). */
  gain: number;
}

/** DPS gained from one normal 5★ substat roll of each stat, largest first. */
export function statValues(data: DpsData, input: FightInput, rolls = C.NORMAL_ROLL): { base: FightResult; values: StatValue[] } {
  const base = simulate(data, input);
  const values = rolls.map(({ stat, value }) => {
    const totals: Totals = structuredClone(input.totals);
    addStat(totals, stat, value);
    const dps = simulate(data, { ...input, totals }).dps;
    return { stat, value, dps, gain: base.dps > 0 ? dps / base.dps - 1 : 0 };
  });
  return { base, values: values.sort((a, b) => b.gain - a.gain) };
}

// ---- Skill upgrades ----

export const UPGRADABLE: SkillSlot[] = ['ActiveSkill1', 'ActiveSkill2', 'ActiveSkill3', 'Ultimate', 'Combo'];

export interface SkillGain {
  slot: SkillSlot;
  level: number;
  max: number;
  /** DPS gain from one more level, and from levelling to max (fractions). */
  next: number;
  toMax: number;
}

/** Highest level a skill has. */
export function maxLevel(hero: DpsHero, slot: SkillSlot): number {
  return slot === 'Combo' ? hero.combo.length : (hero.skills[slot]?.levels.length ?? 0);
}

/** DPS gained from levelling each skill that isn't maxed, largest first. */
export function skillGains(data: DpsData, input: FightInput): SkillGain[] {
  const base = simulate(data, input).dps;
  if (base <= 0) return [];
  const out: SkillGain[] = [];
  for (const slot of UPGRADABLE) {
    const max = maxLevel(input.hero, slot);
    const level = Math.min(max, input.skillLevels[slot] ?? max);
    if (!max || level >= max) continue;
    const at = (lv: number) => simulate(data, { ...input, skillLevels: { ...input.skillLevels, [slot]: lv } }).dps / base - 1;
    out.push({ slot, level, max, next: at(level + 1), toMax: at(max) });
  }
  return out.sort((a, b) => b.next - a.next);
}
