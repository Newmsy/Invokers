// Client side of the My box page: import, backup, delete, and the invokers / gear / accessories views.
import { avatar } from '../avatar';
import type { BoxAccessory, BoxGear, BoxHero, StatRoll } from './decode';
import { ImportError, importBackup, importSnapshots, partFor } from './importer';
import { clearBox, loadBox, onBoxChange, saveBox, type BoxDoc } from './store';
import { TROPHY_ROOMS, roomLevels, trophyBonuses } from './trophies';
import type { HeroRef } from '../data';
import { getAccountState, onAccountChange } from '../account/state';

interface Refs {
  heroes: Record<string, HeroRef>;
  stats: Record<string, { name: string; percent: boolean }>;
  sets: Record<string, string>;
  gameVersion: string;
  heroBase: string;
}

const PAGE = 150;
const RANKS = ['Unknown', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];
const RARITIES = ['Unknown', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Greater'];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** Small element builder; children that are strings become text nodes, so nothing is parsed as HTML. */
function h(tag: string, attrs: Record<string, string> = {}, ...children: (Node | string | null)[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of children) if (c !== null) el.append(c);
  return el;
}

const stars = (rank: string) => h('span', { class: 'stars', title: `${RANKS.indexOf(rank)} stars` }, '★'.repeat(Math.max(0, RANKS.indexOf(rank))));
const titleCase = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1 $2');

export function start(): void {
  const refs: Refs = JSON.parse($('box-refs').textContent ?? '{}');
  let box: BoxDoc | null = null;
  let tab = 'heroes';
  let gearShown = PAGE;
  let accShown = PAGE;

  const heroRef = (h: BoxHero): HeroRef | undefined => refs.heroes[h.configId];
  const heroNameByInventoryId = () => {
    const m = new Map<number, string>();
    for (const hero of box?.heroes ?? []) m.set(hero.id, heroRef(hero)?.name ?? 'Unknown invoker');
    return m;
  };

  const statText = (s: StatRoll | null): string => {
    if (!s) return '';
    const label = refs.stats[s.stat];
    if (!label) return `${titleCase(s.stat)} ${s.value}`;
    return label.percent ? `${label.name} ${+(s.value * 100).toFixed(1)}%` : `${label.name} ${+s.value.toFixed(1)}`;
  };

  // ---------- messages and status ----------
  const message = (text: string, error = false) => {
    const el = $('box-message');
    el.textContent = text;
    el.classList.toggle('error', error);
  };

  function savedWhere(): string {
    const account = getAccountState();
    if (account.status !== 'signed-in') return 'saved in this browser only';
    if (account.sync === 'synced') return 'saved in this browser and synced to your account';
    if (account.sync === 'syncing') return 'saved in this browser, syncing to your account';
    return 'saved in this browser, not synced to your account yet';
  }

  function renderStatus(): void {
    const has = !!box;
    ($('backup') as HTMLButtonElement).disabled = !has;
    ($('delete') as HTMLButtonElement).disabled = !has;
    $('box-views').hidden = !has;
    ($('howto') as HTMLDetailsElement).open = !has;
    if (!box) {
      $('box-status').textContent = 'No box imported yet. Import your files from the game to see your invokers and gear.';
      return;
    }
    const when = new Date(box.importedAt).toLocaleString();
    $('box-status').textContent =
      `${box.heroes.length} invokers, ${box.gear.length} gear, ${box.accessories.length} accessories · ` +
      `imported ${when} · ${savedWhere()}`;
    for (const part of ['heroes', 'gear', 'accessories'] as const) {
      document.querySelector(`[data-count="${part}"]`)!.textContent = String(box[part].length);
    }
    renderTrophies();
  }

  /** One line per room with levels: the bonus every Invoker of that element gets. */
  function renderTrophies(): void {
    const list = $('trophy-rooms');
    list.replaceChildren();
    $('trophy-none').hidden = !!box?.trophies;
    for (const element of TROPHY_ROOMS) {
      if (!roomLevels(box?.trophies, element).length) continue;
      const parts = trophyBonuses(box?.trophies, element).map(([stat, v]) => {
        const label = refs.stats[stat];
        return label?.percent ? `${label.name} +${+(v * 100).toFixed(1)}%` : `${label?.name ?? titleCase(stat)} +${v}`;
      });
      list.append(h('li', {}, h('strong', {}, element), `: ${parts.join(', ')}`));
    }
  }

  // ---------- import ----------
  async function importFiles(files: File[]): Promise<void> {
    const boxFiles = files.filter((f) => partFor(f.name));
    if (files.length && !boxFiles.length && files.every((f) => f.name.toLowerCase().endsWith('.json'))) {
      return restore(files[0]);
    }
    message('Reading your files…');
    try {
      const { doc, updated, notes } = await importSnapshots(boxFiles.length ? boxFiles : files, box, refs.gameVersion);
      await saveBox(doc);
      box = doc;
      const missing = (['heroes', 'gear', 'accessories'] as const).filter((p) => !updated.includes(p) && !doc.files[p]);
      const parts = [`Imported ${updated.map((p) => (p === 'heroes' ? 'invokers' : p)).join(', ')}.`, ...notes];
      if (missing.length) parts.push(`Still missing: ${missing.join(', ')}.`);
      message(parts.join(' '));
      renderAll();
    } catch (e) {
      message(e instanceof ImportError ? e.message : 'Something went wrong reading those files.', true);
    }
  }

  async function restore(file: File): Promise<void> {
    try {
      const doc = await importBackup(file);
      await saveBox(doc);
      box = doc;
      message('Backup loaded.');
      renderAll();
    } catch (e) {
      message(e instanceof ImportError ? e.message : 'Something went wrong reading that backup.', true);
    }
  }

  const picker = (id: string, handle: (files: File[]) => void) => {
    const input = $<HTMLInputElement>(id);
    input.addEventListener('change', () => {
      handle([...(input.files ?? [])]);
      input.value = '';
    });
  };
  picker('pick-files', importFiles);
  $<HTMLInputElement>('pick-folder').webkitdirectory = true;
  picker('pick-folder', importFiles);
  picker('pick-backup', (files) => files[0] && restore(files[0]));

  const drop = $('drop');
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    importFiles([...(e.dataTransfer?.files ?? [])]);
  });

  $('copy-path').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('folder-path').textContent ?? '');
      $('copy-path').textContent = 'Copied';
    } catch {
      $('copy-path').textContent = 'Select and copy';
    }
  });

  $('backup').addEventListener('click', () => {
    if (!box) return;
    const blob = new Blob([JSON.stringify(box)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `invokers-box-${box.importedAt.slice(0, 10)}.json` });
    a.click();
    // Revoking straight away can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL((a as HTMLAnchorElement).href), 10_000);
  });

  $('delete').addEventListener('click', async () => {
    const signedIn = getAccountState().status === 'signed-in';
    const question = signedIn
      ? 'Delete your imported box from this browser and from your account?'
      : 'Delete your imported box from this browser?';
    if (!confirm(question)) return;
    await clearBox();
    box = null;
    message(signedIn ? 'Your box was deleted from this browser and your account.' : 'Your box was deleted from this browser.');
    renderAll();
  });

  // ---------- tabs ----------
  document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((btn) =>
    btn.addEventListener('click', () => {
      tab = btn.dataset.tab!;
      document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
      document.querySelectorAll<HTMLElement>('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== tab));
    }),
  );

  // ---------- invokers ----------
  const heroSearch = $<HTMLInputElement>('hero-search');
  const heroSort = $<HTMLSelectElement>('hero-sort');
  const heroStorage = $<HTMLInputElement>('hero-storage');
  [heroSearch, heroSort, heroStorage].forEach((el) => el.addEventListener('input', renderHeroes));

  function renderHeroes(): void {
    const grid = $('hero-grid');
    grid.replaceChildren();
    if (!box) return;
    const q = heroSearch.value.trim().toLowerCase();
    const rows = box.heroes
      .filter((hero) => heroStorage.checked || !hero.inStorage)
      .map((hero) => ({ hero, ref: heroRef(hero) }))
      .filter(({ ref }) => !q || (ref ? `${ref.name} ${ref.faction} ${ref.element} ${ref.class}` : 'unknown').toLowerCase().includes(q));
    const by = heroSort.value;
    rows.sort((a, b) => {
      const name = (a.ref?.name ?? '~').localeCompare(b.ref?.name ?? '~');
      if (by === 'name') return name;
      if (by === 'rank') return RANKS.indexOf(b.hero.rank) - RANKS.indexOf(a.hero.rank) || b.hero.level - a.hero.level || name;
      if (by === 'rarity') return RARITIES.indexOf(b.ref?.rarity ?? '') - RARITIES.indexOf(a.ref?.rarity ?? '') || name;
      return b.hero.level - a.hero.level || RANKS.indexOf(b.hero.rank) - RANKS.indexOf(a.hero.rank) || name;
    });
    if (!rows.length) {
      grid.append(h('p', { class: 'muted' }, 'No invokers match.'));
      return;
    }
    for (const { hero, ref } of rows) {
      const gearCount = Object.keys(hero.gearBySlot).length;
      grid.append(
        h(
          'article',
          { class: `hero-card r-${ref?.rarity ?? 'Unknown'}` },
          ref ? h('a', { href: refs.heroBase + ref.slug, class: 'with-avatar' }, avatar(ref.art, 36), ref.name) : h('strong', {}, 'Unknown invoker'),
          h('span', { class: 'sub' }, ref ? `${ref.rarity} · ${ref.faction} · ${ref.element} · ${titleCase(ref.class)}` : `config ${hero.configId}`),
          h('span', {}, stars(hero.rank), ` Lv ${hero.level}`),
          h('span', { class: 'sub' }, `Awakening ${hero.awakenLevel} · gear ${gearCount}/8${hero.inStorage ? ' · in storage' : ''}`),
        ),
      );
    }
  }

  // ---------- gear and accessories ----------
  type Item = BoxGear | BoxAccessory;
  interface ItemView {
    filters: HTMLElement;
    table: HTMLElement;
    more: HTMLButtonElement;
    groupKey: 'set' | 'faction';
    groupLabel: string;
    items: () => Item[];
    shown: () => number;
    showMore: () => void;
    reset: () => void;
  }

  function setupFilters(view: ItemView): Record<string, HTMLSelectElement | HTMLInputElement> {
    const select = (name: string, label: string) => {
      const s = h('select', { 'aria-label': label, 'data-filter': name }) as HTMLSelectElement;
      s.addEventListener('input', () => {
        view.reset();
        renderItems(view);
      });
      return s;
    };
    const search = h('input', { type: 'search', placeholder: 'Search stats or invoker' }) as HTMLInputElement;
    search.addEventListener('input', () => {
      view.reset();
      renderItems(view);
    });
    const controls = {
      q: search,
      slot: select('slot', 'Slot'),
      group: select('group', view.groupLabel),
      rarity: select('rarity', 'Rarity'),
      main: select('main', 'Main stat'),
      equipped: select('equipped', 'Equipped'),
    };
    view.filters.replaceChildren(...Object.values(controls));
    return controls;
  }

  function fillOptions(sel: HTMLSelectElement, all: string, values: [string, string][]): void {
    const current = sel.value;
    sel.replaceChildren(h('option', { value: '' }, all), ...values.map(([v, l]) => h('option', { value: v }, l)));
    sel.value = values.some(([v]) => v === current) ? current : '';
  }

  const controlsByView = new Map<ItemView, Record<string, HTMLSelectElement | HTMLInputElement>>();

  function renderItems(view: ItemView): void {
    const c = controlsByView.get(view)!;
    const items = view.items();
    const uniq = (f: (i: Item) => string, label: (v: string) => string = titleCase) =>
      [...new Set(items.map(f))].sort().map((v) => [v, label(v)] as [string, string]);
    fillOptions(c.slot as HTMLSelectElement, 'All slots', uniq((i) => i.slot));
    fillOptions(c.group as HTMLSelectElement, `All ${view.groupLabel.toLowerCase()}s`,
      uniq((i) => String((i as unknown as Record<string, string>)[view.groupKey]), (v) => refs.sets[v] ?? titleCase(v)));
    fillOptions(c.rarity as HTMLSelectElement, 'All rarities',
      [...new Set(items.map((i) => i.rarity))].sort((a, b) => RARITIES.indexOf(b) - RARITIES.indexOf(a)).map((v) => [v, v]));
    fillOptions(c.main as HTMLSelectElement, 'Any main stat',
      uniq((i) => i.mainStat?.stat ?? '', (v) => (refs.stats[v] ? `${refs.stats[v].name}${refs.stats[v].percent ? ' %' : ''}` : titleCase(v))));
    fillOptions(c.equipped as HTMLSelectElement, 'Equipped or not', [['yes', 'Equipped'], ['no', 'Not equipped']]);

    const names = heroNameByInventoryId();
    const q = c.q.value.trim().toLowerCase();
    const groupOf = (i: Item) => String((i as unknown as Record<string, string>)[view.groupKey]);
    const rows = items
      .filter((i) =>
        (!c.slot.value || i.slot === c.slot.value) &&
        (!c.group.value || groupOf(i) === c.group.value) &&
        (!c.rarity.value || i.rarity === c.rarity.value) &&
        (!c.main.value || i.mainStat?.stat === c.main.value) &&
        (!c.equipped.value || (c.equipped.value === 'yes') === (i.equippedHeroId !== null)) &&
        (!q || [statText(i.mainStat), ...i.subStats.map(statText), names.get(i.equippedHeroId ?? -1) ?? ''].join(' ').toLowerCase().includes(q)),
      )
      .sort((a, b) => RANKS.indexOf(b.rank) - RANKS.indexOf(a.rank) || RARITIES.indexOf(b.rarity) - RARITIES.indexOf(a.rarity) || b.level - a.level);

    const head = h('tr', {}, ...['Slot', view.groupLabel, 'Rarity', 'Stars', 'Lv', 'Main stat', 'Substats', 'On'].map((t) => h('th', {}, t)));
    // data-label lets narrow screens show each row as a small card.
    const body = rows.slice(0, view.shown()).map((i) =>
      h('tr', {},
        h('td', { class: 'slot' }, titleCase(i.slot)),
        h('td', { 'data-label': view.groupLabel }, refs.sets[groupOf(i)] ?? titleCase(groupOf(i))),
        h('td', { class: `t-${i.rarity}` }, i.rarity),
        h('td', {}, stars(i.rank)),
        h('td', { class: 'num' }, `+${i.level}`),
        h('td', { class: 'num main' }, statText(i.mainStat)),
        h('td', { class: 'subs' }, i.subStats.map(statText).join(' · ')),
        h('td', { 'data-label': 'On' }, i.equippedHeroId === null ? '' : names.get(i.equippedHeroId) ?? '?'),
      ),
    );
    view.table.replaceChildren(h('thead', {}, head), h('tbody', {}, ...body));
    if (!rows.length) view.table.append(h('caption', { class: 'muted' }, 'Nothing matches these filters.'));
    view.more.hidden = rows.length <= view.shown();
    view.more.textContent = `Show more (${rows.length - Math.min(rows.length, view.shown())} left)`;
  }

  const gearView: ItemView = {
    filters: $('gear-filters'), table: $('gear-table'), more: $('gear-more'),
    groupKey: 'set', groupLabel: 'Set',
    items: () => box?.gear ?? [], shown: () => gearShown,
    showMore: () => (gearShown += PAGE), reset: () => (gearShown = PAGE),
  };
  const accView: ItemView = {
    filters: $('acc-filters'), table: $('acc-table'), more: $('acc-more'),
    groupKey: 'faction', groupLabel: 'Faction',
    items: () => box?.accessories ?? [], shown: () => accShown,
    showMore: () => (accShown += PAGE), reset: () => (accShown = PAGE),
  };
  for (const view of [gearView, accView]) {
    controlsByView.set(view, setupFilters(view));
    view.more.addEventListener('click', () => {
      view.showMore();
      renderItems(view);
    });
  }

  function renderAll(): void {
    renderStatus();
    try {
      renderHeroes();
      renderItems(gearView);
      renderItems(accView);
    } catch {
      message('Part of your saved box looks damaged. Re-import from the game, or delete it and start again.', true);
    }
  }

  const reload = async () => {
    box = await loadBox();
    renderAll();
  };
  onBoxChange(reload);
  onAccountChange(renderStatus);
  reload();
}
