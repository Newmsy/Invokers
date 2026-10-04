import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import { markdownArt } from './src/lib/markdown-art';
import { markdownLinks } from './src/lib/markdown-links';

// The game art in public/art is served under readable names from img/ (src/lib/art.ts), so the
// copies Astro makes of the source files are removed from the build.
const dropSourceArt = {
  name: 'drop-source-art',
  hooks: {
    'astro:build:done': async ({ dir }) => {
      await rm(fileURLToPath(new URL('art/', dir)), { recursive: true, force: true });
    },
  },
};

// The live site is https://invokerscompanion.app (canonical links and the sitemap use it). SITE and BASE_PATH
// let another host serve it elsewhere or from a subpath (e.g. /invokers/).
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site: process.env.SITE || 'https://invokerscompanion.app',
  base,
  trailingSlash: 'ignore',
  integrations: [dropSourceArt, sitemap({ filter: (page) => !/\/share\//.test(page) })],
  // Old blog URLs keep working. Astro doesn't add the base to a redirect's target, so it is added here.
  redirects: { '/blog/levels-not-stars': `${base.replace(/\/$/, '')}/blog/levelling-vs-awakening` },
  // ![Name](hero:) and friends in blog posts become icon chips (src/lib/markdown-art.ts); links to /pages get
  // the base path (src/lib/markdown-links.ts).
  markdown: { processor: satteri({ mdastPlugins: [markdownArt(base), markdownLinks(base)] }) },
});
