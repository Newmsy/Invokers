// Serves the game art under readable names (see lib/art.ts).
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { APIRoute } from 'astro';
import { artRoutes } from '../../lib/art';

export function getStaticPaths() {
  return artRoutes().map(({ served, source }) => ({ params: { path: served }, props: { source } }));
}

export const GET: APIRoute = async ({ props }) => {
  const body = await readFile(join(process.cwd(), 'public', 'art', props.source as string));
  return new Response(body, { headers: { 'Content-Type': 'image/webp' } });
};
