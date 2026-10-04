import { describe, expect, it } from 'vitest';
import sample from '../../datamine/samples/box-sample.json';
import type { BoxHero } from '../src/lib/box/decode';
import type { BoxDoc } from '../src/lib/box/store';
import { fullyAwakened } from '../src/lib/awakening';
import { heroes } from '../src/lib/data';
import { bareBuild, boxBuild } from '../src/lib/dps/box';
import { dpsData, STAGES } from '../src/lib/dps/data';
import { defenseFactor, finalStat, simulate, statValues, type FightInput } from '../src/lib/dps/model';
import { openSlots, optimise } from '../src/lib/dps/optimise';
import { parseComboText, parseHit, parseSkillText } from '../src/lib/dps/parse';

const data = dpsData();
const hero = (name: string) => data.heroes.find((h) => h.name === name)!;
const stage = (n: number) => data.stages.find((s) => s.stage === n)!;
const fight = (name: string, extra: Partial<FightInput> = {}): FightInput => {
  const b = bareBuild(data, hero(name));
  return { hero: b.hero, totals: b.totals, skillLevels: b.skillLevels, mode: 'pve', stage: stage(16), ...extra };
};

describe('skill text parser', () => {
  it('reads ATK, DEF and thousands separators', () => {
    expect(parseHit('245% ATK')).toEqual({ atk: 2.45, def: 0, hp: 0 });
    expect(parseHit('965% * ATK')).toEqual({ atk: 9.65, def: 0, hp: 0 });
    expect(parseHit('1,100% ATK')).toEqual({ atk: 11, def: 0, hp: 0 });
    expect(parseHit('50% ATK + 40% DEF')).toEqual({ atk: 0.5, def: 0.4, hp: 0 });
    expect(parseHit('if the hit lands as a critical hit')).toBeNull();
  });

  it('reads one hit per "#N Damage" line', () => {
    const vos = hero('Grandmaster Vos').skills.ActiveSkill3!.levels.at(-1)!;
    expect(vos.h).toEqual([[2.85], [2.85]]);
  });

  it('reads Burn from the sentence that casts it, and skips self-Burn', () => {
    const bosko = hero('Bosko').skills.ActiveSkill2!.levels.at(-1)!;
    expect(bosko.d).toEqual([{ kind: 'Burn', pct: 0.015, capAtk: 3, everySec: 2, durationSec: 4 }]);
    const brandis = hero('Brandis').skills.ActiveSkill1!.levels.at(-1)!;
    expect(brandis.d).toBeUndefined();
  });

  it('reads five combo steps', () => {
    const steps = parseComboText('#1 Attacks 1 enemy.<br>Damage: 41% ATK\n\n#2 Attacks 1 enemy.<br>Damage: 62% ATK');
    expect(steps).toEqual([[{ atk: 0.41, def: 0, hp: 0 }], [{ atk: 0.62, def: 0, hp: 0 }]]);
    expect(hero('Ironblade Darus').combo.at(-1)).toHaveLength(5);
  });

  it('finds damage on almost every Invoker', () => {
    const none = data.heroes.filter((h) => !Object.values(h.skills).some((s) => s.levels.at(-1)?.h.length));
    expect(none.length).toBeLessThan(5);
  });

  it('parses an Invoker with no "#N Damage" lines into nothing', () => {
    expect(parseSkillText('Casts a buff.')).toEqual({ hits: [], dots: [] });
  });
});

describe('stats', () => {
  it('matches the fully awakened stats for every Invoker', () => {
    for (const h of heroes.slice(0, 40)) {
      const d = data.heroes.find((x) => x.name === h.name);
      const awake = fullyAwakened(h);
      if (!d || !awake) continue;
      const t = bareBuild(data, d).totals;
      expect(Math.round(finalStat(t, 'atk'))).toBe(Math.round(awake.stats.atk));
      expect(Math.round(finalStat(t, 'hp'))).toBe(Math.round(awake.stats.hp));
    }
  });

  it('builds a boxed Invoker with its gear and sets', () => {
    const configIds = new Map(heroes.map((h) => [h.id, data.heroes.find((d) => d.name === h.name)?.configId]));
    const doc = {
      gear: sample.gear.items,
      accessories: sample.accessories.items,
      heroes: (sample.heroes.items as unknown as (BoxHero & { heroId: string })[]).map((h) => ({ ...h, configId: configIds.get(h.heroId)! })),
    } as unknown as BoxDoc;
    const owned = doc.heroes.find((h) => h.id === 1)!;
    const b = boxBuild(data, doc, owned)!;
    expect(b.pieces).toBeGreaterThan(0);
    expect(b.totals.flat.atk).toBeGreaterThanOrEqual(188);
    expect(b.skillLevels.ActiveSkill1).toBe(5);
  });
});

