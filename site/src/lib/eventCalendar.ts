// Event calendar helpers, shared by the page, its small status script and the tests. Type imports only, so the
// page script stays small.
import type { EventRankReward, EventRewardItem, EventScoringRule, RankName } from './data';

export type EventStatus = 'now' | 'next' | 'ended';

export interface Timed {
  start: string;
  end: string;
}

export function eventStatus(e: Timed, now: number): EventStatus {
  if (now >= Date.parse(e.end)) return 'ended';
  if (now >= Date.parse(e.start)) return 'now';
  return 'next';
}

/** Events split into Now / Coming up / Ended, each sorted by start (then end). */
export function groupEvents<T extends Timed>(events: T[], now: number): Record<EventStatus, T[]> {
  const out: Record<EventStatus, T[]> = { now: [], next: [], ended: [] };
  const sorted = [...events].sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || Date.parse(a.end) - Date.parse(b.end));
  for (const e of sorted) out[eventStatus(e, now)].push(e);
  return out;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sun 4 Oct, 12:00 UTC". */
export function formatUtc(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${hh}:${mm} UTC`;
}

/** "2d 4h", "3h 12m" or "12m" (rounded down; under a minute is "under 1m"). */
export function countdown(ms: number): string {
  const mins = Math.floor(Math.max(0, ms) / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return m > 0 ? `${m}m` : 'under 1m';
}

/** The countdown line for one event: "ends in 2d 4h", "starts in 1d 3h" or "ended". */
export function statusText(e: Timed, now: number): string {
  const s = eventStatus(e, now);
  if (s === 'now') return `ends in ${countdown(Date.parse(e.end) - now)}`;
  if (s === 'next') return `starts in ${countdown(Date.parse(e.start) - now)}`;
  return 'ended';
}

/** The page's lead line: what is on now and what starts next. */
export function leadLine(events: (Timed & { name: string })[], now: number): string {
  const g = groupEvents(events, now);
  const live = [...g.now].sort((a, b) => Date.parse(a.end) - Date.parse(b.end));
  const parts: string[] = [];
  if (live.length) {
    const [first, ...rest] = live;
    parts.push(`${first.name} runs until ${formatUtc(first.end)}${rest.length ? `, with ${rest.length} more on now` : ''}.`);
  } else {
    parts.push('Nothing is on right now.');
  }
  const next = g.next[0];
  if (next) parts.push(`Next: ${next.name}, from ${formatUtc(next.start)}.`);
  return parts.join(' ');
}

/** Description text as plain bullet points: split on <br>, tags dropped, generic leaderboard lines left out. */
export function descriptionLines(text: string): string[] {
  return text
    .split(/<br\s*\/?>/i)
    .map((l) => l.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim())
    .filter((l) => l && !/^(earn tournament points|unlock huge rewards)/i.test(l));
}

/** Rank bands, with consecutive bands that pay exactly the same merged ("4-10"). */
export function rankRanges(rows: EventRankReward[]): { from: number; to: number; label: string; reward: EventRewardItem[] }[] {
  const key = (r: EventRewardItem[]) => JSON.stringify(r.map((x) => [x.itemId, x.amount]));
  const out: { from: number; to: number; label: string; reward: EventRewardItem[] }[] = [];
  for (const r of [...rows].sort((a, b) => a.fromRank - b.fromRank)) {
    const last = out[out.length - 1];
    if (last && last.to + 1 === r.fromRank && key(last.reward) === key(r.reward)) last.to = r.toRank;
    else out.push({ from: r.fromRank, to: r.toRank, label: '', reward: r.reward });
  }
  for (const r of out) r.label = r.from === r.to ? String(r.from) : `${r.from}-${r.to}`;
  return out;
}

// ---- Scoring rules as small tables ----

/** A heading or row label. `kind` tells the page which icon or colour to use. */
export interface Label {
  text: string;
  kind?: 'rarity' | 'stars' | 'item' | 'element';
  /** Rarity names, item id or element names behind the label. */
  keys?: string[];
}

export interface RuleTable {
  title: string;
  /** Header of the row-label column. */
  corner: string;
  columns: Label[];
  rows: { label: Label; cells: (number | null)[] }[];
  /** Long tables are folded away. */
  collapse: boolean;
  /** A short line under the table. */
  note?: string;
}

const RANKS: RankName[] = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'];
const stars = (r: string) => RANKS.indexOf(r as RankName) + 1;
const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];
const byRarity = (a: string, b: string) => RARITIES.indexOf(a) - RARITIES.indexOf(b);
const uniq = <T,>(xs: T[]) => [...new Set(xs)];
const COLLAPSE_ROWS = 6;

/**
 * Grid of rows x columns. Columns whose values are all the same are merged into one ("Common, Uncommon, Rare"),
 * so a table only gets as wide as the differences in it.
 */
function grid(
  title: string,
  corner: string,
  rowKeys: string[],
  colKeys: string[],
  value: (row: string, col: string) => number | undefined,
  rowLabel: (k: string) => Label,
  colKind: Label['kind'],
  colText: (k: string) => string = (k) => k,
): RuleTable {
  const cols: { keys: string[]; values: (number | null)[] }[] = [];
  for (const c of colKeys) {
    const values = rowKeys.map((r) => value(r, c) ?? null);
    const same = cols.find((x) => JSON.stringify(x.values) === JSON.stringify(values));
    if (same && colKind === 'rarity') same.keys.push(c);
    else cols.push({ keys: [c], values });
  }
  return {
    title,
    corner,
    columns: cols.map((c) => ({ text: c.keys.map(colText).join(', '), kind: colKind, keys: c.keys })),
    rows: rowKeys.map((r, i) => ({ label: rowLabel(r), cells: cols.map((c) => c.values[i]) })),
    collapse: rowKeys.length > COLLAPSE_ROWS,
  };
}

const list = (title: string, corner: string, column: string, rows: { label: Label; points: number }[]): RuleTable => ({
  title,
  corner,
  columns: [{ text: column }],
  rows: rows.map((r) => ({ label: r.label, cells: [r.points] })),
  collapse: rows.length > COLLAPSE_ROWS,
});

const rarityLabel = (r: string): Label => ({ text: r, kind: 'rarity', keys: [r] });
const starLabel = (n: number, prefix = ''): Label => ({ text: `${prefix}${n}★`, kind: 'stars' });
const arenaLeague = (l: string) => l.replace(/(\D)(\d)/, '$1 $2');

/** The tables that explain one scoring rule. `itemName` turns an item id into its English name. */
export function ruleTables(rule: EventScoringRule, itemName: (id: string) => string, bossNames: (ids: string[]) => string = () => ''): RuleTable[] {
  const item = (id: string): Label => ({ text: itemName(id), kind: 'item', keys: [id] });
  switch (rule.ruleType) {
    case 'GearDropScoringRule':
    case 'RelicDropScoringRule': {
      const what = rule.ruleType === 'GearDropScoringRule' ? 'accessory' : 'relic';
      const from = rule.acceptedRegions?.length ? bossNames(rule.acceptedRegions) : '';
      const ranks = uniq(rule.entries.map((e) => e.rank)).sort((a, b) => stars(a) - stars(b));
      const rarities = uniq(rule.entries.map((e) => e.rarity)).sort(byRarity);
      const t = grid(
        `Points per ${what} won${from ? ` from ${from}` : ''}`,
        'Rarity',
        rarities,
        ranks,
        (r, k) => rule.entries.find((e) => e.rarity === r && e.rank === k)?.points,
        rarityLabel,
        'stars',
        (k) => `${stars(k)}★`,
      );
      return [t];
    }
    case 'GearUpgradeScoringRule': {
      const ranks = uniq(rule.entries.map((e) => e.rank)).sort((a, b) => stars(a) - stars(b));
      const levels = uniq(rule.entries.map((e) => e.levelMilestone)).sort((a, b) => a - b);
      return [
        grid(
          'Points for reaching each upgrade level',
          'Stars',
          ranks,
          levels.map(String),
          (k, lv) => rule.entries.find((e) => e.rank === k && e.levelMilestone === Number(lv))?.points,
          (k) => starLabel(stars(k)),
          undefined,
          (lv) => `+${lv}`,
        ),
      ];
    }
    case 'ArenaBattleScoringRule': {
      const leagues = uniq(rule.entries.map((e) => e.league));
      const results = uniq(rule.entries.map((e) => e.result));
      const t = grid(
        'Points per Arena battle',
        'League',
        leagues,
        results,
        (l, r) => rule.entries.find((e) => e.league === l && e.result === r)?.points,
        (l) => ({ text: arenaLeague(l) }),
        undefined,
        (r) => (r === 'Victory' ? 'Win' : r === 'Defeat' ? 'Loss' : r),
      );
      return [t];
    }
    case 'HeroLevelUpScoringRule': {
      const bands = uniq(rule.entries.map((e) => `${e.minLevelInclusive}-${e.maxLevelInclusive}`));
      const rarities = uniq(rule.entries.map((e) => e.rarity)).sort(byRarity);
      return [
        grid(
          'Points per level gained',
          'Levels',
          bands,
          rarities,
          (b, r) => rule.entries.find((e) => `${e.minLevelInclusive}-${e.maxLevelInclusive}` === b && e.rarity === r)?.pointsPerLevel,
          (b) => ({ text: b.replace('-', '–') }),
          'rarity',
        ),
      ];
    }
    case 'HeroRankUpScoringRule': {
      const ranks = uniq(rule.entries.map((e) => e.rank)).sort((a, b) => stars(a) - stars(b));
      const rarities = uniq(rule.entries.map((e) => e.rarity)).sort(byRarity);
      return [
        grid(
          'Points per ascension',
          'To',
          ranks,
          rarities,
          (k, r) => rule.entries.find((e) => e.rank === k && e.rarity === r)?.points,
          (k) => starLabel(stars(k)),
          'rarity',
        ),
      ];
    }
    case 'HeroAwakenScoringRule': {
      const levels = uniq(rule.entries.map((e) => e.awakeLevel)).sort((a, b) => a - b);
      const rarities = uniq(rule.entries.map((e) => e.rarity)).sort(byRarity);
      return [
        grid(
          'Points per Awakening level',
          'Level',
          levels.map(String),
          rarities,
          (lv, r) => rule.entries.find((e) => e.awakeLevel === Number(lv) && e.rarity === r)?.points,
          (lv) => ({ text: lv }),
          'rarity',
        ),
      ];
    }
    case 'HeroSkillUpScoringRule':
      return [list('Points per skill upgrade', 'Using', 'Points', rule.entries.map((e) => ({ label: item(e.resourceId), points: e.points })))];
    case 'CampaignBattleScoringRule':
      return [list('Points per Campaign battle won', 'Difficulty', 'Points', rule.entries.map((e) => ({ label: { text: e.difficulty }, points: e.points })))];
    case 'HeroSummonScoringRule': {
      const sets: PullSet[] = [
        ['std', rule.heroEntriesNonLightDark, { text: 'Other elements' }],
        ['ld', rule.heroEntriesLightDark, { text: 'Light, Dark', kind: 'element', keys: ['Light', 'Dark'] }],
        ['chroma', rule.heroEntriesChromaNonLightDark, { text: 'Chroma' }, 'std'],
        ['chromaLd', rule.heroEntriesChromaLightDark, { text: 'Chroma Light, Dark', kind: 'element', keys: ['Light', 'Dark'] }, 'ld'],
      ];
      return [
        list('Points per summon item used', 'Item', 'Points', rule.resourceSpendEntries.map((e) => ({ label: item(e.resourceId), points: e.points }))),
        pullTable('Points per Invoker summoned', sets),
      ];
    }
    case 'AnimaSummonScoringRule': {
      const sets: PullSet[] = [
        ['std', rule.animaEntries, { text: 'Points' }],
        ['chroma', rule.animaEntriesChroma, { text: 'Chroma' }, 'std'],
      ];
      return [
        list('Points per summon item used', 'Item', 'Points', rule.resourceSpendEntries.map((e) => ({ label: item(e.resourceId), points: e.points }))),
        pullTable('Points per Titan summoned', sets),
      ];
    }
    default:
      return [];
  }
}

/** One column of a summon table; a Chroma column names the column it doubles (or not). */
type PullSet = [string, { rarity: string; points: number }[], Label, string?];

function pullTable(title: string, sets: PullSet[]): RuleTable {
  let present = sets.filter(([, rows]) => rows?.length);
  // Chroma columns that are exactly double their plain column become one line under the table.
  const doubles = present.filter(([, rows, , of]) => {
    const base = of ? present.find(([k]) => k === of)?.[1] : undefined;
    return !!base && rows.length === base.length && rows.every((r) => base.find((b) => b.rarity === r.rarity)?.points === r.points / 2);
  });
  present = present.filter((s) => !doubles.includes(s));
  const rarities = uniq(present.flatMap(([, rows]) => rows.map((r) => r.rarity))).sort(byRarity);
  return {
    title,
    corner: 'Rarity',
    columns: present.map(([, , label]) => label),
    rows: rarities.map((r) => ({ label: rarityLabel(r), cells: present.map(([, rows]) => rows.find((x) => x.rarity === r)?.points ?? null) })),
    collapse: rarities.length > COLLAPSE_ROWS,
    note: doubles.length ? 'Chroma pulls score double.' : undefined,
  };
}

/** Pages that help with an event, by what it scores. Boss pages are added by the page from `acceptedRegions`. */
export function eventLinks(rules: EventScoringRule[]): { path: string; label: string }[] {
  const out: { path: string; label: string }[] = [];
  const add = (path: string, label: string) => out.some((l) => l.path === path) || out.push({ path, label });
  for (const r of rules) {
    switch (r.ruleType) {
      case 'GearDropScoringRule':
      case 'RelicDropScoringRule':
      case 'ArenaBattleScoringRule':
      case 'CampaignBattleScoringRule':
        add('events', 'Event planner');
        break;
      case 'HeroSummonScoringRule':
      case 'AnimaSummonScoringRule':
        add('summons', 'Summon rates');
        break;
      case 'GearUpgradeScoringRule':
        add('gear-upgrades', 'Gear upgrade costs');
        break;
      case 'HeroLevelUpScoringRule':
      case 'HeroRankUpScoringRule':
      case 'HeroAwakenScoringRule':
        add('ascension', 'Ascension and Awakening');
        break;
      case 'HeroSkillUpScoringRule':
        add('skill-costs', 'Skill costs');
        break;
    }
  }
  return out;
}

// The event planner's events and the in-game event kinds they match (by type prefix: RelicBossAlthar, ClanBoss1...).
const plannerKinds: Record<string, string> = {
  relic: 'RelicBoss', accessory: 'ClanBoss', arena: 'ArenaMedals', gearup: 'GearUpgrade',
  summon: 'SummonHero', titansummon: 'SummonAnima', powerup: 'HeroUpgrade', campaign: 'Campaign',
};

interface Scored { type: string; start: string; personalRewards?: { requiredPoints: number }[]; scoring?: { rules: EventScoringRule[] } }

/** The planner's targets and Campaign Rush points, taken from the newest listed event of each kind where there is one. */
export function withLiveTargets<T extends { id: string; target: number; difficulties?: { name: string; points: number }[] }>(
  planner: T[],
  listed: Scored[],
): T[] {
  return planner.map((p) => {
    const kind = plannerKinds[p.id];
    const latest = kind ? listed.filter((e) => e.type.startsWith(kind)).sort((a, b) => b.start.localeCompare(a.start))[0] : undefined;
    if (!latest) return p;
    const top = Math.max(0, ...(latest.personalRewards ?? []).map((r) => r.requiredPoints));
    const campaign = latest.scoring?.rules.find((r) => r.ruleType === 'CampaignBattleScoringRule');
    const points = new Map(campaign && 'entries' in campaign ? (campaign.entries as { difficulty: string; points: number }[]).map((x) => [x.difficulty, x.points]) : []);
    return {
      ...p,
      target: top || p.target,
      ...(p.difficulties ? { difficulties: p.difficulties.map((d) => ({ ...d, points: points.get(d.name) ?? d.points })) } : {}),
    };
  });
}

/** Announced changes the event list doesn't carry yet, by tournament id: shown above that event's rewards. */
export const eventNotices: Record<number, { text: string; link: string }> = {};
