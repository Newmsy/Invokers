// Readable URL slugs. Kept free of Astro and Vite imports so build scripts can use them too.

export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Hero id → page slug, e.g. ironblade-darus. Two heroes with the same name get the element added, then a
 * number, so every slug stays unique.
 */
export function makeHeroSlugs(heroes: { id: string; name: string; element: string }[]): Map<string, string> {
  const slugs = new Map<string, string>();
  const taken = new Set<string>();
  const count = new Map<string, number>();
  for (const h of heroes) count.set(slugify(h.name), (count.get(slugify(h.name)) ?? 0) + 1);
  for (const h of heroes) {
    let slug = slugify(h.name) || 'invoker';
    if ((count.get(slug) ?? 0) > 1) slug = `${slug}-${slugify(h.element)}`;
    for (let n = 2; taken.has(slug); n++) slug = `${slug.replace(/-\d+$/, '')}-${n}`;
    taken.add(slug);
    slugs.set(h.id, slug);
  }
  return slugs;
}
