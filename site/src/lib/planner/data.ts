// Build-time inputs for the planner page: cost tables and hero facts, serialised into the page.
import { heroArt } from '../art';
import { heroRefsByConfigId, href, itemName, pack } from '../data';
import { calculatorData, currencies } from '../skillCosts';
import type { GearCostRow, PlanData } from './model';

// Gear upgrade prices join the data pack later (data/gear_costs.json). The glob is empty until then,
// so the page builds either way and shows gear costs as soon as the file lands.
const gearFiles = import.meta.glob<{ default: unknown }>('../../../../data/gear_costs.json', { eager: true });
const gearRows = Object.values(gearFiles)[0]?.default;

/** Sell and crush returns from data/gear_costs.json (`salvage`), or null until they exist. */
export interface SalvageRow {
  rarity: string;
  stars: number;
  level: number;
  sellGold?: number;
  crushMemorium?: number;
}
export function gearSalvage(): SalvageRow[] | null {
  const rows = (gearRows as { salvage?: unknown } | undefined)?.salvage;
  if (!Array.isArray(rows)) return null;
  const valid = rows.filter((r): r is SalvageRow => !!r && typeof r.rarity === 'string' && typeof r.stars === 'number' && typeof r.level === 'number');
  return valid.length ? valid : null;
}

/** Upgrade price rows from data/gear_costs.json (a bare list, or under `costs` or `upgrade`), or null until it exists. */
export function gearCosts(): GearCostRow[] | null {
  const file = gearRows as { costs?: unknown; upgrade?: unknown } | undefined;
  const rows = Array.isArray(gearRows) ? gearRows : (file?.upgrade ?? file?.costs);
  if (!Array.isArray(rows)) return null;
  const valid = rows.filter(
    (r): r is GearCostRow => !!r && typeof r.rarity === 'string' && typeof r.stars === 'number' && typeof r.toLevel === 'number',
  );
  return valid.length ? valid : null;
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
