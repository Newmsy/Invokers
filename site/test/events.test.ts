import { describe, expect, it } from 'vitest';
import guide from '../src/data/event-guide.json';
import { arena, chestAverage, dailyIncome, dayPlan, expectedPointsPerRun, periodIncome, shortfall, spreadRuns, toFinish } from '../src/lib/events';

describe('event planners', () => {
  it('adds up the default energy income', () => {
    const daily = dailyIncome(guide.income.daily, guide.income.rechargeMinutes);
    expect(daily).toBeCloseTo(878 + 1400 / 30);
    expect(periodIncome(daily, 21, guide.income.extras)).toBeCloseTo(878 * 21 + 980 + 5700);
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

  it('spreads each run over its days', () => {
    expect(spreadRuns(5, [{ from: 1, to: 3 }], 600)).toEqual([0, 300, 300, 0, 0]);
    // A run past the end of the chase is spent in the days the chase still has.
    expect(spreadRuns(3, [{ from: 2, to: 5 }], 300)).toEqual([0, 0, 300]);
  });

  it('buys the cheapest top-ups, using earlier daily offers before paying more', () => {
    const topUps = [
      { name: 'Unlimited', energy: 100, gems: 150 },
      { name: 'Coins', energy: 100, gems: 0, perDay: 1 },
      { name: 'Cheap', energy: 100, gems: 50, perDay: 1 },
    ];
    // Day 0 has spare energy; day 1 is 450 short: two coin buys and two cheap buys (days 0 and 1), then one unlimited.
    const plan = dayPlan([100, 100], [100, 550], topUps);
    expect(plan[0].buys).toEqual({ Coins: 1, Cheap: 1 });
    expect(plan[1].buys).toEqual({ Coins: 1, Cheap: 1, Unlimited: 1 });
    expect(plan.reduce((n, d) => n + d.gems, 0)).toBe(250);
    expect(plan[0].balance).toBe(200);
    expect(plan[1].balance).toBe(50);
    expect(plan.every((d) => d.balance >= 0)).toBe(true);
  });

  it('buys nothing when free energy covers every day', () => {
    const plan = dayPlan([500, 500], [400, 600], [{ name: 'Coins', energy: 100, gems: 0, perDay: 1 }]);
    expect(plan.map((d) => d.bought)).toEqual([0, 0]);
    expect(plan[1].balance).toBe(0);
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
