import { describe, expect, it } from 'vitest';
import { heroes, itemName } from '../src/lib/data';
import { ascensionSteps, awakeningMaterials, baseStars, plainItemName } from '../src/lib/progression';
import brackets from '../src/data/gear-upgrade-brackets.json';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('progression', () => {
  it('names a real item for every Invoker at every awakening tier', () => {
    for (const h of heroes) {
      for (const m of awakeningMaterials(h)) {
        for (const id of [m.rune, m.essence, m.astral, m.crest]) expect(itemName(id), `${h.name} ${id}`).not.toBe(id);
      }
    }
  });

  it('ascends a Legendary once and a Common five times, with real Echoes', () => {
    const legendary = heroes.find((h) => h.rarity === 'Legendary')!;
    const common = heroes.find((h) => h.rarity === 'Common')!;
    expect(ascensionSteps(baseStars(legendary)).map((s) => s.echo)).toEqual(['ASC_Stars5']);
    const steps = ascensionSteps(baseStars(common));
    expect(steps).toHaveLength(5);
    for (const s of steps) expect(itemName(s.echo)).not.toBe(s.echo);
    expect(steps.at(-1)!.levelCapAfter).toBe(60);
  });

  it('cleans sprite tags out of item names', () => {
    expect(plainItemName('ASC_Stars1')).toBe('1★ Echo');
    expect(plainItemName('FM_Tier3Freeborn')).toBe('Divine Freeborn Rune');
  });

  it('keeps the gear bracket totals consistent with the blog', () => {
    expect(sum(brackets.byRarity6Star.find((r) => r.rarity === 'Legendary')!.gold)).toBe(2334830);
    expect(sum(brackets.memorium6Star)).toBe(6600);
    expect(brackets.legendaryByStars.at(-1)!.memorium).toBe(6600);
  });
});
