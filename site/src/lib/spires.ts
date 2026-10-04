// The six Spires: entry rules, the 120 shared floors and each Spire's floor rewards (data/spires.json and the
// Tower area of data/stages.json). Pure, so the tests can check it against the data.
import spiresJson from '../../../data/spires.json';
import stagesJson from '../../../data/stages.json';

export interface SpireEnemy {
  name: string;
  class: string;
  count: number;
  role?: string;
}
export interface SpireFloor {
  floor: number;
  enemyLevel: number;
  enemyElement: string;
  accuracy: number;
  resistance: number;
  toleranceBonus: number;
  ultimateManaMultiplier: number;
  waves: { wave: number; name: string; enemies: SpireEnemy[] }[];
  enemiesWithoutWave?: SpireEnemy[];
  enemyStatBoosts?: { hpPercent: number; atkPercent: number; defPercent: number }[];
}
export interface Spire {
  id: string;
  element: string;
  name: string;
  description: string;
}
interface Drop {
  source: string;
  itemId: string;
  min: number;
  max: number;
  chancePerRoll?: number;
  rolls?: number;
}
interface StageRow {
  area: string;
  region: string;
  stage: number;
  drops: Drop[];
}

const pack = spiresJson as unknown as { rules: { keysPerDayPerSpire: number; reset: string }; spires: Spire[]; floors: SpireFloor[] };

export const spireRules = pack.rules;
export const spires: Spire[] = pack.spires;
export const floors: SpireFloor[] = [...pack.floors].sort((a, b) => a.floor - b.floor);

export const spireSlug = (s: Spire) => s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const towerStages = (stagesJson as unknown as { stages: StageRow[] }).stages.filter((s) => s.area === 'Tower');

export interface Reward {
  itemId: string;
  amount: number;
}

/** What one Spire gives for a floor: every-clear rewards and the once-only first-clear reward. */
export function floorRewards(spire: Spire, floor: number): { clear: Reward[]; first: Reward[] } {
  const stage = towerStages.find((s) => s.region === spire.id && s.stage === floor);
  const pick = (source: string) => (stage?.drops ?? []).filter((d) => d.source === source).map((d) => ({ itemId: d.itemId, amount: d.min }));
  return { clear: pick('Repeat'), first: pick('FirstClear') };
}

/** Everything a Spire gives for clearing all its floors once, biggest groups first in game order. */
export function climbTotals(spire: Spire): Reward[] {
  const totals = new Map<string, number>();
  for (const f of floors) {
    const r = floorRewards(spire, f.floor);
    for (const x of [...r.clear, ...r.first]) totals.set(x.itemId, (totals.get(x.itemId) ?? 0) + x.amount);
  }
  return [...totals].map(([itemId, amount]) => ({ itemId, amount }));
}

/** The random drops every win rolls for (the same on every floor of every Spire). */
export function winDrops(): { itemId: string; chance: number; rolls: number }[] {
  const first = towerStages[0];
  return (first?.drops ?? [])
    .filter((d) => d.source === 'Victory' && typeof d.chancePerRoll === 'number')
    .map((d) => ({ itemId: d.itemId, chance: d.chancePerRoll!, rolls: d.rolls ?? 1 }))
    .sort((a, b) => b.chance - a.chance);
}

// Element matchups for your team (the Spire's element) against a floor's enemies. Light and Dark: against the four
// basic elements both sides deal +15% / take −15%; Light vs Dark is advantage for your side only outside the Arena.
const beats: Record<string, string> = { Water: 'Fire', Fire: 'Earth', Earth: 'Wind', Wind: 'Water' };
const special = new Set(['Light', 'Dark']);
export type Edge = 'advantage' | 'disadvantage' | 'slight-advantage' | 'slight-disadvantage' | 'neutral';

export function edge(mine: string, enemy: string): Edge {
  if (special.has(mine) && special.has(enemy)) return mine === enemy ? 'neutral' : 'advantage';
  if (special.has(mine)) return 'slight-advantage';
  if (special.has(enemy)) return 'slight-disadvantage';
  if (beats[mine] === enemy) return 'advantage';
  if (beats[enemy] === mine) return 'disadvantage';
  return 'neutral';
}

export const edgeLabel: Record<Edge, string> = {
  advantage: 'Advantage: +30% damage',
  disadvantage: 'Weak: −30% damage',
  'slight-advantage': '+15% damage',
  'slight-disadvantage': '−15% damage',
  neutral: 'Neutral',
};

/** The floor's named boss(es), if it has one. */
export const bossesOf = (f: SpireFloor) => (f.enemiesWithoutWave ?? []).filter((e) => e.role === 'Boss').map((e) => e.name);

/** Enemies grouped by wave; spawns with no wave become one "Also on this floor" group (the boss among them). */
export function floorGroups(f: SpireFloor): { label: string; enemies: SpireEnemy[] }[] {
  const groups = f.waves.map((w) => ({ label: `Wave ${w.wave}: ${w.name}`, enemies: w.enemies }));
  const loose = f.enemiesWithoutWave ?? [];
  const boss = loose.filter((e) => e.role === 'Boss');
  const rest = loose.filter((e) => e.role !== 'Boss');
  // Some floors name the same enemy once per role; merge them so each name shows once.
  const merged = [...rest.reduce((m, e) => m.set(e.name, { ...e, role: undefined, count: (m.get(e.name)?.count ?? 0) + e.count }), new Map<string, SpireEnemy>()).values()];
  if (merged.length) groups.push({ label: 'Also on this floor', enemies: merged });
  if (boss.length) groups.push({ label: 'Boss', enemies: boss });
  return groups;
}

/** Floors in runs of ten, with level, ACC/RES and Ultimate mana ranges, for the scaling table. */
export function bands(size = 10) {
  const out: { from: number; to: number; level: [number, number]; acc: [number, number]; res: [number, number]; mana: number[] }[] = [];
  for (let i = 0; i < floors.length; i += size) {
    const run = floors.slice(i, i + size);
    const range = (k: (f: SpireFloor) => number): [number, number] => [Math.min(...run.map(k)), Math.max(...run.map(k))];
    out.push({
      from: run[0].floor,
      to: run[run.length - 1].floor,
      level: range((f) => f.enemyLevel),
      acc: range((f) => f.accuracy),
      res: range((f) => f.resistance),
      mana: [...new Set(run.map((f) => f.ultimateManaMultiplier))].sort((a, b) => b - a),
    });
  }
  return out;
}

/** Floors that raise enemy HP and ATK, as ranges ("+10–15%"). */
export function boostText(f: SpireFloor): string | undefined {
  const b = f.enemyStatBoosts;
  if (!b?.length) return undefined;
  const range = (k: 'hpPercent' | 'atkPercent' | 'defPercent', label: string) => {
    const lo = Math.min(...b.map((x) => x[k]));
    const hi = Math.max(...b.map((x) => x[k]));
    return hi <= 0 ? '' : `${label} +${lo === hi ? hi : `${lo}–${hi}`}%`;
  };
  return ['HP', 'ATK', 'DEF'].map((l) => range(`${l.toLowerCase()}Percent` as 'hpPercent', l)).filter(Boolean).join(', ');
}
