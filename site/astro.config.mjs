import { defineConfig } from 'astro/config';

// GitHub Pages serves the site at https://<owner>.github.io/<repo>/.
// The deploy workflow sets SITE and BASE_PATH; local dev uses the defaults.
export default defineConfig({
  site: process.env.SITE ?? 'http://localhost:4321',
  base: process.env.BASE_PATH ?? '/',
  trailingSlash: 'ignore',
});
