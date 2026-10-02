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

export const collections = { blog };
