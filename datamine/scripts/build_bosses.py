"""Build data/bosses.json (issue #11): every dungeon and clan boss with the game's own dos and don'ts.

Sources:
  - localization table (decode_localization.py): the Do / Don't lines
  - <game>/UserData/datapack/names.json (LootDump F11): boss name, title and description per region
  - LootDump/output/Levels.csv: stages and energy cost
  - data/stats.json: the tolerance texts name the bosses each Corruption is "useful against"

The Do / Don't keys are built at runtime ("md-{0}-{1}-Do-{2}", "...-Dont-{2}", numbered from 1) and their prefix is
not stored anywhere readable. FNV-1a can be run backwards one byte at a time, so stripping "-Do-<n>" and
"-Dont-<n>" from every hash in the table and keeping the states both suffixes share finds each boss's list,
in order. Each list is tied to its region below by its content (boss names, Corruptions).

Usage: python build_bosses.py [game_dir] [lootdump_output_dir]
"""
import csv
import json
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

from decode_localization import DEFAULT_GAME, read_package

REPO = Path(__file__).resolve().parents[2]
GAME = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_GAME
LOOT = Path(sys.argv[2]) if len(sys.argv) > 2 else REPO.parent / "LootDump" / "output"

FNV_PRIME = 0x100000001B3
FNV_PRIME_INV = pow(FNV_PRIME, -1, 2 ** 64)

# FNV state after "md-{0}-{1}" -> region, checked by hand against the text of each list (game 0.61.1516)
PREFIX_REGION = {
    0x55ef901aea030c3c: "DungeonRelics1",       # Ulgorim: Power Totems, Heal Reduction
    0x55ef931aea0310d5: "DungeonRelics2",       # Althar: Block Revive, minions
    0x55ef8f1aea030a09: "DungeonRelics6",       # Sakiel: Mindworm, two phases
    0x3a75a96a13e3cc0f: "ClanBoss1",            # Sorgott
    0x0354580cc4f3e4a1: "DungeonTitan",         # Pentiax
    0x20d206b4498cf621: "DungeonTank",          # Hyxxis
    0x9f38b4b2b8f534e0: "DungeonSupport",       # Galvos
    0x22cdb3bec8ef5f43: "DungeonMelee",         # Yskara
    0x61a9279d075086ca: "DungeonRanged",        # Koltmos
    0xa5545a87d66a45a8: "DungeonEssenceNeutral",  # Astral: Crush + Atrophy
    0xf188578194e84249: "DungeonEssenceFire",   # Daze + Manaburn
    0x26dea783d80c9235: "DungeonEssenceDark",   # Manashock + Manaburn, Combo SPD Down
    0x1d7c1a06fbb1a817: "DungeonEssenceWind",   # Nightmare + Fatigue, Move SPD Down
    0xb69c5fa56993ebe0: "DungeonEssenceWater",  # Frost + Mindfog, the slow
    0x25f3ddcabd9f0fc7: "DungeonEssenceEarth",  # Paralysis + Bloodrot, buffs
    0xdc206921bf8c7eff: "DungeonEssenceLight",  # Paralysis + Blight, no heals
}
MODE = {"DungeonRelics": "relic boss", "ClanBoss": "clan boss", "DungeonEssence": "Omnissi", "DungeonTitan": "Pentiax"}
ELEMENT = {"Fire": "Fire", "Water": "Water", "Wind": "Wind", "Earth": "Earth", "Light": "Light", "Dark": "Dark",
           "Neutral": "Astral"}
CORRUPTION = {"Crush": "Crush", "ManaShock": "Manashock", "Frost": "Frost", "Daze": "Daze", "Paralysis": "Paralysis",
              "Nightmare": "Nightmare", "MindFog": "Mindfog", "Fatigue": "Fatigue", "Blight": "Blight",
              "ManaBurn": "Manaburn", "Atrophy": "Atrophy", "BloodRot": "Bloodrot"}


def unwind(h, suffix):
    for byte in reversed(suffix.encode()):
        h = ((h * FNV_PRIME_INV) % 2 ** 64) ^ byte
    return h


def dos_and_donts(strings):
    lists = {}
    for word in ("Do", "Dont"):
        found = defaultdict(dict)
        for h, text in strings.items():
            for n in range(1, 10):
                state = unwind(h, f"-{word}-{n}")
                if state in PREFIX_REGION:
                    found[state][n] = text
        lists[word] = found
    return {PREFIX_REGION[s]: {"dos": [v for _, v in sorted(lists["Do"].get(s, {}).items())],
                               "donts": [v for _, v in sorted(lists["Dont"].get(s, {}).items())]}
            for s in PREFIX_REGION}


def main():
    _version, _package, strings = read_package(GAME / "Invokers_Data" / "StreamingAssets" / "i18n" / "en_US.bin.br")
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
        boss["stages"] = [{"stage": s, "energy": e} for s, e in sorted(stages[region].items())]
        bosses.append(boss)

    out = {"gameVersion": manifest["gameVersion"], "extractedAt": date.today().isoformat(),
           "source": "Installed game files (localization table, region config, level config); nothing comes from the server.",
           "unconfirmed": [
               "mode 'other' covers the four Crest dungeon bosses (Yskara, Galvos, Hyxxis, Koltmos).",
               "corruptions come from the tolerance help texts. Two disagree with the boss's own Do list: Koltmos "
               "(help text: Manashock, Blight; Do list: Bloodrot, Manashock) and Pentiax (help text: Nightmare, Mindfog; "
               "Do list names none).",
               "Boss skills, levels and HP per stage are not exported yet (they need enemy data from a game session).",
               "Sedula (ClanBoss2) has a name in the game but no stages or advice yet.",
           ],
           "bosses": bosses}
    (REPO / "data" / "bosses.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"data/bosses.json: {len(bosses)} bosses, {sum(len(b['dos']) + len(b['donts']) for b in bosses)} lines")


if __name__ == "__main__":
    main()
