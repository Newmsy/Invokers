import { describe, expect, it } from 'vitest';
import guide from '../src/data/event-guide.json';
import { arena, chestAverage, dailyIncome, expectedPointsPerRun, periodIncome, shortfall, toFinish } from '../src/lib/events';

describe('event planners', () => {
  it('adds up the default energy income', () => {
    const daily = dailyIncome(guide.income.daily, guide.income.rechargeMinutes);
    expect(daily).toBeCloseTo(1078 + 1400 / 30);
    expect(periodIncome(daily, 21, guide.income.extras)).toBeCloseTo(28338 + 980);
  });

  it('averages a chest reward over its odds', () => {
    const items = [
      { group: 1, itemId: 'Energy', amount: 50, weight: 1, groupChanceInPicks: 0.5 },
      { group: 1, itemId: 'Energy', amount: 150, weight: 1, groupChanceInPicks: 0.5 },
      { group: 2, itemId: 'Gold', amount: 1000, weight: 1, groupChanceInPicks: 1 },
    ];
    expect(chestAverage(items, 'Energy')).toBe(50);
    expect(chestAverage(items, 'Gem')).toBe(0);
  });

  it('works out runs and energy to finish', () => {
    expect(toFinish(4800, 16, 14)).toEqual({ runs: 300, energy: 4200 });
    expect(toFinish(51000, 0, 20).runs).toBe(Infinity);
  });

  it('prices the shortfall in gems', () => {
    expect(shortfall(30000, 28338, 1.5)).toEqual({ energy: 1662, gems: 1108 });
    expect(shortfall(100, 200, 1.5)).toEqual({ energy: 0, gems: 0 });
    // Gem Shop: 100 energy for 150 gems.
    expect(shortfall(1662, 0, 100 / 150).gems).toBe(2493);
  });

  it('counts arena double days', () => {
    const r = arena({ battlesPerDay: 10, winRate: 0.5, winPoints: 40, lossPoints: 20, days: 3, doubleDays: 1, target: 1200 });
    expect(r.perBattle).toBe(30);
    expect(r.perDay).toBe(300);
    expect(r.total).toBe(1200);
    expect(r.daysToTarget).toBe(3);
  });
});

describe('points per run from drop rates', () => {
  const family = { rollsPerRun: 2, points: { '5★ Epic': 300, '6★ Legendary': 2500, Spark: 1 } };

  it('weights each drop by its chance, average amount and points', () => {
    const drops = [
      { key: '5★ Epic', chance: 0.5, min: 1, max: 1 },
      { key: '6★ Legendary', chance: 0.1, min: 1, max: 1 },
    ];
    // 2 rolls × (0.5 × 300 + 0.1 × 2500) = 800
    expect(expectedPointsPerRun(family, drops)).toBeCloseTo(800);
  });

  it('uses the middle of an amount range', () => {
    expect(expectedPointsPerRun({ ...family, rollsPerRun: 1 }, [{ key: 'Spark', chance: 1, min: 216, max: 264 }])).toBe(240);
  });

  it('counts an expected number of drops above 1 in full', () => {
    // Tables that give drops a run (2 items) rather than a chance per roll.
    expect(expectedPointsPerRun({ ...family, rollsPerRun: 1 }, [{ key: '5★ Epic', chance: 2, min: 1, max: 1 }])).toBe(600);
  });

  it('scores unknown drops as nothing', () => {
    expect(expectedPointsPerRun(family, [{ key: 'Gold', chance: 1, min: 1, max: 1 }])).toBe(0);
  });
});
