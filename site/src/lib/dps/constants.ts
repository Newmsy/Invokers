// Battle constants for the DPS simulator. Values marked PLACEHOLDER are working guesses until the real numbers are
// exported (GitHub issues #123 damage, #124 mana, #125 timing, #126 gear rolls); each one lives here so swapping in
// the real value is a one-line change. Everything else comes from the data pack.

/** Length of the simulated fight, seconds. */
export const FIGHT_SEC = 60;

/** PLACEHOLDER (#125): seconds per combo step at Combo Speed 0. Combo timing is the same for every Invoker. */
export const COMBO_STEP_SEC = 1.0;
/** PLACEHOLDER (#125): cast time of an active skill / Ultimate at Skill Speed 0, seconds. */
export const SKILL_CAST_SEC = 1.5;
export const ULTIMATE_CAST_SEC = 2.0;
/** PLACEHOLDER (#125): the combo carries on from the step it had reached after a skill or Ultimate. */
export const COMBO_RESETS_AFTER_SKILL = false;
/** PLACEHOLDER (#125): Combo Speed has no curve of its own yet, so it borrows the Skill Speed curve. */
export const COMBO_SPEED_CURVE = 'SkillSpeedFactorPct';

/** PLACEHOLDER (#124): Ultimate mana gained per combo hit and per active skill cast, before Mana Generation. */
export const MANA_PER_COMBO_HIT = 40;
export const MANA_PER_SKILL_CAST = 100;
/** Ultimate mana multiplier per mode (arena.json: pvp 2; relic bosses assumed "pve5" = 1 until #124 confirms). */
export const MANA_MULTIPLIER = { pve: 1, arena: 2 } as const;
/** PLACEHOLDER (#124): Skill Recovery also shortens the Ultimate's own cooldown. */
export const RECOVERY_APPLIES_TO_ULTIMATE = false;

/** PLACEHOLDER (#123): ATK % bonuses multiply the Invoker's own ATK (level + Awakening), flat ATK adds after. */
export const PERCENT_OF_BASE_ONLY = true;
/** PLACEHOLDER (#123): crit chance is capped at 100%; a crit deals 1 + Crit DMG. */
export const CRIT_RATE_CAP = 1;
/** PLACEHOLDER (#123): element advantage is not modelled yet (factor 1 for every pairing). */
export const ELEMENT_FACTOR = 1;
/** PLACEHOLDER (#123): Burn/Bleed ticks ignore DEF and can't crit. */
export const DOT_USES_DEF = false;

/** Set bonuses: the 5-piece bonus adds on top of the 3-piece one. */
export const SET_BONUSES_STACK = true;

/**
 * One "normal" 5★ substat roll (B grade), used by the stat value table. PROVISIONAL (#126): the best rolls seen in
 * imported boxes × 0.8 until the grade table is exported.
 */
export const NORMAL_ROLL: { stat: string; value: number }[] = [
  { stat: 'AttackPercent', value: 0.027 * 0.8 },
  { stat: 'CriticalRatePercent', value: 0.032 * 0.8 },
  { stat: 'CriticalDamagePercent', value: 0.038 * 0.8 },
  { stat: 'SkillRecoveryFlat', value: 7 },
  { stat: 'SkillSpeedFlat', value: 7 },
  { stat: 'ComboSpeedFlat', value: 7 },
  { stat: 'ManaGenerationFlat', value: 7 },
  { stat: 'DefensePercent', value: 0.027 * 0.8 },
  { stat: 'HealthPercent', value: 0.027 * 0.8 },
];
