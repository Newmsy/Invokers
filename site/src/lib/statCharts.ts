// Line charts of what a stat rating turns into, drawn as static SVG from data/stat_curves.json at build time.
// Blog posts place one with ![Caption](curve:skill-speed), or several stats on one chart with
// ![Caption](curve:skill-speed,skill-recovery,mana-generation) when they share a scale (lib/markdown-charts.ts).
// A small script on the post page adds a hover readout (components/ChartHover.astro).
import curvesJson from '../../../data/stat_curves.json';

interface Curve { id: string; values: number[] }
const curves = (curvesJson as unknown as { curves: Curve[] }).curves;

export const MAX_RATING = 800;

interface StatDef {
  name: string;
  curve: string;
  /** What the y axis shows. */
  axis: string;
  /** Curve value → what the chart plots. */
  map: (v: number) => number;
  unit: '%' | '';
  /** Signed values ("+12.5%") rather than plain ones ("53%"). */
  plus: boolean;
  /** Mark where the opening rate ends and where gains drop to a quarter of it. */
  knee: boolean;
}

const stats: Record<string, StatDef> = {
  'skill-speed': { name: 'Skill Speed', curve: 'SkillSpeedFactorPct', axis: 'Faster skills and combos', map: (v) => v, unit: '%', plus: true, knee: true },
  'skill-recovery': { name: 'Skill Recovery', curve: 'SkillRecoveryPct', axis: 'Faster cooldowns', map: (v) => v, unit: '%', plus: true, knee: true },
  'mana-generation': { name: 'Mana Generation', curve: 'ManaRegenRecoveryPct', axis: 'More Ultimate mana', map: (v) => v, unit: '%', plus: true, knee: true },
  instinct: { name: 'Instinct', curve: 'InstinctFactorPct01', axis: 'Dodge chance', map: (v) => v * 100, unit: '%', plus: false, knee: false },
  defense: { name: 'Defense', curve: 'DefenseFactor', axis: 'Damage blocked', map: (v) => (1 - v) * 100, unit: '%', plus: false, knee: false },
  'move-speed': { name: 'Move Speed', curve: 'RunSpeed', axis: 'Run speed bonus', map: (v) => v, unit: '', plus: true, knee: true },
};

export const statKeys = Object.keys(stats);

export interface StatSeries {
  key: string;
  name: string;
  axis: string;
  unit: '%' | '';
  plus: boolean;
  /** Plotted value at every rating from 0 to MAX_RATING. */
  values: number[];
  /** Last rating where each point still gives the opening rate. */
  fullRateTo?: number;
  /** First rating where each point gives under a quarter of the opening rate. */
  quarterRateFrom?: number;
  /** First rating where the value reaches 100%. */
  cappedAt?: number;
}

/** One stat's curve from 0 to MAX_RATING, with its breakpoints. Throws on an unknown stat. */
export function statSeries(key: string): StatSeries {
  const def = stats[key];
  if (!def) throw new Error(`Unknown stat "${key}" (known: ${statKeys.join(', ')})`);
  const curve = curves.find((c) => c.id === def.curve);
  if (!curve) throw new Error(`No curve for ${def.name}`);
  const values = curve.values.slice(0, MAX_RATING + 1).map(def.map);
  const series: StatSeries = { key, name: def.name, axis: def.axis, unit: def.unit, plus: def.plus, values };
  if (def.knee) {
    // The opening rate is steady over the first 20 points; values are rounded to one decimal, hence the slack.
    const rate = (values[20] - values[0]) / 20;
    let to = 0;
    while (to < MAX_RATING && Math.abs(values[to + 1] - values[0] - (to + 1) * rate) <= 0.051) to++;
    series.fullRateTo = to;
    // Averaged over 10 points, which smooths out the rounding steps.
    const from = values.findIndex((v, i) => i + 10 <= MAX_RATING && (values[i + 10] - v) / 10 < rate / 4);
    if (from > 0) series.quarterRateFrom = from;
  }
  const capped = values.findIndex((v) => v >= 100 - 1e-9);
  if (def.unit === '%' && !def.plus && capped >= 0) series.cappedAt = capped;
  return series;
}

/** A value as the post shows it: "+16.8%", "53%", "+6.5". */
export function formatValue(s: Pick<StatSeries, 'unit' | 'plus'>, v: number): string {
  if (v === 0) return `0${s.unit}`;
  const dp = s.unit === '%' && !s.plus ? (Number.isInteger(Math.round(v * 10) / 10) ? 0 : 1) : 1;
  const text = v.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  return `${s.plus && v > 0 ? '+' : ''}${text}${s.unit}`;
}

// Categorical order for several stats on one chart (checked for colour-blind separation on the site background).
const seriesColors = ['#3987e5', '#d95926', '#199e70'];

const W = 640;
const H = 300;
const pad = { l: 54, r: 14, t: 24, b: 40 };
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r1 = (n: number) => Math.round(n * 10) / 10;

function niceMax(top: number): { max: number; step: number } {
  for (const step of [1, 2, 2.5, 5, 10, 20, 25, 50]) {
    if (top / step <= 6) return { max: Math.ceil(top / step - 1e-9) * step, step };
  }
  return { max: Math.ceil(top / 100) * 100, step: 100 };
}

