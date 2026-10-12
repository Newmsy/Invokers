"""Build the data pack (../../data/*.json) from the PC-side dumps.

Inputs (on Newman's PC):
  - <game>/UserData/datapack/   written in game by the LootDump mod's F11 wishlist dump
        names.json, hero_stats.json, skills_by_level.json
  - Documents/MOD/LootDump/output/   earlier LootDump exports
        Characters.csv, json/HeroData.json (playable hero list, skill costs), json/RelicData.json (set bonuses)

Usage: python build_pack.py [game_dir] [lootdump_output_dir]
"""
import csv
import json
import os
import re
import sys
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
DATA = REPO / "data"
GAME = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(os.environ.get("APPDATA", "")) / "zone.hitzone.invokers.launcher" / "game"
LOOT = Path(sys.argv[2]) if len(sys.argv) > 2 else REPO.parent / "LootDump" / "output"
DUMP = GAME / "UserData" / "datapack"

GAME_VERSION = "0.61.1523"
MAX_SKILL_LEVEL = 11  # 10 upgrades per skill, every rarity (HeroData.SkillLevelUpPrices)
RANKS = ["One", "Two", "Three", "Four", "Five", "Six"]


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def write(name, value):
    with open(DATA / name, "w", encoding="utf-8", newline="\n") as f:
        json.dump(value, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"data/{name}: {len(value) if hasattr(value, '__len__') else ''}")


def real(text):
    """The game returns the key itself when a string doesn't exist."""
    return text if text and not re.match(r"^(md|ui)-[A-Za-z]", text) else None


