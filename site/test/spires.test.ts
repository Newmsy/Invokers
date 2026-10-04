import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import arenaJson from '../../data/arena.json';
import { bands, bossesOf, climbTotals, edge, floorGroups, floorRewards, floors, spires, winDrops } from '../src/lib/spires';

describe('spires', () => {
  it('has six Spires sharing 120 floors, 20 of each enemy element', () => {
    expect(spires).toHaveLength(6);
    expect(floors.map((f) => f.floor)).toEqual(Array.from({ length: 120 }, (_, i) => i + 1));
    for (const s of spires) expect(floors.filter((f) => f.enemyElement === s.element)).toHaveLength(20);
  });

  it('gives every floor of every Spire a clear reward', () => {
    for (const s of spires) for (const f of floors) expect(floorRewards(s, f.floor).clear.length).toBeGreaterThan(0);
  });

  it('adds up a full climb', () => {
    const fire = spires.find((s) => s.element === 'Fire')!;
    const gold = climbTotals(fire).find((r) => r.itemId === 'Gold')!.amount;
    const sum = floors.reduce((t, f) => t + (floorRewards(fire, f.floor).clear.find((r) => r.itemId === 'Gold')?.amount ?? 0), 0);
    expect(gold).toBe(sum);
  });

  it('rates element matchups from the Spire team side', () => {
    expect(edge('Fire', 'Earth')).toBe('advantage');
    expect(edge('Fire', 'Water')).toBe('disadvantage');
    expect(edge('Fire', 'Wind')).toBe('neutral');
    expect(edge('Light', 'Dark')).toBe('advantage');
    expect(edge('Dark', 'Fire')).toBe('slight-advantage');
    expect(edge('Water', 'Light')).toBe('slight-disadvantage');
  });

  it('shows each enemy once per floor and keeps bosses', () => {
    for (const f of floors) {
      const loose = floorGroups(f).find((g) => g.label === 'Also on this floor');
      if (loose) expect(new Set(loose.enemies.map((e) => e.name)).size).toBe(loose.enemies.length);
      expect(floorGroups(f).find((g) => g.label === 'Boss')?.enemies.map((e) => e.name) ?? []).toEqual(bossesOf(f));
    }
    expect(bands()).toHaveLength(12);
    expect(winDrops().length).toBeGreaterThan(0);
  });
});

describe('Arena guide battle rules', () => {
  const post = readFileSync(new URL('../src/content/blog/arena-guide.md', import.meta.url), 'utf8');
  const arena = arenaJson as unknown as {
    effectDurationPercent: Record<string, number | string>[];
    controlDiminishingReturns: { windowSec: number; immunitySec: number; durationMultipliers: number[] };
    mana: { pvp: { ultimate: number; titan: number }; pve5: { ultimate: number; titan: number }; titanCooldownSec: { pvp: number; pve: number }; titanDurationSec: number; titanManaCost: number; maxTitanMana: number };
  };
  const cell = (single: number, aoe: number) => (single === aoe ? `${single}%` : `${single}% (AoE ${aoe}%)`);

  it('lists the shortened durations as the data has them', () => {
    const cols = [['skill1', 'skill1AOE'], ['skill23', 'skill23AOE'], ['ultimate', 'ultimateAOE'], ['animaSkill1', 'animaSkill1AOE']];
    for (const e of arena.effectDurationPercent) {
      const values = cols.map(([s, a]) => [e[s] as number, e[a] as number]);
      if (values.every(([s, a]) => s === 100 && a === 100)) continue;
      const name = String(e.effect);
      const row = post.split('\n').find((l) => l.startsWith('|') && l.includes(name));
      expect(row, name).toBeDefined();
      expect(row!.split('|').slice(2, 6).map((c) => c.trim())).toEqual(values.map(([s, a]) => cell(s, a)));
    }
  });

  it('states the control and Titan numbers', () => {
    const d = arena.controlDiminishingReturns;
    expect(post).toContain(`${d.windowSec}-second window`);
    expect(post).toContain(`**${d.immunitySec} seconds**`);
    expect(post).toContain(d.durationMultipliers.slice(1).map((m, i) => `${['2nd', '3rd', '4th'][i]}: ${m * 100}%`).join('. '));
    const m = arena.mana;
    expect(post).toContain(`Ultimate mana builds ×${m.pvp.ultimate} and Titan mana ×${m.pvp.titan} (×${m.pve5.ultimate} and ×${m.pve5.titan} in 5-Invoker PvE)`);
    expect(post).toContain(`costs ${m.titanManaCost.toLocaleString('en-GB')} of its ${m.maxTitanMana.toLocaleString('en-GB')} mana, stays ${m.titanDurationSec} seconds, and its cooldown is ${m.titanCooldownSec.pvp} seconds instead of ${m.titanCooldownSec.pve}`);
  });
});

describe('Arena guide skill timing', () => {
  const post = readFileSync(new URL('../src/content/blog/arena-guide.md', import.meta.url), 'utf8');
  const factor = (arenaJson as unknown as { initialCooldownFactor: number }).initialCooldownFactor;

  it('starts cooldowns where the Arena data does', () => {
    expect(post).toContain(`start at ${factor * 100}% cooldown`);
    expect(post).toContain(`${factor} × base cooldown`);
    for (const [base, ...cells] of [[20], [25], [30]].map(([b]) => [b, ...[0, 0.25, 0.46].map((sr) => `${((factor * b) / (1 + sr)).toFixed(1)}s`)])) {
      expect(post).toContain(`| ${base}s | ${cells.join(' | ')} |`);
    }
  });
});
