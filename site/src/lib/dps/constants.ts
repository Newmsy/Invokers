// Battle constants for the DPS simulator. Values marked PLACEHOLDER are working guesses until the real numbers are
// exported (GitHub issues #123 damage, #124 mana, #125 timing, #126 gear rolls); each one lives here so swapping in
// the real value is a one-line change. Everything else comes from the data pack.

/** Length of the simulated fight, seconds: PvE boss fights run long; top-level Arena fights last about 25 s (Newms). */
export const FIGHT_SEC = { pve: 60, arena: 25 } as const;
/** DPS is averaged over fights this many seconds either side of FIGHT_SEC, so cooldown timing doesn't make it jump. */
export const FIGHT_WINDOW_SEC = { pve: 30, arena: 5 } as const;

/** PLACEHOLDER (#125): seconds per combo step at Combo Speed 0. Combo timing is the same for every Invoker. */
export const COMBO_STEP_SEC = 1.0;
/** PLACEHOLDER (#125): cast time of an active skill / Ultimate at Skill Speed 0, seconds. */
export const SKILL_CAST_SEC = 1.5;
export const ULTIMATE_CAST_SEC = 2.0;
/** PLACEHOLDER (#125): the combo carries on from the step it had reached after a skill or Ultimate. */
export const COMBO_RESETS_AFTER_SKILL = false;
/** PLACEHOLDER (#125): Combo Speed has no curve of its own yet, so it borrows the Skill Speed curve. */
export const COMBO_SPEED_CURVE = 'SkillSpeedFactorPct';

/**
 * Ultimate mana fills with time spent acting, not per hit (data/mana.json): per second × the mode's multiplier ×
 * (1 + Mana Generation %). PvE uses the 5-Invoker battle multiplier; Arena uses the PvP one.
 */
export const MANA_MODE = { pve: 'fiveHeroes', arena: 'pvp' } as const;
/** Skill Recovery also shortens the Ultimate's own cooldown (mana.json ultimateCooldown, timing.json canBeReduced). */
export const RECOVERY_APPLIES_TO_ULTIMATE = true;

/** PLACEHOLDER (#123): ATK % bonuses multiply the Invoker's own ATK (level + Awakening), flat ATK adds after. */
export const PERCENT_OF_BASE_ONLY = true;
/** Crit chance rolls against 0-100, so anything above 100% does nothing (damage.json hit.crit); a crit deals 1 + Crit DMG. */
export const CRIT_RATE_CAP = 1;
/** Burn and Bleed skip DEF (damage.json hit.mitigation.bleedAndBurn); ticks don't crit. */
export const DOT_USES_DEF = false;

/** Set bonuses: the 5-piece bonus adds on top of the 3-piece one. */
export const SET_BONUSES_STACK = true;

/**
 * One "normal" 5★ substat roll (B grade), used by the stat value table: a substat's first roll on 5★ gear at the
 * B-grade roll quality. Roll sizes come from gear_rolls.json; reading B as the 0.8 quality step (of 0.7/0.8/0.9/1.0)
 * is an inference.
 */
export const NORMAL_ROLL_RANK = 'Five';
export const NORMAL_ROLL_QUALITY = 0.8;
export const NORMAL_ROLL_STATS = [
  'AttackPercent',
  'CriticalRatePercent',
  'CriticalDamagePercent',
  'SkillRecoveryFlat',
  'SkillSpeedFlat',
  'ComboSpeedFlat',
  'ManaGenerationFlat',
  'AccuracyFlat',
  'DefensePercent',
  'HealthPercent',
] as const;
/** The HP and DEF substats compared for toughness: flat and % of each. */
export const TOUGH_ROLL_STATS = ['HealthFlat', 'HealthPercent', 'DefenseFlat', 'DefensePercent'] as const;

/**
 * PLACEHOLDER (#160): one of Ulgorim's hits deals this × his ATK before DEF.
 * Only the "hits survived" line uses it; effective HP doesn't depend on it.
 */
export const BOSS_HIT_ATK = 1;
