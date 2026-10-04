// Build-time data for the DPS simulator, served as one JSON file (pages/dps-data.json.ts) that the page fetches.
import awakeningJson from '../../../../data/awakening.json';
import curvesJson from '../../../../data/stat_curves.json';
import setsJson from '../../../../data/sets.json';
import { bosses, heroRefsByConfigId, heroes, pack, skillsFor } from '../data';
import { COMBO_SPEED_CURVE } from './constants';
import { toHitT, type DpsData, type DpsHero, type DpsSkill, type SkillLevelT, type StatPairs } from './model';
import { parseComboText, parseSkillText, type ParsedSkill } from './parse';

const compact = (p: ParsedSkill): SkillLevelT => (p.dots.length ? { h: p.hits.map(toHitT), d: p.dots } : { h: p.hits.map(toHitT) });

const ACTIVE_SLOTS = ['ActiveSkill1', 'ActiveSkill2', 'ActiveSkill3', 'Ultimate'] as const;
const FIXED = ['critRate', 'critDmg', 'comboSpeed', 'skillSpeed', 'skillRecovery', 'manaGen', 'instinct'] as const;
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

export function dpsData(): DpsData {
  const configIds = new Map(Object.entries(heroRefsByConfigId).map(([cid, r]) => [r.id, { cid, slug: r.slug }]));
  const list: DpsHero[] = [];
  for (const h of heroes) {
    const ref = configIds.get(h.id);
    if (!ref) continue;
    const skills: DpsHero['skills'] = {};
    let combo: DpsHero['combo'] = [];
    for (const s of skillsFor(h.id)) {
      const levels = s.levels ?? [];
      if (s.type === 'Combo') combo = levels.map((l) => parseComboText(l.text).map((step) => step.map(toHitT)));
      else if ((ACTIVE_SLOTS as readonly string[]).includes(s.type) && typeof s.cooldown === 'number') {
        const skill: DpsSkill = { cooldown: s.cooldown, levels: levels.map((l) => compact(parseSkillText(l.text))) };
        if (s.manaCost) skill.manaCost = s.manaCost;
        skills[s.type as (typeof ACTIVE_SLOTS)[number]] = skill;
      }
    }
    list.push({
      configId: ref.cid,
      name: h.name,
      slug: ref.slug,
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
    .map((s) => ({ stage: s.stage, level: s.level ?? 0, element: s.element ?? '', hp: s.hp!, def: s.def! }));

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
      defense: curve('DefenseFactor'),
    },
    stages,
  };
}
