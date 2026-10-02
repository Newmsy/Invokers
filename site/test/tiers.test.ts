import { describe, expect, it } from 'vitest';
import heroes from '../../data/heroes.json';
import skills from '../../data/skills.json';
import tiers from '../src/data/tiers.json';
import { makeHeroSlugs } from '../src/lib/slugs';
import { titanInfo, type HeroLike, type SkillSetLike } from '../src/lib/tiers/candidates';
import { damageOf, readKit } from '../src/lib/tiers/kit';
import { tierLists, tierNames, toTiers } from '../src/lib/tiers/lists';

describe('kit reading', () => {
  it('sums ATK and DEF multipliers and counts hits and targets', () => {
    expect(damageOf('Attacks 7 enemies in a 3.5m radius. #1 Damage: 455% ATK')).toEqual({ atk: 4.55, def: 0, targets: 7 });
    expect(damageOf('Attacks 1 enemy 3 times, dealing 92 damage per hit. #1 Damage: 91% ATK').atk).toBeCloseTo(2.73);
    expect(damageOf('#1 Damage: 260% ATK + 380% DEF').def).toBeCloseTo(3.8);
  });

  it('tags the tools boss guides ask for', () => {
    const kit = readKit([
      { type: 'ActiveSkill1', levels: [{ level: 11, text: 'Casts a <b><color=#FF3232>[60% Heal Reduction]</color></b> debuff on the target.' }] },
      { type: 'ActiveSkill2', levels: [{ level: 11, text: 'Removes 2 random debuffs from the 10 allies with the lowest HP.' }] },
      { type: 'Ultimate', levels: [{ level: 11, text: 'Casts a <color=#FF3232>[Stun]</color> debuff on the targets.' }] },
    ]);
    expect([...kit.tags].sort()).toEqual(['cleanse', 'hardCC', 'healReduction']);
  });
});

describe('tiers.json', () => {
  const heroSlugs = new Set(makeHeroSlugs(heroes as HeroLike[]).values());
  const titanSlugs = new Set(titanInfo(heroes as HeroLike[], skills as SkillSetLike[]).map((t) => t.slug));
  const file = tiers as unknown as Record<'invokers' | 'titans', Record<string, Record<string, string[]>>>;

  for (const [kind, known] of [['invokers', heroSlugs], ['titans', titanSlugs]] as const) {
    it(`${kind}: every list exists and names each pick once, with a real name`, () => {
      for (const [id, list] of Object.entries(file[kind])) {
        expect(tierLists.some((l) => l.id === id), `unknown list ${id}`).toBe(true);
        const names = Object.entries(list).flatMap(([tier, slugs]) => {
          expect(tierNames as readonly string[], `unknown tier ${tier} in ${id}`).toContain(tier);
          return slugs;
        });
        for (const n of names) expect(known.has(n), `${kind}/${id}: no ${n}`).toBe(true);
        expect(new Set(names).size, `${kind}/${id} lists someone twice`).toBe(names.length);
      }
    });
  }
});

describe('toTiers', () => {
  it('splits by rank: S is the top 8%', () => {
    const scores = new Map(Array.from({ length: 100 }, (_, i) => [`h${i}`, i] as [string, number]));
    const t = toTiers(scores);
    expect(t.S).toHaveLength(8);
    expect(t.S[0]).toBe('h99');
    expect(t.D).toHaveLength(25);
  });
});
