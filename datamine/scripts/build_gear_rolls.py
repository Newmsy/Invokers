"""Build data/gear_rolls.json (issue #126): main and sub stat tables for gear and accessories, and the roll rules.

Sources: LootDump/output/json/RelicData.json and AccessoryData.json (MainBonusesBySlot, SubBonusesBySlot,
InitialSubBonusesCountByRarity, UpgradeCoefficients, MaxRelicLevel).

The rules below were checked against a real account's box (3,281 gear and 809 accessory main stats, 8,555 gear and
2,213 accessory substats, every one reproduced exactly):
  main stat value at level L = sum(byLevel[0..L])          (byLevel[0] = value at +0, then the gain per level)
  substat roll k (0 = when the substat appears, 1-4 = each later upgrade) = base[k] x quality
  quality is one of 0.7 / 0.8 / 0.9 / 1.0; flat stats are rounded to a whole number per roll
  flat HP (HealthFlat) is 10x the table value, for main and sub stats

Usage: python build_gear_rolls.py [lootdump_output_dir]
"""
import json
import sys
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
LOOT = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO.parent / "LootDump" / "output"


def scale(stat):
    return 10 if stat == "HealthFlat" else 1


def tables(data, main_key, sub_key):
    mains, subs = [], []
    for slot, by_stat in data[main_key].items():
        for stat, info in by_stat.items():
            for rank, values in (info.get("MainBonusByLevelByRank") or {}).items():
                mains.append({"slot": slot, "stat": stat, "rank": rank,
                              "byLevel": [round(v * scale(stat), 6) for v in values]})
    for slot, by_stat in data[sub_key].items():
        for stat, info in by_stat.items():
            for rank, values in (info.get("SubBonusByLevelByRank") or {}).items():
                subs.append({"slot": slot, "stat": stat, "rank": rank,
                             "baseByRoll": [round(v * scale(stat), 6) for v in values]})
    return mains, subs


def main():
    relic = json.loads((LOOT / "json" / "RelicData.json").read_text(encoding="utf-8"))
    acc = json.loads((LOOT / "json" / "AccessoryData.json").read_text(encoding="utf-8"))
    manifest = json.loads((REPO / "data" / "manifest.json").read_text(encoding="utf-8"))
    g_main, g_sub = tables(relic, "MainBonusesBySlot", "SubBonusesBySlot")
    a_main, a_sub = tables(acc, "MainBonusesBySlot", "SubBonusesBySlot")
    out = {
        "gameVersion": manifest["gameVersion"], "extractedAt": date.today().isoformat(),
        "source": "Static game config (RelicData, AccessoryData); rules checked against a real account's gear.",
        "rules": {
            "mainStat": "value at level L = sum(byLevel[0..L]). Depends on slot, stat and rank (stars) only, not rarity.",
            "subStatRoll": "roll k of a substat (0 = when it appears, 1-4 = each later upgrade of it) adds "
                           "baseByRoll[k] x quality. Flat stats are rounded to a whole number on every roll.",
            "qualities": [{"value": round(q, 2), "observedShare": 0.25} for q in relic["UpgradeCoefficients"]],
            "startingSubStats": relic["InitialSubBonusesCountByRarity"],
            "maxSubStats": 4,
            "milestones": [5, 10, 15, 20],
            "milestoneRule": "At each milestone the item gains a new substat if it has fewer than 4, otherwise one "
                             "existing substat is upgraded (its next roll).",
            "subStatCanRepeatMain": False,
            "maxLevel": relic["MaxRelicLevel"],
            "flatHealthScale": "HealthFlat values are already multiplied by 10 in this file (the config stores 1/10).",
            "valuesFormat": "Percent stats are fractions (0.027 = 2.7%).",
            "highRankServerSide": f"Upgrades of {relic['HighRank']}-star and higher items are decided by the server; "
                                  "the tables still apply.",
        },
        "gear": {"mainStats": g_main, "subStats": g_sub},
        "accessories": {"mainStats": a_main, "subStats": a_sub,
                        "startingSubStats": acc["InitialSubBonusesCountByRarity"],
                        "note": "Accessories follow the same rules. They have no set bonuses; see sets.json for gear sets."},
        "unconfirmed": [
            "Quality weights are not in the config; 0.7/0.8/0.9/1.0 each appeared ~25% of the time (7,554 rolls).",
            "Which substat a milestone upgrades, and which new stat is added, look uniformly random among the slot's "
            "allowed stats (not in the config).",
        ],
    }
    (REPO / "data" / "gear_rolls.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"data/gear_rolls.json: gear {len(g_main)} main / {len(g_sub)} sub rows; accessories {len(a_main)} / {len(a_sub)}")


if __name__ == "__main__":
    main()
