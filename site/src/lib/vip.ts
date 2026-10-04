// VIP levels from data/vip.json, numbered the way the game shows them (VIP 1 to 25). Each entry holds that level's
// points, boosts and perks (free pass days, avatar frame, chat badge, quest auto-complete).
import vipJson from '../../../data/vip.json';

interface VipEntry {
  level: number;
  pointsTotal: number;
  battleStatsBonus: number;
  goldBoost: number;
  xpPotionBoost: number;
  memoriumBoost: number;
  runeDropMultiplier: number;
  chatBadge: boolean;
  autoCompleteDailyQuests: boolean;
  avatarFrame: string | null;
  freePassDaysOnLevelUp: number | null;
}

export interface VipLevel {
  level: number;
  /** Points from VIP 1 to this level. */
  points: number;
  /** Boosts as fractions (0.5 = +50%); rune drops as a multiplier (1 or less = no boost). */
  gold: number;
  xp: number;
  memorium: number;
  runeDrops: number;
  battleStats: number;
  /** Undefined where the export has no value. */
  freePassDays?: number;
  chatBadge?: boolean;
  autoCompleteDailyQuests?: boolean;
  avatarFrame?: boolean;
}

const entries = vipJson.levels as VipEntry[];

export const vipLevels: VipLevel[] = entries.map((e) => {
  return {
    level: e.level,
    points: e.pointsTotal,
    gold: e.goldBoost,
    xp: e.xpPotionBoost,
    memorium: e.memoriumBoost,
    runeDrops: e.runeDropMultiplier,
    battleStats: e.battleStatsBonus,
    freePassDays: e.freePassDaysOnLevelUp ?? undefined,
    chatBadge: e.chatBadge,
    autoCompleteDailyQuests: e.autoCompleteDailyQuests,
    avatarFrame: e.avatarFrame !== null,
  };
});

export const vipPasses = vipJson.passes.map((p) => ({ days: p.days, gems: p.price.Gem }));
export const vipPointsPerUsd = vipJson.points.perUsdSpent;
export const loginPointsByStreakDay = vipJson.points.dailyLoginByStreakDay;

/** Days of unbroken logins to earn `points`; the last streak value repeats after the list ends. */
export function loginDaysFor(points: number): number {
  const last = loginPointsByStreakDay[loginPointsByStreakDay.length - 1];
  let total = 0;
  let day = 0;
  while (total < points) {
    total += loginPointsByStreakDay[day] ?? last;
    day++;
  }
  return day;
}

export const maxVip = vipLevels[vipLevels.length - 1];
