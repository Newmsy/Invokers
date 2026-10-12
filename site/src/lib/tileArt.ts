// A background picture for each link tile (home sections, Featured guides, the Guides hub). A section uses its
// own banner; when another section already has that banner, it takes an unused banner or boss, Titan or Invoker
// splash, so tiles side by side never repeat. (Loading-screen scenes are left out: they show game menus.)
// Articles and news use their story picture (lib/storyArt).
import { bannerArt, bannerNames, bossSplash, heroSplash, titanSplash } from './art';
import { bosses, heroes, titans } from './data';
import { nav } from './nav';
import { storyPictures } from './storyArt';

const isUrl = (s: string | undefined): s is string => !!s;
const scenes = () => [
  ...bannerNames().filter((n) => !n.startsWith('meme-')).map(bannerArt),
  ...bosses.map((b) => bossSplash(b.id)),
  ...titans.map((t) => titanSplash(t.id)),
  ...heroes.map((h) => heroSplash(h.id)),
].filter(isUrl);

let sections: Map<string, string> | undefined;

function sectionPictures(): Map<string, string> {
  if (sections) return sections;
  sections = new Map();
  const used = new Set<string>();
  const spare = scenes();
  for (const n of nav) {
    const own = n.banner ? bannerArt(n.banner) : undefined;
    const src = own && !used.has(own) ? own : spare.find((s) => !used.has(s)) ?? own;
    if (!src) continue;
    used.add(src);
    sections.set(n.path, src);
  }
  return sections;
}

/** The picture for a tile linking to `path`, or undefined when there is none. */
export async function tilePicture(path: string): Promise<string | undefined> {
  return sectionPictures().get(path) ?? (await storyPictures()).get(path)?.src;
}

/** Inline styles that hand each tile its picture (see .pic-tile in layouts/Base.astro), by path. */
export async function tileStyles(paths: string[]): Promise<Map<string, string | undefined>> {
  const pics = await Promise.all(paths.map(tilePicture));
  return new Map(paths.map((p, i) => [p, pics[i] ? `--pic: url(${pics[i]})` : undefined]));
}
