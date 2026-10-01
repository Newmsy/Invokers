// The search index, built once at build time and fetched by the search page.
import { getCollection } from 'astro:content';
import { href } from '../lib/data';
import { dataDocs, pageDocs } from '../lib/search/dataIndex';
import type { SearchDoc } from '../lib/search/match';

/** Markdown to plain text, near enough for matching and snippets. */
function markdownText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*\|?\s*:?-{3,}.*$/gm, ' ')
    .replace(/[#*_`>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function GET() {
  const posts = (await getCollection('blog')).sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
  const guides: SearchDoc[] = posts.map((p) => ({
    kind: 'Guide',
    title: p.data.title,
    sub: p.data.description,
    text: markdownText(p.body ?? ''),
    url: href(`blog/${p.id}`),
  }));
  const docs = [...dataDocs(), ...guides, ...pageDocs()];
  return new Response(JSON.stringify(docs), { headers: { 'Content-Type': 'application/json' } });
}
