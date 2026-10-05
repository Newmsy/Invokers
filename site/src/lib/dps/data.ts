// Build-time data for the DPS simulator, served as one JSON file (pages/dps-data.json.ts) that the page fetches.
import awakeningJson from '../../../../data/awakening.json';
import curvesJson from '../../../../data/stat_curves.json';
import damageJson from '../../../../data/damage.json';
import manaJson from '../../../../data/mana.json';
import gearRollsJson from '../../../../data/gear_rolls.json';
import setsJson from '../../../../data/sets.json';
import { heroArt } from '../art';
import { bosses, heroRefsByConfigId, heroes, pack, skillsFor } from '../data';
import { COMBO_SPEED_CURVE, MANA_MODE, NORMAL_ROLL_QUALITY, NORMAL_ROLL_RANK, NORMAL_ROLL_STATS, TOUGH_ROLL_STATS } from './constants';
import { toHitT, type DpsData, type DpsHero, type DpsSkill, type SkillLevelT, type StatPairs } from './model';
import { parseComboEffects, parseComboText, parseSkillText, type ParsedSkill } from './parse';

const compact = (p: ParsedSkill): SkillLevelT => ({
  h: p.hits.map(toHitT),
  ...(p.dots.length ? { d: p.dots } : {}),
  ...(p.debuffs.length ? { x: p.debuffs } : {}),
  ...(p.buffs.length ? { b: p.buffs } : {}),
  ...(p.team.length ? { t: p.team } : {}),
  ...(p.shields.length ? { s: p.shields } : {}),
  ...(p.effects.length ? { e: p.effects } : {}),
});

const ACTIVE_SLOTS = ['ActiveSkill1', 'ActiveSkill2', 'ActiveSkill3', 'Ultimate'] as const;
const FIXED = ['critRate', 'critDmg', 'acc', 'comboSpeed', 'skillSpeed', 'skillRecovery', 'manaGen', 'instinct'] as const;
/** The Ulgorim stages players can pick. */
export const STAGES = [1, 4, 7, 10, 13, 16, 20];
export const BOSS = 'Ulgorim';

const round = (n: number) => Math.round(n * 1e4) / 1e4;

interface Node { id: number; bonuses: { stat: string; value: number }[] }
interface Sign { soulSign: string; levels: { nodes: Node[] }[] }

function curve(id: string): number[] {
  const c = (curvesJson as { curves: { id: string; values: number[] }[] }).curves.find((x) => x.id === id);
  if (!c) throw new Error(`stat_curves.json has no ${id}`);
  return c.values;
}

/** One entry per skill level 1..max. Some skills skip levels; a skipped level uses the last listed one below it. */
function fillLevels<L extends { level: number }>(listed: L[]): L[] {
  const out: L[] = [];
  const max = listed.at(-1)?.level ?? 0;
  for (let n = 1, i = 0; n <= max; n++) {
    while (i + 1 < listed.length && listed[i + 1].level <= n) i++;
    out.push(listed[i]);
  }
  return out;
}

/** First roll of each stat on 5★ gear at the normal quality; flat stats round to a whole number per roll. */
function normalRoll(stats: readonly string[]): DpsData['normalRoll'] {
  const rows = gearRollsJson.gear.subStats.filter((r) => r.rank === NORMAL_ROLL_RANK);
  return stats.flatMap((stat) => {
    const row = rows.find((r) => r.stat === stat);
    if (!row) return [];
    const raw = row.baseByRoll[0] * NORMAL_ROLL_QUALITY;
    return [{ stat, value: stat.endsWith('Flat') ? Math.round(raw) : Math.round(raw * 1e6) / 1e6 }];
  });
}

function elementRules(): DpsData['elements'] {
  const e = damageJson.elements;
  const rule = (k: 'advantage' | 'disadvantage' | 'neutral') => ({
    damage: e.damageMultiplier[k],
    crit: e.critChanceDelta[k] / 100,
    debuff: e.debuffApplicationChance[k],
  });
  // Light/Dark Invoker vs a basic element (player side): x1.15 damage and +10 to landing debuffs (damage.json lightDark notes).
  return { advantage: rule('advantage'), disadvantage: rule('disadvantage'), neutral: rule('neutral'), lightDark: { damage: 1.15, crit: 0, debuff: 10 } };
}

