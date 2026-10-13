// Draws src/assets/runes.svg, the faint background layer of engraved sigils, runes, constellations and vines
// (run: node scripts/draw-runes.ts src/assets/runes.svg). Seeded, so the output only changes when this file does.
import { writeFileSync } from 'node:fs';

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const f = (n: number) => +n.toFixed(1);
const TAU = Math.PI * 2;
const pt = (cx: number, cy: number, r: number, a: number): [number, number] => [f(cx + r * Math.cos(a)), f(cy + r * Math.sin(a))];
const deg = (a: number) => f((a * 180) / Math.PI);

// Rune letters as strokes in a box 1 wide and 2 tall, centred on 0,0.
const RUNES = [
  'M-.3 1V-1M-.3-.2L.4-.7M-.3.3L.4-.2', 'M-.4 1V-1L.4-.4V1', 'M-.3-1V1M-.3-.5L.3 0-.3.5', 'M-.3 1V-1L.3-.5M-.3-.5L.3 0',
  'M-.3 1V-1L.3-.5-.3 0 .3 1', 'M.3-.6L-.3 0 .3.6', 'M-.5-1L.5 1M.5-1L-.5 1', 'M-.3 1V-1L.3-.6-.3-.2',
  'M-.3-1V1M.3-1V1M-.3-.3L.3.3', 'M0-1V1M-.3-.3L.3.3', 'M0-1V1', 'M-.1-.6L-.4-.2-.1.2M.1-.2L.4.2.1.6',
  'M0-1V1M0-1L.3-.7M0 1L-.3.7', 'M-.3-1V1M-.3-1L.3-.6M-.3 1L.3.6', 'M0-1V1M-.4-.6L0-.1.4-.6', 'M.3-1L-.3-.3.3.3-.3 1',
  'M0-1V1M-.4-.5L0-1 .4-.5', 'M-.3-1V1M-.3-1L.3-.5-.3 0 .3.5-.3 1', 'M-.4 1V-1L0-.4.4-1V1', 'M-.4 1V-1L.4-.2M.4 1V-1L-.4-.2',
  'M-.2 1V-1L.3-.5', 'M0-.6L.4 0 0 .6-.4 0Z', 'M-.4-1V1L.4-1V1Z', 'M0-1L.35-.4-.35.4-.1 1M0-1L-.35-.4.35.4.1 1',
];
const rune = (x: number, y: number, h: number, rot: number, i = Math.floor(rnd() * RUNES.length), w = Math.max(1.6, h * 0.16)) =>
  `<path transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${f(h / 2)})" d="${RUNES[i % RUNES.length]}" stroke-width="${f(w)}" vector-effect="non-scaling-stroke"/>`;

/** A star polygon {n/k} as a path. */
function star(cx: number, cy: number, r: number, n: number, k: number, rot: number) {
  const pts = Array.from({ length: n }, (_, i) => pt(cx, cy, r, rot + (i * k * TAU) / n));
  return `M${pts.map((p) => p.join(' ')).join('L')}Z`;
}
const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const [x0, y0] = pt(cx, cy, r, a0), [x1, y1] = pt(cx, cy, r, a1);
  return `M${x0} ${y0}A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
};
const ring = (cx: number, cy: number, r: number, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${f(r)}"${extra}/>`;
const sw = (w: number) => ` stroke-width="${f(w)}"`;
const FILL = ' fill="#EBB84C" fill-opacity="0.16"';
const SOLID = ' fill="#EBB84C" stroke="none"';
/** A filled ring between two radii (the engraved band runes sit in). */
const band = (cx: number, cy: number, r0: number, r1: number, op: number) => {
  const c = (r: number) => `M${f(cx + r)} ${cy}A${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${cy}A${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${cy}Z`;
  return `<path d="${c(r0)}${c(r1)}" fill="#EBB84C" fill-opacity="${op}" fill-rule="evenodd" stroke="none"/>`;
};
/** Two interlaced waves round a circle, like a braided cord. */
function braid(cx: number, cy: number, r: number, amp: number, lobes: number, w: number) {
  const wave = (sign: number) => {
    const pts = Array.from({ length: 361 }, (_, i) => { const a = (i / 360) * TAU; return pt(cx, cy, r + sign * amp * Math.sin(lobes * a), a); });
    return `<path d="M${pts.map((p) => p.join(' ')).join('L')}Z"${sw(w)}/>`;
  };
  return wave(1) + wave(-1);
}

