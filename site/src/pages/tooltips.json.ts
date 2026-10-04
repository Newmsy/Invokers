// Hover cards for links to Invokers, Titans and bosses, keyed by page path (no base, no slashes at the ends).
// Built once; the layout's tooltip script fetches it on the first hover.
import { bosses, bossLabel, bossSlug, heroes, heroHref, href, skillsFor, titanHref, titans } from '../lib/data';
import { bossArt, elementIcon, heroArt, titanArt } from '../lib/art';
import { fullyAwakened } from '../lib/awakening';
import { className, formatStat, rarityColor, skillTypeName, tierColor } from '../lib/format';
import { bestTier, tierNames, titanTiers } from '../lib/tierData';
import { bonusLabel, maxBonus, titanSkills } from '../lib/titans';

export interface Tooltip {
  /** name, picture, colour of the top line, top line, chips, rows of label/value, list of lines */
  n: string;
  a?: string;
  c?: string;
  s: string;
  e?: string;
  t?: { label: string; color: string };
  r?: [string, string][];
  l?: string[];
}

const base = href('/');
const key = (url: string) => url.slice(base.length).replace(/^\/|\/$/g, '');

export function GET() {
  const tips: Record<string, Tooltip> = {};
  for (const h of heroes) {
    const stats = fullyAwakened(h)?.stats ?? h.maxStats;
    const best = bestTier(h.id);
    tips[key(heroHref(h.id))] = {
      n: h.name,
      a: heroArt(h.id),
      c: rarityColor[h.rarity],
      s: `${h.rarity} · ${h.element} ${className(String(h.class))} · ${h.faction}`,
      e: elementIcon(h.element),
      t: best && { label: `${best.tier} tier · ${best.list.label}`, color: tierColor[best.tier] },
      r: [
        ['HP', formatStat(stats.hp)],
        ['ATK', formatStat(stats.atk)],
        ['DEF', formatStat(stats.def)],
      ],
      l: skillsFor(h.id)
        .filter((s) => /^ActiveSkill|^Ultimate/.test(s.type))
        .map((s) => `${skillTypeName(s.type)}: ${s.title}`),
    };
  }
  for (const t of titans) {
    const tiers = titanTiers(t.slug);
    const best = [...tiers].sort((a, b) => tierNames.indexOf(a.tier) - tierNames.indexOf(b.tier))[0];
    const bonus = maxBonus(t.id);
    tips[key(titanHref(t.slug))] = {
      n: t.name,
      a: titanArt(t.id),
      s: `Titan · ${t.faction ?? 'Any faction'}`,
      t: best && { label: `${best.tier} tier · ${best.list.label}`, color: tierColor[best.tier] },
      r: bonus ? [['Max bonus', bonusLabel(bonus)]] : [],
      l: titanSkills(t.id).filter((s) => s.title && s.type !== 'Combo').map((s) => `${skillTypeName(s.type)}: ${s.title}`),
    };
  }
  for (const b of bosses) {
    tips[key(href(`bosses/${bossSlug(b)}`))] = {
      n: bossLabel(b),
      a: bossArt(b.id),
      s: [b.mode.replace(/^./, (c) => c.toUpperCase()), b.element].filter(Boolean).join(' · '),
      e: b.element ? elementIcon(b.element) : undefined,
      r: [['Stages', String(b.stages.length)], ...(b.corruptions.length ? [['Corruptions', b.corruptions.join(', ')] as [string, string]] : [])],
      l: b.dos.slice(0, 2).map((d) => `Do: ${d}`),
    };
  }
  return new Response(JSON.stringify(tips), { headers: { 'Content-Type': 'application/json' } });
}
