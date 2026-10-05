// News and articles that feature an Invoker, for the "News and articles" list on its page.
// A story features an Invoker when it names it in its heroes or art, or shows its icon in the text.
import { getCollection } from 'astro:content';
import type { Hero } from './data';
import { newsKinds } from './news';

export interface Mention { path: string; title: string; kind: string; date: Date }

export async function storiesAbout(hero: Hero): Promise<Mention[]> {
  const ref = `hero:${hero.name}`.toLowerCase();
  const chip = `![${hero.name}](hero:)`.toLowerCase();
  const has = (art: string[], body = '') => art.some((a) => a.toLowerCase() === ref) || body.toLowerCase().includes(chip);
  const news = (await getCollection('news'))
    .filter((e) => e.data.heroes.some((h) => h.toLowerCase() === hero.name.toLowerCase()) || has(e.data.art, e.body))
    .map((e) => ({ path: `news/${e.id}`, title: e.data.title, kind: newsKinds[e.data.kind], date: e.data.date }));
  const posts = (await getCollection('blog'))
    .filter((p) => has(p.data.art, p.body))
    .map((p) => ({ path: `blog/${p.id}`, title: p.data.title, kind: 'Article', date: p.data.date }));
  return [...news, ...posts].sort((a, b) => b.date.valueOf() - a.date.valueOf());
}
