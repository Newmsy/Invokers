// Renders a shared box or team on /share/. Everything shown comes from the share itself, and text is
// always added as text nodes, never parsed as HTML.
import type { BoxAccessory, BoxGear, BoxHero, StatRoll } from '../box/decode';
import type { HeroRef } from '../data';
import { getShare } from './api';
import { isBoxShare, isTeamDoc, type BoxShare, type TeamDoc } from './payload';

interface Refs {
  heroes: Record<string, HeroRef>;
  stats: Record<string, { name: string; percent: boolean }>;
  sets: Record<string, string>;
  gameVersion: string;
  heroBase: string;
}

const RANKS = ['Unknown', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];

function h(tag: string, attrs: Record<string, string> = {}, ...children: (Node | string | null)[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of children) if (c !== null) el.append(c);
  return el;
}
const titleCase = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1 $2');
const stars = (rank: string) => h('span', { class: 'stars' }, '★'.repeat(Math.max(0, RANKS.indexOf(rank))));

export async function startShareView(): Promise<void> {
  const refs: Refs = JSON.parse(document.getElementById('share-refs')?.textContent ?? '{}');
  const heading = document.getElementById('share-heading')!;
  const meta = document.getElementById('share-meta')!;
  const body = document.getElementById('share-body')!;
  const byId = new Map(Object.values(refs.heroes).map((r) => [r.id, r]));

  const id = new URLSearchParams(window.location.search).get('id') ?? '';
  let share;
  try {
    share = await getShare(id);
  } catch {
    meta.textContent = "Couldn't load this link. Check your connection and try again.";
    return;
  }
  if (!share) {
    meta.textContent = "This link doesn't exist or was deleted by the person who shared it.";
    return;
  }
  heading.textContent = share.title;
  document.title = `${share.title} · Invokers Companion`;
  const shared = new Date(share.created_at).toLocaleDateString();

  const statText = (s: StatRoll | null): string => {
    if (!s) return '';
    const label = refs.stats[s.stat];
    if (!label) return `${titleCase(s.stat)} ${s.value}`;
    return label.percent ? `${label.name} ${+(s.value * 100).toFixed(1)}%` : `${label.name} ${+s.value.toFixed(1)}`;
  };
  const heroLink = (ref: HeroRef | undefined) =>
    ref ? h('a', { href: refs.heroBase + ref.slug }, ref.name) : h('strong', {}, 'Unknown invoker');
  const heroSub = (ref: HeroRef | undefined) =>
    h('span', { class: 'sub' }, ref ? `${ref.rarity} · ${ref.faction} · ${ref.element} · ${titleCase(ref.class)}` : '');

  if (share.kind === 'team' && isTeamDoc(share.payload)) {
    const team: TeamDoc = share.payload;
    meta.textContent = `Team of ${team.heroes.length} · shared ${shared} · game version ${team.gameVersion}`;
    body.replaceChildren(
      h('div', { class: 'grid' }, ...team.heroes.map((slot) => {
        const ref = byId.get(slot.id);
        return h('article', { class: `hero-card r-${ref?.rarity ?? 'Unknown'}` },
          heroLink(ref), heroSub(ref), slot.note ? h('span', { class: 'note' }, slot.note) : null);
      })),
    );
    return;
  }

  if (share.kind === 'box' && isBoxShare(share.payload)) {
    const box: BoxShare = share.payload;
    meta.textContent =
      `${box.heroes.length} invokers · box imported ${new Date(box.importedAt).toLocaleDateString()} · ` +
      `shared ${shared} · game version ${box.gameVersion}`;
    const gearByHero = new Map<number, (BoxGear | BoxAccessory)[]>();
    for (const item of [...box.gear, ...box.accessories]) {
      if (item.equippedHeroId === null) continue;
      gearByHero.set(item.equippedHeroId, [...(gearByHero.get(item.equippedHeroId) ?? []), item]);
    }
    const rows = box.heroes
      .map((hero: BoxHero) => ({ hero, ref: refs.heroes[hero.configId] }))
      .sort((a, b) => b.hero.level - a.hero.level || RANKS.indexOf(b.hero.rank) - RANKS.indexOf(a.hero.rank) ||
        (a.ref?.name ?? '~').localeCompare(b.ref?.name ?? '~'));
    body.replaceChildren(
      h('div', { class: 'grid' }, ...rows.map(({ hero, ref }) => {
        const worn = gearByHero.get(hero.id) ?? [];
        const gearList = worn.length
          ? h('details', {}, h('summary', {}, `Gear (${worn.length})`),
              h('ul', {}, ...worn.map((i) => {
                const group = 'set' in i ? refs.sets[i.set] ?? titleCase(i.set) : titleCase(i.faction);
                return h('li', {}, h('strong', {}, `${titleCase(i.slot)} +${i.level}`), ` ${i.rarity} ${group} · `,
                  statText(i.mainStat), h('br'), i.subStats.map(statText).join(' · '));
              })))
          : null;
        return h('article', { class: `hero-card r-${ref?.rarity ?? 'Unknown'}` },
          heroLink(ref), heroSub(ref),
          h('span', {}, stars(hero.rank), ` Lv ${hero.level}`),
          h('span', { class: 'sub' }, `Awakening ${hero.awakenLevel}`),
          gearList);
      })),
    );
    return;
  }

  meta.textContent = 'This link was made with a newer version of the site. Reload the page to see it.';
}