/** The chart for one or more stats, as an inline <span> holding the SVG and its caption (valid inside a paragraph). */
export function statChartHtml(keys: string[], caption: string): string {
  const series = keys.map(statSeries);
  const multi = series.length > 1;
  if (multi && series.some((s) => s.unit !== series[0].unit)) throw new Error(`Stats on one chart must share a unit: ${keys.join(', ')}`);
  if (series.length > seriesColors.length) throw new Error(`At most ${seriesColors.length} stats on one chart`);
  const top = Math.max(...series.flatMap((s) => s.values));
  const { max, step } = niceMax(series.some((s) => s.cappedAt != null) ? 100 : top);
  const pw = W - pad.l - pad.r;
  const ph = H - pad.t - pad.b;
  const x = (rating: number) => r1(pad.l + (rating / MAX_RATING) * pw);
  const y = (v: number) => r1(pad.t + ph - (v / max) * ph);
  const yFmt = (v: number) => `${v}${series[0].unit}`;
  const parts: string[] = [];
  let markNote = '';

  // Grid and axes: recessive, horizontal lines only.
  for (let v = 0; v <= max + 1e-9; v += step) {
    parts.push(`<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}"/>`);
    parts.push(`<text class="tick" x="${pad.l - 6}" y="${y(v) + 4}" text-anchor="end">${yFmt(v)}</text>`);
  }
  for (let r = 0; r <= MAX_RATING; r += 100) {
    parts.push(`<text class="tick" x="${x(r)}" y="${H - pad.b + 18}" text-anchor="middle">${r}</text>`);
  }
  parts.push(`<text class="tick" x="${W - pad.r}" y="${H - 4}" text-anchor="end">Rating</text>`);

  // Breakpoints (single-stat charts): where the full rate ends and where gains fall to a quarter.
  if (!multi) {
    const s = series[0];
    const marks: { at: number; label: string }[] = [];
    if (s.fullRateTo) marks.push({ at: s.fullRateTo, label: `Full rate to ${s.fullRateTo}` });
    if (s.quarterRateFrom && s.quarterRateFrom - (s.fullRateTo ?? 0) > 40) marks.push({ at: s.quarterRateFrom, label: `¼ rate from ${s.quarterRateFrom}` });
    if (s.cappedAt != null) marks.push({ at: s.cappedAt, label: `Maxed at ${s.cappedAt}` });
    marks.forEach((m, i) => {
      const v = s.values[m.at];
      parts.push(`<line class="mark" x1="${x(m.at)}" x2="${x(m.at)}" y1="${pad.t}" y2="${pad.t + ph}"/>`);
      // A cap sits on the top line, so its label goes in the empty space below the flat part instead.
      const capped = m.at === s.cappedAt;
      parts.push(`<text class="mark-label" x="${x(m.at) + 6}" y="${capped ? pad.t + ph / 2 : pad.t + 12 + (i % 2) * 18}">${esc(m.label)}</text>`);
      if (!capped) parts.push(`<text class="value" x="${x(m.at) + 8}" y="${y(v) + 16}">${formatValue(s, v)}</text>`);
    });
    // Phones hide the in-chart labels, so the caption names the dashed lines too.
    if (marks.length) markNote = `Dashed lines: ${marks.map((m) => m.label[0].toLowerCase() + m.label.slice(1)).join(', ')}.`;
  }

  series.forEach((s, i) => {
    const color = multi ? seriesColors[i] : 'var(--accent)';
    const d = s.values.filter((_, r) => r % 2 === 0 || r === MAX_RATING).map((v, j, a) => `${j ? 'L' : 'M'}${x(j === a.length - 1 ? MAX_RATING : j * 2)} ${y(v)}`).join('');
    parts.push(`<path class="line" d="${d}" stroke="${color}"/>`);
    const end = s.values[MAX_RATING];
    // Direct label at the end of each line, in text ink; the dot carries the colour.
    parts.push(`<circle class="dot" cx="${x(MAX_RATING)}" cy="${y(end)}" r="4" fill="${color}"/>`);
    parts.push(`<text class="value" x="${x(MAX_RATING) - 8}" y="${y(end) - 10}" text-anchor="end">${multi ? `${esc(s.name)} ` : ''}${formatValue(s, end)}</text>`);
    if (!multi) {
      for (const m of [s.fullRateTo, s.quarterRateFrom, s.cappedAt]) {
        if (m != null && m > 0) parts.push(`<circle class="dot" cx="${x(m)}" cy="${y(s.values[m])}" r="4" fill="${color}"/>`);
      }
    }
  });

  // Hover readout data: every 5 points of rating is plenty for the crosshair.
  const hover = series.map((s, i) => ({
    name: s.name,
    color: multi ? seriesColors[i] : '',
    unit: s.unit,
    plus: s.plus,
    v: s.values.filter((_, r) => r % 5 === 0).map(r1),
  }));
  const label = `${caption}. ${series.map((s) => `${s.name}: ${formatValue(s, s.values[100])} at 100 rating, ${formatValue(s, s.values[400])} at 400, ${formatValue(s, s.values[MAX_RATING])} at 800`).join('; ')}.`;
  const legend = multi
    ? `<span class="chart-legend">${series.map((s, i) => `<span><i style="background:${seriesColors[i]}"></i>${esc(s.name)}</span>`).join('')}</span>`
    : '';
  return (
    `<span class="stat-chart" data-series="${esc(JSON.stringify(hover))}" data-max="${MAX_RATING}" data-pad="${pad.l},${pad.r},${W}">` +
    `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${parts.join('')}` +
    `<line class="cross" x1="0" x2="0" y1="${pad.t}" y2="${pad.t + ph}" visibility="hidden"/></svg>` +
    `<span class="chart-tip" hidden></span>` +
    `<span class="chart-caption">${legend}<span>${esc(caption)}${markNote ? `<span class="mark-note">. ${esc(markNote)}</span>` : ''}</span></span></span>`
  );
}
