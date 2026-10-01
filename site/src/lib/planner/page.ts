// Client side of the Planner page: reads the saved box and shows what each invoker still needs.
import type { BoxGear } from '../box/decode';
import { loadBox, onBoxChange, type BoxDoc } from '../box/store';
import {
  MAX_GEAR_LEVEL,
  MAX_HERO_LEVEL,
  MAX_STARS,
  isEmptyCost,
  missing,
  planHero,
  roster,
  totals,
  type Cost,
  type HeroPlan,
  type PlanData,
} from './model';

const PICKED_KEY = 'invokers-planner-picked';
// Kept here rather than imported from format.ts, which lists art files and isn't meant for the browser.
const RARITY_ORDER = ['Legendary', 'Epic', 'Rare', 'Uncommon', 'Common'];
const className = (c: string) => ({ MeleeAttacker: 'Melee', RangedAttacker: 'Ranged' })[c] ?? c;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const fmt = (n: number) => n.toLocaleString('en-GB');

/** Small element builder; string children become text nodes, so nothing is parsed as HTML. */
function h(tag: string, attrs: Record<string, string> = {}, ...children: (Node | string | null)[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const c of children) if (c !== null) el.append(c);
  return el;
}

const skillNames: Record<string, string> = {
  ActiveSkill1: 'Skill 1',
  ActiveSkill2: 'Skill 2',
  ActiveSkill3: 'Skill 3',
  Tolerance1: 'Tolerance 1',
  Tolerance2: 'Tolerance 2',
};
const skillName = (s: string) => skillNames[s] ?? s;

function readPicked(): Set<number> | null {
  try {
    const raw = localStorage.getItem(PICKED_KEY);
    return raw ? new Set(JSON.parse(raw) as number[]) : null;
  } catch {
    return null;
  }
}

function writePicked(ids: Set<number>): void {
  try {
    localStorage.setItem(PICKED_KEY, JSON.stringify([...ids]));
  } catch {
    // Storage blocked: the selection just won't survive a reload.
  }
}

