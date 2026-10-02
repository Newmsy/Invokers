import { describe, expect, it } from 'vitest';
import guide from '../src/data/event-guide.json';
import { arena, dailyIncome, periodIncome, shortfall, toFinish } from '../src/lib/events';

describe('event planners', () => {
  it('adds up the default energy income', () => {
    const daily = dailyIncome(guide.income.daily, guide.income.rechargeMinutes);
    expect(daily).toBe(1078);
    expect(periodIncome(daily, 21, guide.income.extras)).toBe(28338);
  });

  it('works out runs and energy to finish', () => {
    expect(toFinish(4800, 16, 14)).toEqual({ runs: 300, energy: 4200 });
    expect(toFinish(51000, 0, 20).runs).toBe(Infinity);
  });

  it('prices the shortfall in gems', () => {
    expect(shortfall(30000, 28338, 1.5)).toEqual({ energy: 1662, gems: 1108 });
    expect(shortfall(100, 200, 1.5)).toEqual({ energy: 0, gems: 0 });
  });

  it('counts arena double days', () => {
    const r = arena({ battlesPerDay: 10, winRate: 0.5, winPoints: 40, lossPoints: 20, days: 3, doubleDays: 1, target: 1200 });
    expect(r.perBattle).toBe(30);
    expect(r.perDay).toBe(300);
    expect(r.total).toBe(1200);
    expect(r.daysToTarget).toBe(3);
  });
});
