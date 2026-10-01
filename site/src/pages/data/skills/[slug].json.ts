import type { APIContext } from 'astro';
import { heroes, heroSlug } from '../../../lib/data';
import { rosterSkills } from '../../../lib/roster';

export function getStaticPaths() {
  return heroes.map((h) => ({ params: { slug: heroSlug(h.id) }, props: { id: h.id } }));
}

export function GET({ props }: APIContext) {
  return new Response(JSON.stringify(rosterSkills((props as { id: string }).id)), {
    headers: { 'Content-Type': 'application/json' },
  });
}
