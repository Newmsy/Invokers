import { describe, expect, it } from 'vitest';
import eventsJson from '../../data/events.json';
import stored from '../src/data/chases.json';
import plannedJson from '../src/data/planned-events.json';
import type { GameEvent } from '../src/lib/data';
import { allChases, chaseSchedule, dateRange, featuredChase, milestoneText, plannedOnly, type Chase } from '../src/lib/chases';

const events = eventsJson as unknown as GameEvent[];
// Grimnall's shop lists the hero by config id; map it for the test without the full hero pack.
const grimnallConfigId = (events.find((e) => e.type === 'GetLegendary')!.shopItems![0].reward[0] as { details: { configId: number }[] }).details[0].configId;
const heroFor = (configId: number) => (configId === grimnallConfigId ? 'NOC044' : undefined);

describe('chase calendar', () => {
  const chases = allChases(stored.chases as Chase[], events, heroFor);

  it('lists stored and live chases, oldest first', () => {
    expect(chases.map((c) => c.hero)).toEqual(['ELD036', 'ELD037', 'CAM027', 'NOC044']);
  });

  it('reads the live chase totals from its rewards and shop', () => {
    const g = chases[3];
    expect(g.total).toBe(200);
    expect(g.heroPrice).toBe(170);
    expect(g.currency).toBe('GE_HalloweenPumpkin');
    expect(g.registrationEnd).toBe('2026-10-15T12:00:00Z');
  });

  it('features the chase on now', () => {
    expect(featuredChase(chases, Date.parse('2026-10-20T00:00:00Z'))?.hero).toBe('NOC044');
    expect(featuredChase(chases, Date.parse('2026-08-15T00:00:00Z'))?.hero).toBe('ELD037');
  });

  it('places each tournament on the chase days', () => {
    const s = chaseSchedule(events.find((e) => e.type === 'GetLegendary')!, events);
    expect(s.days).toHaveLength(21);
    const ulg = s.rows.find((r) => r.source === 'RelicBossUlgorim')!;
    expect(ulg.runs).toEqual([expect.objectContaining({ from: 0, to: 3 })]);
    expect(s.rows.reduce((n, r) => n + r.total, 0)).toBe(200);
    // Tournaments that ended as the chase began are left out.
    expect(s.rows.find((r) => r.source === 'ArenaMedals')!.runs).toHaveLength(1);
    expect(s.knownUntil).toBe(8);
  });

  it('formats ranges and milestones', () => {
    expect(dateRange('2026-10-12T12:00:00Z', '2026-10-15T12:00:00Z')).toBe('12–15 Oct');
    expect(dateRange('2026-10-28T12:00:00Z', '2026-11-02T12:00:00Z')).toBe('28 Oct – 2 Nov');
    expect(milestoneText([{ points: 24000 }, { points: 48000 }])).toBe('24k / 48k');
    expect(milestoneText([{ points: 102000 }])).toBe('102,000');
  });
});

describe('planned tournaments', () => {
  const planned = (plannedJson as { events: { name: string; type: string; start: string; end: string }[] }).events;
  const chase = events.find((e) => e.type === 'GetLegendary')!;

  it('fill every day of the chase and every Pumpkin milestone count', () => {
    const s = chaseSchedule(chase, [...events, ...plannedOnly(planned, events)]);
    expect(s.knownUntil).toBe(s.days.length);
    const runs = Object.fromEntries(s.rows.map((r) => [r.source, r.runs.length]));
    // One run per milestone set: three Arena Rush and Gear Up, two Invoker Summon Surge, one of the rest.
    expect(runs).toMatchObject({ ArenaMedals: 3, GearUpgrade: 3, SummonHero: 2, RelicBossSakiel: 1, Dragon: 1, ClanBoss1: 1 });
    expect(s.rows.every((r) => r.runs.length > 0)).toBe(true);
  });

  it('drops a planned tournament once the live list has it', () => {
    const live = [{ name: 'Gear Up', type: 'GearUpgrade', start: '2026-10-20T12:00:00Z', end: '2026-10-23T12:00:00Z' }];
    expect(plannedOnly(planned, live).some((p) => p.type === 'GearUpgrade' && p.start.startsWith('2026-10-20'))).toBe(false);
    expect(plannedOnly(planned, live).every((p) => p.planned)).toBe(true);
  });
});
