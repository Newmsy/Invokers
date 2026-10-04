// Totals for the free-rewards pages: every Achievement and Progress Quest reward, added up by item and by section.
// Pure functions over data/quests.json (see questData.ts), so they can be tested with small samples.

export interface QuestReward {
  type: string;
  id: string;
  amount: number;
  /** A random pick of this rarity (e.g. "Legendary"), shown as "a random Legendary". */
  random?: string;
}
export interface Achievement { section: string; order?: number; task: string; rewards: QuestReward[] }
export interface QuestTask { task: string; rewards: QuestReward[] }
export interface QuestPage { page: number; tasks: QuestTask[]; completionReward: QuestReward[] }
export interface QuestsFile { gameVersion?: string; achievements?: Achievement[]; progressQuests?: QuestPage[] }

/** One line of a total: what it is and how many. Random picks of the same rarity add up together. */
export interface Total { key: string; type: string; id: string; random?: string; amount: number }

const keyOf = (r: QuestReward) => (r.random ? `random:${r.type}:${r.random}` : `${r.type}:${r.id}`);

/** Adds rewards up by item, biggest first by count of rewards it came from, then amount. */
export function sumRewards(rewards: QuestReward[]): Total[] {
  const byKey = new Map<string, Total & { n: number }>();
  for (const r of rewards) {
    if (!r || !(r.amount > 0)) continue;
    const key = keyOf(r);
    const prev = byKey.get(key);
    if (prev) {
      prev.amount += r.amount;
      prev.n++;
    } else byKey.set(key, { key, type: r.type, id: r.id, random: r.random, amount: r.amount, n: 1 });
  }
  return [...byKey.values()].sort((a, b) => order(a) - order(b) || b.n - a.n || b.amount - a.amount).map(({ n: _n, ...t }) => t);
}

// Gems and Gold lead every table, so the headline numbers are always in the same place.
const lead = ['Gem', 'Gold'];
const order = (t: Total) => {
  const i = lead.indexOf(t.id);
  return t.random ? lead.length : i >= 0 ? i : lead.length + 1;
};

export const amountOf = (totals: Total[], id: string) => totals.find((t) => t.id === id && !t.random)?.amount ?? 0;

export interface SectionTotals { section: string; count: number; totals: Total[] }

/** Achievements grouped by tab, in the order the tabs first appear. */
export function achievementSections(list: Achievement[]): SectionTotals[] {
  const names = [...new Set(list.map((a) => a.section))];
  return names.map((section) => {
    const items = list.filter((a) => a.section === section);
    return { section, count: items.length, totals: sumRewards(items.flatMap((a) => a.rewards ?? [])) };
  });
}

/** The single biggest rewards of one item (e.g. the top Gem achievements), biggest first. */
export function biggest<T extends { rewards: QuestReward[] }>(list: T[], id: string, n = 5): (T & { amount: number })[] {
  return list
    .map((x) => ({ ...x, amount: (x.rewards ?? []).filter((r) => r.id === id && !r.random).reduce((s, r) => s + r.amount, 0) }))
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n);
}

export interface PageBand { from: number; to: number; tasks: number; totals: Total[] }

/** Progress Quest pages in bands of `size` pages (1–10, 11–20 …), tasks and page completion rewards together. */
export function pageBands(pages: QuestPage[], size = 10): PageBand[] {
  const sorted = [...pages].sort((a, b) => a.page - b.page);
  const bands: PageBand[] = [];
  for (let i = 0; i < sorted.length; i += size) {
    const chunk = sorted.slice(i, i + size);
    bands.push({
      from: chunk[0].page,
      to: chunk[chunk.length - 1].page,
      tasks: chunk.reduce((s, p) => s + (p.tasks?.length ?? 0), 0),
      totals: sumRewards(chunk.flatMap(pageRewards)),
    });
  }
  return bands;
}

export const pageRewards = (p: QuestPage): QuestReward[] => [...(p.tasks ?? []).flatMap((t) => t.rewards ?? []), ...(p.completionReward ?? [])];

export interface QuestSummary {
  pages: number;
  tasks: number;
  all: Total[];
  fromTasks: Total[];
  fromCompletion: Total[];
}

export function progressSummary(pages: QuestPage[]): QuestSummary {
  return {
    pages: pages.length,
    tasks: pages.reduce((s, p) => s + (p.tasks?.length ?? 0), 0),
    all: sumRewards(pages.flatMap(pageRewards)),
    fromTasks: sumRewards(pages.flatMap((p) => (p.tasks ?? []).flatMap((t) => t.rewards ?? []))),
    fromCompletion: sumRewards(pages.flatMap((p) => p.completionReward ?? [])),
  };
}

/** Short amounts for chips: 150,000 → 150K, 2,500,000 → 2.5M. */
export const short = (n: number) =>
  n >= 1e6 ? `${+(n / 1e6).toFixed(2)}M` : n >= 10000 && n % 1000 === 0 ? `${n / 1000}K` : n.toLocaleString('en-GB');
