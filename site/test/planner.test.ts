import { describe, expect, it } from 'vitest';
import sample from '../../datamine/samples/box-sample.json';
import type { BoxGear, BoxHero } from '../src/lib/box/decode';
import { gearCost, missing, planHero, roster, skillSchedule, totals } from '../src/lib/planner/model';
import { plannerData } from '../src/lib/planner/data';
import { maxAll } from '../src/lib/skillCosts';

const data = plannerData();
// The sample's int64 configIds are rounded by JSON.parse, so map them back through its heroId.
const configById = new Map(Object.entries(data.heroes).map(([configId, h]) => [h.id, configId]));
const heroes = (sample.heroes.items as unknown as (BoxHero & { heroId: string })[]).map((h) => ({ ...h, configId: configById.get(h.heroId)! }));
const gear = new Map((sample.gear.items as unknown as BoxGear[]).map((g) => [g.id, g]));
const configOf = (rarity: string) => Object.entries(data.heroes).find(([, h]) => h.rarity === rarity)![0];

const fresh = (rarity: string, skills: string[]): BoxHero => ({
  id: 1,
  configId: configOf(rarity),
  rank: 'One',
  level: 1,
  locked: false,
  inStorage: false,
  marker: 'None',
  skills: skills.map((skill) => ({ skill, level: 1 })),
  gearBySlot: {},
  accessoryBySlot: {},
  awakenLevel: 0,
  awakenNodeIds: [],
  chroma: false,
  skin: null,
});

describe('planner skills', () => {
  it('matches the skill cost guide for a fresh Legendary', () => {
    const skills = Object.keys(data.skills.Legendary);
    const plan = planHero(data, fresh('Legendary', skills), new Map());
    expect(plan.skillCost).toEqual(maxAll('Legendary'));
    expect(plan.skillLevels).toBe(skills.length);
  });

  it('owes nothing once every skill is maxed', () => {
    const hero = fresh('Epic', ['ActiveSkill1', 'Ultimate']);
    hero.skills = hero.skills.map((s) => ({ ...s, level: 11 }));
    const plan = planHero(data, hero, new Map());
    expect(plan.skillCost).toEqual({});
    expect(plan.skillLevels).toBe(plan.skillMax);
  });

  it('prices a tolerance slot from the tolerance list its rarity has', () => {
    expect(skillSchedule(data, 'Rare', 'Tolerance2')).toEqual(data.skills.Rare.Tolerance1);
    expect(skillSchedule(data, 'Rare', 'Nonsense')).toBeNull();
  });

  it('plans the sample box', () => {
    const plans = heroes.map((h) => planHero(data, h, gear));
    expect(plans.every((p) => p.ref)).toBe(true);
    const t = totals(plans);
    expect(t.heroes).toBe(heroes.length);
    expect(t.skillCost.Gold).toBeGreaterThan(0);
    // Gear prices aren't in the data pack yet.
    if (!data.gear) expect(t.gearCost).toBeNull();
  });
});

describe('planner gear', () => {
  const rows = [1, 2, 3].map((toLevel) => ({ rarity: 'Epic', stars: 5, toLevel, gold: toLevel * 100, memorium: toLevel }));
  it('adds up the levels still to buy', () => {
    expect(gearCost(rows, { rarity: 'Epic', rank: 'Five', level: 1 })).toEqual({ Gold: 500, Memorium: 5 });
  });
  it('returns null when the piece has no price list', () => {
    expect(gearCost(rows, { rarity: 'Rare', rank: 'Five', level: 1 })).toBeNull();
  });
  it('counts empty slots and pieces below +20', () => {
    const first = planHero(data, heroes[0], gear);
    expect(first.gear.equipped + first.gear.empty.length).toBe(8);
  });
});

describe('roster', () => {
  it('counts every invoker once', () => {
    const groups = roster(data, heroes, 'element');
    expect(groups.reduce((n, g) => n + g.total, 0)).toBe(Object.keys(data.heroes).length);
    expect(groups.reduce((n, g) => n + g.owned, 0)).toBe(new Set(heroes.map((h) => h.configId).filter((c) => data.heroes[c])).size);
    expect(missing(data, heroes).length).toBe(Object.keys(data.heroes).length - groups.reduce((n, g) => n + g.owned, 0));
  });
});
