import { describe, expect, it } from 'vitest';
import { diffPacks, diffText, plainText, type PackFiles } from '../src/lib/updates/diff';

const stats = { hp: 1000, atk: 100, def: 50, critRate: 0.05000000074505806, critDmg: 0.5 };
const hero = (id: string, name: string, extra: object = {}) => ({
  id,
  name,
  rarity: 'Epic',
  faction: 'Freeborn',
  element: 'Fire',
  class: 'Tank',
  baseRank: 'Four',
  maxStats: { ...stats },
  ...extra,
});
const skillSet = (heroId: string, name: string, pct: string) => ({
  heroId,
  kind: 'hero',
  name,
  skills: [
    {
      type: 'ActiveSkill1',
      title: 'Kick',
      levels: [
        { level: 1, text: 'Attacks 1 enemy.<br><i>#1 Damage: 100% ATK</i>' },
        { level: 2, text: `Attacks 1 enemy.<br><i>#1 Damage: <color=#FFE606>${pct}</color> ATK</i>` },
      ],
    },
  ],
});

function pack(version: string, edit: (p: Required<PackFiles>) => void = () => {}): PackFiles {
  const p: Required<PackFiles> = {
    manifest: { gameVersion: version, extractedAt: '2026-10-01' },
    heroes: [hero('A1', 'Aria'), hero('B2', 'Borin')],
    skills: [skillSet('A1', 'Aria', '120%')],
    skillCosts: [{ rarity: 'Epic', skill: 'Ultimate', toLevel: 2, cost: { Gold: 100, Codex: 1 } }],
    sets: [{ id: 'Vampire', name: 'Vampire', bonuses: { '3': [{ stat: 'LifeStealByOtherSkills', statName: 'LifeStealByOtherSkills', value: 0.05 }] } }],
    items: [
      { id: 'Gold', name: 'Gold' },
      { id: 'Codex', name: 'Rare Codex' },
    ],
    trophies: { trophies: [] },
    bosses: { bosses: [{ id: 'R1', name: 'Ulgorim', dos: ['Bring a tank'], donts: [], corruptions: [], stages: [{ stage: 1, energy: 8 }] }] },
  };
  edit(p);
  return p;
}

describe('update notes', () => {
  it('finds nothing between identical packs', () => {
    const n = diffPacks(pack('1'), pack('2'));
    expect(n).toMatchObject({ from: '1', to: '2' });
    expect(n.heroes).toEqual({ added: [], removed: [], changed: [] });
    expect(n.skills).toEqual([]);
    expect(n.skillCosts).toEqual([]);
    expect(n.sets.changed).toEqual([]);
    expect(n.bosses.changed).toEqual([]);
  });

  it('lists new, removed and changed heroes with readable stat values', () => {
    const next = pack('2', (p) => {
      p.heroes = [hero('A1', 'Aria', { maxStats: { ...stats, atk: 110, critRate: 0.06 } }), hero('C3', 'Cyra')];
    });
    const n = diffPacks(pack('1'), next);
    expect(n.heroes.added.map((h) => h.name)).toEqual(['Cyra']);
    expect(n.heroes.removed.map((h) => h.name)).toEqual(['Borin']);
    expect(n.heroes.changed[0].changes).toEqual([
      { label: 'Max ATK', before: '100', after: '110' },
      { label: 'Max Crit Rate', before: '5%', after: '6%' },
    ]);
  });

  it('diffs skill text at the highest changed level, ignoring formatting tags', () => {
    const n = diffPacks(pack('1'), pack('2', (p) => (p.skills = [skillSet('A1', 'Aria', '135%')])));
    const c = n.skills[0].changes[0];
    expect(c.levels).toEqual([2]);
    expect(c.top?.parts).toEqual([{ same: 'Attacks 1 enemy. #1 Damage: ' }, { before: '120%', after: '135%' }, { same: ' ATK' }]);
  });

  it('reports costs, set bonuses and boss energy in plain words', () => {
    const next = pack('2', (p) => {
      p.skillCosts[0].cost = { Gold: 150, Codex: 1 };
      p.sets[0].bonuses['3'][0].value = 0.06;
      p.bosses.bosses[0].stages[0].energy = 6;
    });
    const n = diffPacks(pack('1'), next);
    expect(n.skillCosts[0]).toMatchObject({ before: '100 Gold, 1 Rare Codex', after: '150 Gold, 1 Rare Codex' });
    expect(n.sets.changed[0].changes[0]).toEqual({ label: '3-piece bonus', before: 'Lifesteal from skills +5%', after: 'Lifesteal from skills +6%' });
    expect(n.bosses.changed[0].changes[0]).toEqual({ label: 'Stage 1 energy', before: '8', after: '6' });
  });

  it('leaves out items that only have a key for a name', () => {
    const next = pack('2', (p) => p.items.push({ id: 'VIP_30d', name: 'VIP_30d' }, { id: 'Memorium', name: 'Memorium' }));
    expect(diffPacks(pack('1'), next).items.added).toEqual(['Memorium']);
  });
});

describe('text helpers', () => {
  it('strips rich-text tags', () => {
    expect(plainText('Heals <b><color=#5EEF2C>6%</color></b><br>of HP')).toBe('Heals 6% of HP');
  });
  it('round-trips both sides of a diff', () => {
    const a = 'Deals 10 damage and heals 5% HP';
    const b = 'Deals 12 damage, then heals 6% HP for 3s';
    const parts = diffText(a, b);
    const side = (k: 'before' | 'after') => parts.map((p) => ('same' in p ? p.same : p[k])).join('');
    expect(side('before')).toBe(a);
    expect(side('after')).toBe(b);
  });
});
