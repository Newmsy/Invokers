"""Build data/event_scoring.json (issue #13): raw drop and points tables so the site can work out event points per run.

Sources:
  - LootDump/output/json/LootData.json   loot tables (relic/accessory rank x rarity weights, resource amounts, links)
  - LootDump/output/Levels.csv           which victory tables each boss stage rolls (TableId of Victory rows)
  - event catalogs: <game>/UserData/datapack/json/Tournaments.json (latest F11) and LootDump/output/json/Tournaments.json
    (older capture), for the scoring rules of every event type seen
  - data/bosses.json                     boss modes

Expected points per run = rollsPerRun x sum(chance x (min+max)/2 x points[key]) for each family and stage.
Table expansion: an entry's share = its Probability / the table's total; a link entry rolls every linked table
(weighted by the link's share); a relic/accessory entry splits by its Rank and Rarity weights.

Usage: python build_event_scoring.py [game_dir] [lootdump_output_dir]
"""
import csv
import json
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

from decode_localization import DEFAULT_GAME

REPO = Path(__file__).resolve().parents[2]
GAME = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_GAME
LOOT = Path(sys.argv[2]) if len(sys.argv) > 2 else REPO.parent / "LootDump" / "output"
RANKS = {1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6}
RARITY = {1: "Common", 2: "Uncommon", 3: "Rare", 4: "Epic", 5: "Legendary", 6: "Mythical"}
RANK_NAME = {"One": 1, "Two": 2, "Three": 3, "Four": 4, "Five": 5, "Six": 6}


def kv(lst):
    return {e["Key"]: e["Value"] for e in lst or []}


def expand(tables, table_id, weight, out, depth=0):
    """Adds (key, min, max) -> chance per roll of this table into out."""
    t = tables.get(table_id)
    if not t or depth > 6:
        return
    items = t.get("Items") or t.get("TableItems") or []
    total = sum(i.get("Probability") or 0 for i in items) or 1
    for i in items:
        share = weight * (i.get("Probability") or 0) / total
        if not share:
            continue
        if i.get("LinkToAnotherTableItemConfig"):
            for tid in i["LinkToAnotherTableItemConfig"].get("Ids") or []:
                expand(tables, tid, share, out, depth + 1)
        elif i.get("RelicItemConfig") or i.get("AccessoryItemConfig"):
            cfg = i.get("RelicItemConfig") or i.get("AccessoryItemConfig")
            kind = "relic" if i.get("RelicItemConfig") else "accessory"
            ranks, rars = kv(cfg.get("Rank")), kv(cfg.get("Rarity"))
            rt, at = sum(ranks.values()) or 1, sum(rars.values()) or 1
            for rk, rw in ranks.items():
                for ra, aw in rars.items():
                    out[(kind, f"{rk}★ {RARITY.get(ra, ra)}", 1, 1)] += share * rw / rt * aw / at
        elif i.get("ResourceItemConfig"):
            r = i["ResourceItemConfig"]
            lo, hi = r.get("MinAmount", 0), r.get("MaxAmount", 0)
            # amounts are rolled uniformly between min and max (one line per amount, see unconfirmed)
            n = max(1, hi - lo + 1)
            for amount in range(lo, hi + 1):
                out[("resource:" + r.get("TypeId"), r.get("TypeId"), amount, amount)] += share / n


