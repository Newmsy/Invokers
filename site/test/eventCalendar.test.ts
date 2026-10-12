import { describe, expect, it } from 'vitest';
import eventsJson from '../../data/events.json';
import type { EventScoringRule, GameEvent } from '../src/lib/data';
import {
  countdown,
  withLiveTargets,
  descriptionLines,
  eventLinks,
  mergeSameTables,
  sameScoreRows,
  eventStatus,
  formatUtc,
  groupEvents,
  leadLine,
  rankRanges,
  ruleTables,
  statusText,
} from '../src/lib/eventCalendar';

const events = eventsJson as unknown as GameEvent[];
const at = (iso: string) => Date.parse(iso);
const ev = (name: string, start: string, end: string) => ({ name, start, end });

describe('event status', () => {
  const a = ev('A', '2026-10-01T12:00:00Z', '2026-10-04T12:00:00Z');
  const b = ev('B', '2026-10-02T12:00:00Z', '2026-10-05T12:00:00Z');
  const c = ev('C', '2026-10-05T12:00:00Z', '2026-10-09T12:00:00Z');

  it('groups by the time given, sorted by start', () => {
    const g = groupEvents([c, b, a], at('2026-10-04T18:00:00Z'));
    expect(g.now.map((e) => e.name)).toEqual(['B']);
    expect(g.next.map((e) => e.name)).toEqual(['C']);
    expect(g.ended.map((e) => e.name)).toEqual(['A']);
  });

  it('treats start as live and end as over', () => {
    expect(eventStatus(a, at(a.start))).toBe('now');
    expect(eventStatus(a, at(a.end))).toBe('ended');
  });

  it('counts down', () => {
    expect(countdown((2 * 24 + 4) * 3600e3 + 59e3)).toBe('2d 4h');
    expect(countdown(3 * 3600e3 + 12 * 60e3)).toBe('3h 12m');
    expect(countdown(30e3)).toBe('under 1m');
    expect(statusText(b, at('2026-10-03T08:00:00Z'))).toBe('ends in 2d 4h');
    expect(statusText(c, at('2026-10-04T09:00:00Z'))).toBe('starts in 1d 3h');
  });

  it('formats dates in UTC', () => {
    expect(formatUtc('2026-10-04T12:00:00Z')).toBe('Sun 4 Oct, 12:00 UTC');
  });

  it('leads with what is on and what is next', () => {
    expect(leadLine([a, b, c], at('2026-10-04T18:00:00Z'))).toBe('B runs until Mon 5 Oct, 12:00 UTC. Next: C, from Mon 5 Oct, 12:00 UTC.');
    expect(leadLine([a], at('2026-10-05T00:00:00Z'))).toBe('Nothing is on right now.');
  });
});

describe('text and rewards', () => {
  it('turns description markup into bullet lines', () => {
    const text = '<sprite name="x"><indent=50>Defeat Sorgott</indent><br><sprite name="x"><indent=50>Unlock Huge Rewards</indent>';
    expect(descriptionLines(text)).toEqual(['Defeat Sorgott']);
  });

  it('merges consecutive ranks with the same rewards', () => {
    const r = (from: number, gems: number) => ({ rewardId: from, fromRank: from, toRank: from, reward: [{ itemId: 'Gem', amount: gems }] });
    expect(rankRanges([r(1, 300), r(2, 200), r(3, 200), r(4, 200), r(5, 100)]).map((x) => x.label)).toEqual(['1', '2-4', '5']);
    expect(rankRanges([r(1, 100), r(3, 100)]).map((x) => x.label)).toEqual(['1', '3']);
  });
});