def main():
    names = load(DUMP / "names.json")
    hero_data = load(LOOT / "json" / "HeroData.json")
    relic_data = load(LOOT / "json" / "RelicData.json")
    playable = {str(k) for k in hero_data["HeroById"]}

    chars = {}
    with open(LOOT / "Characters.csv", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            chars[row["Id"]] = row

    # ---- stats ----
    stats = []
    for key, v in names["statBonuses"].items():
        if real(v.get("name")):
            stats.append({"id": key, "name": v["name"], "percent": key.endswith("Percent")})
    for key, v in names["stats"].items():
        if real(v.get("name")):
            stats.append({"id": key, "name": v["name"], "short": real(v.get("short")),
                          "description": real(v.get("description")), "kind": "rating"})
    stat_name = {s["id"]: s["name"] for s in stats}
    write("stats.json", stats)

    # ---- items (resources, currencies, summon items, materials) ----
    items = [{"id": key, "name": v["name"], "description": real(v.get("description"))}
             for key, v in names["resources"].items() if real(v.get("name"))]
    write("items.json", items)

    # ---- gear sets: names from the game, bonuses from the set config (the game's own 3/5-piece texts are placeholders) ----
    sets = []
    for key, info in relic_data["SetInfoBySet"].items():
        n = names["relicSets"].get(key, {})
        bonuses = {}
        for pieces, field in (("3", "ThreeItemsBonus"), ("5", "FiveItemsBonus"), ("8", "EightItemsBonus")):
            b = info.get(field)
            if b and b.get("StatBonuses"):
                bonuses[pieces] = [{"stat": s["Stat"], "statName": stat_name.get(s["Stat"]), "value": round(s["Value"], 6)}
                                   for s in b["StatBonuses"]]
        sets.append({"id": key, "name": real(n.get("name")) or key, "bonuses": bonuses,
                     "recommendation": real(n.get("recommendation"))})
    write("sets.json", sets)

    # ---- heroes ----
    stats_by_id = {str(h["id"]): h for h in load(DUMP / "hero_stats.json")}
    # Tolerance skills: HeroData lists each hero's corruptions in slot order (Tolerance1, Tolerance2); the tolerance %
    # per skill level comes from ToleranceSkillProgressions by rarity (progression level 0 = skill level 1).
    set_by_lower = {k.lower(): k for k in relic_data["SetInfoBySet"] if k.endswith("Tolerance")}
    tol_by_rarity = {}
    for row in hero_data["ToleranceSkillProgressions"]:
        tol_by_rarity.setdefault(row["Rarity"], {})[row["Level"] + 1] = row["Value"]
    heroes = []
    for cid in sorted(playable, key=lambda i: chars.get(i, {}).get("LocalizedName") or ""):
        c = chars.get(cid)
        if not c:
            continue
        s = stats_by_id.get(cid, {})
        hd = hero_data["HeroById"].get(cid, {})
        by_rank = {r: s.get("byRank", {}).get(r, {}) for r in RANKS}
        max_stats = by_rank["Six"].get("60")
        heroes.append({
            "id": c["Name"], "configId": int(cid), "name": c["LocalizedName"] or c["Name"],
            "rarity": c["Rarity"], "faction": c["Faction"], "element": c["Element"], "class": c["Class"],
            "baseRank": s.get("baseRank"), "maxStats": max_stats, "statsByRank": by_rank,
            "soulSign": hd.get("SoulSign"),
            "tolerances": [{"slot": f"Tolerance{i + 1}", "stat": set_by_lower[t.lower() + "tolerance"],
                            "byLevel": [{"level": lv, "percent": v} for lv, v in sorted(tol_by_rarity.get(c["Rarity"], {}).items())]}
                           for i, t in enumerate(hd.get("Tolerances") or [])],
        })
    write("heroes.json", heroes)

    # ---- skills (playable heroes + all Titans), levels 1..11 ----
    skills = []
    for entry in load(DUMP / "skills_by_level.json"):
        if entry["kind"] == "hero" and str(entry["id"]) not in playable:
            continue
        out = []
        # cooldown (seconds) and the Ultimate's mana cost from the hero's own skill configs (HeroData)
        configs = {c["Type"]: c for c in hero_data["HeroById"].get(str(entry["id"]), {}).get("Skills") or []}
        for sk in entry.get("skills", []):
            item = {"type": sk["type"], "title": sk.get("title") or None}
            cfg = configs.get(sk["type"])
            if cfg and cfg.get("Cooldown"):
                item["cooldown"] = cfg["Cooldown"]
            if cfg and cfg.get("Cost"):
                item["manaCost"] = cfg["Cost"]
            if "levels" in sk:
                item["levels"] = [lv for lv in sk["levels"] if lv["level"] <= MAX_SKILL_LEVEL]
            if "empowerments" in sk:
                item["empowerments"] = sk["empowerments"]
            out.append(item)
        skills.append({"heroId": entry["code"], "kind": entry["kind"], "name": entry["name"], "skills": out})
    write("skills.json", skills)

    # ---- skill upgrade costs ----
    costs = [{"rarity": p["Rarity"], "skill": p["SkillKind"], "toLevel": p["Level"] + 1,
              "cost": p["Price"]["RawValues"]} for p in hero_data["SkillLevelUpPrices"]]
    write("skill_costs.json", costs)

    # ---- arena trophy room (ArenaData.HallBonuses / HallPrices), shape agreed in issue #4 ----
    # One room per element; each stat is a trophy with 15 levels. Bonus values are the total at that level.
    arena = load(LOOT / "json" / "ArenaData.json")
    prices = [p["RawValues"] for p in arena["HallPrices"]]
    trophies = []
    for stat, values in arena["HallBonuses"].items():
        trophies.append({
            "id": stat,
            "name": stat_name.get(stat) or stat,
            "maxLevel": len(values),
            "levels": [{
                "level": i + 1,
                "cost": [{"itemId": item, "amount": amount} for item, amount in prices[i].items()],
                "bonuses": [{"stat": stat, "value": round(v, 6), "valueType": "percent" if stat.endswith("Percent") else "flat"}],
            } for i, v in enumerate(values)],
        })
    write("trophies.json", {
        "rooms": ["Fire", "Water", "Wind", "Earth", "Light", "Dark"],
        "scope": {"type": "element", "description": "Each room's trophies boost all Invokers of that room's element, in every battle."},
        "source": "Static game config (ArenaData.HallBonuses, HallPrices): changes only with game patches; nothing comes from the server.",
        "unconfirmed": [
            "Whether each level's cost is paid per stat (assumed: the config has one 15-level price list).",
            "Whether every element's room offers all stats.",
            "Which stats sit under the UI's Attack / Defense / Utility groups.",
            "Any unlock condition for the trophy room (not in the config).",
        ],
        "trophies": trophies,
    })

    manifest = load(DATA / "manifest.json")
    manifest.update({"gameVersion": GAME_VERSION, "extractedAt": date.today().isoformat()})
    write("manifest.json", manifest)


if __name__ == "__main__":
    main()
