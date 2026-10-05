import { describe, expect, it } from 'vitest';
import { gearSets } from '../src/lib/gear';

const set = (id: string) => gearSets.find((s) => s.id === id)!;

describe('gear set totals', () => {
  it('stacks the 5-piece bonus on the 3-piece one', () => {
    expect(set('Accuracy').fullSet).toEqual(['+125 ACC']);
    expect(set('Attack').fullSet).toEqual(['+30% ATK']);
    expect(set('CriticalDamage').fullSet).toEqual(['+60% Crit DMG']);
  });

  it('shows no full-set row when the two bonuses raise different stats', () => {
    expect(set('CrushTolerance').fullSet).toEqual([]);
  });
});
