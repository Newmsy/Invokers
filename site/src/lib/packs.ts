// Pack value maths for the Packs page. Every reward is counted in gems: at its Gem Shop price where the shop
// sells it, and summon items the shop doesn't sell by their average Legendaries against the Destiny Star (heroes)
// or Wonder Orb (Titans). Gems turn into £ at the Bank's best rate. Averages count bonus summons, not mercy.
import shopJson from '../../../data/shop_packs.json';
import { itemName } from './data';
import { summonItem, summons } from './summons/odds';

export interface Reward { type: string; id: string; amount: number; secondary?: boolean }
export interface ShopPack {
  id: number;
  name: string;
  description?: string;
  tab: string;
  price: { usd?: number; resources?: Record<string, number> };
  rewards?: Reward[];
  steps?: { step: number; rewards: Reward[] }[] | null;
  purchaseLimit?: string;
  purchaseLimitCount?: number;
  durationHours?: number | null;
  replacesPackId?: number | null;
}

export const shop = shopJson as unknown as { gameVersion: string; packs: ShopPack[] };

/** Store tab names as the game shows them. */
export const tabNames: Record<string, string> = {
  Currency: 'Bank',
  GemShop: 'Gem Shop',
  SpecialOffers: 'Special Offers',
  HotDeals: 'Hot Deals',
  Exclusive: 'Exclusive Deals',
  Retention: 'Calendars',
};

/** UK store price for a US price tier (the store's £ tiers mirror the $ ones: $20 is £19.99). */
export const gbp = (usd: number) => Math.round(usd * 100 - 1) / 100;

const titleCase = (s: string) => (s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s-])\S/g, (c) => c.toUpperCase()) : s);
export const packName = (p: ShopPack) => titleCase(p.name.replace('{0}', String(p.rewards?.[0]?.amount.toLocaleString('en-GB') ?? '')));
export const rewardName = (id: string) =>
  itemName(id).replace(/<sprite[^>]*>\s*/g, '★ ').replace(/<[^>]+>/g, '').replace(/^(\d) ★ /, '$1★ ');

/** Everything a pack gives, calendar days added up. */
export function packRewards(p: ShopPack): Reward[] {
  const all = [...(p.rewards ?? []), ...(p.steps ?? []).flatMap((s) => s.rewards ?? [])];
  const byId = new Map<string, Reward>();
  for (const r of all) {
    const prev = byId.get(r.id);
    byId.set(r.id, { ...r, amount: (prev?.amount ?? 0) + r.amount });
  }
  return [...byId.values()];
}

export function limitText(p: ShopPack): string {
  const n = p.purchaseLimitCount ?? 0;
  switch (p.purchaseLimit) {
    case 'Unlimited': return 'No limit';
    case 'PerDay': return `${n} a day`;
    case 'PerWeek': return `${n} a week`;
    case 'PerMonth': return `${n} a month`;
    case 'OneUntilActive': return '1 at a time';
    case 'PerAccountWithDuration': return `${n} while on sale`;
    default: return `Limit ${n}`;
  }
}

const isPaid = (p: ShopPack) => (p.price.usd ?? 0) > 0;
const gemCost = (p: ShopPack) => p.price.resources?.Gem ?? 0;

// Gem Shop offers of a single item, cheapest per unit; offers with no limit win over limited ones.
const gemShopOffers = shop.packs.filter((p) => p.tab === 'GemShop' && gemCost(p) > 0 && (p.rewards ?? []).length === 1);
const shopPrice = new Map<string, { gems: number; limited: boolean }>();
for (const p of gemShopOffers) {
  const r = p.rewards![0];
  const gems = gemCost(p) / r.amount;
  const limited = p.purchaseLimit !== 'Unlimited';
  const prev = shopPrice.get(r.id);
  if (!prev || (prev.limited && !limited) || (prev.limited === limited && gems < prev.gems)) shopPrice.set(r.id, { gems, limited });
}

/** Gems per £ at the Bank's best repeatable rate. */
export const bankGemsPerPound = Math.max(
  ...shop.packs.filter((p) => p.tab === 'Currency' && p.purchaseLimit === 'Unlimited').map((p) => (p.rewards?.[0]?.amount ?? 0) / gbp(p.price.usd!)),
);

type Rarities = Record<string, number>;
const add = (a: Rarities, b: Rarities, k = 1) => {
  for (const [r, v] of Object.entries(b)) a[r] = (a[r] ?? 0) + v * k;
  return a;
};

/**
 * Average pulls by rarity from one summon item, counting the bonus items its use earns on average
 * (a Destiny Star is 1/85 of a Divine Star; a Radiant Star's own bonus repeats, 1 + 1/10 + 1/100 ...).
 */
