import { describe, expect, it } from 'vitest';
import { achievementSections, amountOf, biggest, pageBands, progressSummary, sumRewards } from '../src/lib/questRewards';

const r = (id: string, amount: number, random?: string) => ({ type: 'resource', id, amount, random });

describe('quest reward totals', () => {
  it('adds rewards up by item, Gems and Gold first, random picks by rarity', () => {
    const t = sumRewards([r('Codex_Rare', 1), r('Gold', 150000), r('Gem', 300), r('Gold', 50000), r('Codex_Rare', 2), r('x', 1, 'Legendary'), r('y', 1, 'Legendary')]);
    expect(t.map((x) => [x.id, x.amount])).toEqual([['Gem', 300], ['Gold', 200000], ['x', 2], ['Codex_Rare', 3]]);
    expect(t[2].random).toBe('Legendary');
    expect(amountOf(t, 'Gold')).toBe(200000);
    expect(amountOf(t, 'Diamond')).toBe(0);
  });

  it('groups achievements by tab and finds the biggest', () => {
    const list = [
      { section: 'General', task: 'a', rewards: [r('Gem', 50)] },
      { section: 'Battle', task: 'b', rewards: [r('Gold', 150000)] },
      { section: 'General', task: 'c', rewards: [r('Gem', 200)] },
    ];
    const s = achievementSections(list);
    expect(s.map((x) => [x.section, x.count, amountOf(x.totals, 'Gem')])).toEqual([['General', 2, 250], ['Battle', 1, 0]]);
    expect(biggest(list, 'Gem').map((x) => x.task)).toEqual(['c', 'a']);
  });

  it('totals Progress Quest pages, tasks and completion separately, in bands', () => {
    const pages = Array.from({ length: 12 }, (_, i) => ({ page: 12 - i, tasks: [{ task: 't', rewards: [r('Gold', 1000)] }], completionReward: [r('Gem', 100)] }));
    const s = progressSummary(pages);
    expect([s.pages, s.tasks, amountOf(s.all, 'Gem'), amountOf(s.fromTasks, 'Gem'), amountOf(s.fromCompletion, 'Gold')]).toEqual([12, 12, 1200, 0, 0]);
    const b = pageBands(pages);
    expect(b.map((x) => [x.from, x.to, x.tasks, amountOf(x.totals, 'Gold')])).toEqual([[1, 10, 10, 10000], [11, 12, 2, 2000]]);
  });
});
