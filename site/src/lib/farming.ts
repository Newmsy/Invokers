// Where to farm each upgrade material: stages ranked by average amount per Energy, Spire floors and shop packs.
// Victory and Repeat drops carry their own average per win. In-battle loot (enemies and chests) picks one of the
// stage's entries of that kind by weight, so its average is estimated as amount × weight / total weight.
import sourcesJson from '../../../data/sources.json';
import stagesJson from '../../../data/stages.json';
import { bosses, bossLabel, bossSlug } from './data';

interface DropRow {
  source: string;
  region: string;
  difficulty: string;
  stage: number;
  energy: number;
  drop: string;
  min: number;
  max: number;
  chancePerRoll: number;
  rolls?: number;
  expectedPerRun?: number;
}
export interface ShopRow {
  source: 'Shop';
  packId: number;
  pack: string;
  price: { usd: number | null; resources: Record<string, number> };
  amount: number;
}
interface StageDrop {
  source: string;
  itemId: string;
  min: number;
  max: number;
  weight?: number;
}
interface Stage {
  area: string;
  region: string;
  difficulty: string;
  stage: number;
  energy: number;
  drops: StageDrop[];
}

const sources = (sourcesJson as unknown as { items: Record<string, (DropRow | ShopRow)[]> }).items;
const stageIndex = new Map(
  (stagesJson as unknown as { stages: Stage[] }).stages.map((s) => [`${s.area}|${s.region}|${s.difficulty}|${s.stage}`, s]),
);

/** One way an item comes out of a stage, for the "drop chance" column. */
export interface DropPart {
  amount: string;
  /** Chance per roll (0–1); undefined for in-battle loot, which is shared out by weight. */
  chance?: number;
  rolls?: number;
  /** 'win' for drops given on every win, 'battle' for enemy and chest loot. */
  kind: 'roll' | 'win' | 'battle';
  where?: string;
}

export interface FarmStage {
  area: string;
  place: string;
  /** Boss page path when the stage is a boss fight. */
  path?: string;
  difficulty: string;
  /** Stage numbers that give exactly the same drops (merged into one row). */
  stages: number[];
  energy: number;
  /** Average amount per win. */
  perRun: number;
  perEnergy: number;
  estimated: boolean;
  parts: DropPart[];
}

export interface SpireRow {
  place: string;
  floors: number;
  first: number;
  last: number;
  min: number;
  max: number;
  total: number;
}

