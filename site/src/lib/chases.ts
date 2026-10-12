// Chase calendar helpers: every chase (past ones from data/chases.json, live ones from the event list) and the
// day-by-day schedule of the tournaments that pay into the current chase. Shared by the page and the tests.
import type { GameEvent } from './data';

const DAY = 86_400_000;

export interface Chase {
  /** "Grimnall Chase". */
  name: string;
  /** What the chase is called for short: "Grimnall". */
  short: string;
  /** Hero id of the chase Invoker. */
  hero: string;
  start: string;
  end: string;
  /** Item id of the chase currency. */
  currency: string;
  registrationEnd?: string;
  /** When leftover currency is spent for you. */
  rewardPeriodEnd?: string;
  /** Currency on offer from every activity milestone. */
  total?: number;
  /** Shop price of the chase Invoker. */
  heroPrice?: number;
  story?: string;
  /** The live event, when the chase is still on the event list. */
  event?: GameEvent;
}

/** The hero a chase shop sells, by exact config id (the raw JSON rounds it, so compare as numbers). */
function shopHero(e: GameEvent, heroIdByConfigId: (configId: number) => string | undefined) {
  for (const item of e.shopItems ?? []) {
    for (const r of item.reward) {
      if ('kind' in r && r.details[0]) {
        const id = heroIdByConfigId(r.details[0].configId);
        if (id) return { id, price: item.price };
      }
    }
  }
  return undefined;
}

/** Every chase, oldest first. Live chases replace the stored entry for the same hero. */
export function allChases(stored: Chase[], events: GameEvent[], heroIdByConfigId: (configId: number) => string | undefined): Chase[] {
  const out = new Map(stored.map((c) => [c.hero, { ...c }]));
  for (const e of events.filter((x) => x.type === 'GetLegendary')) {
    const hero = shopHero(e, heroIdByConfigId);
    if (!hero) continue;
    out.set(hero.id, {
      ...out.get(hero.id),
      hero: hero.id,
      name: e.name,
      short: e.name.replace(/\s+Chase$/, ''),
      start: e.start,
      end: e.end,
      currency: e.shopCurrency ?? out.get(hero.id)?.currency ?? '',
      registrationEnd: e.registrationEnd,
      rewardPeriodEnd: e.rewardPeriodEnd,
      total: (e.progressRewards ?? []).reduce((n, r) => n + r.reward.reduce((m, x) => m + ('amount' in x ? x.amount : 0), 0), 0),
      heroPrice: hero.price,
      event: e,
    });
  }
  return [...out.values()].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

/** The chase on now, else the next one, else the latest. */
export function featuredChase(chases: Chase[], now: number): Chase | undefined {
  return (
    chases.find((c) => Date.parse(c.start) <= now && now < Date.parse(c.end)) ??
    chases.find((c) => now < Date.parse(c.start)) ??
    chases[chases.length - 1]
  );
}

export interface ScheduleRun {
  name: string;
  start: string;
  end: string;
  /** Day columns from the chase start, end exclusive, clipped to the chase. */
  from: number;
  to: number;
}

export interface ScheduleRow {
  source: string;
  name: string;
  /** Currency at each milestone, lowest first. */
  milestones: { points: number; amount: number }[];
  total: number;
  runs: ScheduleRun[];
}

export interface Schedule {
  /** Day columns: each starts at the chase start time plus n days. */
  days: string[];
  rows: ScheduleRow[];
  /** First day column the event list doesn't cover yet (days.length when it covers the whole chase). */
  knownUntil: number;
}

/** The tournaments that pay into a chase, one row per activity, with each run placed on the chase's days. */
export function chaseSchedule(chase: GameEvent, events: GameEvent[]): Schedule {
  const t0 = Date.parse(chase.start);
  const t1 = Date.parse(chase.end);
  const count = Math.ceil((t1 - t0) / DAY);
  const days = Array.from({ length: count }, (_, i) => new Date(t0 + i * DAY).toISOString());
  const col = (t: number) => Math.max(0, Math.min(count, (t - t0) / DAY));
  const sources = [...new Set([...(chase.activities ?? []).map((a) => a.source), ...(chase.progressRewards ?? []).map((r) => r.sourceTypeId ?? '')])].filter(Boolean);
  const rows = sources.map((source) => {
    const milestones = (chase.progressRewards ?? [])
      .filter((r) => r.sourceTypeId === source)
      .map((r) => ({ points: r.requiredPoints, amount: r.reward.reduce((n, x) => n + ('amount' in x ? x.amount : 0), 0) }))
      .sort((a, b) => a.points - b.points);
    const runs = events
      .filter((e) => e.type === source && Date.parse(e.end) > t0 && Date.parse(e.start) < t1)
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
      .map((e) => ({ name: e.name, start: e.start, end: e.end, from: Math.floor(col(Date.parse(e.start))), to: Math.ceil(col(Date.parse(e.end))) }));
    const name = chase.activities?.find((a) => a.source === source)?.name ?? runs[0]?.name ?? source;
    return { source, name, milestones, total: milestones.reduce((n, m) => n + m.amount, 0), runs };
  });
  // Rows with dates first, by first run; the rest by how much they pay.
  rows.sort((a, b) => (a.runs[0] ? Date.parse(a.runs[0].start) : Infinity) - (b.runs[0] ? Date.parse(b.runs[0].start) : Infinity) || b.total - a.total);
  const lastEnd = Math.max(t0, ...events.filter((e) => e.type !== 'GetLegendary').map((e) => Date.parse(e.end)));
  return { days, rows, knownUntil: Math.min(count, Math.ceil(col(lastEnd))) };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "12–15 Oct" or "28 Oct – 2 Nov" (UTC dates). */
export function dateRange(start: string, end: string): string {
  const a = new Date(start);
  const b = new Date(end);
  if (a.getUTCMonth() === b.getUTCMonth()) return `${a.getUTCDate()}–${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`;
  return `${a.getUTCDate()} ${MONTHS[a.getUTCMonth()]} – ${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`;
}

/** "102,000" for one milestone, "24k / 48k / 72k" for several. */
export function milestoneText(milestones: { points: number }[]): string {
  const k = (n: number) => (n % 1000 === 0 ? `${n / 1000}k` : n.toLocaleString('en-GB'));
  return milestones.length === 1 ? milestones[0].points.toLocaleString('en-GB') : milestones.map((m) => k(m.points)).join(' / ');
}
