import { describe, expect, it } from 'vitest';
import bossesJson from '../../data/bosses.json';
import skillsJson from '../../data/skills.json';
import { bossAbilities, bossAbilityIds } from '../src/lib/bossAbilities';

const bosses = (bossesJson as { bosses: { id: string; corruptions: string[] }[] }).bosses;
const skills = skillsJson as { heroId: string; skills: { levels?: { text: string }[] }[] }[];
const key = (s: string) => s.toLowerCase().replace(/\s+/g, '');

describe('boss abilities', () => {
  it('covers every boss', () => {
    expect(bossAbilityIds.sort()).toEqual(bosses.map((b) => b.id).sort());
  });
  it('checks every counter pick against the Invoker', () => {
    for (const boss of bosses) {
      for (const p of bossAbilities(boss.id)!.picks) {
        if (p.why === 'both') {
          const has = (p.hero as unknown as { tolerances: { stat: string }[] }).tolerances.map((t) => key(t.stat));
          for (const c of boss.corruptions) expect(has, `${p.hero.name} on ${boss.id}`).toContain(`${key(c)}tolerance`);
        } else if (p.why !== 'pick') {
          const text = skills.find((s) => s.heroId === p.hero.id)!.skills.flatMap((s) => s.levels ?? []).map((l) => l.text).join(' ');
          expect(text, `${p.hero.name} brings ${p.why}`).toContain(p.why);
        }
      }
    }
  });
});