type Inner = 'hexagram' | 'pentagram' | 'octagram' | 'triad' | 'squares' | 'eye';

/** A sigil: a heavy double outer ring with ticks, an engraved band of bold runes, a filled inner star with a
 *  glow behind it, solid nodes on its points, and either a braided cord or broken arcs outside. */
function sigil(cx: number, cy: number, r: number, inner: Inner, rot = rnd() * TAU, outer: 'braid' | 'arcs' = 'arcs') {
  const w = Math.max(1.5, r / 45);
  const out: string[] = [ring(cx, cy, r * 0.8, ' fill="url(#glow)" stroke="none"'), band(cx, cy, r * 0.84, r, 0.12)];
  out.push(ring(cx, cy, r, sw(w * 2.6)), ring(cx, cy, r * 1.035, sw(w * 0.7)), ring(cx, cy, r * 0.84, sw(w * 1.6)), ring(cx, cy, r * 0.81, sw(w * 0.6)));
  const n = Math.round((r * 0.92 * TAU) / (r * 0.17));
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU, [x, y] = pt(cx, cy, r * 0.92, a);
    out.push(rune(x, y, r * 0.1, deg(a) + 90, undefined, w * 1.3));
  }
  const ticks: string[] = [];
  for (let i = 0; i < 72; i++) {
    const a = rot + (i / 72) * TAU, [x1, y1] = pt(cx, cy, r * 1.035, a), [x2, y2] = pt(cx, cy, r * (i % 6 ? 1.06 : 1.1), a);
    ticks.push(`M${x1} ${y1}L${x2} ${y2}`);
  }
  out.push(`<path d="${ticks.join('')}"${sw(w)}/>`);
  const ri = r * 0.74;
  const points = (k: number, off = 0) => Array.from({ length: k }, (_, i) => pt(cx, cy, ri, rot + off + (i * TAU) / k));
  const nodes = (ps: [number, number][], s: number) => ps.map(([x, y]) => ring(x, y, s, SOLID)).join('');
  // Each star: a filled shape with a heavy outline, then a thin echo just inside it.
  const starred = (d: string, echo: string) => `<path d="${d}"${FILL} fill-rule="evenodd"${sw(w * 1.8)}/><path d="${echo}"${sw(w * 0.6)}/>`;
  if (inner === 'hexagram') out.push(starred(star(cx, cy, ri, 6, 2, rot) + star(cx, cy, ri, 6, 2, rot + Math.PI / 3), star(cx, cy, ri * 0.88, 6, 2, rot) + star(cx, cy, ri * 0.88, 6, 2, rot + Math.PI / 3)), nodes(points(6), r * 0.045), ring(cx, cy, ri * 0.32, sw(w * 1.4)));
  if (inner === 'pentagram') out.push(starred(star(cx, cy, ri, 5, 2, rot), star(cx, cy, ri * 0.86, 5, 2, rot)), nodes(points(5), r * 0.06), ring(cx, cy, ri * 0.38, sw(w)));
  if (inner === 'octagram') out.push(starred(star(cx, cy, ri, 8, 3, rot), star(cx, cy, ri * 0.9, 8, 3, rot)), ring(cx, cy, ri * 0.42, sw(w * 1.4)), band(cx, cy, ri * 0.3, ri * 0.42, 0.18), nodes(points(8), r * 0.03));
  if (inner === 'triad') {
    out.push(starred(star(cx, cy, ri, 3, 1, rot) + star(cx, cy, ri, 3, 1, rot + Math.PI), star(cx, cy, ri * 0.85, 3, 1, rot) + star(cx, cy, ri * 0.85, 3, 1, rot + Math.PI)), ring(cx, cy, ri * 0.5, sw(w * 1.4)));
    for (const [x, y] of points(3)) out.push(ring(x, y, r * 0.13, ` fill="#110E0A"${sw(w * 1.6)}`), rune(x, y, r * 0.13, 0, undefined, w * 1.6));
  }
  if (inner === 'squares') out.push(starred(star(cx, cy, ri, 4, 1, rot) + star(cx, cy, ri, 4, 1, rot + Math.PI / 4), star(cx, cy, ri * 0.5, 4, 1, rot)), ring(cx, cy, ri * 0.71, ` stroke-dasharray="${f(w)} ${f(w * 3)}"${sw(w)}`));
  if (inner === 'eye') {
    const [ax, ay] = pt(cx, cy, ri, rot), [bx, by] = pt(cx, cy, ri, rot + Math.PI);
    out.push(`<path d="M${ax} ${ay}Q${pt(cx, cy, ri * 0.9, rot + Math.PI / 2).join(' ')} ${bx} ${by}Q${pt(cx, cy, ri * 0.9, rot - Math.PI / 2).join(' ')} ${ax} ${ay}Z"${FILL}${sw(w * 1.8)}/>`, ring(cx, cy, ri * 0.3, sw(w * 1.6)), ring(cx, cy, ri * 0.14, SOLID));
  }
  out.push(ring(cx, cy, r * 0.07, SOLID));
  if (outer === 'braid') out.push(braid(cx, cy, r * 1.17, r * 0.035, Math.round(r / 9), w * 1.1));
  else {
    // Broken arcs just outside the ring, a different pattern on each sigil, with a dot at each break.
    const arcs: string[] = [], dots: string[] = [];
    let a = rot;
    while (a < rot + TAU - 0.3) {
      const len = 0.25 + rnd() * 0.9, b = Math.min(a + len, rot + TAU - 0.15);
      arcs.push(arc(cx, cy, r * 1.16, a, b));
      const [x, y] = pt(cx, cy, r * 1.16, b + 0.06);
      dots.push(ring(x, y, w * 1.2, SOLID));
      a += len + 0.12 + rnd() * 0.35;
    }
    out.push(`<path d="${arcs.join('')}"${sw(w * 1.8)}/>`, ...dots);
  }
  return `<g>${out.join('')}</g>`;
}