export function dpsData(): DpsData {
  const configIds = new Map(Object.entries(heroRefsByConfigId).map(([cid, r]) => [r.id, { cid, slug: r.slug }]));
  const list: DpsHero[] = [];
  for (const h of heroes) {
    const ref = configIds.get(h.id);
    if (!ref) continue;
    const skills: DpsHero['skills'] = {};
    let combo: DpsHero['combo'] = [];
    let comboFx: DpsHero['comboFx'];
    for (const s of skillsFor(h.id)) {
      const levels = fillLevels(s.levels ?? []);
      if (s.type === 'Combo') {
        combo = levels.map((l) => parseComboText(l.text).map((step) => step.map(toHitT)));
        const fx = levels.map((l) => parseComboEffects(l.text, h.name));
        if (fx.some((lv) => lv.some((step) => step.length))) comboFx = fx;
      }
      else if ((ACTIVE_SLOTS as readonly string[]).includes(s.type) && typeof s.cooldown === 'number') {
        const skill: DpsSkill = { cooldown: s.cooldown, levels: levels.map((l) => compact(parseSkillText(l.text, h.name))) };
        if (s.manaCost) skill.manaCost = s.manaCost;
        skills[s.type as (typeof ACTIVE_SLOTS)[number]] = skill;
      }
    }
    list.push({
      configId: ref.cid,
      name: h.name,
      slug: ref.slug,
      art: heroArt(h.id),
      rarity: h.rarity,
      faction: h.faction,
      element: h.element,
      sign: h.soulSign,
      base: Object.fromEntries(
        Object.entries(h.statsByRank).map(([rank, byLevel]) => [
          rank,
          Object.fromEntries(Object.entries(byLevel).map(([lv, st]) => [lv, [st.hp, st.atk, st.def] as [number, number, number]])),
        ]),
      ),
      fixed: Object.fromEntries(FIXED.map((k) => [k, round(h.maxStats[k])])),
      skills,
      combo,
      ...(comboFx ? { comboFx } : {}),
    });
  }

  const nodes: Record<string, StatPairs> = {};
  const signs: Record<string, number[]> = {};
  for (const sign of (awakeningJson as unknown as { soulSigns: Sign[] }).soulSigns) {
    signs[sign.soulSign] = [];
    for (const l of sign.levels) {
      for (const n of l.nodes) {
        signs[sign.soulSign].push(n.id);
        nodes[String(n.id)] = n.bonuses.map((b) => [b.stat, b.value]);
      }
    }
  }

  const sets: DpsData['sets'] = Object.fromEntries(
    (setsJson as { id: string; bonuses: Record<string, { stat: string; value: number }[]> }[]).map((s) => [
      s.id,
      Object.fromEntries(Object.entries(s.bonuses).map(([p, bs]) => [p, bs.map((b) => [b.stat, b.value] as [string, number])])),
    ]),
  );

  const boss = bosses.find((b) => b.name === BOSS);
  const stages = (boss?.stages ?? [])
    .filter((s) => STAGES.includes(s.stage) && s.hp && s.def)
    .map((s) => ({ stage: s.stage, level: s.level ?? 0, element: s.element ?? '', hp: s.hp!, def: s.def!, res: s.resistance ?? 0, atk: s.atk ?? 0, ...(s.manaUltimate ? { mana: s.manaUltimate } : {}) }));

  return {
    gameVersion: pack.gameVersion,
    heroes: list.sort((a, b) => a.name.localeCompare(b.name)),
    nodes,
    signs,
    sets,
    curves: {
      skillSpeed: curve('SkillSpeedFactorPct'),
      skillRecovery: curve('SkillRecoveryPct'),
      manaGen: curve('ManaRegenRecoveryPct'),
      comboSpeed: curve(COMBO_SPEED_CURVE),
      resist: curve('ResistChance_ResMinusAcc'),
    },
    stages,
    defense: { floor: damageJson.defense.floor, scale: damageJson.defense.scale },
    elements: elementRules(),
    mana: {
      perSec: manaJson.ultimatePerSecond,
      multiplier: { pve: manaJson.modeMultipliers[MANA_MODE.pve].ultimate, arena: manaJson.modeMultipliers[MANA_MODE.arena].ultimate },
    },
    normalRoll: normalRoll(NORMAL_ROLL_STATS),
    toughRoll: normalRoll(TOUGH_ROLL_STATS),
  };
}
