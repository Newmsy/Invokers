import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';

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

// SITE and BASE_PATH let a host serve the site from a subpath
// (e.g. /invokers/); local dev and CI use the defaults.
export default defineConfig({
  site: process.env.SITE || 'http://localhost:4321',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'ignore',
  integrations: [dropSourceArt],
});
