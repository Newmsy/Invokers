"""Build data/awakening.json, data/gear_costs.json and data/sources.json (issue #26).

Sources: LootDump/output/json/HeroData.json (AwakeNodes, BaseAwakeBonusBySoulSign), RelicData.json and
AccessoryData.json (upgrade, sell, deactivate and destroy prices), LootDump/output/Levels.csv (stage drops) and
data/shop_packs.json (pack contents).

Awakening trees: node id = <soul sign><awaken level><node number:2 digits>, e.g. 1101 = BladeDancer, awaken level 1,
node 1 (the root). The soul sign digit is the SoulSign enum value (1 BladeDancer ... 8 Slayer); each tree's
signature stats match that soul class's base awaken bonus. Costs name "Generic" tier items (FM_ runes, EE_
essences, RM_ crests) plus Astral Essence (AE_Mana) and Titan Sparks.

Usage: python build_awakening.py [lootdump_output_dir]
"""
import csv
import json
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
LOOT = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO.parent / "LootDump" / "output"
SOUL_SIGNS = {1: "BladeDancer", 2: "Assassin", 3: "Gladiator", 4: "Templar", 5: "Sentinel", 6: "Cleric", 7: "Warlock", 8: "Slayer"}
RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Legendary"]
TRACKED = re.compile(r"^(Memorium|FM_|EE_|AE_|RM_|EMP_AnimaSpark|ASC_Stars|Booster_(Memorium|Rune))")


def load(name):
    return json.loads((LOOT / "json" / name).read_text(encoding="utf-8"))


def costs(prices):
    return [{"itemId": k, "amount": v} for k, v in prices["RawValues"].items()]


def awakening(hero):
    trees = defaultdict(lambda: defaultdict(list))
    for node in sorted(hero["AwakeNodes"], key=lambda n: n["Id"]):
        sign, level = SOUL_SIGNS[node["Id"] // 1000], node["Id"] // 100 % 10
        trees[sign][level].append({
            "id": node["Id"], "parentId": node["ParentId"] or None,
            "bonuses": [{"stat": k, "value": round(v, 6), "valueType": "percent" if k.endswith("Percent") else "flat"}
                        for k, v in node["Bonuses"].items()],
            "costByRarity": {r: costs(node["Prices"][r]) for r in RARITIES if r in node["Prices"]},
        })
    base = {sign: {k: v for k, v in b.items() if k != "$type" and v} for sign, b in hero["BaseAwakeBonusBySoulSign"].items()}
    return {
        "soulSigns": [{"soulSign": sign, "baseBonus": base.get(sign, {}),
                       "levels": [{"awakenLevel": lvl, "nodes": nodes} for lvl, nodes in sorted(levels.items())]}
                      for sign, levels in trees.items()],
        "materialTiers": {"1": "awaken levels 1-2", "2": "awaken levels 3-4", "3": "awaken levels 5-6"},
        "unconfirmed": [
            "Generic items in the costs (FM_TierNGeneric, EE_TierNGeneric, RM_TierNGeneric): the specific items say "
            "'Used to Awaken <Faction|Element|Class> Invokers', so the hero's own faction rune, element essence and "
            "class crest are assumed to fill these slots. Whether the Generic items themselves (Ancient Rune, Raw "
            "Essence, Novice Crest...) can be used instead is not in the config.",
            "Which star rank unlocks each awaken level is not in the config.",
            "baseBonus is the soul class's flat rating bonus from BaseAwakeBonusBySoulSign; when it applies is not stated.",
        ],
    }


def gear_costs(relic, accessory):
    def table(data):
        rows = []
        for rank, by_rarity in data["UpgradePricesByRarityByRank"].items():
            for rarity, steps in by_rarity.items():
                for i, price in enumerate(steps):
                    raw = price["RawValues"]
                    rows.append({"rank": rank, "rarity": rarity, "toLevel": i + 1,
                                 "gold": raw.get("Gold", 0), "memorium": raw.get("Memorium", 0)})
        return rows

    def by_rank_rarity(d):
        return {rank: {rarity: p["RawValues"] for rarity, p in by.items()} for rank, by in (d or {}).items()}

    return {
        "gear": {"upgrade": table(relic), "sell": by_rank_rarity(relic.get("SellPriceByRarityByRank")),
                 "deactivate": by_rank_rarity(relic.get("DeactivatePriceByRarityByRank")),
                 "destroy": {rank: p["RawValues"] for rank, p in (relic.get("DestroyPriceByRank") or {}).items()}},
        "accessories": {"upgrade": table(accessory) if "UpgradePricesByRarityByRank" in accessory else [],
                        "sell": by_rank_rarity(accessory.get("SellPriceByRarityByRank"))},
        "unconfirmed": ["destroy: Memorium per rank; the config name doesn't say whether destroying gives or costs it "
                        "(in game, dismantling gear returns Memorium).",
                        "deactivate: Gold per rank and rarity; what 'deactivate' does in the UI is not stated."],
    }


def sources():
    out = defaultdict(list)
    with open(LOOT / "Levels.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if not TRACKED.match(r["Item"]):
                continue
            num = lambda v: float(v) if v not in ("", None) else None
            row = {"source": r["Area"], "region": r["Region"], "difficulty": r["Difficulty"], "stage": int(r["Stage"]),
                   "energy": int(r["EnergyCost"]) if r["EnergyCost"] else None, "drop": r["Source"],
                   "min": num(r["MinAmount"]), "max": num(r["MaxAmount"]), "chancePerRoll": num(r["ChancePerRoll"]),
                   "rolls": num(r["Rolls"]), "expectedPerRun": num(r["ExpectedPerWin"])}
            out[r["Item"]].append({k: v for k, v in row.items() if v is not None})
    packs = json.loads((REPO / "data" / "shop_packs.json").read_text(encoding="utf-8"))["packs"]
    for p in packs:
        for reward in p.get("rewards", []) + [x for s in p.get("steps", []) for x in s["rewards"]]:
            if reward and reward.get("id") and TRACKED.match(reward["id"]):
                out[reward["id"]].append({"source": "Shop", "packId": p["id"], "pack": p.get("name"),
                                          "price": p.get("price"), "amount": reward["amount"]})
    return dict(sorted(out.items()))


def main():
    manifest = json.loads((REPO / "data" / "manifest.json").read_text(encoding="utf-8"))
    head = {"gameVersion": manifest["gameVersion"], "extractedAt": date.today().isoformat()}

    def write(name, body):
        (REPO / "data" / name).write_text(json.dumps({**head, **body}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")

    write("awakening.json", {"source": "Static game config (HeroData.AwakeNodes).", **awakening(load("HeroData.json"))})
    write("gear_costs.json", {"source": "Static game config (RelicData, AccessoryData).",
                              **gear_costs(load("RelicData.json"), load("AccessoryData.json"))})
    src = sources()
    write("sources.json", {
        "source": "Stage loot from the level config (Levels.csv) and shop packs (shop_packs.json).",
        "drops": {"Victory": "per win (boss/dungeon victory table)", "Repeat": "per win (fixed reward)",
                  "FirstClear": "first clear only", "Enemies entry": "campaign loot spread over the stage's enemies",
                  "Chests entry": "campaign loot spread over the stage's chests"},
        "unconfirmed": ["Quests, login rewards, events and clan rewards are not included yet.",
                        "'Enemies entry' / 'Chests entry' amounts are the stage's loot distribution totals."],
        "items": src})
    print(f"awakening.json, gear_costs.json, sources.json ({len(src)} items)")


if __name__ == "__main__":
    main()