export function start(): void {
  const data: PlanData = JSON.parse($('planner-data').textContent ?? '{}');
  let box: BoxDoc | null = null;
  let plans: HeroPlan[] = [];
  let picked = new Set<number>();
  let missingRarity = 'Legendary';

  const costText = (c: Cost): string => {
    if (isEmptyCost(c)) return 'Nothing left';
    return data.currencies
      .filter((cur) => c[cur.id])
      .map((cur) => `${fmt(c[cur.id])} ${cur.name}`)
      .join(' · ');
  };

  const costList = (c: Cost): HTMLElement => {
    if (isEmptyCost(c)) return h('p', { class: 'done' }, 'Nothing left to pay.');
    return h(
      'dl',
      { class: 'cost' },
      ...data.currencies.filter((cur) => c[cur.id]).flatMap((cur) => [h('dt', {}, cur.name), h('dd', {}, fmt(c[cur.id]))]),
    );
  };

  // ---------- filters ----------
  const search = $<HTMLInputElement>('p-search');
  const minStars = $<HTMLSelectElement>('p-stars');
  const rarity = $<HTMLSelectElement>('p-rarity');
  const sort = $<HTMLSelectElement>('p-sort');
  const storage = $<HTMLInputElement>('p-storage');

  function shown(): HeroPlan[] {
    const q = search.value.trim().toLowerCase();
    const list = plans.filter(
      (p) =>
        (storage.checked || !p.hero.inStorage) &&
        p.stars >= Number(minStars.value) &&
        (!rarity.value || p.ref?.rarity === rarity.value) &&
        (!q || (p.ref?.name ?? '').toLowerCase().includes(q)),
    );
    const gold = (p: HeroPlan) => p.skillCost.Gold ?? 0;
    const byName = (a: HeroPlan, b: HeroPlan) => (a.ref?.name ?? '').localeCompare(b.ref?.name ?? '');
    const sorts: Record<string, (a: HeroPlan, b: HeroPlan) => number> = {
      cost: (a, b) => gold(b) - gold(a) || byName(a, b),
      close: (a, b) => (gold(a) || Infinity) - (gold(b) || Infinity) || byName(a, b),
      stars: (a, b) => b.stars - a.stars || b.hero.level - a.hero.level || byName(a, b),
      name: byName,
    };
    return list.sort(sorts[sort.value] ?? sorts.cost);
  }

  // ---------- summary ----------
  function renderSummary(): void {
    const list = plans.filter((p) => picked.has(p.hero.id));
    const t = totals(list);
    $('s-count').textContent = `${t.heroes} invoker${t.heroes === 1 ? '' : 's'} in your plan`;

    $('s-skills').replaceChildren(
      h('p', { class: 'big' }, t.skillsToGo ? `${fmt(t.skillsToGo)} skill levels to go` : 'Every skill maxed'),
      costList(t.skillCost),
    );

    const gearLines: (HTMLElement | null)[] = [
      h('p', { class: 'big' }, `${fmt(t.gearBelowMax)} piece${t.gearBelowMax === 1 ? '' : 's'} below +${MAX_GEAR_LEVEL}`),
      h('p', { class: 'muted' }, `${fmt(t.emptySlots)} empty gear slot${t.emptySlots === 1 ? '' : 's'}`),
      data.gear && t.gearCost ? costList(t.gearCost) : h('p', { class: 'soon' }, 'Gold and Memorium totals coming soon'),
    ];
    $('s-gear').replaceChildren(...gearLines.filter((x): x is HTMLElement => !!x));

    $('s-level').replaceChildren(
      h('p', { class: 'big' }, `${fmt(t.belowMaxLevel)} below ${MAX_STARS}★ level ${MAX_HERO_LEVEL}`),
      h('p', { class: 'soon' }, 'XP, food and ascension costs coming soon'),
    );
  }

  // ---------- invokers ----------
  function heroCard(p: HeroPlan): HTMLElement {
    const name = p.ref?.name ?? 'Unknown invoker';
    const check = h('input', { type: 'checkbox', 'aria-label': `Include ${name} in the plan` }) as HTMLInputElement;
    check.checked = picked.has(p.hero.id);
    check.addEventListener('change', () => {
      if (check.checked) picked.add(p.hero.id);
      else picked.delete(p.hero.id);
      writePicked(picked);
      card.classList.toggle('off', !check.checked);
      renderSummary();
    });

    const title = p.ref
      ? h('a', { href: `${data.heroBase}${p.ref.slug}` }, name)
      : h('span', {}, name);
    const stars = h('span', { class: 'stars', title: `${p.stars} stars` }, '★'.repeat(p.stars));

    const pct = p.skillMax ? Math.round((p.skillLevels / p.skillMax) * 100) : 100;
    const bar = h('div', { class: 'bar', role: 'img', 'aria-label': `Skills ${pct}% of max` }, h('span', { style: `width:${pct}%` }));

    const gear = p.gear;
    const gearText =
      `Gear ${gear.equipped}/8` +
      (gear.belowMax ? ` · ${gear.belowMax} below +${MAX_GEAR_LEVEL}` : gear.equipped ? ` · all +${MAX_GEAR_LEVEL}` : '');

    const skillRows = p.skills.map((s) =>
      h(
        'li',
        {},
        h('b', {}, skillName(s.skill)),
        h('span', { class: 'lv' }, s.priced ? `${s.level} / ${s.max}` : `Level ${s.level}`),
        h('span', { class: 'c' }, s.priced ? costText(s.cost) : 'No price list'),
      ),
    );
    const details = h(
      'details',
      {},
      h('summary', {}, 'Details'),
      h('ul', { class: 'skills' }, ...skillRows),
      gear.empty.length ? h('p', { class: 'muted' }, `Empty slots: ${gear.empty.join(', ')}`) : null,
      gear.cost ? h('p', { class: 'muted' }, `Gear to +${MAX_GEAR_LEVEL}: ${costText(gear.cost)}`) : null,
    );

    const card = h(
      'article',
      { class: `plan-card r-${p.ref?.rarity ?? 'Unknown'}${check.checked ? '' : ' off'}` },
      h('div', { class: 'head' }, check, h('div', { class: 'who' }, title, h('span', { class: 'sub' }, stars, ` Lv ${p.hero.level}`, p.hero.inStorage ? ' · storage' : ''))),
      h('div', { class: 'line' }, h('span', {}, `Skills ${p.skillLevels}/${p.skillMax}`), bar),
      h('p', { class: 'cost-line' }, costText(p.skillCost)),
      h('p', { class: 'sub' }, gearText),
      details,
    );
    return card;
  }

  function renderHeroes(): void {
    const list = shown();
    $('p-count').textContent = `${list.length} shown`;
    $('p-grid').replaceChildren(...(list.length ? list.map(heroCard) : [h('p', { class: 'muted' }, 'No invokers match.')]));
  }

  // ---------- roster ----------
  function renderRoster(): void {
    if (!box) return;
    const owned = box.heroes;
    const table = (field: 'faction' | 'element' | 'class' | 'rarity', label: string) => {
      const rows = roster(data, owned, field);
      if (field === 'rarity') rows.sort((a, b) => RARITY_ORDER.indexOf(a.key) - RARITY_ORDER.indexOf(b.key));
      return h(
        'table',
        { class: 'roster' },
        h('caption', {}, label),
        h(
          'tbody',
          {},
          ...rows.map((r) =>
            h(
              'tr',
              {},
              h('th', { scope: 'row' }, field === 'class' ? className(r.key) : r.key),
              h('td', { class: 'num' }, `${r.owned} / ${r.total}`),
              h('td', { class: 'meter' }, h('div', { class: 'bar' }, h('span', { style: `width:${r.total ? Math.round((r.owned / r.total) * 100) : 0}%` }))),
            ),
          ),
        ),
      );
    };
    $('r-tables').replaceChildren(
      table('rarity', 'By rarity'),
      table('element', 'By element'),
      table('faction', 'By faction'),
      table('class', 'By class'),
    );

    const all = missing(data, owned);
    for (const chip of document.querySelectorAll<HTMLButtonElement>('[data-missing]')) {
      const r = chip.dataset.missing!;
      chip.setAttribute('aria-pressed', String(r === missingRarity));
      chip.querySelector('span')!.textContent = String(all.filter((m) => m.rarity === r).length);
    }
    const list = all
      .filter((m) => m.rarity === missingRarity)
      .sort((a, b) => a.element.localeCompare(b.element) || a.name.localeCompare(b.name));
    $('r-missing').replaceChildren(
      ...(list.length
        ? list.map((m) =>
            h('li', {}, h('a', { href: `${data.heroBase}${m.slug}` }, m.name), h('span', { class: 'sub' }, ` ${m.element} · ${m.faction} · ${className(m.class)}`)),
          )
        : [h('li', { class: 'muted' }, `You have every ${missingRarity} invoker.`)]),
    );
  }

  // ---------- load ----------
  function render(): void {
    const has = !!box;
    $('p-empty').hidden = has;
    $('p-views').hidden = !has;
    if (!box) return;
    $('p-status').textContent = `From your box imported ${new Date(box.importedAt).toLocaleString()}.`;
    renderSummary();
    renderHeroes();
    renderRoster();
  }

  async function load(): Promise<void> {
    box = await loadBox();
    const gearById = new Map<number, BoxGear>((box?.gear ?? []).map((g) => [g.id, g]));
    plans = (box?.heroes ?? []).map((hero) => planHero(data, hero, gearById));
    const saved = readPicked();
    const ids = new Set(plans.map((p) => p.hero.id));
    // First visit: plan every invoker that isn't in storage.
    picked = saved ? new Set([...saved].filter((id) => ids.has(id))) : new Set(plans.filter((p) => !p.hero.inStorage).map((p) => p.hero.id));
    render();
  }

  for (const el of [search, minStars, rarity, sort, storage]) el.addEventListener(el === search ? 'input' : 'change', renderHeroes);

  $('p-all').addEventListener('click', () => {
    for (const p of shown()) picked.add(p.hero.id);
    writePicked(picked);
    renderSummary();
    renderHeroes();
  });
  $('p-none').addEventListener('click', () => {
    for (const p of shown()) picked.delete(p.hero.id);
    writePicked(picked);
    renderSummary();
    renderHeroes();
  });
  for (const chip of document.querySelectorAll<HTMLButtonElement>('[data-missing]')) {
    chip.addEventListener('click', () => {
      missingRarity = chip.dataset.missing!;
      renderRoster();
    });
  }

  onBoxChange(() => void load());
  void load();
}
