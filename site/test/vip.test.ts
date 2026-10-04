import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loginDaysFor, maxVip, vipLevels, vipPasses, vipPointsPerUsd } from '../src/lib/vip';

// The VIP levels post is a hand-written table. These checks fail when the VIP data changes, so the post gets updated.
const post = readFileSync(new URL('../src/content/blog/vip-levels.md', import.meta.url), 'utf8');
const cells = (line: string) => line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
const table = (heading: string) =>
  post
    .split(`## ${heading}`)[1]
    .split('\n## ')[0]
    .split('\n')
    .filter((l) => /^\| \d/.test(l))
    .map(cells);

const num = (n: number) => n.toLocaleString('en-US');
const pct = (f: number) => (f ? `+${Math.round(f * 100)}%` : '—');
const runes = (m: number) => (m > 1 ? `×${+m.toFixed(2)}` : '—');
function loginCell(points: number) {
  if (!points) return '—';
  const days = loginDaysFor(points);
  return days < 700 ? `${days} days` : undefined;
}

describe('VIP levels post vs VIP data', () => {
  const rows = table('Every level');

  it('has one row per level', () => {
    expect(rows.map((r) => Number(r[0]))).toEqual(vipLevels.map((l) => l.level));
  });

  it('matches points, cost and boosts', () => {
    for (const [i, l] of vipLevels.entries()) {
      const r = rows[i];
      expect(r[1], `VIP ${l.level} points`).toBe(num(l.points));
      expect(r[2], `VIP ${l.level} cost`).toBe(l.points ? num(l.points / vipPointsPerUsd) : '—');
      expect(r[4], `VIP ${l.level} gold`).toBe(pct(l.gold));
      expect(l.xp).toBe(l.gold);
      expect(r[5], `VIP ${l.level} Memorium`).toBe(pct(l.memorium));
      expect(r[6], `VIP ${l.level} runes`).toBe(runes(l.runeDrops));
      expect(r[7], `VIP ${l.level} battle`).toBe(pct(l.battleStats));
      if (l.freePassDays !== undefined) expect(r[8], `VIP ${l.level} free days`).toBe(String(l.freePassDays));
    }
  });

  it('matches login days (years within rounding)', () => {
    for (const [i, l] of vipLevels.entries()) {
      const expected = loginCell(l.points);
      if (expected !== undefined) expect(rows[i][3]).toBe(expected);
      else expect(Number.parseFloat(rows[i][3])).toBeCloseTo(loginDaysFor(l.points) / 365, 0);
    }
  });

  it('matches the VIP pass prices', () => {
    for (const p of vipPasses) expect(post).toContain(`| ${p.days} day${p.days > 1 ? 's' : ''} | ${num(p.gems)} |`);
  });

  it('matches the headline numbers', () => {
    expect(post).toContain(`**${num(maxVip.points)} points**`);
    expect(post).toContain(`$${num(maxVip.points / vipPointsPerUsd)}`);
    expect(post).toContain(`${vipPointsPerUsd} VIP points per $1`);
  });

  it('places the keyed perks where the post says', () => {
    expect(vipLevels.find((l) => l.chatBadge)?.level).toBe(2);
    expect(vipLevels.find((l) => l.autoCompleteDailyQuests)?.level).toBe(8);
    expect(vipLevels.filter((l) => l.avatarFrame).map((l) => l.level)).toEqual([1, 5, 9, 13, 17, 21]);
  });
});
