// Client side of the DPS simulator page: fetches the simulator data, reads the saved box, and re-runs the fight
// whenever a select changes.
import type { BoxHero } from '../box/decode';
import { loadBox, onBoxChange, type BoxDoc } from '../box/store';
import { bareBuild, boxBuild, type Build } from './box';
import { CRIT_RATE_CAP } from './constants';
import { finalStat, skillGains, statValues, type DpsData, type Mode, type SkillSlot } from './model';
import { activeSets, openSlots, optimise, type Loadout, type Piece } from './optimise';

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
  const others = $<HTMLInputElement>('o-others');
  const seconds = Number(root.dataset.seconds);
  const heroSel = $<HTMLSelectElement>('d-hero');
  const modeSel = $<HTMLSelectElement>('d-mode');
  const stageSel = $<HTMLSelectElement>('d-stage');

  let data: DpsData;
  try {
    data = (await (await fetch(`${root.dataset.base!.replace(/\/$/, '')}/dps-data.json`)).json()) as DpsData;
  } catch {
    heroSel.replaceChildren(el('option', "Couldn't load the simulator. Try reloading the page."));
    return;
  }
  let box: BoxDoc | null = null;

  const wanted = new URLSearchParams(location.search).get('hero');

  function fillHeroes() {
    const keep = heroSel.value || (wanted ? `any:${wanted}` : '');
    heroSel.replaceChildren();
    const owned = (box?.heroes ?? [])
      .filter((h) => data.heroes.some((d) => d.configId === h.configId))
      .sort((a, b) => (RANK_STARS[b.rank] ?? 0) - (RANK_STARS[a.rank] ?? 0) || b.level - a.level);
    if (owned.length) {
      const group = document.createElement('optgroup');
      group.label = 'My box (with gear)';
      for (const h of owned) {
        const d = data.heroes.find((x) => x.configId === h.configId)!;
        const o = new Option(`${d.name} · ${RANK_STARS[h.rank] ?? '?'}★ Lv ${h.level}`, `box:${h.id}`);
        group.append(o);
      }
      heroSel.append(group);
    }
    const all = document.createElement('optgroup');
    all.label = 'Any Invoker (6★, fully awakened, no gear)';
    for (const d of data.heroes) all.append(new Option(d.name, `any:${d.slug}`));
    heroSel.append(all);
    if (keep && [...heroSel.options].some((o) => o.value === keep)) heroSel.value = keep;
    else if (wanted) {
      const mine = owned.find((h) => data.heroes.find((x) => x.configId === h.configId)?.slug === wanted);
      heroSel.value = mine ? `box:${mine.id}` : `any:${wanted}`;
    }
    if (heroSel.selectedIndex < 0) heroSel.selectedIndex = 0;
    heroSel.disabled = false;
    $('d-nobox').hidden = owned.length > 0;
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
    const input = { hero: build.hero, totals: build.totals, skillLevels: build.skillLevels, mode: modeSel.value as Mode, stage, seconds };
    const { base, values } = statValues(data, input);
    $('d-out').hidden = false;
    $('d-dps').textContent = fmt(base.dps);
    $('d-total').textContent = `${fmt(base.total)} damage in ${seconds} seconds against stage ${stage.stage} (level ${stage.level}, ${stage.element}, ${fmt(stage.def)} DEF).`;

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
    const set = 'set' in p ? (setNames[p.set] ?? p.set) : '';
    wrap.append(el('span', [`${p.rarity} ${RANK_STARS[p.rank] ?? '?'}★ +${p.level}`, set && `${set} set`].filter(Boolean).join(' · ')));
    const stats = [p.mainStat, ...p.subStats].filter((s) => !!s).map((s) => statText(s!.stat, s!.value));
    wrap.append(el('small', stats.join(', ')));
    if (p.equippedHeroId !== null && p.equippedHeroId !== ownerId && box) {
      const wearer = box.heroes.find((h) => h.id === p.equippedHeroId);
      const name = wearer && data.heroes.find((d) => d.configId === wearer.configId)?.name;
      const badge = el('span', undefined, 'equipped');
      badge.append(el('b', 'Equipped'), ` by ${name ?? 'another Invoker'}`);
      wrap.append(badge);
    }
    return td;
  }

  function renderOptimiser() {
    const [kind, key] = heroSel.value.split(':');
    const owned = kind === 'box' ? box?.heroes.find((h) => String(h.id) === key) : undefined;
    const stage = data.stages.find((s) => s.stage === Number(stageSel.value));
    $('o-box').hidden = !owned || !stage;
    if (!owned || !stage || !box) return;
    const r = optimise(data, box, owned, { mode: modeSel.value as Mode, stage, takeFromOthers: others.checked, seconds });
    if (!r) return;
    const gain = r.before > 0 ? r.after / r.before - 1 : 0;
    const setLine = (l: Loadout) =>
      activeSets(data, l)
        .map((s) => `${setNames[s.set] ?? s.set} ${s.pieces} pieces (${s.tiers.map((n) => `${n}-piece`).join(' + ')} bonus)`)
        .join(', ') || 'none';
    $('o-sets').replaceChildren(
      el('li', `Set bonuses now: ${setLine(r.current)}`),
      el('li', `Set bonuses with the best gear: ${setLine(r.best)}`),
    );
    $('o-summary').textContent = r.changed.length
      ? `Swapping ${r.changed.length} piece${r.changed.length === 1 ? '' : 's'} takes estimated DPS from ${fmt(r.before)} to ${fmt(r.after)} (+${pct(gain)}).`
      : 'This Invoker already wears the best gear your box has for it.';
    const slots = openSlots(owned);
    $('o-rows').replaceChildren(
      ...slots.map((slot) => {
        const tr = document.createElement('tr');
        if (!r.changed.includes(slot)) tr.className = 'same';
        const g = r.gainBySlot[slot];
        tr.append(
          el('td', slot),
          pieceCell(r.current[slot], owned.id),
          r.changed.includes(slot) ? pieceCell(r.best[slot], owned.id) : el('td', 'Keep'),
          g === undefined ? el('td', '', 'num') : el('td', g >= 0.0005 ? `+${pct(g, 1)}` : g <= -0.0005 ? `${pct(g, 1)}` : '+0.0%', g >= 0.0005 ? 'num pos' : 'num'),
        );
        return tr;
      }),
    );
  }

  const update = () => {
    render();
    renderOptimiser();
  };

  box = await loadBox();
  fillHeroes();
  update();
  for (const s of [heroSel, modeSel, stageSel, others]) s.addEventListener('change', update);
  onBoxChange(async () => {
    box = await loadBox();
    fillHeroes();
    update();
  });
}
