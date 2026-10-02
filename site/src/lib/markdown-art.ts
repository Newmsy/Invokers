// Game art inside Markdown posts. An image whose URL is a kind and a colon becomes a small icon chip
// next to its name:
//   ![Ironblade Darus](hero:)   portrait, linked to the hero page
//   ![Destiny Star](item:)      item icon
//   ![Fire](element:) ![Tank](class:) ![Goros](titan:)
// The name to look up is the alt text, or whatever follows the colon (![Melee](class:melee)); an empty
// alt gives the icon alone (![](item:gold)).
// A name with no art fails the build, so a post never ships a broken image.
import { defineMdastPlugin } from 'satteri';
import { artRoutes } from './art';
import { slugify } from './slugs';

const folders: Record<string, string> = { hero: 'heroes', titan: 'titans', item: 'items', element: 'icons', class: 'icons' };
const ref = /^(hero|titan|item|element|class):(.*)$/;

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** img/ path (no base) for a "kind:name" art reference, or undefined when there is no such art. */
export function artRefPath(kind: string, name: string): string | undefined {
  const folder = folders[kind];
  if (!folder) return undefined;
  const served = `${folder}/${slugify(name)}.webp`;
  return artRoutes().some((r) => r.served === served) ? `img/${served}` : undefined;
}

/** A "kind:Name" reference → its img/ path and whether it is a portrait. Throws when there is no such art. */
export function artRef(ref: string): { path: string; name: string; portrait: boolean } {
  const [kind, ...rest] = ref.split(':');
  const name = rest.join(':');
  const path = artRefPath(kind, name);
  if (!path) throw new Error(`No ${kind} art for "${name}"`);
  return { path, name, portrait: kind === 'hero' || kind === 'titan' };
}

/** Sätteri plugin: swaps each art reference for its chip. */
export function markdownArt(base = '/') {
  const root = base.replace(/\/$/, '');
  return defineMdastPlugin({
    name: 'invokers-art',
    image(node, ctx) {
      const m = ref.exec(node.url);
      if (!m) return;
      const [, kind, key] = m;
      const label = node.alt ?? '';
      const lookup = decodeURIComponent(key) || label;
      const path = artRefPath(kind, lookup);
      if (!path) throw new Error(`No ${kind} art for "${lookup}" in ${ctx.fileURL?.pathname ?? 'a post'}`);
      const inner = `<img src="${root}/${path}" alt="" width="28" height="28" loading="lazy" />${label ? `<span>${escape(label)}</span>` : ''}`;
      ctx.replaceNode(node, {
        type: 'html',
        value:
          kind === 'hero'
            ? `<a class="art-chip" href="${root}/heroes/${slugify(lookup)}">${inner}</a>`
            : `<span class="art-chip">${inner}</span>`,
      });
    },
  });
}