/** Stars joined by thin lines, the brightest drawn as a four-point sparkle. */
function constellation(pts: [number, number][], links: [number, number][]) {
  const out = [`<path stroke-width="1.8" stroke-dasharray="1 5" d="${links.map(([i, j]) => `M${pts[i].join(' ')}L${pts[j].join(' ')}`).join('')}"/>`];
  pts.forEach(([x, y], i) => {
    out.push(ring(x, y, 16, ' fill="url(#glow)" stroke="none"'));
    out.push(i === 0 ? sparkle(x, y, 16) : ring(x, y, f(3 + rnd() * 2.5), SOLID));
  });
  return out.join('');
}
const sparkle = (x: number, y: number, s: number) =>
  `<path fill="#EBB84C" stroke="none" d="M${x} ${f(y - s)}Q${x} ${y} ${f(x + s)} ${y}Q${x} ${y} ${x} ${f(y + s)}Q${x} ${y} ${f(x - s)} ${y}Q${x} ${y} ${x} ${f(y - s)}Z"/>`;

/** A leaf shape pointing along angle a from x,y. */
function leaf(x: number, y: number, a: number, len: number) {
  const tip = pt(x, y, len, a), c1 = pt(x, y, len * 0.55, a + 0.45), c2 = pt(x, y, len * 0.55, a - 0.45);
  return `<path d="M${f(x)} ${f(y)}Q${c1.join(' ')} ${tip.join(' ')}Q${c2.join(' ')} ${f(x)} ${f(y)}Z"${FILL.replace('0.16', '0.5')} stroke-width="1.6"/>`;
}

