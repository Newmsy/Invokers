import { describe, expect, it } from 'vitest';
import { heroes } from '../src/lib/data';
import { awakeningType, fullyAwakened } from '../src/lib/awakening';

describe('fully awakened stats', () => {
  it('finds an Awakening type for every Invoker', () => {
    expect(heroes.filter((h) => !awakeningType(h)).map((h) => h.name)).toEqual([]);
  });

  it('matches the Levelling vs Awakening post', () => {
    const almea = fullyAwakened(heroes.find((h) => h.name === 'Almea')!)!;
    expect(Math.round(almea.stats.atk)).toBe(2980);
    expect(Math.round(almea.stats.hp)).toBe(16330);
    expect(almea.stats.critRate).toBeCloseTo(0.15);
    const kanraku = fullyAwakened(heroes.find((h) => h.name === 'Duchess Kanraku')!)!;
    expect(Math.round(kanraku.stats.atk)).toBe(4234);
    expect(Math.round(kanraku.stats.def)).toBe(1565);
    expect(kanraku.titanTime).toBe(3);
  });
});
