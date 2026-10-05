import { describe, expect, it } from 'vitest';
import { formatValue, statChartHtml, statKeys, statSeries } from '../src/lib/statCharts';

describe('stat charts', () => {
  it('finds the breakpoints the stat curves post quotes', () => {
    expect(statSeries('skill-speed')).toMatchObject({ fullRateTo: 50, quarterRateFrom: 199 });
    expect(statSeries('skill-recovery')).toMatchObject({ fullRateTo: 100, quarterRateFrom: 313 });
    expect(statSeries('mana-generation')).toMatchObject({ fullRateTo: 53, quarterRateFrom: 193 });
    expect(statSeries('instinct').cappedAt).toBe(362);
  });

  it('formats values like the post', () => {
    const speed = statSeries('skill-speed');
    expect(formatValue(speed, speed.values[100])).toBe('+16.8%');
    const instinct = statSeries('instinct');
    expect(formatValue(instinct, instinct.values[0])).toBe('30%');
  });

  it('draws every stat without internal names', () => {
    for (const key of statKeys) expect(statChartHtml([key], 'x')).not.toMatch(/Pct|Flat|Factor/);
    expect(() => statChartHtml(['nope'], 'x')).toThrow();
    expect(() => statChartHtml(['skill-speed', 'move-speed'], 'x')).toThrow();
  });
});
