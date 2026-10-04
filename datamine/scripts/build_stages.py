"""Build data/stages.json and data/chests.json (issue #25) from the LootDump F9 export.

Sources: LootDump/output/Levels.csv (one row per stage x drop), LootDistribution.csv (how in-battle loot is spread
over enemies, destructibles and chests) and ChestOdds.csv (clan activity, clan boss, PvP and VIP chests).

Drop sources in Levels.csv:
  Victory              victory loot tables, rolled once per win (chancePerRoll x rolls = expectedPerWin)
  Repeat / FirstClear  fixed rewards for every win / the first clear only
  <kind> entry         in-battle loot (kind = Enemies, Destructibles, Chests): the stage's loot entry, an amount of a
                       resource with a weight. Each defeated enemy / broken object / opened chest of a loot source
                       (LootDistribution) drops with that source's DropChance, IterationCount times, and the entry
                       is picked by weight against the stage's other entries of the same kind.
  <kind> table         the loot tables an entry points at, expanded: chance per roll and rolls each time it is rolled

Usage: python build_stages.py [lootdump_output_dir]
"""
import csv
import json
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
LOOT = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO.parent / "LootDump" / "output"


def num(v):
    if v in ("", None):
        return None
    f = float(v)
    return int(f) if f.is_integer() else round(f, 6)


def stages():
    by_level = {}
    with open(LOOT / "Levels.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            key = r["LevelId"]
            if key not in by_level:
                by_level[key] = {"id": r["LevelName"], "area": r["Area"], "region": r["Region"],
                                 "difficulty": r["Difficulty"], "stage": int(r["Stage"]),
                                 "energy": num(r["EnergyCost"]), "drops": []}
            if r["Source"] in ("None", "") or not r["Item"]:
                continue
            drop = {"source": r["Source"], "itemId": r["Item"], "min": num(r["MinAmount"]), "max": num(r["MaxAmount"]),
                    "chancePerRoll": num(r["ChancePerRoll"]), "rolls": num(r["Rolls"]),
                    "expectedPerWin": num(r["ExpectedPerWin"])}
            if r["Source"].endswith(" entry"):
                drop["weight"] = drop.pop("chancePerRoll")  # entries store the raw weight in this column
            by_level[key]["drops"].append({k: v for k, v in drop.items() if v is not None})
    order = {"Campaign": 0, "Dungeon": 1, "ClanBoss": 2, "Tower": 3, "Events": 4}
    return sorted(by_level.values(), key=lambda s: (order.get(s["area"], 9), s["region"], s["difficulty"], s["stage"]))


def chests():
    groups = defaultdict(lambda: {"items": []})
    with open(LOOT / "ChestOdds.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            g = groups[(r["Chest"], r["Tier"])]
            g.update(chest=r["Chest"], tier=r["Tier"], picks=int(r["Picks"]))
            g["items"].append({"group": int(r["GroupId"]), "itemId": r["Item"], "amount": num(r["Amount"]),
                               "weight": num(r["Weight"]), "groupChanceInPicks": num(r["GroupChanceInPicks"])})
    return list(groups.values())


def distribution():
    with open(LOOT / "LootDistribution.csv", encoding="utf-8") as f:
        return [{"source": r["Source"], "weight": num(r["Weight"]), "dropChance": num(r["DropChance"]),
                 "iterations": num(r["IterationCount"])} for r in csv.DictReader(f)]


def main():
    manifest = json.loads((REPO / "data" / "manifest.json").read_text(encoding="utf-8"))
    head = {"gameVersion": manifest["gameVersion"], "extractedAt": date.today().isoformat(),
            "source": "Static game config via the LootDump export (Levels.csv, LootDistribution.csv, ChestOdds.csv)."}
    s = stages()
    (REPO / "data" / "stages.json").write_text(json.dumps({
        **head, "lootDistribution": distribution(),
        "unconfirmed": ["How the server picks between 'entry' drops of the same kind is assumed to be by weight.",
                        "itemId 'Relic' / 'Hero' / 'Unknown' are gear, hero and empty rewards whose details are in "
                        "the linked loot tables, not in this file."],
        "stages": s}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    c = chests()
    (REPO / "data" / "chests.json").write_text(json.dumps({
        **head,
        "rules": "Each chest gives `picks` rewards. A reward is picked by weight among groups; the same group is "
                 "never picked twice. Within a group, the item and amount are picked by weight. "
                 "groupChanceInPicks = chance that group is among the chest's rewards.",
        "unconfirmed": ["No-repeat picking is how the config is shaped; it has not been checked against the server."],
        "chests": c}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"data/stages.json: {len(s)} stages; data/chests.json: {len(c)} chests")


if __name__ == "__main__":
    main()