describe('scoring tables', () => {
  const name = (id: string) => id.replace(/^SI_/, '');
  const rule = (type: string) => events.flatMap((e) => e.scoring.rules).find((r) => r.ruleType === type) as EventScoringRule;

  it('builds a rarity x stars grid for drops', () => {
    const [t] = ruleTables(rule('GearDropScoringRule'), name, () => 'Sorgott');
    expect(t.title).toBe('Points per accessory won from Sorgott');
    expect(t.columns.map((c) => c.text)).toEqual(['3★', '4★', '5★', '6★']);
    const legendary = t.rows.find((r) => r.label.text === 'Legendary')!;
    expect(legendary.cells).toEqual([60, 100, 450, 2500]);
  });

  it('merges rarities that score the same', () => {
    const [t] = ruleTables(rule('HeroRankUpScoringRule'), name);
    expect(t.columns.map((c) => c.keys)).toEqual([['Common', 'Uncommon', 'Rare'], ['Epic'], ['Legendary']]);
    expect(t.rows.at(-1)!.cells).toEqual([1500, 1950, 2250]);
  });

  it('lists summon items and pulls by kind', () => {
    const [items, pulls] = ruleTables(rule('HeroSummonScoringRule'), name);
    expect(items.rows[0]).toEqual({ label: { text: 'WildStar', kind: 'item', keys: ['SI_WildStar'] }, cells: [10] });
    // Chroma pulls are exactly double, so they become a note rather than two more columns.
    expect(pulls.columns.map((c) => c.text)).toEqual(['Other elements', 'Light, Dark']);
    expect(pulls.note).toBe('Chroma pulls score double.');
    expect(pulls.rows.find((r) => r.label.text === 'Common')!.cells).toEqual([10, null]);
    expect(pulls.rows.find((r) => r.label.text === 'Legendary')!.cells).toEqual([10000, 20000]);
  });

  it('keeps a Chroma column that is not simply double', () => {
    const r = { ...rule('AnimaSummonScoringRule') } as Extract<EventScoringRule, { ruleType: 'AnimaSummonScoringRule' }>;
    const odd = { ...r, animaEntriesChroma: r.animaEntriesChroma.map((e) => ({ ...e, points: e.points + 1 })) };
    const [, pulls] = ruleTables(odd, name);
    expect(pulls.columns.map((c) => c.text)).toEqual(['Points', 'Chroma']);
    expect(pulls.note).toBeUndefined();
  });

  it('builds a table for every rule in the event list, and links each event somewhere', () => {
    for (const e of events) {
      for (const r of e.scoring.rules) expect(ruleTables(r, name).length, r.ruleType).toBeGreaterThan(0);
      expect(eventLinks(e.scoring.rules).length, e.name).toBeGreaterThan(0);
    }
  });
});

describe('withLiveTargets', () => {
  const planner = [
    { id: 'campaign', target: 4800, difficulties: [{ name: 'Normal', points: 6, energy: 6 }, { name: 'Brutal', points: 16, energy: 14 }] },
    { id: 'titansummon', target: 180000 },
    { id: 'crest', target: 18000 },
  ];
  const listed = [
    { type: 'Campaign', start: '2026-09-01T12:00:00Z', personalRewards: [{ requiredPoints: 1000 }] },
    { type: 'Campaign', start: '2026-10-06T12:00:00Z', personalRewards: [{ requiredPoints: 600 }, { requiredPoints: 24000 }],
      scoring: { rules: [{ ruleType: 'CampaignBattleScoringRule', entries: [{ difficulty: 'Normal', points: 60 }, { difficulty: 'Brutal', points: 160 }] }] } },
    { type: 'SummonAnima', start: '2026-10-08T12:00:00Z', personalRewards: [{ requiredPoints: 90000 }] },
  ] as Parameters<typeof withLiveTargets>[1];
  const [campaign, titans, crest] = withLiveTargets(planner, listed);

  it('takes the newest event of each kind', () => {
    expect(campaign.target).toBe(24000);
    expect(campaign.difficulties!.map((d) => d.points)).toEqual([60, 160]);
    expect(campaign.difficulties![1].energy).toBe(14);
    expect(titans.target).toBe(90000);
  });

  it('keeps events with no listed match', () => {
    expect(crest).toEqual(planner[2]);
  });
});

describe('items that score the same', () => {
  it('merge into one row named by their shared words', () => {
    const names: Record<string, string> = { a: 'Raw Fire Essence', b: 'Raw Astral Essence', c: 'Refined Fire Essence' };
    const rows = sameScoreRows([{ resourceId: 'a', points: 1 }, { resourceId: 'b', points: 1 }, { resourceId: 'c', points: 10 }], (id) => names[id]);
    expect(rows.map((r) => [r.label.text, r.points])).toEqual([['Raw Essence (any)', 1], ['Refined Fire Essence', 10]]);
  });
});

describe('mergeSameTables', () => {
  it('shows identical boss tables once, naming every boss', () => {
    const t = (boss: string, n = 1) => ({ title: `Points per relic won from ${boss}`, corner: 'Rarity', columns: [], rows: [{ label: { text: 'Epic' }, cells: [n] }], collapse: false });
    expect(mergeSameTables([t('Ulgorim'), t('Althar'), t('Sakiel', 2)]).map((x) => x.title)).toEqual([
      'Points per relic won from Ulgorim, Althar',
      'Points per relic won from Sakiel',
    ]);
  });
});
