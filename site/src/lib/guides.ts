// Every guide on the site in one list: the guide pages plus the blog posts, sorted into topics.
// Used by the Guides hub and the home page.
import { getCollection } from 'astro:content';
import { nav } from './nav';

export interface GuideEntry {
  path: string;
  title: string;
  blurb: string;
  art: string[];
  kind: 'Guide' | 'Article' | 'Tool';
  date?: Date;
  topic: string;
  /** Wide picture for story cards: the topic's banner. */
  banner?: string;
}

export const topics: { name: string; blurb: string; art: string; banner: string; tags: string[]; pages: string[] }[] = [
  { name: 'Invokers and teams', banner: 'loading-screen', blurb: 'Who to build and how stats work', art: 'hero:Admiral Gladstone', tags: ['invokers', 'roster', 'stats'], pages: ['tiers', 'team', 'tactics', 'stats'] },
  { name: 'Progression', banner: 'echo-legendary', blurb: 'Levels, stars, awakening and skills', art: 'item:5 star Echo', tags: ['levelling', 'awakening', 'skills', 'codex', 'trophies'], pages: ['ascension', 'farming', 'skill-costs', 'trophies'] },
  { name: 'Gear', banner: 'upgrade-relics', blurb: 'Sets, upgrades and where the gold goes', art: 'item:Gear Swap Pass', tags: ['gear', 'sets'], pages: ['gear', 'gear-upgrades'] },
  { name: 'Bosses and events', banner: 'clan-boss-1', blurb: 'Boss mechanics, scaling and event targets', art: 'item:Elder Titanheart', tags: ['bosses', 'stages', 'clan', 'arena', 'spires'], pages: ['bosses', 'spires', 'events'] },
  { name: 'Summons and value', banner: 'summon-invoker', blurb: 'Odds, chests and which packs are worth it', art: 'item:Destiny Star', tags: ['summons', 'odds', 'chests', 'chroma'], pages: ['summons', 'packs'] },
  { name: 'Tips', banner: 'novice-tournament', blurb: 'Quick answers and fact checks', art: 'item:Heroic Playbook', tags: ['tips', 'guides'], pages: [] },
];

const toolPages = new Set(['team', 'trophies', 'events', 'summons', 'packs']);

export async function allGuides(): Promise<GuideEntry[]> {
  const pages: GuideEntry[] = topics.flatMap((t) =>
    t.pages.map((p) => {
      const n = nav.find((x) => x.path === p)!;
      return { path: p, title: n.label, blurb: n.blurb ?? '', art: n.art ? [n.art] : [], kind: toolPages.has(p) ? 'Tool' : 'Guide', topic: t.name, banner: n.banner ?? t.banner } satisfies GuideEntry;
    }),
  );
  const posts: GuideEntry[] = (await getCollection('blog'))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .map((p) => {
      const topic = topics.find((t) => t.tags.includes(p.data.tags[0])) ?? topics.find((t) => p.data.tags.some((tag) => t.tags.includes(tag))) ?? topics[topics.length - 1];
      return {
        path: `blog/${p.id}`,
        title: p.data.title,
        blurb: p.data.description,
        // A post without header art borrows its topic's picture, so every card has one.
        art: p.data.art.length > 0 ? p.data.art : [topic.art],
        kind: 'Article',
        date: p.data.date,
        topic: topic.name,
        banner: p.data.banner ?? topic.banner,
      } satisfies GuideEntry;
    });
  return [...pages, ...posts];
}
