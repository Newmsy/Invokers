// Which corruptions each Invoker's own tolerances counter, for boss pages and the Invokers filter.
// Common to Rare Invokers have one tolerance, Epic and Legendary two. The data pack doesn't carry the
// pairing yet (issue #60); this reads it from either place it may land, so both pages fill in on their own:
//   heroes.json  hero.tolerances = [{ slot: 'Tolerance1', stat: 'DazeTolerance', ... }]
//   skills.json  skills of type Tolerance1 / Tolerance2 whose title names the tolerance ("Daze Tolerance")
import heroesJson from '../../../data/heroes.json';
import skillsJson from '../../../data/skills.json';
import statsJson from '../../../data/stats.json';

interface HeroLike {
  id: string;
  tolerances?: { stat?: string }[];
}
interface SkillSetLike {
  heroId: string;
  skills: { type: string; title?: string }[];
}

/** "Mana Shock", "ManaShockTolerance" and "Manashock" all become "manashock". */
export const corruptionKey = (s: string) => s.replace(/\s*Tolerance$/i, '').replace(/\s+/g, '').toLowerCase();

const tolerances = (statsJson as { id: string; short?: string; kind?: string }[]).filter(
  (s) => s.kind === 'rating' && s.id.endsWith('Tolerance'),
);
const known = new Set(tolerances.map((s) => corruptionKey(s.id)));

/** Short display name for a corruption key, e.g. "manashock" → "Manashock". */
export function corruptionLabel(key: string): string {
  return tolerances.find((s) => corruptionKey(s.id) === key)?.short ?? key;
}

/** Hero id → corruption keys its own tolerances counter. */
export function readHeroTolerances(heroes: HeroLike[], skillSets: SkillSetLike[]): Map<string, string[]> {
  const out = new Map<string, Set<string>>();
  const add = (heroId: string, name: string | undefined) => {
    const key = name && corruptionKey(name.replace(/<[^>]+>/g, ''));
    if (!key || !known.has(key)) return;
    if (!out.has(heroId)) out.set(heroId, new Set());
    out.get(heroId)!.add(key);
  };
  for (const h of heroes) for (const t of h.tolerances ?? []) add(h.id, t.stat);
  for (const s of skillSets) for (const sk of s.skills) if (/^Tolerance\d$/.test(sk.type)) add(s.heroId, sk.title);
  return new Map([...out].map(([id, keys]) => [id, [...keys]]));
}

export const heroTolerances = readHeroTolerances(heroesJson as HeroLike[], skillsJson as SkillSetLike[]);

/** False until the pairing is in the data pack; pages hide the hero lists and filter until then. */
export const hasHeroTolerances = heroTolerances.size > 0;

export function heroesWithTolerance(corruption: string): string[] {
  const key = corruptionKey(corruption);
  return [...heroTolerances].filter(([, keys]) => keys.includes(key)).map(([id]) => id);
}
