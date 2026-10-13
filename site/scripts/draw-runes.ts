// Draws src/assets/runes.svg (run: node scripts/draw-runes.ts src/assets/runes.svg): faint rune circles and swirls for the page background.
import { writeFileSync } from 'node:fs';
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const f = (n: number) => +n.toFixed(1);
const pt = (cx: number, cy: number, r: number, a: number) => [f(cx + r * Math.cos(a)), f(cy + r * Math.sin(a))];

// A rune: 2-4 straight strokes inside a small box, like an angular futhark letter.
function glyph(x: number, y: number, s: number, rot: number) {
  const pts: number[][] = [[0, -1], [0, 1], [-0.6, -0.5], [0.6, -0.5], [-0.6, 0.4], [0.6, 0.4], [-0.6, -1], [0.6, -1], [0.6, 1], [-0.6, 1]];
  const d = ['M0 -1 L0 1'];
  const n = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const a = pts[Math.floor(rnd() * pts.length)], b = pts[Math.floor(rnd() * pts.length)];
    if (a === b) continue;
    d.push(`M${a[0]} ${a[1]} L${b[0]} ${b[1]}`);
  }
  return `<path transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)}) scale(${s})" d="${d.join(' ')}" vector-effect="non-scaling-stroke"/>`;
}

function circle(cx: number, cy: number, r: number) {
  const out: string[] = [];
  out.push(`<circle cx="${cx}" cy="${cy}" r="${r}"/>`, `<circle cx="${cx}" cy="${cy}" r="${f(r * 0.86)}"/>`);
  // Runes around the band between the two rings.
  const n = Math.round(r / 9);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const [x, y] = pt(cx, cy, r * 0.93, a);
    out.push(glyph(x, y, f(r * 0.035), (a * 180) / Math.PI + 90));
  }
  // Inner star: two overlapping polygons.
  for (const [k, off] of [[6, 0], [6, Math.PI / 6]]) {
    const p = Array.from({ length: k }, (_, i) => pt(cx, cy, r * 0.7, off + (i / k) * Math.PI * 2).join(' '));
    out.push(`<polygon points="${p.join(' ')}"/>`);
  }
  out.push(`<circle cx="${cx}" cy="${cy}" r="${f(r * 0.6)}" stroke-dasharray="2 6"/>`, `<circle cx="${cx}" cy="${cy}" r="${f(r * 0.24)}"/>`);
  // Ticks on the outer ring.
  const ticks: string[] = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2, [x1, y1] = pt(cx, cy, r, a), [x2, y2] = pt(cx, cy, r * (i % 6 ? 1.02 : 1.05), a);
    ticks.push(`M${x1} ${y1}L${x2} ${y2}`);
  }
  out.push(`<path d="${ticks.join('')}"/>`);
  return out.join('');
}

// A swirl: a loose spiral that unwinds into a long tail.
function swirl(cx: number, cy: number, r: number, turns: number, dir: number, rot: number) {
  const pts: number[][] = [];
  for (let i = 0; i <= 120; i++) {
    const t = i / 120, a = rot + dir * t * turns * Math.PI * 2, rr = r * Math.pow(t, 1.6);
    pts.push(pt(cx, cy, rr, a));
  }
  return `<path d="M${pts.map((p) => p.join(' ')).join('L')}"/>`;
}

const W = 1600, H = 1000;
const body = [
  `<g opacity="0.75">${circle(170, 790, 250)}</g>`,
  circle(1460, 210, 190),
  `<g opacity="0.6">${circle(1330, 880, 95)}</g>`,
  `<g opacity="0.55">${circle(330, 150, 70)}</g>`,
  swirl(560, 900, 220, 2.2, 1, 0.4),
  swirl(1180, 380, 180, 1.8, -1, 2.2),
  swirl(90, 360, 120, 1.6, 1, 4.1),
  swirl(1530, 620, 110, 1.5, -1, 1),
  `<path d="M420 790 C 620 700, 760 980, 1010 920 S 1300 760, 1240 880"/>`,
  `<path d="M1270 210 C 1100 120, 980 260, 820 180 S 560 60, 400 150"/>`,
].join('\n');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" fill="none" stroke="#EBB84C" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">\n${body}\n</svg>\n`;
writeFileSync(process.argv[2], svg);
console.log(svg.length);