describe('fight', () => {
  it('offers the Ulgorim stages Newms picked', () => {
    expect(data.stages.map((s) => s.stage)).toEqual(STAGES);
  });

  it('keeps the defense curve falling past 3,000 DEF', () => {
    const c = data.curves.defense;
    expect(defenseFactor(c, 3000)).toBeCloseTo(c[3000]);
    expect(defenseFactor(c, 11000)).toBeLessThan(defenseFactor(c, 8540));
    expect(defenseFactor(c, 11000)).toBeGreaterThan(0);
  });

  it('deals damage with combos, skills and the Ultimate', () => {
    const r = simulate(data, fight('Ironblade Darus'));
    expect(r.dps).toBeGreaterThan(0);
    expect(r.sources.map((s) => s.slot).sort()).toEqual(['ActiveSkill1', 'ActiveSkill2', 'ActiveSkill3', 'Combo', 'Ultimate']);
  });

  it('deals less in Arena (half cooldowns at the start) than with every skill ready', () => {
    const pve = simulate(data, fight('Ironblade Darus', { seconds: 10 }));
    const arena = simulate(data, fight('Ironblade Darus', { seconds: 10, mode: 'arena' }));
    expect(arena.total).toBeLessThan(pve.total);
  });

  it('deals less to a higher stage', () => {
    expect(simulate(data, fight('Ironblade Darus', { stage: stage(20) })).dps).toBeLessThan(
      simulate(data, fight('Ironblade Darus', { stage: stage(1) })).dps,
    );
  });

  it('values every damage stat above zero', () => {
    const { values } = statValues(data, fight('Ironblade Darus'));
    const gain = Object.fromEntries(values.map((v) => [v.stat, v.gain]));
    for (const s of ['AttackPercent', 'CriticalRatePercent', 'CriticalDamagePercent', 'SkillRecoveryFlat']) expect(gain[s]).toBeGreaterThan(0);
    expect(gain.HealthPercent).toBe(0);
  });
});

describe('gear optimiser', () => {
  const configIds = new Map(heroes.map((h) => [h.id, data.heroes.find((d) => d.name === h.name)?.configId]));
  const doc = {
    gear: sample.gear.items,
    accessories: sample.accessories.items,
    heroes: (sample.heroes.items as unknown as (BoxHero & { heroId: string })[]).map((h) => ({ ...h, configId: configIds.get(h.heroId)! })),
  } as unknown as BoxDoc;

  it('never does worse than the current gear', () => {
    for (const owned of doc.heroes) {
      const r = optimise(data, doc, owned, { mode: 'pve', stage: stage(16), takeFromOthers: true });
      if (!r) continue;
      expect(r.after).toBeGreaterThanOrEqual(r.before);
      for (const [slot, p] of Object.entries(r.best)) if (p) expect(p.slot).toBe(slot);
    }
  });

  it('only takes other Invokers\' gear when allowed', () => {
    const owned = doc.heroes[0];
    const r = optimise(data, doc, owned, { mode: 'pve', stage: stage(16), takeFromOthers: false })!;
    for (const p of Object.values(r.best)) if (p) expect([null, owned.id]).toContain(p.equippedHeroId);
  });

  it('opens accessory slots with Awakening', () => {
    expect(openSlots({ awakenLevel: 0 } as BoxHero)).toContain('Amulet');
    expect(openSlots({ awakenLevel: 0 } as BoxHero)).not.toContain('Earrings');
    expect(openSlots({ awakenLevel: 6 } as BoxHero)).toContain('Flasks');
  });
});
