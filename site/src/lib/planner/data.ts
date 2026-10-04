// Build-time inputs for the planner page: cost tables and hero facts, serialised into the page.
import { heroArt } from '../art';
import { heroRefsByConfigId, href, itemName, pack } from '../data';
import { calculatorData, currencies } from '../skillCosts';
import { ascensionTable, echoFor, maxLevel, plainItemName, xpToLevel } from '../progression';
import { RANKS, type GearCostRow, type PlanData } from './model';


// Gear upgrade prices, sell and destroy returns (data/gear_costs.json). Globbed so the page still builds
// without the file; gear Gold and Memorium then show as "coming soon".
interface Upgrade { rank: string; rarity: string; toLevel: number; gold?: number; memorium?: number }
type ByRank<T> = Record<string, T>;
interface GearSide {
  upgrade?: Upgrade[];
  sell?: ByRank<Record<string, { Gold?: number }>>;
  destroy?: ByRank<{ Memorium?: number }>;
}
interface GearFile extends GearSide {
  costs?: unknown;
  gear?: GearSide;
  accessories?: GearSide;
}
const gearFiles = import.meta.glob<{ default: unknown }>('../../../../data/gear_costs.json', { eager: true });
const gearFile = Object.values(gearFiles)[0]?.default as GearFile | unknown[] | undefined;
const gearSide: GearSide | undefined = Array.isArray(gearFile) ? { upgrade: gearFile as Upgrade[] } : (gearFile?.gear ?? gearFile);

// Rarities the game doesn't have yet are left out (the price list carries a "Greater" tier).
const inGame = (rarity: string) => rarity !== 'Greater';

const starsOf = (rank: unknown): number => (typeof rank === 'number' ? rank : RANKS.indexOf(String(rank)) + 1);

/** Sell and destroy returns per star and rarity (rarity '' = any), or null until they exist. */
export interface SalvageRow {
  rarity: string;
  stars: number;
  sellGold?: number;
}
export interface Salvage {
  rows: SalvageRow[];
  /** Memorium from destroying a piece, by stars (the same for every rarity). */
  destroyMemorium: Record<number, number>;
}
export function gearSalvage(): Salvage | null {
  const sell = gearSide?.sell;
  if (!sell || typeof sell !== 'object') return null;
  const rows: SalvageRow[] = [];
  for (const [rank, byRarity] of Object.entries(sell)) {
    for (const [rarity, v] of Object.entries(byRarity)) {
      if (inGame(rarity)) rows.push({ rarity, stars: starsOf(rank), sellGold: v?.Gold });
    }
  }
  const destroyMemorium = Object.fromEntries(
    Object.entries(gearSide?.destroy ?? {})
      .filter(([, v]) => typeof v?.Memorium === 'number')
      .map(([rank, v]) => [starsOf(rank), v.Memorium!]),
  );
  return rows.length ? { rows: rows.filter((r) => r.stars > 0), destroyMemorium } : null;
}

/** Upgrade price rows (gear; accessories cost the same), or null until they exist. */
export function gearCosts(): GearCostRow[] | null {
  const file = gearFile as GearFile | undefined;
  const raw = gearSide?.upgrade ?? (Array.isArray(file?.costs) ? file.costs : undefined);
  if (!Array.isArray(raw)) return null;
  const rows = raw
    .map((r) => (r && typeof r === 'object' ? { ...r, stars: starsOf((r as { stars?: number }).stars ?? r.rank) } : null))
    .filter((r): r is Upgrade & { stars: number } => !!r && typeof r.rarity === 'string' && inGame(r.rarity) && r.stars > 0 && typeof r.toLevel === 'number')
    .map(({ rarity, stars, toLevel, gold, memorium }) => ({ rarity, stars, toLevel, gold, memorium }));
  return rows.length ? rows : null;
}

/** XP and ascension facts for the planner's "Stars and level" card. */
function levellingData(): PlanData['levelling'] {
  return {
    maxLevel,
    xpTo: Array.from({ length: maxLevel + 1 }, (_, level) => (level ? xpToLevel(level) : 0)),
    ascension: ascensionTable.map((r) => ({ from: r.from, count: r.count, echo: plainItemName(echoFor(r.from)), gold: r.gold })),
  };
}

export function plannerData(): PlanData {
  const gear = gearCosts();
  const ids = [...currencies, ...(gear ? ['Memorium'] : [])];
  return {
    currencies: ids.map((id) => ({ id, name: itemName(id) })),
    skills: Object.fromEntries(
      calculatorData().map((r) => [r.rarity, Object.fromEntries(r.skills.map((s) => [s.id, s.schedule]))]),
    ),
    gear,
    levelling: levellingData(),
    heroes: Object.fromEntries(
      Object.entries(heroRefsByConfigId).map(([configId, r]) => [
        configId,
        { id: r.id, slug: r.slug, name: r.name, rarity: r.rarity, faction: r.faction, element: r.element, class: r.class, art: heroArt(r.id) },
      ]),
    ),
    gameVersion: pack.gameVersion,
    heroBase: href('heroes/'),
    boxHref: href('my-box'),
  };
}
