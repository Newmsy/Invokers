// Shapes of site/src/data/summons.json.
export interface SummonItem {
  id: string;
  name: string;
  kind: 'hero' | 'titan';
  /** Rarity → chance per pull (fraction). */
  rates: Record<string, number>;
  /** Estimated mercy: a pull of this rarity by this many pulls without one. */
  mercy?: Record<string, number>;
  /** Estimated first-time mercy (Destiny Star: first Legendary by pull 50). */
  firstMercy?: Record<string, number>;
  /** Which heroes a Legendary pull can give: Fire/Water/Earth/Wind, or Light/Dark. */
  legendaryPool?: 'elemental' | 'lightDark';
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

