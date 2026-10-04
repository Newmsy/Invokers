"""Build data/titans.json (issue #149): one row per Titan with rarity, role, faction and passive bonus.

Sources: LootDump/output/json/AnimaData.json (Animas[]), data/skills.json (Titan names), localization
(md-AnimaRarity-<n> rarity names, md-AnimaRole-<n> role names).

Usage: python build_titans.py [lootdump_output_dir]
"""
import json
import sys
from datetime import date
from pathlib import Path

from decode_localization import DEFAULT_GAME, fnv1a64, newest_package, read_package

REPO = Path(__file__).resolve().parents[2]
LOOT = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO.parent / "LootDump" / "output"
RARITY = {"Rare": 3, "Epic": 4, "Legendary": 5, "Mythic": 6}
ROLE = {"Tank": 1, "Damage": 2}


def main():
    anima = json.loads((LOOT / "json" / "AnimaData.json").read_text(encoding="utf-8"))
    names = {s["heroId"]: s["name"] for s in json.loads((REPO / "data" / "skills.json").read_text(encoding="utf-8")) if s["kind"] == "titan"}
    _v, _p, strings = read_package(newest_package(DEFAULT_GAME))
    text = lambda key: strings.get(fnv1a64(key))
    manifest = json.loads((REPO / "data" / "manifest.json").read_text(encoding="utf-8"))
    titans = []
    for a in anima["Animas"]:
        if a.get("IsTempAnima") or a["Name"] not in names:
            continue
        titans.append({
            "id": a["Name"], "configId": a["ID"], "name": names[a["Name"]],
            "rarity": text(f"md-AnimaRarity-{RARITY.get(a['Rarity'])}") or a["Rarity"], "rarityId": a["Rarity"],
            "role": text(f"md-AnimaRole-{ROLE.get(a['Role'])}") or a["Role"], "roleId": a["Role"],
            "faction": a.get("Faction"), "passiveBonus": a.get("PassiveBonus"),
            "passiveBonusScope": a.get("PassiveBonusSpecialization"),
            "baseRank": a.get("BaseRank"), "maxLevel": a.get("MaxLevel"),
        })
    titans.sort(key=lambda t: (-RARITY.get(t["rarityId"], 0), t["name"]))
    (REPO / "data" / "titans.json").write_text(json.dumps(titans, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"data/titans.json: {len(titans)} Titans ({manifest['gameVersion']}, {date.today()})")


if __name__ == "__main__":
    main()