export function averagePerItem(id: string, seen: string[] = []): Rarities {
  const item = summonItem(id);
  if (!item || seen.includes(id)) return {};
  const out = add({}, item.rates);
  let repeat = 1;
  for (const b of summons.bonus.filter((b) => b.uses.includes(id))) {
    if (b.gives === id) repeat /= 1 - 1 / b.every;
    else add(out, averagePerItem(b.gives, [...seen, id]), 1 / b.every);
  }
  for (const r of Object.keys(out)) out[r] *= repeat;
  return out;
}

const topPulls = (id: string) => {
  const a = averagePerItem(id);
  return (a.Legendary ?? 0) + (a.Mythic ?? 0);
};

export interface ItemValue { gems: number; how: 'shop' | 'limited' | 'estimated' }

/** What one of an item is worth in gems, or undefined when it can't be priced. */
export function itemValue(id: string): ItemValue | undefined {
  if (id === 'Gem') return { gems: 1, how: 'shop' };
  const s = shopPrice.get(id);
  if (s) return { gems: s.gems, how: s.limited ? 'limited' : 'shop' };
  const item = summonItem(id);
  if (!item) return undefined;
  const ref = item.kind === 'titan' ? 'SI_WonderOrb' : 'SI_DestinyStar';
  const refPrice = shopPrice.get(ref)?.gems;
  if (!refPrice || !topPulls(ref)) return undefined;
  return { gems: (topPulls(id) / topPulls(ref)) * refPrice, how: 'estimated' };
}

export interface PackValue {
  pack: ShopPack;
  name: string;
  tab: string;
  limit: string;
  price: number;
  rewards: (Reward & { value?: ItemValue })[];
  /** Total value in gems of the rewards that can be priced. */
  gems: number;
  /** That value in £ at the Bank's best rate. */
  worth: number;
  /** worth ÷ price: 1 = the same as buying gems at the Bank. */
  ratio: number;
  /** Average Invokers by rarity from the pack's stars. */
  pulls: Rarities;
  perLegendary: number;
  /** Some rewards can't be priced, so the value is a floor. */
  partial: boolean;
  estimated: boolean;
}

export function packValue(p: ShopPack): PackValue {
  const rewards = packRewards(p).map((r) => ({ ...r, value: itemValue(r.id) }));
  const price = gbp(p.price.usd ?? 0);
  const gems = rewards.reduce((t, r) => t + (r.value ? r.value.gems * r.amount : 0), 0);
  const worth = gems / bankGemsPerPound;
  const pulls: Rarities = {};
  for (const r of rewards) if (summonItem(r.id)?.kind === 'hero') add(pulls, averagePerItem(r.id), r.amount);
  return {
    pack: p,
    name: packName(p),
    tab: tabNames[p.tab] ?? p.tab,
    limit: limitText(p),
    price,
    rewards,
    gems,
    worth,
    ratio: price > 0 ? worth / price : 0,
    pulls,
    perLegendary: pulls.Legendary ? price / pulls.Legendary : Infinity,
    partial: rewards.some((r) => !r.value),
    estimated: rewards.some((r) => r.value?.how === 'estimated'),
  };
}

/** Paid packs other than the Bank's gem bundles, best value first. */
const paidPacks = () => shop.packs.filter((p) => isPaid(p) && p.tab !== 'Currency').map(packValue);
export const rankedPacks = (): PackValue[] => paidPacks().filter((p) => !p.partial).sort((a, b) => b.ratio - a.ratio);
/** Packs with rewards that have no gem price, so they can't be ranked fairly. */
export const unrankedPacks = (): PackValue[] => paidPacks().filter((p) => p.partial).sort((a, b) => a.price - b.price);

/** The Bank's gem bundles, with first-purchase offers next to the ones they replace. */
export function bank(): { price: number; gems: number; first?: number; perPound: number }[] {
  const tiers = shop.packs.filter((p) => p.tab === 'Currency' && p.purchaseLimit === 'Unlimited');
  return tiers
    .map((p) => {
      const price = gbp(p.price.usd!);
      const gems = p.rewards?.[0]?.amount ?? 0;
      const first = shop.packs.find((f) => f.replacesPackId === p.id)?.rewards?.[0]?.amount;
      return { price, gems, first, perPound: gems / price };
    })
    .sort((a, b) => a.price - b.price);
}

/** What the Gem Shop charges for each item, per unit. */
export function gemShopPrices(): { id: string; gems: number; limited: boolean }[] {
  return [...shopPrice].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.gems - a.gems);
}
