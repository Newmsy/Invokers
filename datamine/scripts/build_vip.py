"""Build data/vip.json (issue #110) from VipData (LootDump/output/json/VipData.json).

Usage: python build_vip.py [lootdump_output_dir]
"""
import json
import sys
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
LOOT = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO.parent / "LootDump" / "output"


def r(x):
    return round(x, 4)


def main():
    v = json.loads((LOOT / "json" / "VipData.json").read_text(encoding="utf-8"))
    manifest = json.loads((REPO / "data" / "manifest.json").read_text(encoding="utf-8"))
    frames = {lvl: name for name, lvl in v["AvatarFrameUnlockLevels"].items()}
    levels, total = [], 0
    # Levels 1-25 (issue #145): the per-level arrays have 25 entries (index 0-24 = VIP 1-25) and VipPointsForLevel has
    # 24 thresholds (index 0 = points from VIP 1 to VIP 2); the level-keyed tables (frames, free pass days) use the
    # level number itself, including 25.
    for lvl in range(1, v["MaxVipLevel"] + 1):
        i = lvl - 1
        if lvl > 1:
            total += v["VipPointsForLevel"][lvl - 2]
        levels.append({
            "level": lvl,
            "pointsFromPrevious": v["VipPointsForLevel"][lvl - 2] if lvl > 1 else 0,
            "pointsTotal": total,
            "battleStatsBonus": r(v["DungeonCampaignStatsByLevel"][i]),
            "goldBoost": r(v["GoldBoostByLevel"][i]),
            "xpPotionBoost": r(v["XpBoostByLevel"][i]),
            "memoriumBoost": r(v["MemoriumBoostByLevel"][i]),
            "runeDropMultiplier": r(v["RunesBoostByLevel"][i]),
            "chatBadge": lvl >= v["ChatIconMinVipLevel"],
            "autoCompleteDailyQuests": lvl >= v["AutoDailyQuestCompleteMinVipLevel"],
            "avatarFrame": frames.get(lvl),
            "portraitGroup": v["PortraitGroupByLevel"][i],
            "freePassDaysOnLevelUp": v["FreeActivationDaysByVipLevel"].get(str(lvl)),
        })
    out = {
        "gameVersion": manifest["gameVersion"], "extractedAt": date.today().isoformat(),
        "source": "Static game config (VipData).",
        "maxLevel": v["MaxVipLevel"],
        "levels": levels,
        "passes": [{"itemId": k, "days": int(k.split("_")[1].rstrip("d")), "price": p["RawValues"]}
                   for k, p in v["VipActivationPrices"].items()],
        "points": {
            "dailyLoginByStreakDay": v["DailyLoginStreakPoints"],
            "perUsdSpent": v["PurchaseVipPointsPerUsd"],
            "retroactivePerUsd": v["RetroactiveVipPointsPerUsd"],
            "retroactivePerLoginDay": v["RetroactiveVipPointsPerLoginDay"],
        },
        "notes": [
            "Boost values are fractions (0.5 = +50%). battleStatsBonus is HP, ATK and DEF in Campaign and Boss Mode.",
            "Shop purchases give VIP points per USD spent, except Gem purchases (in-game text).",
            "Boosts are active only while a VIP Pass is active (in-game: 'Activate VIP Pass for Boosts'). Reaching a "
            "new VIP level gives freePassDaysOnLevelUp days of the pass.",
            "VIP chest contents per level are in chests.json (chest VIP).",
        ],
        "unconfirmed": [
            "Level numbering: exported as VIP 1-25 (issue #145). The 25-entry per-level tables are read as VIP 1-25 and "
            "the 24 point thresholds as the points for VIP 2-25, so VIP 1 needs 0 points here; the level-keyed tables "
            "(frames, free pass days) use their own level numbers. Not yet checked against the VIP screen.",
            "runeDropMultiplier: 'Increases your chance of getting Rune Drops from Campaign Battles'; read as a "
            "multiplier on the drop chance (1 = no change).",
            "dailyLoginByStreakDay: day 17 onwards stays at the last value.",
            "freePassDaysOnLevelUp: the config key is FreeActivationDaysByVipLevel; the exact trigger is not stated.",
            "retroactive*: points granted once to existing accounts when VIP launched (from the config names).",
        ],
    }
    (REPO / "data" / "vip.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"data/vip.json: {len(levels)} levels")


if __name__ == "__main__":
    main()
