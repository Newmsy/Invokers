// One wide picture for every news post and article, in place of a row of icons. A story gets the key art of
// what it is about (its chase banner, or the splash of its first Invoker, Titan or boss) when there is some,
// else a scene from its topic's pool. Each story takes the first picture no newer story has used, so lists
// show a different picture on every card.
import { getCollection } from 'astro:content';
import { bannerArt, bossGroupSplash, bossSplash, chaseBanner, heroSplash, hintArt, titanSplash } from './art';
import { bossLabel, bosses, heroes, titans } from './data';
import { topics } from './guides';

export interface StoryPicture {
  src: string;
  /** CSS object-position: splash art keeps faces in frame. */
  position: string;
}

const banners = (...names: string[]) => names.map(bannerArt).filter((s): s is string => !!s);
// Loading-screen pictures (wide 4:1 scenes), the deepest pool.
const scenes = () => Array.from({ length: 200 }, (_, i) => hintArt(i)).filter((s): s is string => !!s);

// Scenes for each Guides topic and news kind, best fit first.
const topicPool: Record<string, string[]> = {
  'Invokers and teams': banners('loading-screen', 'upgrade-invoker', 'summon-invoker', 'stars', 'win-arena-medals'),
  Progression: banners('echo-legendary', 'echo-epic', 'upgrade-invoker', 'titan-sparks', 'campaign-progression', 'stars'),
  Gear: banners('upgrade-relics', 'collect-dungeon-relics-1', 'collect-dungeon-relics-2', 'collect-dungeon-relics-6', 'memorium'),
  'Bosses and events': banners('clan-boss-1', 'collect-dungeon-titan', 'win-arena-medals', 'novice-tournament', 'novice-tournament-2', 'keys'),
  'Summons and value': banners('summon-invoker', 'destiny-star', 'radiant-star', 'orbs', 'gems', 'star-pack', 'gift', 'summon-titan'),
  Tips: [],
};
const kindPool: Record<string, string[]> = {
  spotlight: banners('summon-invoker', 'destiny-star'),
  patch: banners('campaign-progression', 'upgrade-titan', 'collect-dungeon-essence', 'titan-sparks', 'keys'),
  event: banners('energy', 'novice-tournament-2', 'clan-boss-1', 'collect-dungeon-medals', 'gold'),
  announcement: banners('stars', 'gift', 'gems', 'orbs', 'star-pack'),
};

/** Splash art for "hero:", "titan:" and "boss:" references, in order. */
function keyArt(refs: string[]): string[] {
  return refs.flatMap((r) => {
    const [, kind, name] = r.match(/^(hero|titan|boss):(.+)$/) ?? [];
    if (kind === 'hero') { const h = heroes.find((x) => x.name === name); return h && heroSplash(h.id) ? [heroSplash(h.id)!] : []; }
    if (kind === 'titan') { const t = titans.find((x) => x.name === name); return t && titanSplash(t.id) ? [titanSplash(t.id)!] : []; }
    if (kind === 'boss') {
      const b = bosses.find((x) => x.name === name || bossLabel(x) === name);
      const s = b && (bossSplash(b.id) ?? bossGroupSplash(b.id));
      return s ? [s] : [];
    }
    return [];
  });
}

let cache: Promise<Map<string, StoryPicture>> | undefined;

/** Every story's picture, by page path ("news/update-0-61", "blog/arena-guide"). */
export function storyPictures(): Promise<Map<string, StoryPicture>> {
  return (cache ??= build());
}

export async function storyPicture(path: string): Promise<StoryPicture | undefined> {
  return (await storyPictures()).get(path);
}

async function build(): Promise<Map<string, StoryPicture>> {
  const stories: { path: string; date: Date; fixed?: string; candidates: string[] }[] = [];
  for (const e of await getCollection('news')) {
    const hero = e.data.kind === 'spotlight' ? heroes.find((h) => h.name === e.data.heroes[0]) : undefined;
    stories.push({
      path: `news/${e.id}`,
      date: e.data.date,
      fixed: hero && chaseBanner(hero.id),
      candidates: [...keyArt([...e.data.heroes.map((n) => `hero:${n}`), ...e.data.art]), ...(kindPool[e.data.kind] ?? [])],
    });
  }
  for (const p of await getCollection('blog')) {
    const topic = topics.find((t) => t.tags.includes(p.data.tags[0])) ?? topics.find((t) => p.data.tags.some((tag) => t.tags.includes(tag)));
    stories.push({
      path: `blog/${p.id}`,
      date: p.data.date,
      fixed: p.data.banner ? bannerArt(p.data.banner) : undefined,
      candidates: [...keyArt(p.data.art), ...(topicPool[topic?.name ?? 'Tips'] ?? [])],
    });
  }
  stories.sort((a, b) => b.date.valueOf() - a.date.valueOf() || a.path.localeCompare(b.path));

  const all = [...scenes(), ...Object.values(topicPool).flat(), ...Object.values(kindPool).flat()];
  const used = new Set<string>(stories.flatMap((s) => (s.fixed ? [s.fixed] : [])));
  const out = new Map<string, StoryPicture>();
  for (const s of stories) {
    const src = s.fixed ?? [...s.candidates, ...all].find((c) => !used.has(c)) ?? s.candidates[0] ?? all[0];
    if (!src) continue;
    used.add(src);
    // Character splash puts faces in the upper third; scenes and banners read best from the middle.
    out.set(s.path, { src, position: /\/splash\/|\/chase\//.test(src) ? 'center 25%' : 'center' });
  }
  return out;
}
