import { describe, expect, it } from 'vitest';
import sample from '../../datamine/samples/box-sample.json';
import type { BoxHero } from '../src/lib/box/decode';
import type { BoxDoc } from '../src/lib/box/store';
import { fullyAwakened } from '../src/lib/awakening';
import { heroes } from '../src/lib/data';
import { bareBuild, boxBuild } from '../src/lib/dps/box';
import { dpsData, STAGES } from '../src/lib/dps/data';
import { defenseFactor, finalStat, landChance, simulate, skillGains, statValues, type FightInput } from '../src/lib/dps/model';
import { openSlots, optimise } from '../src/lib/dps/optimise';
import { toughValues } from '../src/lib/dps/tank';
import { parseComboText, parseDebuffs, parseHit, parseSkillText } from '../src/lib/dps/parse';

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
    expect(bosko.d).toEqual([{ kind: 'Burn', acc: true, pct: 0.015, capAtk: 3, everySec: 2, durationSec: 4 }]);
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
    expect(parseSkillText('Casts a buff.')).toEqual({ hits: [], dots: [], debuffs: [] });
  });

  it('lists the debuffs and control effects cast on enemies', () => {
    expect(hero('Ironblade Darus').skills.Ultimate!.levels.at(-1)!.x).toEqual([{ name: 'DEF Down', chance: 1, acc: true }]);
    expect(hero('Sanctus the Valiant').skills.ActiveSkill3!.levels.at(-1)!.x!.map((d) => d.name)).toEqual(['Stun', 'Launch']);
    // Brandis burns himself: not a debuff on the enemy.
    expect(hero('Brandis').skills.ActiveSkill1!.levels.at(-1)!.x).toBeUndefined();
    expect(parseDebuffs('Has a 20% chance to casts a [4% Burn] debuff on the target, lasting 6s.')).toEqual([{ name: 'Burn', chance: 0.2, acc: false }]);
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
    // Box stores upgrades: 5 upgrades = level 6.
    expect(b.skillLevels.ActiveSkill1).toBe(6);
  });

  it('treats 10 box upgrades as a maxed skill', () => {
    const hero = data.heroes.find((h) => h.name === 'Devi of the Six')!;
    const skillLevels = { ActiveSkill1: 11, ActiveSkill2: 11, ActiveSkill3: 11, Ultimate: 11, Combo: 11 };
    const totals = bareBuild(data, hero).totals;
    expect(skillGains(data, { hero, totals, skillLevels, mode: 'pve', stage: stage(16) })).toEqual([]);
  });

  it('fills skipped skill levels with the level below', () => {
    for (const h of data.heroes) for (const s of Object.values(h.skills)) expect(s.levels.every(Boolean)).toBe(true);
    const long = data.heroes.flatMap((h) => Object.values(h.skills)).filter((s) => s.levels.length === 11);
    expect(long.length).toBeGreaterThan(data.heroes.length * 3);
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

  it('uses the B-grade first roll of 5★ gear as the normal roll', () => {
    const roll = Object.fromEntries(data.normalRoll.map((r) => [r.stat, r.value]));
    expect(roll.AttackPercent).toBeCloseTo(0.0216, 6);
    expect(roll.CriticalDamagePercent).toBeCloseTo(0.0304, 6);
    expect(roll.SkillSpeedFlat).toBe(7);
    expect(roll.AccuracyFlat).toBe(14);
    expect(data.normalRoll).toHaveLength(10);
  });

  it('values every damage stat above zero', () => {
    const { values } = statValues(data, fight('Ironblade Darus'));
    const gain = Object.fromEntries(values.map((v) => [v.stat, v.gain]));
    for (const s of ['AttackPercent', 'CriticalRatePercent', 'CriticalDamagePercent', 'SkillRecoveryFlat']) expect(gain[s]).toBeGreaterThan(0);
    expect(gain.HealthPercent).toBe(0);
  });
});

describe('debuffs', () => {
  it('lands every debuff when ACC beats RES, and fewer as RES climbs', () => {
    const c = data.curves.resist;
    expect(landChance(c, 50, 100)).toBe(1);
    expect(landChance(c, 100, 100)).toBe(1);
    expect(landChance(c, 150, 100)).toBeCloseTo(0.5);
    expect(landChance(c, 475, 0)).toBe(0);
  });

  it('counts the debuffs each skill lands on the boss', () => {
    const f = fight('Ironblade Darus', { stage: stage(1) });
    f.totals.acc = 100;
    const r = simulate(data, f);
    const defDown = r.debuffs.find((d) => d.name === 'DEF Down')!;
    expect(defDown.slot).toBe('Ultimate');
    expect(defDown.landed).toBeCloseTo(defDown.tries);
    const high = simulate(data, { ...f, stage: stage(20) });
    expect(high.debuffs.find((d) => d.name === 'DEF Down')!.landed).toBe(0);
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
      expect(Object.keys(r.gainBySlot).sort()).toEqual([...r.changed].sort());
      for (const g of Object.values(r.gainBySlot)) expect(g).toBeGreaterThanOrEqual(-1e-9);
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

describe('toughness', () => {
  const s16 = data.stages.find((s) => s.stage === 16)!;
  it('compares one normal roll of flat and % HP and DEF', () => {
    expect(data.toughRoll.map((r) => r.stat).sort()).toEqual(['DefenseFlat', 'DefensePercent', 'HealthFlat', 'HealthPercent']);
    expect(Object.fromEntries(data.toughRoll.map((r) => [r.stat, r.value])).HealthFlat).toBe(168);
  });
  it('gives effective HP above HP and positive gains for every roll', () => {
    const hero = data.heroes.find((h) => h.name === 'Ironblade Darus')!;
    const { base, values } = toughValues(data, bareBuild(data, hero).totals, s16);
    expect(s16.atk).toBeGreaterThan(0);
    expect(base.taken).toBeGreaterThan(0);
    expect(base.taken).toBeLessThan(1);
    expect(base.ehp).toBeGreaterThan(base.hp);
    for (const v of values) expect(v.gain).toBeGreaterThan(0);
  });
});