const avg = (r: { min: number; max: number }) => (r.min + r.max) / 2;
const amountText = (r: { min: number; max: number }) => (r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`);

const dungeonBoss = new Map(bosses.map((b) => [b.id, b]));

/** Player-facing place name for a stage's region. */
export function placeName(source: string, region: string): { name: string; path?: string } {
  const boss = dungeonBoss.get(region);
  if (boss) return { name: bossLabel(boss), path: `bosses/${bossSlug(boss)}` };
  const chapter = /^Chapter(\d+)_/.exec(region);
  if (chapter) return { name: `Chapter ${chapter[1]}` };
  const spire = /^Tower(\w+)$/.exec(region);
  if (spire) return { name: `${spire[1]} Spire` };
  const event = /^Event_Slot(\d+)$/.exec(region);
  if (event) return { name: `Event stages ${event[1]}` };
  return { name: region === 'Prologue' ? 'Prologue' : source };
}

const battleKind: Record<string, string> = { 'Enemies entry': 'enemies', 'Chests entry': 'chests' };

/** Average amount of an item from one kind of in-battle loot: amount × its share of that kind's weights. */
function battleShare(stage: Stage | undefined, kindSource: string, itemId: string): number | undefined {
  if (!stage) return undefined;
  const entries = stage.drops.filter((d) => d.source === kindSource);
  const total = entries.reduce((a, d) => a + (d.weight ?? 0), 0);
  const mine = entries.filter((d) => d.itemId === itemId);
  if (!total || !mine.length) return undefined;
  return mine.reduce((a, d) => a + avg(d) * ((d.weight ?? 0) / total), 0);
}

const isShop = (r: DropRow | ShopRow): r is ShopRow => r.source === 'Shop';

export function farmingFor(itemId: string): { stages: FarmStage[]; spires: SpireRow[]; shop: ShopRow[]; firstClear: number } {
  const rows = sources[itemId] ?? [];
  const shop = rows.filter(isShop);
  const drops = rows.filter((r): r is DropRow => !isShop(r));
  const groups = new Map<string, DropRow[]>();
  for (const r of drops) {
    const key = `${r.source}|${r.region}|${r.difficulty}|${r.stage}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const stages: FarmStage[] = [];
  const merged = new Map<string, FarmStage>();
  const spireFloors = new Map<string, { stage: number; amount: DropRow }[]>();
  let firstClear = 0;
  for (const [key, list] of groups) {
    const { source, region, difficulty, stage, energy } = list[0];
    for (const r of list) if (r.drop === 'FirstClear') firstClear += r.expectedPerRun ?? avg(r);
    const repeatable = list.filter((r) => r.drop !== 'FirstClear');
    if (!repeatable.length) continue;
    if (source === 'Tower') {
      const name = placeName(source, region).name;
      for (const r of repeatable) spireFloors.set(name, [...(spireFloors.get(name) ?? []), { stage, amount: r }]);
      continue;
    }
    if (energy <= 0) continue; // Prologue: free tutorial stages.
    let perRun = 0;
    let estimated = false;
    const parts: DropPart[] = [];
    for (const r of repeatable) {
      if (battleKind[r.drop]) {
        const share = battleShare(stageIndex.get(key), r.drop, itemId);
        if (share == null) continue;
        perRun += share;
        estimated = true;
        parts.push({ amount: amountText(r), kind: 'battle', where: battleKind[r.drop] });
      } else {
        perRun += r.expectedPerRun ?? 0;
        parts.push({ amount: amountText(r), chance: r.chancePerRoll, rolls: r.rolls, kind: r.drop === 'Repeat' ? 'win' : 'roll' });
      }
    }
    if (perRun <= 0) continue;
    const place = placeName(source, region);
    const same = `${source}|${region}|${difficulty}|${energy}|${perRun.toFixed(6)}|${JSON.stringify(parts)}`;
    const twin = merged.get(same);
    if (twin) twin.stages.push(stage);
    else {
      const row = { area: source, place: place.name, path: place.path, difficulty, stages: [stage], energy, perRun, perEnergy: perRun / energy, estimated, parts };
      merged.set(same, row);
      stages.push(row);
    }
  }
  for (const s of stages) s.stages.sort((a, b) => a - b);
  stages.sort((a, b) => b.perEnergy - a.perEnergy || a.energy - b.energy || a.stages[0] - b.stages[0]);

  const spires: SpireRow[] = [...spireFloors].map(([place, floors]) => {
    const amounts = floors.map((f) => avg(f.amount));
    const stagesList = floors.map((f) => f.stage);
    return {
      place,
      floors: floors.length,
      first: Math.min(...stagesList),
      last: Math.max(...stagesList),
      min: Math.min(...amounts),
      max: Math.max(...amounts),
      total: amounts.reduce((a, b) => a + b, 0),
    };
  });
  return { stages, spires, shop, firstClear };
}

/** "1, 3–5, 8" from a sorted list of stage numbers. */
export function stageList(stages: number[]): string {
  const out: string[] = [];
  for (let i = 0; i < stages.length; i++) {
    let j = i;
    while (j + 1 < stages.length && stages[j + 1] === stages[j] + 1) j++;
    out.push(j > i ? `${stages[i]}–${stages[j]}` : `${stages[i]}`);
    i = j;
  }
  return out.join(', ');
}

/** Every item the sources list covers. */
export const farmItems = Object.keys(sources);
