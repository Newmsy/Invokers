"""Build data/progression.json (issue #22): Invoker XP per level, level caps, ascension fodder and costs, fodder XP,
XP potions. "Road to 6 stars" data.

Sources: LootDump/output/json/HeroData.json (MaxHeroExperienceByLevel, MaxTotalHeroExperienceByLevel,
AscensionMaterialsCountByRank, AscensionPriceByRankByRarity, LevelUpPriceByRank, XpAmountForSellByRank,
XpAmountForSellByLevel, MaxHeroLevel) and ResourcesData.json (ExperienceByXpPotionId).
Level caps per rank are the levels the game's stat calculator accepts (UserData/datapack/hero_stats.json).

Usage: python build_progression.py [lootdump_output_dir]
"""
import json
import sys
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
LOOT = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO.parent / "LootDump" / "output"
RANKS = ["One", "Two", "Three", "Four", "Five", "Six"]
ECHO = {"One": "ASC_Stars1", "Two": "ASC_Stars2", "Three": "ASC_Stars3", "Four": "ASC_Stars4", "Five": "ASC_Stars5"}


def load(name):
    return json.loads((LOOT / "json" / name).read_text(encoding="utf-8"))


def main():
    hero = load("HeroData.json")
    resources = load("ResourcesData.json")
    manifest = json.loads((REPO / "data" / "manifest.json").read_text(encoding="utf-8"))

    per_level = hero["MaxHeroExperienceByLevel"]          # XP to go from level n to n+1, n = 1..59
    total = hero["MaxTotalHeroExperienceByLevel"]          # cumulative XP to reach level n+1 from level 1
    max_level = {rank: 10 * (i + 1) for i, rank in enumerate(RANKS)}

    ascension = []
    for i, rank in enumerate(RANKS[:-1]):
        cost = {rarity: by_rank[rank]["RawValues"].get("Gold")
                for rarity, by_rank in hero["AscensionPriceByRankByRarity"].items() if rank in by_rank}
        ascension.append({
            "fromRank": rank, "toRank": RANKS[i + 1], "levelRequired": max_level[rank],
            "fodderCount": hero["AscensionMaterialsCountByRank"][rank],
            "fodder": [{"kind": "invoker", "rank": rank}, {"kind": "echo", "itemId": ECHO[rank]}],
            "goldByRarity": cost,
        })

    out = {
        "gameVersion": manifest["gameVersion"], "extractedAt": date.today().isoformat(),
        "source": "Static game config (HeroData, ResourcesData).",
        "maxLevel": hero["MaxHeroLevel"],
        "maxLevelByRank": max_level,
        "xpPerLevel": [{"level": n + 1, "xpToNext": xp, "totalXp": total[n]} for n, xp in enumerate(per_level)],
        "xpByRarity": "same for every rarity (the game has one XP table)",
        "levelCost": {rank: v["RawValues"] for rank, v in hero["LevelUpPriceByRank"].items()},
        "ascension": ascension,
        "fodderXp": {
            "byRank": hero["XpAmountForSellByRank"],
            "byLevel": [{"level": n + 1, "xp": xp} for n, xp in enumerate(hero["XpAmountForSellByLevel"])],
        },
        "xpItems": [{"itemId": k, "xp": v} for k, v in sorted(resources["ExperienceByXpPotionId"].items(), key=lambda kv: kv[1])],
        "unconfirmed": [
            "fodder: the ascension slots take the given number of Invokers or Echoes (in-game: 'Select {0} or more "
            "Invokers or Echoes'); the config does not say whether fodder Invokers must be the same rank. Each Echo "
            "item is described as 'Used to Ascend Invokers from N to N+1 stars', which suggests same-rank fodder.",
            "fodderXp: the config has both an XP-per-rank and an XP-per-level table for Invokers used as food; how they "
            "combine (e.g. rank base plus level) is not stated.",
            "levelCost: every rank's level-up price is empty, so levelling costs no Gold.",
        ],
    }
    (REPO / "data" / "progression.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"data/progression.json: {len(per_level)} levels, {len(ascension)} ascension steps")


if __name__ == "__main__":
    main()
