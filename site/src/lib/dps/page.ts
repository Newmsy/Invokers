// Client side of the DPS simulator page: fetches the simulator data, reads the saved box, and re-runs the fight
// whenever a select changes.
import type { BoxHero } from '../box/decode';
import { avatar } from '../avatar';
import { loadBox, onBoxChange, type BoxDoc } from '../box/store';
import { bareBuild, boxBuild, type Build } from './box';
import { CRIT_RATE_CAP } from './constants';
import { finalStat, simulate, skillGains, statValues, type DpsData, type ElementEdge, type Mode, type SkillSlot } from './model';
import { toughness, toughValues } from './tank';
import { activeSets, openSlots, optimise, type Loadout, type Piece } from './optimise';

const EDGE_TEXT: Record<ElementEdge, (mine: string, enemy: string) => string> = {
  advantage: (m, e) => `${m} beats ${e}: +30% damage, and debuffs land more often.`,
  disadvantage: (m, e) => `${m} is weak against ${e}: −30% damage, 50% less Crit Rate, and debuffs land far less often.`,
  lightDark: (m, e) => `${m} against ${e}: +15% damage.`,
  neutral: () => 'No element advantage.',
};
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');
const pct = (n: number, digits = 1) => `${(n * 100).toFixed(digits)}%`;
const RANK_STARS: Record<string, number> = { One: 1, Two: 2, Three: 3, Four: 4, Five: 5, Six: 6 };
const SOURCE: Record<SkillSlot, string> = {
  Combo: 'Combo',
  ActiveSkill1: 'Skill 1',
  ActiveSkill2: 'Skill 2',
  ActiveSkill3: 'Skill 3',
  Ultimate: 'Ultimate',
};

