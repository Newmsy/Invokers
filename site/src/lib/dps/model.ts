// DPS simulator core (pure, runs in the browser and in tests). Totals an Invoker's stats from its level, Awakening,
// gear, accessories and sets, then plays a fixed-length fight against one boss stage: Ultimate when its mana is
// full, otherwise the readiest skill (3, 2, 1), otherwise the next combo step. Damage uses expected crits.
// Battle rules that aren't exported yet are in constants.ts.
import * as C from './constants';
import { TEAM_SIZE, type BuffStat, type Debuff, type Dot, type Hit, type SelfBuff, type SelfEffect, type Shield, type TeamBuff } from './parse';

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
  /** Buffs cast on the Invoker itself. */
  b?: SelfBuff[];
  /** Buffs cast on other team members. */
  t?: TeamBuff[];
  /** Shields cast on the Invoker itself. */
  s?: Shield[];
  /** Cooldown cuts and Ultimate Mana for the Invoker itself. */
  e?: SelfEffect[];
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
  /** Stats that don't grow with level: critRate, critDmg, acc, res, comboSpeed, skillSpeed, skillRecovery, manaGen, instinct. */
  fixed: Record<string, number>;
  skills: Partial<Record<'ActiveSkill1' | 'ActiveSkill2' | 'ActiveSkill3' | 'Ultimate', DpsSkill>>;
  /** Combo hits per step, index = skill level - 1. */
  combo: HitT[][][];
  /** Cooldown cuts and Ultimate Mana per combo step, same shape as `combo` (missing = none). */
  comboFx?: SelfEffect[][][];
}

export interface BossStage {
  stage: number;
  level: number;
  element: string;
  hp: number;
  def: number;
  /** The boss's RES, which resists debuffs that need Accuracy. */
  res: number;
  atk: number;
  /** PvE Ultimate mana multiplier this stage sets in place of the mode one (missing = the mode's). */
  mana?: number;
}

export interface Curves {
  skillSpeed: number[];
  skillRecovery: number[];
  manaGen: number[];
  comboSpeed: number[];
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
  defense: DefenseRule;
  elements: Record<ElementEdge, ElementRule>;
  /** Ultimate mana per second of acting, and the multiplier per mode. */
  mana: { perSec: number; multiplier: Record<Mode, number> };
  /** One normal 5★ substat roll per stat (see NORMAL_ROLL_* in constants). */
  normalRoll: { stat: string; value: number }[];
  /** One normal 5★ roll of flat and % HP and DEF, for toughness. */
  toughRoll: { stat: string; value: number }[];
}

// ---- Stats ----

