// Blog posts are Markdown files in src/content/blog. Each one records the
// game version its numbers come from, which the post page shows. Inline art uses ![Name](kind:), see
// lib/markdown-art.ts.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    gameVersion: z.string(),
    tags: z.array(z.string()).default([]),
    // Header art as "kind:Name" (hero, titan, item, element, class), e.g. "item:Destiny Star".
    art: z.array(z.string()).default([]),
  }),
});

// News: a short report of something that happened in the game, then our numbers on it. `heroes` names the
// Invokers it covers; each gets a "by the numbers" box (components/HeroNumbers).
const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    /** Last day, for things that ran over a stretch (a chase). */
    until: z.coerce.date().optional(),
    /** True when the dates are our best evidence rather than announced. */
    datesEstimated: z.boolean().default(false),
    kind: z.enum(['spotlight', 'patch', 'event', 'announcement']),
    gameVersion: z.string(),
    heroes: z.array(z.string()).default([]),
    art: z.array(z.string()).default([]),
    /** The official announcement, when there is one. */
    official: z.url().optional(),
  }),
});

export const collections = { blog, news };
