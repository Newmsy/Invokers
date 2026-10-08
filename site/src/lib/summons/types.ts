// Shapes of site/src/data/summons.json.
export interface SummonItem {
  id: string;
  name: string;
  kind: 'hero' | 'titan';
  /** Not a real item: the guaranteed pull a bonus counter pays out. Kept for the maths, never shown as an item. */
  pity?: boolean;
  /** Rarity → chance per pull (fraction). */
  rates: Record<string, number>;
  /** Mercy: a pull of this rarity by this many pulls without one. */
  mercy?: Record<string, number>;
  /** First-time mercy (Destiny Star: first Legendary by pull 50). */
  firstMercy?: Record<string, number>;
  /** Which heroes a Legendary pull can give: Fire/Water/Earth/Wind, or Light/Dark. */
  legendaryPool?: 'elemental' | 'lightDark';
  /** Which heroes any pull from this item can give; missing means every hero of the rarity. */
  pool?: 'elemental' | 'lightDark';
  /** Rarity → chance per pull split between Fire/Water/Earth/Wind and Light/Dark heroes (Wild Star Uncommon). */
  split?: Record<string, Record<'elemental' | 'lightDark', number>>;
}

export interface BonusRule {
  uses: string[];
  gives: string;
  every: number;
}

export interface SummonData {
  gameVersion: string;
  items: SummonItem[];
  bonus: BonusRule[];
  chroma: Record<'hero' | 'titan', Record<string, number>>;
  unsummonable: string[];
}

