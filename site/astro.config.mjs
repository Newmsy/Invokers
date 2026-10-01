import { defineConfig } from 'astro/config';

// SITE and BASE_PATH let a host serve the site from a subpath
// (e.g. /invokers/); local dev and CI use the defaults.
export default defineConfig({
  site: process.env.SITE ?? 'http://localhost:4321',
  base: process.env.BASE_PATH ?? '/',
  trailingSlash: 'ignore',
});
