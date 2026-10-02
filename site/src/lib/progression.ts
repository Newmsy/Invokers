// Ascension and Awakening: which items an Invoker needs at each step. Amounts aren't in the data pack yet
// (issue #26), so this only names the items, from their in-game descriptions.
import type { Hero } from './data';
import { itemName } from './data';
import { rankNumber } from './format';

export const MAX_STARS = 6;
export const MAX_AWAKENING = 6;

/** Level cap at each star: 10 levels per star. */
export const levelCap = (stars: number) => stars * 10;

/** The Echo used to ascend from `stars` to `stars + 1`. */
export const echoFor = (stars: number) => `ASC_Stars${stars}`;

export interface AscensionStep {
  from: number;
  to: number;
  echo: string;
  levelCapAfter: number;
}

/** Every ascension from the Invoker's starting star to 6★. */
export function ascensionSteps(baseStars: number): AscensionStep[] {
  const steps: AscensionStep[] = [];
  for (let s = baseStars; s < MAX_STARS; s++) {
    steps.push({ from: s, to: s + 1, echo: echoFor(s), levelCapAfter: levelCap(s + 1) });
  }
  return steps;
}

/** Awakening materials come in three tiers: levels 1–2, 3–4 and 5–6. */
export const awakeningTiers = [
  { tier: 1, levels: [1, 2] },
  { tier: 2, levels: [3, 4] },
  { tier: 3, levels: [5, 6] },
] as const;

export interface AwakeningMaterials {
  tier: number;
  levels: readonly number[];
  rune: string;
  essence: string;
  astral: string;
  crest: string;
}

/** The faction rune, element essence, Astral essence and class crest for each awakening tier. */
export function awakeningMaterials(hero: Pick<Hero, 'faction' | 'element' | 'class'>): AwakeningMaterials[] {
  return awakeningTiers.map(({ tier, levels }) => ({
    tier,
    levels,
    rune: `FM_Tier${tier}${hero.faction}`,
    essence: `EE_Tier${tier}${hero.element}`,
    astral: `AE_ManaTier${tier}`,
    crest: `RM_Tier${tier}${hero.class}`,
  }));
}

export const baseStars = (hero: Pick<Hero, 'baseRank'>) => rankNumber(hero.baseRank);

/** Item name without the game's sprite tags, e.g. "1★ Echo". */
export function plainItemName(id: string): string {
  return itemName(id)
    .replace(/\s*<sprite[^>]*>\s*/g, '★ ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
