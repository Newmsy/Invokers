import { describe, expect, it } from 'vitest';
import sample from '../../datamine/samples/box-sample.json';
import damageJson from '../../data/damage.json';
import curvesJson from '../../data/stat_curves.json';
import type { BoxHero } from '../src/lib/box/decode';
import type { BoxDoc } from '../src/lib/box/store';
import { fullyAwakened } from '../src/lib/awakening';
import { heroes } from '../src/lib/data';
import { bareBuild, boxBuild } from '../src/lib/dps/box';
import { dpsData, STAGES } from '../src/lib/dps/data';
import { buffGains, selfDefence, teamGains, defenseFactor, effectGains, elementEdge, finalStat, landChance, totalsFor, simulate, skillGains, statValues, type FightInput } from '../src/lib/dps/model';
import { openSlots, optimise } from '../src/lib/dps/optimise';
import { buffedToughness, toughness, toughValues } from '../src/lib/dps/tank';
import { parseComboText, parseDebuffs, parseHit, parseBuffs, parseSelfBuffs, parseSelfShields, parseSelfEffects, parseSkillText } from '../src/lib/dps/parse';

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

  it('reads stacked and plural Bleed casts', () => {
    // "Casts 2 [1.25% Bleed] debuffs on the target": two stacks, each ticking and capped on its own.
    const dusca = hero('Mistress Dusca').skills.ActiveSkill2!.levels.at(-1)!;
    expect(dusca.d).toHaveLength(1);
    expect(dusca.d![0].pct).toBeCloseTo(0.025);
    expect(dusca.d![0].capAtk).toBeCloseTo(10); // 500% ATK limit per stack
    for (const [name, slot] of [['Veilstalker Nyctra', 'ActiveSkill3'], ['Duchess Kanraku', 'ActiveSkill3'], ['Tyxil the Adder', 'Ultimate'], ['Nightcap Zirdel', 'ActiveSkill2'], ['Ballus the Bull', 'Ultimate']] as const) {
      expect(hero(name).skills[slot]!.levels.at(-1)!.d, name).toBeDefined();
    }
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
    expect(parseSkillText('Casts a buff.')).toEqual({ hits: [], dots: [], debuffs: [], buffs: [], team: [], shields: [], effects: [] });
  });

  it('lists the debuffs and control effects cast on enemies', () => {
    expect(hero('Ironblade Darus').skills.Ultimate!.levels.at(-1)!.x).toEqual([{ name: 'DEF Down', chance: 1, acc: true, pct: 0.18, sec: 14 }]);
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

  it("matches the game's DEF rule at every exported sample, including boss DEF", () => {
    for (const s of damageJson.defense.samples) expect(defenseFactor(data.defense, s.defense)).toBeCloseTo(s.multiplier, 5);
    // Same as the in-game rating table where both exist.
    const curve = (curvesJson as { curves: { id: string; values: number[] }[] }).curves.find((c) => c.id === 'DefenseFactor')!.values;
    for (const d of [0, 402, 1081, 2000, 3000]) expect(defenseFactor(data.defense, d)).toBeCloseTo(curve[d], 5);
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
    const { values } = statValues(data, fight('Ironblade Darus', { stage: stage(13) }));
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

  it('can pick gear for effective HP instead of DPS', () => {
    for (const owned of doc.heroes) {
      const r = optimise(data, doc, owned, { mode: 'pve', stage: stage(16), takeFromOthers: true, goal: 'toughness' });
      if (!r) continue;
      const hero = data.heroes.find((h) => h.configId === owned.configId)!;
      expect(r.before).toBeCloseTo(toughness(data, boxBuild(data, doc, owned)!.totals, stage(16)).ehp, 0);
      expect(r.after).toBeGreaterThanOrEqual(r.before);
      expect(hero).toBeDefined();
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

describe('elements', () => {
  it('reads the element rules from damage.json', () => {
    expect(elementEdge('Water', 'Fire')).toBe('advantage');
    expect(elementEdge('Fire', 'Water')).toBe('disadvantage');
    expect(elementEdge('Light', 'Earth')).toBe('lightDark');
    expect(elementEdge('Fire', 'Wind')).toBe('neutral');
    expect(data.elements.advantage).toEqual({ damage: 1.3, crit: 0, debuff: 20 });
    expect(data.elements.disadvantage).toEqual({ damage: 0.7, crit: -0.5, debuff: -50 });
  });

  it('hits harder with advantage and lands debuffs more often', () => {
    const hero = data.heroes.find((h) => h.element === 'Water')!;
    const totals = bareBuild(data, hero).totals;
    const base = { hero, totals, skillLevels: {}, mode: 'pve' as const };
    const s = data.stages[0];
    const vsFire = simulate(data, { ...base, stage: { ...s, element: 'Fire', res: 100 } });
    const vsWind = simulate(data, { ...base, stage: { ...s, element: 'Wind', res: 100 } });
    const vsEarth = simulate(data, { ...base, stage: { ...s, element: 'Earth', res: 100 } });
    expect(vsFire.edge).toBe('advantage');
    expect(vsFire.dps).toBeGreaterThan(vsEarth.dps);
    expect(vsWind.dps).toBeLessThan(vsEarth.dps);
    expect(vsFire.accChance).toBeGreaterThan(vsEarth.accChance);
    expect(vsWind.accChance).toBeLessThan(vsEarth.accChance);
  });
});

describe('self buffs', () => {
  it('reads buffs on the Invoker itself and on allies around it', () => {
    const devi = 'Casts a <b>[100% Crit DMG Up]</b> buff on <b>Devi of the Six</b>, lasting <b>16s</b>.';
    expect(parseSelfBuffs(devi, 'Devi of the Six')).toEqual([{ name: 'Crit DMG Up', stat: 'critDmg', pct: 1, sec: 16 }]);
    const team = 'Casts a [40% Crit Rate Up] buff on 10 allies in a 15m radius, lasting 17s. Then, casts a [75% Crit DMG Up] buff on the targets, lasting 17s.';
    expect(parseSelfBuffs(team, 'Sebastin').map((b) => b.stat)).toEqual(['critRate', 'critDmg']);
    expect(parseSelfBuffs('Casts a [45% ATK Up] buff on Kera Deathkiss, lasting 7s, on critical hits.', 'Kera Deathkiss')[0].onCrit).toBe(true);
    // Another Invoker's targets, a single other ally, or a kill condition don't count.
    expect(parseSelfBuffs('Then, casts a [30% Crit Rate Up] buff on the targets, lasting 13s.', 'Furnos')).toEqual([]);
    expect(parseSelfBuffs('Casts a [15% Skill Recovery Up] buff on the ally with the lowest current HP in a 15m radius, lasting 3s.', 'Fulrik')).toEqual([]);
    expect(parseSelfBuffs('Casts a [55% ATK Up] buff on the 9 allies with the lowest current HP in a 15m radius, lasting 15s, if this attack kills the target.', 'Nirvelle')).toEqual([]);
  });

  it('gives Devi her Skill 2 and Skill 3 buffs, and they add DPS', () => {
    const f = fight('Devi of the Six', { stage: stage(13) });
    expect(f.hero.skills.ActiveSkill3!.levels[10].b?.[0]).toMatchObject({ stat: 'critDmg', pct: 1, sec: 16 });
    expect(f.hero.skills.ActiveSkill2!.levels[10].b?.[0]).toMatchObject({ stat: 'skillRecovery', pct: 0.25, sec: 14 });
    const withBuffs = simulate(data, f).dps;
    const without = simulate(data, { ...f, noBuffs: true }).dps;
    expect(withBuffs).toBeGreaterThan(without);
    const gains = buffGains(data, f);
    expect(gains.map((g) => g.name).sort()).toEqual(['Crit DMG Up', 'Skill Recovery Up']);
    for (const g of gains) {
      expect(g.uptime).toBeGreaterThan(0.2);
      expect(g.uptime).toBeLessThanOrEqual(1);
      expect(g.gain).toBeGreaterThanOrEqual(0);
    }
  });

  it('multiplies final ATK while ATK Up is up', () => {
    const f = fight('Kisanka', { stage: stage(13) });
    expect(simulate(data, f).dps).toBeGreaterThan(simulate(data, { ...f, noBuffs: true }).dps);
  });
});

describe('cooldown cuts and bonus mana', () => {
  it("reads Devi's cooldown cuts and mana", () => {
    const devi = hero('Devi of the Six');
    expect(devi.skills.ActiveSkill2!.levels[10].e).toEqual([{ kind: 'mana', amount: 20, each: true }]);
    expect(devi.skills.Ultimate!.levels[10].e).toEqual([{ kind: 'cooldown', skill: 'random', amount: 6, when: 'crit' }]);
    expect(devi.comboFx?.[10][4]).toEqual([
      { kind: 'cooldown', skill: 2, amount: 1, when: 'noncrit' },
      { kind: 'cooldown', skill: 2, amount: 3, when: 'crit' },
    ]);
    // Effects that need a kill or debuff count, or go to allies, are left out.
    expect(parseSelfEffects('Reduces the cooldown of all Active Skills on X by 4s if this attack kills the target.', 'X')).toEqual([]);
    expect(parseSelfEffects('Reduces the cooldown of a random Active Skill on 1 random ally by 6s in a 15m radius.', 'X')).toEqual([]);
    expect(parseSelfEffects('If the hit lands as a critical hit X gains 40 Ultimate Mana instead.', 'X')).toEqual([{ kind: 'mana', amount: 40, when: 'crit', instead: true }]);
  });

  it('adds DPS through faster skills and earlier Ultimates', () => {
    const f = fight('Devi of the Six', { stage: stage(13) });
    const gains = effectGains(data, f);
    const mana = gains.find((g) => g.slot === 'ActiveSkill2' && g.kind === 'mana')!;
    expect(mana.total).toBeGreaterThan(0);
    const combo = gains.find((g) => g.slot === 'Combo' && g.kind === 'cooldown')!;
    expect(combo.total).toBeGreaterThan(5);
    expect(combo.gain).toBeGreaterThan(0);
    expect(simulate(data, f).dps).toBeGreaterThan(simulate(data, { ...f, noBuffs: true }).dps);
  });
});

describe('own debuffs', () => {
  it('reads DEF Down and Weaken sizes and lengths', () => {
    const [weaken] = parseDebuffs('Casts a [5% Weaken] debuff on the target, lasting 12s, increasing all damage taken by 5%.');
    expect(weaken).toMatchObject({ name: 'Weaken', pct: 0.05, sec: 12 });
  });

  it("raises the Invoker's own damage while DEF Down is on the boss", () => {
    // Stage 1: low RES, so the debuff lands.
    const f = fight('Ironblade Darus', { stage: stage(1) });
    const gains = buffGains(data, f).filter((g) => g.onBoss);
    expect(gains.map((g) => g.name)).toContain('DEF Down');
    expect(gains[0].gain).toBeGreaterThan(0);
    expect(simulate(data, f).dps).toBeGreaterThan(simulate(data, { ...f, skipBuff: 'Ultimate|DEF Down' }).dps);
  });
});

describe('set bonuses', () => {
  it('adds the 3-piece and 5-piece bonuses together (5-piece Accuracy set = +125 ACC)', () => {
    const h = hero('Ironblade Darus');
    const bare = totalsFor(data, h, 'Six', 60, [], []);
    const five = totalsFor(data, h, 'Six', 60, [], Array.from({ length: 5 }, () => ({ stats: [], set: 'Accuracy' })));
    expect(five.acc - bare.acc).toBe(125);
    const three = totalsFor(data, h, 'Six', 60, [], Array.from({ length: 3 }, () => ({ stats: [], set: 'Accuracy' })));
    expect(three.acc - bare.acc).toBe(50);
  });
});

describe('team buffs', () => {
  it('reads how many other team members a buff reaches', () => {
    const { buffs, team } = parseBuffs('Casts a [55% ATK Up] buff on 10 random allies in a 15m radius, lasting 16s. Then, casts a [30% Skill Recovery Up] buff on the targets, lasting 16s.', 'Plaxi');
    expect(buffs.map((b) => b.name)).toEqual(['ATK Up', 'Skill Recovery Up']);
    expect(team).toMatchObject([{ name: 'ATK Up', allies: 4 }, { name: 'Skill Recovery Up', allies: 4 }]);
    // Two of five picked by HP: each other Invoker has a 2 in 5 chance.
    expect(parseBuffs('Casts a [20% ATK Up] buff on the 2 allies with the lowest current HP in a 15m radius, lasting 10s.', 'X').team[0].allies).toBe(1.6);
    const one = parseBuffs('Casts a [20% ATK Up] buff on the ally with the highest MAX HP in a 15m radius, lasting 10s.', 'X');
    expect(one.buffs).toEqual([]);
    expect(one.team[0].allies).toBe(1);
    expect(parseBuffs('Casts a [20% ATK Up] buff on X, lasting 10s.', 'X').team).toEqual([]);
  });

  it('adds nothing unless the team toggle is on', () => {
    const f = fight('Custodian Plumia');
    const off = simulate(data, f);
    const on = simulate(data, { ...f, team: true });
    expect(off.teamDps).toBe(0);
    expect(on.teamDps).toBeGreaterThan(0);
    expect(on.dps).toBeCloseTo(off.dps + on.teamDps, 6);
    const [atk] = teamGains(data, f);
    expect(atk).toMatchObject({ slot: 'ActiveSkill2', name: 'ATK Up', allies: 4 });
    // 40% ATK Up for about 60% of the fight: a bit under +25% for each ally.
    expect(atk.allyGain).toBeGreaterThan(0.15);
    expect(atk.allyGain).toBeLessThan(0.4);
    expect(atk.teamDps).toBeCloseTo(on.teamDps, 0);
  });

  it('counts DEF Down on the boss for the whole team', () => {
    const f = fight('Ironblade Darus', { stage: stage(1) });
    const g = teamGains(data, f).find((x) => x.name === 'DEF Down')!;
    expect(g.allies).toBe(4);
    expect(g.teamDps).toBeGreaterThan(0);
  });
});

describe('own DEF Up and shields', () => {
  it('reads shields that reach the caster', () => {
    const text = 'Casts a [8 HP Shield] buff on Chaddeus, lasting 12s. Casts a [8 HP Shield] buff on the ally with the lowest current HP in a 12m radius, lasting 12s.<br><br>#1 Damage: 535% ATK<br>#2 Shield: 20% * MAX HP<br>#3 Shield: 30% * MAX HP';
    expect(parseSelfShields(text, 'Chaddeus')).toEqual([{ hp: 0.2, atk: 0, def: 0, dealt: 0, sec: 12 }]);
    const kandra = 'Casts a [Shield] buff on Kandra, lasting 12s. The [Shield] is equal to (50% * Damage Dealt + 10% * MAX HP).';
    expect(parseSelfShields(kandra, 'Kandra')).toEqual([{ hp: 0.1, atk: 0, def: 0, dealt: 0.5, sec: 12 }]);
  });

  it('DEF Up raises DEF-scaling damage and effective HP', () => {
    const f = fight('Admiral Gladstone');
    const sd = selfDefence(data, f);
    expect(sd.defUp.length).toBeGreaterThan(0);
    const b = buffedToughness(data, f)!;
    expect(b.ehp).toBeGreaterThan(toughness(data, f.totals, f.stage).ehp);
    expect(buffedToughness(data, fight('Ironblade Darus'))).toBeNull();
  });
});
