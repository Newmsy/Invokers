"""Build data/spires.json (issue #55, Spires half).

Sources (LootDump F11 dump, <game>/UserData/datapack/):
  levels/Tower<Element>_Normal_<n>.json   "info": LevelInfo of every floor; for TowerFire also "floor": its spawners
                                          (waves and enemies) and the script blocks that name waves / modify enemy stats
  names.json                              Spire names and descriptions
LootDump/output/Characters.csv            enemy names, classes and elements by character id

All six Spires share the same 120 floors (same enemies, levels, elements and modifiers; checked on every floor's
LevelInfo and on sample floors' full configs), so the floor list is exported once. What differs per Spire is which
Invokers may enter: only those of the Spire's element.

Usage: python build_spires.py [game_dir] [lootdump_output_dir]
"""
import csv
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

from decode_localization import DEFAULT_GAME

REPO = Path(__file__).resolve().parents[2]
GAME = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_GAME
LOOT = Path(sys.argv[2]) if len(sys.argv) > 2 else REPO.parent / "LootDump" / "output"
DUMP = GAME / "UserData" / "datapack"
SPIRES = ["Fire", "Water", "Wind", "Earth", "Light", "Dark"]


def wave_of(spawner_id):
    """Wave number from the spawner's name ("Wave 02 Range 1", "RNG2-3"); None when the name has none."""
    m = re.search(r"Wave\s*0*(\d+)", spawner_id) or re.search(r"^[A-Za-z]+\s*0*(\d+)", spawner_id)
    return int(m.group(1)) if m else None


def role_of(spawner_id):
    low = spawner_id.lower()
    for key, role in (("boss", "Boss"), ("tnk", "Tank"), ("tank", "Tank"), ("rng", "Ranged"), ("range", "Ranged"), ("dps", "Melee")):
        if key in low:
            return role
    return None


def enemy(chars, cid, count, role=None):
    c = chars.get(cid) or {}
    e = {"code": (c.get("Name") or "").removesuffix("_NRM") or None, "name": c.get("LocalizedName") or None,
         "class": c.get("Class") or None, "count": count}
    if role:
        e["role"] = role
    return e


def floor(n, chars):
    data = json.loads((DUMP / "levels" / f"TowerFire_Normal_{n:02d}.json").read_text(encoding="utf-8"))
    info, detail = data["info"], data["floor"]
    names = {}
    for b in detail["blocks"]:
        if b["TypeId"] == "LevelNotification":
            text = (b.get("Notification") or {}).get("Text") or ""
            m = re.match(r"Wave\s*(\d+)\s*:\s*(.+)", text.replace("\xa0", " "))
            if m:
                names[int(m.group(1))] = m.group(2).strip()
    enemies, loose = defaultdict(Counter), Counter()
    for sp in detail["spawners"]:
        w = wave_of(sp["id"])
        for p in sp["points"]:
            if w is None:
                loose[(str(p["characterId"]), role_of(sp["id"]))] += 1
            else:
                enemies[w][str(p["characterId"])] += 1
    waves = [{"wave": w, "name": names.get(w), "enemies": [enemy(chars, cid, c) for cid, c in enemies[w].most_common()]}
             for w in sorted(enemies)]
    mods = (info.get("LevelModifiers") or {})
    boosts = [{"hpPercent": b["Health"], "atkPercent": b["Attack"], "defPercent": b["Defense"]}
              for b in detail["blocks"] if b["TypeId"] == "SpawnerStatsModifier"]
    out = {"floor": n, "enemyLevel": info.get("SpawnerLevel"), "enemyElement": info.get("SpawnerElement"),
           "accuracy": (mods.get("Modifiers") or {}).get("AccuracyFlat"),
           "resistance": (mods.get("Modifiers") or {}).get("ResistanceFlat"),
           "toleranceBonus": mods.get("ToleranceLevelBonus"),
           "ultimateManaMultiplier": (info.get("ManaMultipliersOverride") or {}).get("Ultimate"),
           "heroSlots": info.get("HeroSlotsCount"), "waveNames": [names[w] for w in sorted(names)], "waves": waves}
    if loose:
        # spawners named only by role ("DPS", "RNG", "Boss"): their wave is set in the floor script, not resolved here
        out["enemiesWithoutWave"] = [enemy(chars, cid, c, role) for (cid, role), c in loose.most_common()]
    if boosts:
        out["enemyStatBoosts"] = boosts
    if any(b["TypeId"] == "InteractableControl" for b in detail["blocks"]):
        out["hasInteractables"] = True
    return out


def main():
    with open(LOOT / "Characters.csv", encoding="utf-8-sig") as f:
        chars = {r["Id"]: r for r in csv.DictReader(f)}
    regions = json.loads((DUMP / "names.json").read_text(encoding="utf-8"))["regions"]
    manifest = json.loads((REPO / "data" / "manifest.json").read_text(encoding="utf-8"))
    floors = [floor(n, chars) for n in range(1, 121)]
    out = {
        "gameVersion": manifest["gameVersion"], "extractedAt": date.today().isoformat(),
        "source": "Level configs of every Spire floor (LootDump F11), Characters.csv, region names.",
        "rules": {"entry": "Only Invokers of the Spire's element can enter it.", "keysPerDayPerSpire": 5,
                  "keyUse": "A Spire Key is only used when you win the floor.", "reset": "monthly",
                  "sharedFloors": "All six Spires use the same 120 floors below; the enemy element rotates, 20 floors of each element."},
        "spires": [{"id": f"Tower{e}", "element": e, "name": regions.get(f"Tower{e}", {}).get("name"),
                    "description": regions.get(f"Tower{e}", {}).get("description")} for e in SPIRES],
        "unconfirmed": [
            "Rules text comes from the game's Spires help popup (5 keys a day per Spire, monthly reset).",
            "enemyStatBoosts (floors 1-10 only) are the percent HP/ATK/DEF changes the floor script applies to enemy "
            "spawns; which wave each one applies to is not resolved.",
            "The in-battle tip mentions floor-specific buffs and debuffs; beyond these boosts and the stage's ACC/RES "
            "and Tolerance, no per-floor status effects were found in the floor scripts. hasInteractables marks floors "
            "with objects in the arena (e.g. the 'Explosive' waves).",
            "Rewards per floor are in stages.json (area Tower).",
            "enemiesWithoutWave: on some floors the spawners are named by role only (DPS / RNG / TNK / Boss), so their "
            "wave is not known from the name; role 'Boss' marks the floor's boss.",
        ],
        "floors": floors,
    }
    (REPO / "data" / "spires.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"data/spires.json: {len(floors)} floors, {sum(len(f['waves']) for f in floors)} waves")


if __name__ == "__main__":
    main()
