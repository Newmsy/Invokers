"""Build data/bosses.json (issue #11): every dungeon and clan boss with the game's own dos and don'ts.

Sources:
  - localization table (decode_localization.py): the Do / Don't lines
  - <game>/UserData/datapack/names.json (LootDump F11): boss name, title and description per region
  - LootDump/output/Levels.csv: stages and energy cost
  - <game>/UserData/datapack/levels/<region>_<difficulty>_<stage>.json (LootDump F11): per-stage boss HP, ATK, DEF,
    skill level, enemy level and element, and the stage's ACC/RES and tolerance modifiers (LevelInfo)
  - data/stats.json: the tolerance texts name the bosses each Corruption is "useful against"

The Do / Don't lines are md-LevelHint-<region>-Do-<n> and md-LevelHint-<region>-Dont-<n>, numbered from 1 (keys
are built at runtime; the game hashes them lowercased).

Usage: python build_bosses.py [game_dir] [lootdump_output_dir]
"""
import csv
import json
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

from decode_localization import DEFAULT_GAME, fnv1a64, newest_package, read_package

REPO = Path(__file__).resolve().parents[2]
GAME = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_GAME
LOOT = Path(sys.argv[2]) if len(sys.argv) > 2 else REPO.parent / "LootDump" / "output"

REGIONS = ["DungeonRelics1", "DungeonRelics2", "DungeonRelics6", "ClanBoss1", "DungeonTitan", "DungeonTank",
           "DungeonSupport", "DungeonMelee", "DungeonRanged", "DungeonEssenceNeutral", "DungeonEssenceFire",
           "DungeonEssenceDark", "DungeonEssenceWind", "DungeonEssenceWater", "DungeonEssenceEarth", "DungeonEssenceLight"]
MODE = {"DungeonRelics": "relic boss", "ClanBoss": "clan boss", "DungeonEssence": "Omnissi", "DungeonTitan": "Pentiax"}
ELEMENT = {"Fire": "Fire", "Water": "Water", "Wind": "Wind", "Earth": "Earth", "Light": "Light", "Dark": "Dark",
           "Neutral": "Astral"}
CORRUPTION = {"Crush": "Crush", "ManaShock": "Manashock", "Frost": "Frost", "Daze": "Daze", "Paralysis": "Paralysis",
              "Nightmare": "Nightmare", "MindFog": "Mindfog", "Fatigue": "Fatigue", "Blight": "Blight",
              "ManaBurn": "Manaburn", "Atrophy": "Atrophy", "BloodRot": "Bloodrot"}


def dos_and_donts(strings):
    def lines(region, word):
        out = []
        for n in range(1, 20):
            text = strings.get(fnv1a64(f"md-LevelHint-{region}-{word}-{n}"))
            if text is None:
                break
            out.append(text)
        return out
    return {r: {"dos": lines(r, "Do"), "donts": lines(r, "Dont")} for r in REGIONS}


def main():
    _version, _package, strings = read_package(newest_package(GAME))
    advice = dos_and_donts(strings)
    regions = json.loads((GAME / "UserData" / "datapack" / "names.json").read_text(encoding="utf-8"))["regions"]
    manifest = json.loads((REPO / "data" / "manifest.json").read_text(encoding="utf-8"))

    stages = defaultdict(dict)
    with open(LOOT / "Levels.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["Region"] in advice:
                stages[row["Region"]][int(row["Stage"])] = int(row["EnergyCost"])

    # "Useful against: Omnissi (Astral), Hyxxis, ..." in each tolerance's description
    against = defaultdict(list)
    for stat in json.loads((REPO / "data" / "stats.json").read_text(encoding="utf-8")):
        m = re.match(r"(\w+)Tolerance$", stat["id"])
        if m and stat.get("description"):
            names = re.sub(r"<[^>]+>", "", stat["description"].split("Useful against:")[-1])
            for name in (n.strip() for n in names.split(",")):
                against[name].append(CORRUPTION[m.group(1)])

    # per-stage boss numbers from the level configs (LevelInfo.Variables, LevelModifiers, SpawnerLevel/Element)
    stage_info = defaultdict(dict)
    for f in (GAME / "UserData" / "datapack" / "levels").glob("*.json"):
        info = json.loads(f.read_text(encoding="utf-8"))["info"]
        lpi = info["Lpi"]
        if lpi.get("Difficulty") not in ("Normal", "None"):
            continue
        variables = {v["Name"]: v["DefaultNumberValue"] for v in (info.get("Variables") or {}).get("Declarations") or []}
        mods = info.get("LevelModifiers") or {}
        entry = {"level": info.get("SpawnerLevel"), "element": info.get("SpawnerElement"),
                 "hp": variables.get("BossHP"), "atk": variables.get("BossATK"), "def": variables.get("BossDEF"),
                 "skillLevel": variables.get("Boss_Skill_Level"),
                 "accuracy": (mods.get("Modifiers") or {}).get("AccuracyFlat"),
                 "resistance": (mods.get("Modifiers") or {}).get("ResistanceFlat"),
                 "toleranceBonus": mods.get("ToleranceLevelBonus")}
        stage_info[lpi["RegionId"]][lpi["Number"]] = {k: v for k, v in entry.items() if v is not None}

    bosses = []
    for region, lists in advice.items():
        r = regions[region]
        kind = next((v for k, v in MODE.items() if region.startswith(k)), "other")
        element = ELEMENT.get(region.removeprefix("DungeonEssence")) if kind == "Omnissi" else None
        boss = {"id": region, "name": r["name"], "title": r["title"], "mode": kind}
        if element:
            boss["element"] = element
        if not r["description"].startswith("md-"):
            boss["description"] = r["description"]
        boss["dos"] = lists["dos"]
        boss["donts"] = lists["donts"]
        key = f"{r['name']} ({element})" if element else r["name"]
        if against.get(key):
            boss["corruptions"] = against[key]
        boss["stages"] = [{"stage": s, "energy": e, **stage_info[region].get(s, {})} for s, e in sorted(stages[region].items())]
        bosses.append(boss)

    out = {"gameVersion": manifest["gameVersion"], "extractedAt": date.today().isoformat(),
           "source": "Installed game files (localization table, region config, level config); nothing comes from the server.",
           "unconfirmed": [
               "mode 'other' covers the four Crest dungeon bosses (Yskara, Galvos, Hyxxis, Koltmos).",
               "corruptions come from the tolerance help texts. Two disagree with the boss's own Do list: Koltmos "
               "(help text: Manashock, Blight; Do list: Bloodrot, Manashock) and Pentiax (help text: Nightmare, Mindfog; "
               "Do list names none).",
               "Boss skills are not exported yet. Stage hp/atk/def are the boss's own base values from the level config; "
               "accuracy/resistance are the enemy team's flat bonuses; toleranceBonus is the stage's Tolerance Bonus "
               "(positive) or Penalty (negative) to your Invokers' tolerances, in percent points.",
               "skillLevel is missing on some early stages (the level config doesn't set it there).",
               "Sedula (ClanBoss2) has a name in the game but no stages or advice yet.",
           ],
           "bosses": bosses}
    (REPO / "data" / "bosses.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"data/bosses.json: {len(bosses)} bosses, {sum(len(b['dos']) + len(b['donts']) for b in bosses)} lines")


if __name__ == "__main__":
    main()