function el(tag: string, text?: string, cls?: string): HTMLElement {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

function row(...cells: (string | [string, string])[]): HTMLTableRowElement {
  const tr = document.createElement('tr');
  for (const c of cells) tr.append(Array.isArray(c) ? el('td', c[0], c[1]) : el('td', c));
  return tr;
}

export async function start(): Promise<void> {
  const root = $('dps');
  const labels = JSON.parse(root.dataset.labels ?? '{}') as Record<string, string>;
  const setNames = JSON.parse(root.dataset.sets ?? '{}') as Record<string, string>;
  const boss = root.dataset.boss ?? 'Boss';
  const setIcons = JSON.parse(root.dataset.setIcons ?? '{}') as Record<string, string>;
  const gearIcons = JSON.parse(root.dataset.gearIcons ?? '{}') as Record<string, string>;
  const gearImg = (src: string | undefined, className: string) => {
    if (!src) return null;
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.className = className;
    img.loading = 'lazy';
    return img;
  };
  // The piece's own picture: gear by set and slot, accessories by faction and slot.
  const pieceImg = (p: Piece) =>
    gearImg('set' in p ? gearIcons[`set:${p.set}:${p.slot}`] : gearIcons[`accessory:${(p as { faction?: string }).faction}:${p.slot}`], 'gear-icon');
  const setImg = (id: string) => {
    if (!setIcons[id]) return null;
    const img = document.createElement('img');
    img.src = setIcons[id];
    img.alt = '';
    img.className = 'set-icon';
    img.loading = 'lazy';
    return img;
  };
  type Tab = 'dps' | 'toughness';
  const TABS: Tab[] = ['dps', 'toughness'];
  const tabParam = new URLSearchParams(location.search).get('tab');
  // #toughness is the section's old anchor; keep those links working.
  let tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : location.hash === '#toughness' ? 'toughness' : 'dps';
  /** Each tab's own Best gear section: element id prefix. */
  const OPT: Record<Tab, string> = { dps: 'o', toughness: 't-o' };
  /** The chosen Invoker: "box:<id>" or "any:<slug>". */
  const heroSel = { value: '' };
  const searchInput = $<HTMLInputElement>('d-search');
  const sourceSel = $<HTMLSelectElement>('d-source');
  const sortSel = $<HTMLSelectElement>('d-sort');
  const RARITY_COLOR = JSON.parse(root.dataset.rarity ?? '{}') as Record<string, string>;
  const modeSel = $<HTMLSelectElement>('d-mode');
  const stageSel = $<HTMLSelectElement>('d-stage');

  let data: DpsData;
  try {
    data = (await (await fetch(`${root.dataset.base!.replace(/\/$/, '')}/dps-data.json`)).json()) as DpsData;
  } catch {
    $('d-grid-empty').textContent = "Couldn't load the simulator. Try reloading the page.";
    $('d-grid-empty').hidden = false;
    return;
  }
  let box: BoxDoc | null = null;

  const wanted = new URLSearchParams(location.search).get('hero');

  interface Tile {
    key: string;
    name: string;
    art?: string;
    rarity: string;
    element: string;
    stars: number;
    level: number;
    awaken: number;
    pieces: number;
    build: Build | null;
    dps?: number;
    ehp?: number;
  }
  let tiles: Tile[] = [];
  let pickerOpen = !wanted;

  function buildTiles() {
    const owned = (box?.heroes ?? []).filter((h) => data.heroes.some((d) => d.configId === h.configId));
    $('d-nobox').hidden = owned.length > 0;
    sourceSel.querySelector<HTMLOptionElement>('option[value="box"]')!.disabled = !owned.length;
    if (!owned.length) sourceSel.value = 'any';
    else if (!heroSel.value && !wanted) sourceSel.value = 'box';
    tiles =
      sourceSel.value === 'box'
        ? owned.map((h) => {
            const d = data.heroes.find((x) => x.configId === h.configId)!;
            const build = box ? boxBuild(data, box, h) : null;
            return {
              key: `box:${h.id}`, name: d.name, art: d.art, rarity: d.rarity, element: d.element,
              stars: RANK_STARS[h.rank] ?? 0, level: h.level, awaken: h.awakenLevel ?? 0, pieces: build?.pieces ?? 0, build,
            };
          })
        : data.heroes.map((d) => ({
            key: `any:${d.slug}`, name: d.name, art: d.art, rarity: d.rarity, element: d.element,
            stars: 6, level: 60, awaken: 6, pieces: 0, build: bareBuild(data, d),
          }));
    scoreTiles();
  }

  /** Estimated DPS for every tile at the current mode and stage, for the "Highest DPS" sort and the tile line. */
  function scoreTiles() {
    const stage = data.stages.find((s) => s.stage === Number(stageSel.value)) ?? data.stages[0];
    for (const t of tiles) {
      t.dps = t.build && stage
        ? simulate(data, { hero: t.build.hero, totals: t.build.totals, skillLevels: t.build.skillLevels, mode: modeSel.value as Mode, stage }).dps
        : 0;
      t.ehp = t.build && stage ? toughness(data, t.build.totals, stage).ehp : 0;
    }
  }

  const RARITY_RANK: Record<string, number> = { Legendary: 5, Epic: 4, Rare: 3, Uncommon: 2, Common: 1 };

  function tileEl(t: Tile, small = false): HTMLElement {
    const card = el(small ? 'div' : 'button', undefined, `tile${t.key === heroSel.value ? ' on' : ''}`);
    card.style.setProperty('--rarity', RARITY_COLOR[t.rarity] ?? 'var(--line)');
    if (!small) {
      (card as HTMLButtonElement).type = 'button';
      card.setAttribute('aria-pressed', String(t.key === heroSel.value));
      card.addEventListener('click', () => {
        heroSel.value = t.key;
        pickerOpen = false;
        update();
      });
    }
    card.append(avatar(t.art, small ? 56 : 48));
    const text = el('span', undefined, 'tile-text');
    text.append(el('strong', t.name));
    const bits = [`${t.stars}★ Lv ${t.level}`];
    if (t.key.startsWith('box:')) bits.push(t.awaken ? `Awakened ${t.awaken}` : 'Not awakened', `${t.pieces} gear`);
    text.append(el('small', bits.join(' · ')));
    text.append(el('small', (sortSel.value === 'tough' || (sortSel.value !== 'dps' && tab === 'toughness')) ? `${fmt(t.ehp ?? 0)} effective HP` : `${fmt(t.dps ?? 0)} DPS`, 'tile-dps'));
    card.append(text);
    return card;
  }

  function renderPicker() {
    const q = searchInput.value.trim().toLowerCase();
    const sort = sortSel.value;
    const shown = tiles
      .filter((t) => !q || t.name.toLowerCase().includes(q) || t.element.toLowerCase() === q || t.rarity.toLowerCase() === q)
      .sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name);
        if (sort === 'rarity') return (RARITY_RANK[b.rarity] ?? 0) - (RARITY_RANK[a.rarity] ?? 0) || a.name.localeCompare(b.name);
        if (sort === 'stars') return b.stars - a.stars || b.level - a.level || b.awaken - a.awaken || a.name.localeCompare(b.name);
        if (sort === 'tough') return (b.ehp ?? 0) - (a.ehp ?? 0);
        return (b.dps ?? 0) - (a.dps ?? 0);
      });
    $('d-grid').replaceChildren(...shown.map((t) => el('li', undefined, undefined)).map((li, i) => (li.append(tileEl(shown[i])), li)));
    $('d-grid-empty').hidden = shown.length > 0;
    const current = tiles.find((t) => t.key === heroSel.value);
    $('d-current').replaceChildren(...(current ? [tileEl(current, true)] : []));
    $('d-browse').hidden = !pickerOpen;
    $('d-change').textContent = pickerOpen ? 'Done' : 'Change Invoker';
    $('d-change').hidden = !current;
  }

  function fillHeroes() {
    if (!heroSel.value && wanted) {
      const owned = box?.heroes.find((h) => data.heroes.find((x) => x.configId === h.configId)?.slug === wanted);
      heroSel.value = owned ? `box:${owned.id}` : `any:${wanted}`;
      sourceSel.value = owned ? 'box' : 'any';
    }
    buildTiles();
    if (!tiles.some((t) => t.key === heroSel.value)) {
      const best = [...tiles].sort((a, b) => (b.dps ?? 0) - (a.dps ?? 0))[0];
      heroSel.value = best?.key ?? '';
    }
    renderPicker();
  }

  function currentBuild(): Build | null {
    const [kind, key] = heroSel.value.split(':');
    if (kind === 'box' && box) {
      const owned = box.heroes.find((h: BoxHero) => String(h.id) === key);
      return owned ? boxBuild(data, box, owned) : null;
    }
    const hero = data.heroes.find((h) => h.slug === key);
    return hero ? bareBuild(data, hero) : null;
  }

  function render() {
    const build = currentBuild();
    const stage = data.stages.find((s) => s.stage === Number(stageSel.value)) ?? data.stages[0];
    if (!build || !stage) {
      $('d-out').hidden = true;
      return;
    }
    const input = { hero: build.hero, totals: build.totals, skillLevels: build.skillLevels, mode: modeSel.value as Mode, stage };
    const { base, values } = statValues(data, input);
    $('d-out').hidden = false;
    $('d-dps').textContent = fmt(base.dps);
    $('d-total').textContent = `${fmt(base.total)} damage in a ${base.seconds}-second fight against stage ${stage.stage} (level ${stage.level}, ${stage.element}, ${fmt(stage.def)} DEF).`;
    $('d-total').append(' ', EDGE_TEXT[base.edge](build.hero.element, stage.element));

    const t = build.totals;
    const stats: [string, string][] = [
      ['ATK', fmt(finalStat(t, 'atk'))],
      ['DEF', fmt(finalStat(t, 'def'))],
      ['HP', fmt(finalStat(t, 'hp'))],
      ['Crit Rate', t.critRate > CRIT_RATE_CAP ? `${pct(t.critRate)} (${pct(CRIT_RATE_CAP, 0)} counts)` : pct(t.critRate)],
      ['Crit DMG', pct(t.critDmg)],
      ['Skill SPD', fmt(t.skillSpeed)],
      ['Skill RECOV', fmt(t.skillRecovery)],
      ['Combo SPD', fmt(t.comboSpeed)],
      ['Mana Gen', fmt(t.manaGen)],
      ['ACC', fmt(t.acc)],
    ];
    $('d-stats').replaceChildren(...stats.flatMap(([k, v]) => [el('dt', k), el('dd', v)]));

    $('d-sources').replaceChildren(
      ...base.sources
        .filter((s) => s.damage > 0)
        .map((s) => row(SOURCE[s.slot], [fmt(s.casts), 'num'], [fmt(s.damage), 'num'], [pct(base.total ? s.damage / base.total : 0), 'num'])),
    );

    // Debuffs: what each skill tries to cast and how many land on this stage.
    $('d-debuffs-box').hidden = !base.debuffs.length;
    $('d-acc').textContent =
      `Stage ${stage.stage} has ${fmt(stage.res)} RES. With ${fmt(t.acc)} ACC, a debuff that needs Accuracy lands ${pct(base.accChance, 0)} of the time.`;
    $('d-debuffs').replaceChildren(
      ...base.debuffs.map((d) => row(SOURCE[d.slot], d.name, [pct(d.chance, 0), 'num'], [`${d.landed.toFixed(1)} of ${fmt(d.tries)}`, 'num'])),
    );

    // Skill upgrades (box Invokers whose skills aren't maxed).
    const gains = heroSel.value.startsWith('box:') ? skillGains(data, input) : [];
    $('d-skills-box').hidden = !gains.length;
    $('d-skills').replaceChildren(
      ...gains.map((g) =>
        row(SOURCE[g.slot], [`${g.level} of ${g.max}`, 'num'], [g.next >= 0.0005 ? `+${pct(g.next, 2)}` : 'No change', g.next >= 0.0005 ? 'num pos' : 'num'], [g.toMax >= 0.0005 ? `+${pct(g.toMax, 1)}` : 'No change', 'num']),
      ),
    );

    $('d-values').replaceChildren(
      ...values.map((v) => {
        const percent = v.stat.endsWith('Percent');
        const roll = percent ? `+${(v.value * 100).toFixed(1)}%` : `+${Math.round(v.value)}`;
        const gain = v.gain >= 0.0005 ? `+${pct(v.gain, 2)}` : 'No change';
        return row(`${roll} ${labels[v.stat] ?? v.stat}`, [gain, v.gain >= 0.0005 ? 'num pos' : 'num']);
      }),
    );
    renderToughness(build.totals, stage);
  }

  function renderToughness(totals: Build['totals'], stage: (typeof data.stages)[number]) {
    const { base, values } = toughValues(data, totals, stage);
    $('t-ehp').textContent = fmt(base.ehp);
    $('t-line').textContent = `${fmt(base.hp)} HP and ${fmt(base.def)} DEF: ${pct(base.taken, 0)} of each hit gets through.`;
    const stats: [string, string][] = [
      ['Stage', `${stage.stage} (level ${stage.level})`],
      [`${boss} ATK`, fmt(stage.atk)],
      ['One hit, estimated', fmt(base.bossHit)],
      ['Hits survived, estimated', base.hits.toFixed(1)],
    ];
    $('t-stats').replaceChildren(...stats.flatMap(([k, v]) => [el('dt', k), el('dd', v)]));
    $('t-values').replaceChildren(
      ...values.map((v) => {
        const roll = v.stat.endsWith('Percent') ? `+${(v.value * 100).toFixed(1)}%` : `+${Math.round(v.value)}`;
        const good = v.gain >= 0.0005;
        return row(`${roll} ${labels[v.stat] ?? v.stat}`, [`+${fmt(v.ehp - base.ehp)}`, 'num'], [good ? `+${pct(v.gain, 2)}` : 'No change', good ? 'num pos' : 'num']);
      }),
    );
  }

  const statText = (stat: string, value: number) =>
    stat.endsWith('Percent') ? `${labels[stat] ?? stat} ${+(value * 100).toFixed(1)}%` : `${labels[stat] ?? stat} ${Math.round(value)}`;

  function pieceCell(p: Piece | undefined, ownerId: number): HTMLElement {
    const td = el('td', undefined, 'piece');
    // One wrapper, so the phone card layout keeps the label on the left and the piece on the right.
    const wrap = el('div');
    td.append(wrap);
    if (!p) {
      wrap.textContent = 'Empty';
      return td;
    }
    // Picture on the left, details beside it; the set's own icon stays as a fallback.
    const pic = pieceImg(p) ?? ('set' in p ? setImg(p.set) : null);
    const info = el('div', undefined, 'piece-info');
    if (pic) {
      wrap.className = 'piece-wrap';
      wrap.append(pic);
    }
    wrap.append(info);
    const set = 'set' in p ? (setNames[p.set] ?? p.set) : '';
    info.append(el('span', [`${p.rarity} ${RANK_STARS[p.rank] ?? '?'}★ +${p.level}`, set && `${set} set`].filter(Boolean).join(' · '), 'piece-head'));
    const stats = [p.mainStat, ...p.subStats].filter((s) => !!s).map((s) => statText(s!.stat, s!.value));
    info.append(el('small', stats.join(', ')));
    if (p.equippedHeroId !== null && p.equippedHeroId !== ownerId && box) {
      const wearer = box.heroes.find((h) => h.id === p.equippedHeroId);
      const name = wearer && data.heroes.find((d) => d.configId === wearer.configId)?.name;
      const badge = el('span', undefined, 'equipped');
      badge.append(el('b', 'Equipped'), ` by ${name ?? 'another Invoker'}`);
      info.append(badge);
    }
    return td;
  }

  const optimiseMemo = new WeakMap<object, Map<string, ReturnType<typeof optimise>>>();
  function renderOptimiser(goal: Tab) {
    const p = OPT[goal];
    const others = $<HTMLInputElement>(`${p}-others`);
    const [kind, key] = heroSel.value.split(':');
    const owned = kind === 'box' ? box?.heroes.find((h) => String(h.id) === key) : undefined;
    const stage = data.stages.find((s) => s.stage === Number(stageSel.value));
    $(`${p}-box`).hidden = !owned || !stage;
    if (!owned || !stage || !box) return;
    // The search is slow on big boxes, so each answer is kept until the box changes.
    const memoKey = [goal, owned.id, goal === 'dps' ? modeSel.value : '', stage.stage, others.checked].join('|');
    let memo = optimiseMemo.get(box);
    if (!memo) optimiseMemo.set(box, (memo = new Map()));
    if (!memo.has(memoKey)) memo.set(memoKey, optimise(data, box, owned, { mode: modeSel.value as Mode, stage, takeFromOthers: others.checked, goal }));
    const r = memo.get(memoKey);
    if (!r) return;
    const gain = r.before > 0 ? r.after / r.before - 1 : 0;
    const setLine = (label: string, l: Loadout) => {
      const li = el('li', label);
      const sets = activeSets(data, l);
      if (!sets.length) li.append(' none');
      sets.forEach((s, i) => {
        const chip = el('span', undefined, 'set-chip');
        const icon = setImg(s.set);
        if (icon) chip.append(icon);
        chip.append(`${setNames[s.set] ?? s.set} ${s.pieces} pieces (${s.tiers.map((n) => `${n}-piece`).join(' + ')} bonus)${i < sets.length - 1 ? ',' : ''}`);
        li.append(chip);
      });
      return li;
    };
    $(`${p}-sets`).replaceChildren(setLine('Set bonuses now:', r.current), setLine('Set bonuses with the best gear:', r.best));
    const what = goal === 'dps' ? 'estimated DPS' : 'effective HP';
    $(`${p}-summary`).textContent = r.changed.length
      ? `Swapping ${r.changed.length} piece${r.changed.length === 1 ? '' : 's'} takes ${what} from ${fmt(r.before)} to ${fmt(r.after)} (+${pct(gain)}).`
      : `This Invoker already wears the gear from your box with the most ${what}.`;
    const slots = openSlots(owned);
    $(`${p}-rows`).replaceChildren(
      ...slots.map((slot) => {
        const tr = document.createElement('tr');
        if (!r.changed.includes(slot)) tr.className = 'same';
        const g = r.gainBySlot[slot];
        const slotTd = el('td', undefined, 'slot-cell');
        const slotSpan = el('span');
        const outline = gearImg(gearIcons[`slot:${slot}`], '');
        if (outline) {
          outline.loading = 'eager';
          slotSpan.append(outline);
        }
        slotSpan.append(slot);
        slotTd.append(slotSpan);
        tr.append(
          slotTd,
          pieceCell(r.current[slot], owned.id),
          r.changed.includes(slot) ? pieceCell(r.best[slot], owned.id) : el('td', 'Keep'),
          g === undefined ? el('td', '', 'num') : el('td', g >= 0.0005 ? `+${pct(g, 1)}` : g <= -0.0005 ? `${pct(g, 1)}` : '+0.0%', g >= 0.0005 ? 'num pos' : 'num'),
        );
        return tr;
      }),
    );
  }

  function renderTabs() {
    for (const t of TABS) {
      const btn = $(`tab-${t}`);
      btn.setAttribute('aria-selected', String(t === tab));
      btn.tabIndex = t === tab ? 0 : -1;
      $(`panel-${t}`).hidden = t !== tab;
    }
    // Mode (PvE or Arena) only changes damage.
    $('d-mode-label').hidden = tab !== 'dps';
  }

  function setTab(next: Tab) {
    tab = next;
    // Sort the picker by what the tab measures, unless a non-score sort was picked.
    if (sortSel.value === 'dps' || sortSel.value === 'tough') sortSel.value = tab === 'dps' ? 'dps' : 'tough';
    const url = new URL(location.href);
    if (tab === 'dps') url.searchParams.delete('tab');
    else url.searchParams.set('tab', tab);
    history.replaceState(null, '', url);
    update();
  }

  const update = () => {
    renderTabs();
    renderPicker();
    render();
    // Only the open tab's gear search runs; it's the slow part.
    renderOptimiser(tab);
  };

  if (tab === 'toughness' && sortSel.value === 'dps') sortSel.value = 'tough';
  box = await loadBox();
  fillHeroes();
  update();
  for (const s of [modeSel, stageSel]) s.addEventListener('change', () => (scoreTiles(), update()));
  for (const t of TABS) {
    $(`${OPT[t]}-others`).addEventListener('change', update);
    $(`tab-${t}`).addEventListener('click', () => setTab(t));
    $(`tab-${t}`).addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const next = TABS[(TABS.indexOf(t) + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
      setTab(next);
      $(`tab-${next}`).focus();
    });
  }
  searchInput.addEventListener('input', () => {
    pickerOpen = true;
    renderPicker();
  });
  sortSel.addEventListener('change', renderPicker);
  sourceSel.addEventListener('change', () => {
    pickerOpen = true;
    buildTiles();
    renderPicker();
  });
  $('d-change').addEventListener('click', () => {
    pickerOpen = !pickerOpen;
    renderPicker();
  });
  onBoxChange(async () => {
    box = await loadBox();
    fillHeroes();
    update();
  });
}
