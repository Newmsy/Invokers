// Client side of the DPS simulator page: fetches the simulator data, reads the saved box, and re-runs the fight
// whenever a select changes.
import type { BoxHero } from '../box/decode';
import { loadBox, onBoxChange, type BoxDoc } from '../box/store';
import { bareBuild, boxBuild, type Build } from './box';
import { finalStat, statValues, type DpsData, type Mode, type SkillSlot } from './model';

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
      ['Crit Rate', pct(t.critRate)],
      ['Crit DMG', pct(t.critDmg)],
      ['Skill SPD', fmt(t.skillSpeed)],
      ['Skill RECOV', fmt(t.skillRecovery)],
      ['Combo SPD', fmt(t.comboSpeed)],
      ['Mana Gen', fmt(t.manaGen)],
    ];
    $('d-stats').replaceChildren(...stats.flatMap(([k, v]) => [el('dt', k), el('dd', v)]));

    $('d-sources').replaceChildren(
      ...base.sources
        .filter((s) => s.damage > 0)
        .map((s) => row(SOURCE[s.slot], [fmt(s.casts), 'num'], [fmt(s.damage), 'num'], [pct(base.total ? s.damage / base.total : 0), 'num'])),
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

  box = await loadBox();
  fillHeroes();
  render();
  for (const s of [heroSel, modeSel, stageSel]) s.addEventListener('change', render);
  onBoxChange(async () => {
    box = await loadBox();
    fillHeroes();
    render();
  });
}