export interface Totals {
  base: { hp: number; atk: number; def: number };
  pct: { hp: number; atk: number; def: number };
  flat: { hp: number; atk: number; def: number };
  critRate: number;
  critDmg: number;
  acc: number;
  res: number;
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
    case 'ResistanceFlat': t.res += value; break;
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
    res: f.res ?? 0,
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

/** The game's DEF rule: damage taken = floor + (1 - floor) × e^(-DEF / scale). It depends only on the defender's DEF. */
export interface DefenseRule {
  floor: number;
  scale: number;
}

/** Damage multiplier at the target's DEF (1 = full damage), whatever the size of the hit. */
export function defenseFactor(rule: DefenseRule, def: number): number {
  return rule.floor + (1 - rule.floor) * Math.exp(-Math.max(0, def) / rule.scale);
}

/** Chance a debuff that needs Accuracy lands: 1 - resist chance at (target RES - ACC). */
export function landChance(curve: number[], res: number, acc: number, bonus = 0): number {
  const offset = (curve.length - 1) / 2;
  return 1 - Math.max(0, Math.min(100, at(curve, res - acc + offset) - bonus)) / 100;
}

/** Element rules (damage.json): damage multiplier, crit chance change and debuff landing bonus (points off the resist chance). */
export interface ElementRule {
  damage: number;
  crit: number;
  debuff: number;
}
export type ElementEdge = 'advantage' | 'disadvantage' | 'lightDark' | 'neutral';
const BEATS: Record<string, string> = { Water: 'Fire', Fire: 'Earth', Earth: 'Wind', Wind: 'Water' };
const LIGHT_DARK = new Set(['Light', 'Dark']);

/** The Invoker's edge against a boss stage's element (PvE: the player side gets the Light/Dark bonus). */
export function elementEdge(mine: string, enemy: string): ElementEdge {
  if (BEATS[mine] === enemy) return 'advantage';
  if (BEATS[enemy] === mine) return 'disadvantage';
  if (LIGHT_DARK.has(mine) && BEATS[enemy]) return 'lightDark';
  return 'neutral';
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
  /** Leave out every self buff, cooldown cut and bonus mana (to show what they add). */
  noBuffs?: boolean;
  /** Leave out one self buff ("<slot>|<buff name>") or one skill's cooldown cuts or mana ("<slot>|cooldown", "<slot>|mana"). */
  skipBuff?: string;
  /** Buffs and boss debuffs from teammates, already timed and weighted by their chance to reach this Invoker (see teamWindows). */
  ext?: BuffWindow[];
}

/** A buff or boss debuff that is up from `from` to `until`, counted with weight `p` (its chance of being up). */
export interface BuffWindow {
  key: string;
  slot: SkillSlot;
  name: string;
  stat: BuffStat;
  pct: number;
  p: number;
  /** Expected other team members it reaches (boss debuffs: all of them). */
  allies: number;
  from: number;
  until: number;
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
  /** The Invoker's element edge against this stage. */
  edge: ElementEdge;
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

/** Expected time a self buff was up in the fight (crit-only buffs weighted by the chance they were cast). */
export interface BuffUptime {
  slot: SkillSlot;
  name: string;
  stat: BuffStat;
  pct: number;
  /** A debuff on the boss (DEF Down, Weaken) rather than a buff on the Invoker. */
  onBoss?: boolean;
  /** Seconds up, out of `until`. */
  seconds: number;
}

const buffKey = (slot: SkillSlot, b: SelfBuff) => `${slot}|${b.name}`;

/** Cooldown seconds cut or Ultimate Mana gained by one skill's self effects in the fight. */
export interface EffectTotal {
  slot: SkillSlot;
  kind: SelfEffect['kind'];
  total: number;
}

/** Every damage event in a fight of `until` seconds, plus how long each self buff was up. */
interface Timeline {
  events: Event[];
  uptime: BuffUptime[];
  effects: EffectTotal[];
  /** What it gives the rest of the team: buffs on allies and debuffs on the boss. */
  team: BuffWindow[];
  /** Shields on itself: size and how long each lasts. */
  shields: { amount: number; from: number; until: number }[];
}

function timeline(data: DpsData, input: FightInput, until: number): Timeline {
  const { hero, totals: t, mode, stage } = input;
  const atk0 = finalStat(t, 'atk');
  const def0 = finalStat(t, 'def');
  const hp = finalStat(t, 'hp');
  const el = data.elements[elementEdge(hero.element, stage.element)];
  const defFactor = defenseFactor(data.defense, stage.def * Math.max(0, 1 - t.ignoreDef));
  const accChance = landChance(data.curves.resist, stage.res, t.acc, el.debuff);

  const pctOf = (curve: number[], rating: number) => at(curve, rating) / 100;
  const skillSpeed0 = 1 + pctOf(data.curves.skillSpeed, t.skillSpeed);
  const recovery0 = 1 + pctOf(data.curves.skillRecovery, t.skillRecovery);
  const comboSpeed0 = 1 + pctOf(data.curves.comboSpeed, t.comboSpeed);
  // A boss stage's own mana multiplier replaces the PvE one.
  const manaMode = mode === 'pve' && stage.mana ? stage.mana : data.mana.multiplier[mode];
  const manaGain = (1 + pctOf(data.curves.manaGen, t.manaGen)) * manaMode;

  // Self buffs multiply the final stat while they're up (Skill and Combo SPD buffs add to the speed %) (refreshing one restarts it; different buffs stack).
  // A crit-only buff counts with the chance the cast crit, so `p` is that chance.
  const active = new Map<string, { stat: BuffStat; pct: number; p: number; from: number; until: number }>();
  const upFor = new Map<string, BuffUptime>();
  // A teammate's buffs (input.ext) count the same way while their windows are open.
  const ext = input.ext ?? [];
  const extUp = (now: number) => ext.filter((w) => w.from <= now && w.until > now);
  const mult = (stat: BuffStat, now: number) => {
    let m = 1;
    for (const b of active.values()) if (b.stat === stat && b.until > now) m *= 1 + b.p * b.pct;
    for (const w of extUp(now)) if (w.stat === stat) m *= 1 + w.p * w.pct;
    return m;
  };
  const add = (stat: BuffStat, now: number) => {
    let n = 0;
    for (const b of active.values()) if (b.stat === stat && b.until > now) n += b.p * b.pct;
    for (const w of extUp(now)) if (w.stat === stat) n += w.p * w.pct;
    return n;
  };
  // DEF Down lowers the boss's DEF multiplier (defenseFactor = 1 - X%), Weaken raises damage taken (1 + X%); a debuff
  // that may be resisted counts as a mix of landed and not (damage.json statusEffects).
  const ignore = Math.max(0, Math.min(1, t.ignoreDef));
  const defAt = (down: number) => defenseFactor(data.defense, stage.def * Math.max(0, 1 - down - ignore));
  const defNow = (now: number) => {
    let f = defFactor;
    for (const b of active.values()) if (b.stat === 'defDown' && b.until > now) f *= (b.p * defAt(b.pct) + (1 - b.p) * defFactor) / defFactor;
    for (const w of extUp(now)) if (w.stat === 'defDown') f *= (w.p * defAt(w.pct) + (1 - w.p) * defFactor) / defFactor;
    return f;
  };
  const stats = (now: number) => {
    const critRate = Math.max(0, Math.min(C.CRIT_RATE_CAP, t.critRate * mult('critRate', now) + el.crit));
    return {
      atk: atk0 * mult('atk', now),
      myDef: def0 * mult('def', now),
      critRate,
      critFactor: 1 + critRate * t.critDmg * mult('critDmg', now),
      def: defNow(now),
      taken: 1 + add('weaken', now),
      // Skill Recovery and speed buffs add to the stat's % (timing.json speedFactors).
      recovery: recovery0 + add('skillRecovery', now),
      skillSpeed: skillSpeed0 + add('skillSpeed', now),
      comboSpeed: comboSpeed0 + add('comboSpeed', now),
    };
  };
  const closeBuff = (key: string, b: { p: number; from: number; until: number }, at: number) => {
    const u = upFor.get(key);
    if (u) u.seconds += b.p * Math.max(0, Math.min(at, b.until, until) - b.from);
  };

  const events: Event[] = [];
  const team: BuffWindow[] = [];
  const shields: Timeline['shields'] = [];
  // Recasting a team buff refreshes it, so the earlier window ends there.
  const openTeam = new Map<string, BuffWindow>();
  const giveTeam = (w: BuffWindow) => {
    const old = openTeam.get(w.key);
    if (old && old.until > w.from) old.until = w.from;
    openTeam.set(w.key, w);
    team.push(w);
  };
  const startFactor = mode === 'arena' ? 0.5 : 0;
  // Cooldowns tick down by time × recovery factor, so a cooldown lasts base / factor (timing.json skillRecovery).
  const cdLeft = new Map<SkillSlot, number>();
  for (const slot of ACTIVE) {
    const s = hero.skills[slot];
    if (s?.levels.length) cdLeft.set(slot, s.cooldown * startFactor);
  }
  const ult = hero.skills.Ultimate;
  if (ult?.levels.length) cdLeft.set('Ultimate', ult.cooldown * startFactor);
  const comboLevel = hero.combo.length ? hero.combo[levelOf(input, 'Combo', hero.combo.length)] : [];
  const comboFx = hero.comboFx?.[levelOf(input, 'Combo', hero.comboFx.length)];
  // Ultimate mana fills with time spent acting (mana.json), faster with Mana Generation and in Arena; it starts empty (mana.json startingMana).
  const manaPerSec = data.mana.perSec * manaGain;
  let mana = 0;
  let step = 0;
  let now = 0;

  const advance = (dt: number, acting: boolean) => {
    const r = stats(now).recovery;
    for (const [slot, left] of cdLeft) {
      const rate = slot === 'Ultimate' && !C.RECOVERY_APPLIES_TO_ULTIMATE ? 1 : r;
      cdLeft.set(slot, Math.max(0, left - dt * rate));
    }
    if (acting) mana += dt * manaPerSec;
    now += dt;
  };

  // Cooldown cuts and bonus mana, as expected values: a crit-only effect counts by the chance of a crit.
  const fxTotals = new Map<string, EffectTotal>();
  const applyEffects = (slot: SkillSlot, fx: SelfEffect[] | undefined, hits: number, critRate: number) => {
    let lastMana = 0;
    for (const e of fx ?? []) {
      const key = `${slot}|${e.kind}`;
      const p = e.when === 'crit' ? critRate : e.when === 'noncrit' ? 1 - critRate : e.when === 'anycrit' ? 1 - (1 - critRate) ** Math.max(1, hits) : 1;
      const times = e.each ? Math.max(1, hits) : 1;
      let amount = e.amount * p * times;
      if (e.kind === 'mana') {
        if (e.instead) amount = (e.amount - lastMana) * p * times;
        else lastMana = e.amount;
      }
      if (input.noBuffs || input.skipBuff === key || amount <= 0) continue;
      const tot = fxTotals.get(key) ?? { slot, kind: e.kind, total: 0 };
      tot.total += amount;
      fxTotals.set(key, tot);
      if (e.kind === 'mana') {
        mana += amount;
        continue;
      }
      // "A random Active Skill" picks among the ones still cooling down.
      const targets: SkillSlot[] =
        e.skill === 'all'
          ? [...ACTIVE]
          : e.skill === 'random'
            ? ACTIVE.filter((x) => (cdLeft.get(x) ?? 0) > 0)
            : [`ActiveSkill${e.skill}` as SkillSlot];
      const each = e.skill === 'random' ? amount / Math.max(1, targets.length) : amount;
      for (const x of targets) if (cdLeft.has(x)) cdLeft.set(x, Math.max(0, cdLeft.get(x)! - each));
    }
  };

  const cast = (slot: SkillSlot, s: DpsSkill, castSec: number) => {
    const level = s.levels[levelOf(input, slot, s.levels.length)];
    const st = stats(now);
    const hitDamage = (h: HitT) => ((h[0] ?? 0) * st.atk + (h[1] ?? 0) * st.myDef + (h[2] ?? 0) * hp) * st.critFactor * st.def * st.taken * el.damage;
    const dealt = level.h.reduce((n, h) => n + hitDamage(h), 0);
    events.push({ at: now, slot, damage: dealt, cast: true, debuffs: level.x });
    for (const sh of level.s ?? []) {
      const amount = sh.hp * hp + sh.atk * st.atk + sh.def * st.myDef + sh.dealt * dealt;
      if (amount > 0) shields.push({ amount, from: now, until: now + sh.sec });
    }
    for (const b of level.t ?? []) {
      giveTeam({ key: `${slot}|${b.name}`, slot, name: b.name, stat: b.stat, pct: b.pct, p: b.onCrit ? st.critRate : 1, allies: b.allies, from: now, until: now + b.sec });
    }
    for (const d of level.d ?? []) {
      const tick = Math.min(d.pct * stage.hp, d.capAtk * st.atk) * (C.DOT_USES_DEF ? st.def : 1) * st.taken * (d.acc ? accChance : 1);
      const ticks = Math.floor(d.durationSec / d.everySec);
      for (let i = 1; i <= ticks; i++) events.push({ at: now + i * d.everySec, slot, damage: tick, cast: false });
    }
    if (!input.noBuffs) {
      for (const b of level.b ?? []) {
        const key = buffKey(slot, b);
        if (input.skipBuff === key) continue;
        const old = active.get(key);
        if (old) closeBuff(key, old, now);
        if (!upFor.has(key)) upFor.set(key, { slot, name: b.name, stat: b.stat, pct: b.pct, seconds: 0 });
        active.set(key, { stat: b.stat, pct: b.pct, p: b.onCrit ? st.critRate : 1, from: now, until: now + b.sec });
      }
    }
    // DEF Down and Weaken on the boss help every later hit while they last.
    if (!input.noBuffs) {
      for (const d of level.x ?? []) {
        if (!d.pct || !d.sec || (d.name !== 'DEF Down' && d.name !== 'Weaken')) continue;
        const key = `${slot}|${d.name}`;
        if (input.skipBuff === key) continue;
        const stat: BuffStat = d.name === 'DEF Down' ? 'defDown' : 'weaken';
        const old = active.get(key);
        if (old) closeBuff(key, old, now);
        if (!upFor.has(key)) upFor.set(key, { slot, name: d.name, stat, pct: d.pct, seconds: 0, onBoss: true });
        active.set(key, { stat, pct: d.pct, p: d.chance * (d.acc ? accChance : 1), from: now, until: now + d.sec });
      }
    }
    // Every teammate hits the debuffed boss too (counted whether or not its own damage includes them).
    for (const d of level.x ?? []) {
      if (!d.pct || !d.sec || (d.name !== 'DEF Down' && d.name !== 'Weaken')) continue;
      const stat: BuffStat = d.name === 'DEF Down' ? 'defDown' : 'weaken';
      giveTeam({ key: `${slot}|${d.name}`, slot, name: d.name, stat, pct: d.pct, p: d.chance * (d.acc ? accChance : 1), allies: TEAM_SIZE - 1, from: now, until: now + d.sec });
    }
    applyEffects(slot, level.e, level.h.length, st.critRate);
    advance(castSec / st.skillSpeed, true);
    if (C.COMBO_RESETS_AFTER_SKILL) step = 0;
  };

  while (now < until) {
    if (ult?.levels.length && ult.manaCost && mana >= ult.manaCost && (cdLeft.get('Ultimate') ?? 0) <= 0) {
      mana -= ult.manaCost;
      cdLeft.set('Ultimate', ult.cooldown);
      cast('Ultimate', ult, C.ULTIMATE_CAST_SEC);
      continue;
    }
    const slot = ACTIVE.find((s) => cdLeft.has(s) && cdLeft.get(s)! <= 0);
    if (slot) {
      const s = hero.skills[slot]!;
      cdLeft.set(slot, s.cooldown);
      cast(slot, s, C.SKILL_CAST_SEC);
      continue;
    }
    if (comboLevel.length) {
      const st = stats(now);
      const hits = comboLevel[step % comboLevel.length];
      const damage = hits.reduce((n, h) => n + ((h[0] ?? 0) * st.atk + (h[1] ?? 0) * st.myDef + (h[2] ?? 0) * hp) * st.critFactor * st.def * st.taken * el.damage, 0);
      events.push({ at: now, slot: 'Combo', damage, cast: true });
      applyEffects('Combo', comboFx?.[step % comboLevel.length], hits.length, st.critRate);
      step += 1;
      advance(C.COMBO_STEP_SEC / st.comboSpeed, true);
    } else {
      // No combo to fill the gap: wait for the next cooldown (mana only fills while acting).
      const r = stats(now).recovery;
      const waits = [...cdLeft.entries()]
        .filter(([s]) => s !== 'Ultimate')
        .map(([, left]) => left / r);
      const next = Math.min(...waits);
      if (!Number.isFinite(next) || next <= 0) break;
      advance(next, false);
    }
  }
  for (const [key, b] of active) closeBuff(key, b, until);
  return { events, uptime: [...upFor.values()], effects: [...fxTotals.values()], team, shields };
}

/** Average DPS over fights of FIGHT_WINDOW_SEC either side of T (smooths out cooldown timing). */
function windowDps(events: Event[], mode: Mode, T: number): number {
  const WINDOW = C.FIGHT_WINDOW_SEC[mode];
  const lo = Math.max(1, T - WINDOW);
  const damageBy = (until: number) => events.reduce((n, e) => (e.at < until ? n + e.damage : n), 0);
  let sum = 0;
  let count = 0;
  for (let len = lo; len <= T + WINDOW; len += 0.5) {
    sum += damageBy(len) / len;
    count += 1;
  }
  return sum / count;
}

/** Team windows weighted by the chance each reaches one given teammate (a group buff on N of the other four: N / 4). */
const perAlly = (windows: BuffWindow[]) => windows.map((w) => ({ ...w, p: (w.p * w.allies) / (TEAM_SIZE - 1) }));

export function simulate(data: DpsData, input: FightInput): FightResult {
  const T = input.seconds ?? C.FIGHT_SEC[input.mode];
  const { events } = timeline(data, input, T + C.FIGHT_WINDOW_SEC[input.mode]);

  const results = new Map<SkillSlot, SourceResult>();
  for (const e of events) {
    if (e.at >= T) continue;
    const r = results.get(e.slot) ?? { slot: e.slot, casts: 0, damage: 0 };
    if (e.cast) r.casts += 1;
    r.damage += e.damage;
    results.set(e.slot, r);
  }
  const sources = [...results.values()].sort((a, b) => b.damage - a.damage);
  const edge = elementEdge(input.hero.element, input.stage.element);
  const accChance = landChance(data.curves.resist, input.stage.res, input.totals.acc, data.elements[edge].debuff);
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
  return { dps: windowDps(events, input.mode, T), total: sources.reduce((n, s) => n + s.damage, 0), seconds: T, sources, debuffs: [...debuffs.values()], accChance, edge };
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
export function statValues(data: DpsData, input: FightInput, rolls = data.normalRoll): { base: FightResult; values: StatValue[] } {
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

/** Each self buff's uptime in the fight and the DPS it adds (DPS with it vs without it). */
export function buffGains(data: DpsData, input: FightInput): (BuffUptime & { uptime: number; gain: number })[] {
  const T = input.seconds ?? C.FIGHT_SEC[input.mode];
  const { uptime } = timeline(data, input, T);
  if (!uptime.length) return [];
  const dps = simulate(data, input).dps;
  return uptime.map((u) => {
    const without = simulate(data, { ...input, skipBuff: `${u.slot}|${u.name}` }).dps;
    return { ...u, uptime: u.seconds / T, gain: without > 0 ? dps / without - 1 : 0 };
  });
}

/** Each skill's cooldown cuts and bonus Ultimate Mana in the fight, and the DPS they add. */
export function effectGains(data: DpsData, input: FightInput): (EffectTotal & { gain: number })[] {
  const T = input.seconds ?? C.FIGHT_SEC[input.mode];
  const { effects } = timeline(data, input, T);
  if (!effects.length) return [];
  const dps = simulate(data, input).dps;
  return effects.map((e) => {
    const without = simulate(data, { ...input, skipBuff: `${e.slot}|${e.kind}` }).dps;
    return { ...e, gain: without > 0 ? dps / without - 1 : 0 };
  });
}

/** Its own DEF Up and shields over a PvE fight: DEF Up uptime-weighted, and the average shield standing. */
export function selfDefence(data: DpsData, input: FightInput): { defUp: { pct: number; uptime: number }[]; shieldAvg: number; shieldCasts: number; shieldSize: number } {
  const T = input.seconds ?? C.FIGHT_SEC[input.mode];
  const { uptime, shields } = timeline(data, input, T);
  const defUp = uptime.filter((u) => u.stat === 'def').map((u) => ({ pct: u.pct, uptime: u.seconds / T }));
  const inFight = shields.filter((s) => s.from < T);
  const shieldAvg = inFight.reduce((n, s) => n + (s.amount * (Math.min(s.until, T) - s.from)) / T, 0);
  const shieldSize = inFight.length ? inFight.reduce((n, s) => n + s.amount, 0) / inFight.length : 0;
  return { defUp, shieldAvg, shieldCasts: inFight.length, shieldSize };
}

/**
 * A teammate's buffs and boss debuffs as they reach one other Invoker: its own fight's buff windows, each weighted by
 * the chance it reaches that Invoker. Pass them as `ext` to add the teammate to a fight.
 */
export function teamWindows(data: DpsData, mate: FightInput): BuffWindow[] {
  const T = mate.seconds ?? C.FIGHT_SEC[mate.mode];
  return perAlly(timeline(data, { ...mate, ext: [] }, T + C.FIGHT_WINDOW_SEC[mate.mode]).team);
}
