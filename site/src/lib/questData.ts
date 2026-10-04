// Achievements and Progress Quests from data/quests.json. The pages that use them only exist once the file is in the
// data pack, so the nav and link checker stay green until then.
import { heroes, heroHref, href, titans, titanHref } from './data';
import { heroArt, itemIcon, titanArt } from './art';
import { plainItemName } from './progression';
import type { QuestsFile, Total } from './questRewards';

const files = import.meta.glob<{ default: unknown }>('../../../data/quests.json', { eager: true });
export const quests = (Object.values(files)[0]?.default ?? {}) as QuestsFile;

export const achievements = Array.isArray(quests.achievements) ? quests.achievements.filter((a) => a?.section && Array.isArray(a.rewards)) : [];
export const progressPages = Array.isArray(quests.progressQuests) ? quests.progressQuests.filter((p) => p && Number.isFinite(p.page)) : [];
export const hasAchievements = achievements.length > 0;
export const hasProgressQuests = progressPages.length > 0;

// Pages that explain an item, so a reward chip links somewhere useful.
const itemLink = (id: string) =>
  id === 'Memorium' ? 'gear-upgrades'
  : /^ASC_/.test(id) ? 'ascension'
  : /^SIP?_/.test(id) ? 'summons'
  : /^Codex_/.test(id) ? 'skill-costs'
  : /^Prism_/.test(id) ? 'titans'
  : /^FT_/.test(id) ? 'tactics'
  : id === 'Gem' ? 'packs'
  : undefined;

const heroById = new Map(heroes.map((h) => [h.id, h]));
const titanById = new Map(titans.map((t) => [t.id, t]));

export interface RewardView { name: string; icon?: string; link?: string; portrait?: boolean }

/** How a reward shows on the page: its in-game name, icon and the page that explains it. */
export function rewardView(t: Pick<Total, 'id' | 'random' | 'type'> & { amount?: number }): RewardView {
  if (t.random) {
    const titan = /titan/i.test(t.type);
    const plural = (t.amount ?? 1) === 1 ? '' : 's';
    return { name: `random ${t.random} ${titan ? 'Titan' : 'Invoker'}${plural}`, icon: itemIcon(titan ? 'SI_WonderOrb' : 'SI_DestinyStar'), link: href('summons') };
  }
  const titan = titanById.get(t.id);
  if (titan) return { name: titan.name, icon: titanArt(titan.id), link: titanHref(titan.slug), portrait: true };
  const hero = heroById.get(t.id);
  if (hero) return { name: hero.name, icon: heroArt(hero.id), link: heroHref(hero.id), portrait: true };
  const link = itemLink(t.id);
  return { name: plainItemName(t.id), icon: itemIcon(t.id), link: link ? href(link) : undefined };
}