def main():
    loot = json.loads((LOOT / "json" / "LootData.json").read_text(encoding="utf-8"))
    tables = {}
    for t in loot["Loots"]:
        tables[t.get("Id") or t.get("TableId")] = t
    bosses = json.loads((REPO / "data" / "bosses.json").read_text(encoding="utf-8"))["bosses"]
    mode = {b["id"]: b["mode"] for b in bosses}

    victory = defaultdict(set)   # (region, stage) -> victory table ids
    with open(LOOT / "Levels.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["Source"] == "Victory" and r["TableId"] and r["Region"] in mode and r["Difficulty"] in ("Normal", "None"):
                victory[(r["Region"], int(r["Stage"]))].add(int(r["TableId"]))

    catalogs = []
    for p in (GAME / "UserData" / "datapack" / "json" / "Tournaments.json", LOOT / "json" / "Tournaments.json"):
        if p.exists():
            catalogs += json.loads(p.read_text(encoding="utf-8"))
    rules = {}
    for t in catalogs:
        for rule in ((t.get("Scoring") or {}).get("Rules") or []) if isinstance(t.get("Scoring"), dict) else []:
            rules.setdefault((t["TypeId"], rule["RuleType"]), rule)

    def drop_points(rule):
        return {f"{RANK_NAME[e['_Rank_k__BackingField']]}★ {e['_Rarity_k__BackingField'].replace('Mythic', 'Mythical')}": e["_Points_k__BackingField"]
                for e in rule.get("Entries") or []}

    def resource_points(rule):
        return {e["_ResourceId_k__BackingField"]: e["_Points_k__BackingField"] for e in rule.get("ResourceCollectEntries") or []}

    families = []

    def family(fid, regions, points, kind, event_type):
        stages = []
        rolls_per_run = None
        for region in regions:
            for stage in range(1, 21):
                ids = victory.get((region, stage))
                if not ids:
                    continue
                agg = defaultdict(float)
                for tid in ids:
                    t = tables.get(tid) or {}
                    iters = t.get("IterationCount") or t.get("TableIterationCount") or 1
                    sub = defaultdict(float)
                    expand(tables, tid, 1.0, sub)
                    for k, c in sub.items():
                        agg[k] += c * iters  # expected items of this key per run
                drops = [{"key": k[1], "chance": round(c, 6), "min": k[2], "max": k[3]}
                         for k, c in sorted(agg.items(), key=lambda kv: -kv[1])
                         if (kind == "resource" and k[0].startswith("resource:") and k[1] in points) or k[0] == kind]
                stages.append({"region": region, "stage": stage, "drops": drops})
        families.append({"id": fid, "event": event_type, "modes": sorted({mode[r] for r in regions}), "regions": regions,
                         "rollsPerRun": 1, "points": points, "stages": stages})

    relic_regions = [r for r, m in mode.items() if m == "relic boss"]
    any_relic = next((v for (et, rt), v in rules.items() if rt == "RelicDropScoringRule"), None)
    for region in relic_regions:
        rule = next((v for (et, rt), v in rules.items() if rt == "RelicDropScoringRule" and region in (v.get("AcceptedRegions") or [])), None)
        family(f"gear-{region}", [region], drop_points(rule or any_relic) if (rule or any_relic) else {}, "relic",
               next((et for (et, rt), v in rules.items() if v is rule), None))
        if not rule and any_relic:
            families[-1]["pointsFrom"] = "another relic boss event (no event for this boss was captured; all captured relic boss events use the same table)"
    clan = rules.get(("ClanBoss1", "GearDropScoringRule"))
    family("accessory", ["ClanBoss1"], drop_points(clan) if clan else {}, "accessory", "ClanBoss1")
    crest = rules.get(("RoleMedals", "BattleResourceScoringRule"))
    if crest:
        family("crest", crest["AcceptedRegions"], resource_points(crest), "resource", "RoleMedals")
    ess = rules.get(("Garudas", "BattleResourceScoringRule"))
    if ess:
        family("essence", ess["AcceptedRegions"], resource_points(ess), "resource", "Garudas")
    family("sparks", ["DungeonTitan"], {"EMP_AnimaSpark": 1}, "resource", None)
    families[-1]["pointsFrom"] = "the event guide workbook (no Titan event was in the captured catalogs)"

    arena = rules.get(("ArenaMedals", "ArenaBattleScoringRule"))
    leagues = defaultdict(dict)
    for e in (arena or {}).get("Entries") or []:
        leagues[e["_League_k__BackingField"]]["win" if e["_Result_k__BackingField"] == "Victory" else "loss"] = e["_Points_k__BackingField"]
    other = {f"{et}/{rt}": {k: v for k, v in r.items() if k != "$type"} for (et, rt), r in rules.items()
             if rt not in ("RelicDropScoringRule", "GearDropScoringRule", "BattleResourceScoringRule", "ArenaBattleScoringRule")}

    manifest = json.loads((REPO / "data" / "manifest.json").read_text(encoding="utf-8"))
    out = {"gameVersion": manifest["gameVersion"], "extractedAt": date.today().isoformat(),
           "source": "Loot tables (LootData), stage victory tables (Levels.csv) and event scoring rules from the captured event catalogs.",
           "howTo": "expected points per run = sum over drops of chance x (min+max)/2 x points[key]; chance is the expected "
                    "number of that drop per run (rolls already included, so rollsPerRun is 1).",
           "unconfirmed": ["Resource amounts are taken as uniform between the table's min and max (one line per amount).",
                           "sparks (Pentiax): no Titan event was in the captured catalogs; 1 point per Spark is the event guide workbook value.",
                           "Points tables are the latest seen per event type; events can change them."],
           "families": families,
           "arenaLeagues": [{"league": k, **v} for k, v in leagues.items()],
           "otherScoring": other}
    (REPO / "data" / "event_scoring.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"data/event_scoring.json: {len(families)} families, {sum(len(f['stages']) for f in families)} stages, "
          f"{len(leagues)} leagues, {len(other)} other rules")


if __name__ == "__main__":
    main()
