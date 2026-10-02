// Links between pages in Markdown posts are written from the site root ("/summons", "/bosses/althar").
// This prefixes them with the deploy base, so they still work when the site is served from a subpath.
import { defineMdastPlugin } from 'satteri';

export function markdownLinks(base = '/') {
  const root = base.replace(/\/$/, '');
  return defineMdastPlugin({
    name: 'invokers-links',
    link(node, ctx) {
      if (root && /^\/(?!\/)/.test(node.url)) ctx.setProperty(node, 'url', root + node.url);
    },
  });
}
