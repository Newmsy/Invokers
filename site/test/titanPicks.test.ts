import { describe, expect, it } from 'vitest';
import heroes from '../../data/heroes.json';
import skills from '../../data/skills.json';
import { titanInfo, type HeroLike, type SkillSetLike } from '../src/lib/tiers/candidates';
import { bindable, parseBonus, recommendTitans, type PickTitan } from '../src/lib/titanPicks';

const sets = skills as unknown as SkillSetLike[];
const skillsOf = new Map(sets.map((s) => [s.heroId, s.skills]));
const titans: PickTitan[] = titanInfo(heroes as unknown as HeroLike[], sets).map((t) => ({ ...t, skills: skillsOf.get(t.id) ?? [] }));
const hero = (name: string) => {
  const h = (heroes as unknown as (HeroLike & { name: string })[]).find((x) => x.name === name)!;
  return { faction: h.faction, class: h.class, skills: skillsOf.get(h.id) ?? [] };
};

describe('recommended Titans', () => {
  it('reads boss-mode and flat bonuses', () => {
    expect(parseBonus("Increases Bound Invoker's HP by 36%.")).toEqual({ stat: 'HP', value: '+36%', elsewhere: undefined });
  });

  it('only offers same-faction Titans, plus the ones anyone can bind', () => {
    for (const h of heroes as unknown as HeroLike[]) {
      const picks = recommendTitans({ faction: h.faction, class: h.class, skills: skillsOf.get(h.id) ?? [] }, titans);
      expect(picks.length).toBeGreaterThan(0);
      for (const p of picks) expect(!p.titan.faction || p.titan.faction === h.faction).toBe(true);
      for (const p of picks) expect(p.reason.length).toBeGreaterThan(0);
    }
    expect(bindable(hero('Admiral Gladstone'), titans).some((t) => t.name === 'Litria')).toBe(true);
  });

  it('suits the pick to the role', () => {
    const tank = recommendTitans(hero('Admiral Gladstone'), titans)[0];
    expect(['HP', 'DEF', 'RES']).toContain(tank.bonus?.stat);
  });

  it('weights rarity heavily once it is known', () => {
    const h = hero('Admiral Gladstone');
    const own = bindable(h, titans);
    const second = recommendTitans(h, own)[1];
    const rated = own.map((t) => ({ ...t, rarity: t.id === second.titan.id ? 'Legendary' : 'Epic' }));
    expect(recommendTitans(h, rated)[0].titan.id).toBe(second.titan.id);
  });
});
