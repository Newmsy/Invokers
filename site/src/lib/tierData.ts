// Tier lists for the pages: Newms's tiers from src/data/tiers.json, joined to the heroes and Titans they name,
// with the "brings" chips worked out from each kit (lib/tiers).
import skillsJson from '../../../data/skills.json';
import tiersJson from '../data/tiers.json';
import { titanArt, heroArt } from './art';
import { heroes, heroHref, heroSlug, titanHref, titans, type Hero } from './data';
import { heroCandidates, titanCandidates, type SkillSetLike } from './tiers/candidates';
import { tagLabels, type Kit } from './tiers/kit';
import { brings, tierLists, tierNames, type TierListDef, type TierName } from './tiers/lists';

export type PoolKind = 'invokers' | 'titans';

export const pools: { kind: PoolKind; label: string }[] = [
  { kind: 'invokers', label: 'Invokers' },
  { kind: 'titans', label: 'Titans' },
];

type TierFile = { draft: boolean } & Record<PoolKind, Record<string, Partial<Record<TierName, string[]>>>>;
const file = tiersJson as unknown as TierFile;

/** True while the tiers are still the generated draft, before Newms has set them. */
export const tiersDraft = file.draft;

export interface TierPick {
  slug: string;
  name: string;
  href?: string;
  art?: string;
  element?: string;
  /** Short line under the name: class for Invokers, faction for Titans. */
  meta: string;
  brings: string[];
}

export interface TierRow {
  tier: TierName;
  picks: TierPick[];
}

const skillSets = skillsJson as SkillSetLike[];
const kits: Record<PoolKind, Map<string, Kit>> = {
  invokers: new Map(heroCandidates(heroes, skillSets).map((c) => [c.slug, c.kit])),
  titans: new Map(titanCandidates(heroes, skillSets).map((c) => [c.slug, c.kit])),
};
const heroBySlug = new Map<string, Hero>(heroes.map((h) => [heroSlug(h.id), h]));
const titanBySlug = new Map(titans.map((t) => [t.slug, t]));

const classLabel: Record<string, string> = { MeleeAttacker: 'Melee', RangedAttacker: 'Ranged' };

function pick(kind: PoolKind, list: TierListDef, slug: string): TierPick | undefined {
  const kit = kits[kind].get(slug);
  const chips = kit ? brings(list, kit).map((t) => tagLabels[t]) : [];
  if (kind === 'invokers') {
    const h = heroBySlug.get(slug);
    if (!h) return undefined;
    const cls = String(h.class);
    const favoured = (list.classes?.[cls] ?? 0) > 0 || (list.elements?.[h.element] ?? 0) > 0;
    return {
      slug,
      name: h.name,
      href: heroHref(h.id),
      art: heroArt(h.id),
      element: h.element,
      meta: `${h.rarity} · ${classLabel[cls] ?? cls}`,
      brings: favoured ? [(list.classes?.[cls] ?? 0) > 0 ? classLabel[cls] ?? cls : h.element, ...chips].slice(0, 3) : chips,
    };
  }
  const t = titanBySlug.get(slug);
  if (!t) return undefined;
  return { slug, name: t.name, href: titanHref(t.slug), art: titanArt(t.id), meta: t.faction ?? 'Any faction', brings: chips };
}

/** The rows of one list, S to D. Names in tiers.json that don't match a hero or Titan are skipped. */
export function tierRows(kind: PoolKind, list: TierListDef): TierRow[] {
  const tiers = file[kind]?.[list.id] ?? {};
  return tierNames.map((tier) => ({
    tier,
    picks: (tiers[tier] ?? []).map((slug) => pick(kind, list, slug)).filter((p): p is TierPick => !!p),
  }));
}

/** Tier of one hero on every list, for the hero page. */
export function heroTiers(heroId: string): { list: TierListDef; tier: TierName }[] {
  const slug = heroSlug(heroId);
  return tierLists.flatMap((list) => {
    const tiers = file.invokers?.[list.id] ?? {};
    const tier = tierNames.find((t) => tiers[t]?.includes(slug));
    return tier ? [{ list, tier }] : [];
  });
}

/** Tier of one Titan on every list, for the Titan page. */
export function titanTiers(slug: string): { list: TierListDef; tier: TierName }[] {
  return tierLists.flatMap((list) => {
    const tiers = file.titans?.[list.id] ?? {};
    const tier = tierNames.find((t) => tiers[t]?.includes(slug));
    return tier ? [{ list, tier }] : [];
  });
}

/** A hero's best tier on any list, with that list, or undefined if no list has them. */
export function bestTier(heroId: string): { list: TierListDef; tier: TierName } | undefined {
  return heroTiers(heroId).sort((a, b) => tierNames.indexOf(a.tier) - tierNames.indexOf(b.tier))[0];
}

export { tierLists, tierNames };