/** A flourish: a long S-curve sampled from a few control points, ending in a curl, with leaves and runes riding along it. */
function flourish(ctrl: [number, number][], curl: number, runeEvery = 0 /* px between runes; 0 for none */) {
  // Catmull-Rom through the control points.
  const pts: [number, number][] = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(i - 1, 0)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(i + 2, ctrl.length - 1)];
    for (let t = 0; t < 1; t += 1 / 40) {
      const t2 = t * t, t3 = t2 * t;
      const c = (k: 0 | 1) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      pts.push([f(c(0)), f(c(1))]);
    }
  }
  const end = ctrl[ctrl.length - 1], prev = pts[pts.length - 1];
  const heading = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
  // Curl: a tightening spiral that continues the line's heading.
  const dir = curl > 0 ? 1 : -1, R = Math.abs(curl);
  const centre = pt(end[0], end[1], R, heading + dir * Math.PI / 2);
  for (let i = 0; i <= 60; i++) {
    const t = i / 60, a = heading - dir * Math.PI / 2 + dir * t * 1.6 * TAU;
    pts.push(pt(centre[0], centre[1], R * (1 - 0.8 * t), a));
  }
  const line = `M${pts.map((p) => p.join(' ')).join('L')}`;
  const out = [`<path d="${line}" stroke-width="10" stroke-opacity="0.22"/>`, `<path d="${line}" stroke-width="3.2"/>`];
  // Leaves on alternating sides every so often, and a solid bud in the curl.
  let run = 0, side = 1;
  for (let i = 1; i < pts.length - 62; i++) {
    run += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (run < (runeEvery ? 120 : 45)) continue;
    run = 0; side = -side;
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i + 1], a = Math.atan2(y1 - y0, x1 - x0) + side * 0.9;
    out.push(leaf(pts[i][0], pts[i][1], a, 22));
  }
  const bud = pts[pts.length - 1];
  out.push(ring(bud[0], bud[1], 5, SOLID));
  if (runeEvery) {
    // Evenly spaced along the line (by length), stopping before the curl.
    let run = 0;
    for (let i = 1; i < pts.length - 62; i++) {
      run += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (run < runeEvery) continue;
      run = 0;
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i + 1], a = Math.atan2(y1 - y0, x1 - x0);
      const [x, y] = pt(pts[i][0], pts[i][1], 18, a - Math.PI / 2);
      out.push(rune(x, y, 14, deg(a), undefined, 2.4));
    }
  }
  return out.join('');
}

const W = 1600, H = 1000;
const body = [
  // Left margin
  sigil(170, 720, 200, 'hexagram', undefined, 'braid'),
  sigil(255, 140, 78, 'pentagram'),
  `<g transform="rotate(-8 120 420)">${constellation([[60, 470], [120, 390], [205, 410], [250, 340], [300, 380], [150, 500]], [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 0]])}</g>`,
  flourish([[-20, 300], [60, 250], [40, 180], [110, 150]], 22),
  // Right margin
  sigil(1440, 250, 165, 'octagram'),
  sigil(1370, 830, 118, 'triad', undefined, 'braid'),
  sigil(1545, 590, 52, 'eye'),
  constellation([[1300, 530], [1355, 470], [1420, 500], [1470, 440], [1395, 590], [1330, 640]], [[0, 1], [1, 2], [2, 3], [2, 4], [4, 5], [5, 0]]),
  flourish([[1620, 960], [1520, 990], [1480, 930], [1560, 880]], -24),
  // Through the middle (seen between and below panels)
  flourish([[380, 860], [560, 760], [760, 960], [980, 880], [1180, 960]], 30, 24),
  flourish([[1250, 120], [1060, 40], [860, 150], [640, 70], [470, 110]], -26, 24),
  sigil(820, 520, 60, 'squares'),
  sparkle(560, 300, 12), sparkle(1080, 640, 10), sparkle(700, 960, 9), sparkle(1220, 380, 9),
].join('\n');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" fill="none" stroke="#EBB84C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n<defs><radialGradient id="glow"><stop offset="0" stop-color="#EBB84C" stop-opacity="0.35"/><stop offset="1" stop-color="#EBB84C" stop-opacity="0"/></radialGradient></defs>\n${body}\n</svg>\n`;
writeFileSync(process.argv[2] ?? 'src/assets/runes.svg', svg);
