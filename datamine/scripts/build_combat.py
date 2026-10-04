"""Build data/combos.json, data/stat_curves.json and data/tactics.json (issue #31).

Sources:
  - LootDump/output/ComboTimings.csv: per hero, per combo step, the base animation timings (at Combo Speed rating 0)
  - LootDump/output/StatCurves.csv: the game's own rating -> effect conversions for ratings 0..3000
  - <game>/UserData/datapack/json/BattleData.json (LootDump F11): Tactics (FormationTypes) and their upgrade prices
  - localization: tactic names (md-FormationType-Name-<id>)
Skill cooldowns and the Ultimate's mana cost go into skills.json via build_pack.py.

Usage: python build_combat.py [game_dir] [lootdump_output_dir]
"""
import csv
import json
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

from decode_localization import DEFAULT_GAME, fnv1a64, newest_package, read_package

REPO = Path(__file__).resolve().parents[2]
GAME = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_GAME
LOOT = Path(sys.argv[2]) if len(sys.argv) > 2 else REPO.parent / "LootDump" / "output"
STEPS = ["ComboZero", "Combo1", "Combo2", "Combo3", "Combo4", "Combo5"]


def r(v, n=4):
    return round(float(v), n)


def combos(hero_ids):
    by_hero = defaultdict(list)
    with open(LOOT / "ComboTimings.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["Name"] not in hero_ids:
                continue
            by_hero[row["Name"]].append({
                "step": row["Skill"], "cooldown": r(row["Cooldown"]), "preSec": r(row["PreCastAnimationLength"]),
                "castSec": r(row["CastAnimationLength"]), "endSec": r(row["EndCastAnimationLength"]),
                "requiredSec": r(row["ComboAnimationRequiredTime"]), "resetSec": r(row["ComboResetTime"]),
                "range": r(row["Range"])})
    out = []
    for hero, steps in sorted(by_hero.items()):
        steps.sort(key=lambda s: STEPS.index(s["step"]) if s["step"] in STEPS else 99)
        chain = [s for s in steps if s["step"] != "ComboZero"]
        out.append({"heroId": hero, "steps": steps,
                    "animationSec": round(sum(s["preSec"] + s["castSec"] + s["endSec"] for s in chain), 4),
                    "requiredSec": round(sum(s["requiredSec"] for s in chain), 4)})
    return out


CURVES = {
    "SkillSpeedFactorPct": ("SkillSpeedFlat", "Skill Speed: percent faster skill animations"),
    "SkillRecoveryPct": ("SkillRecoveryFlat", "Skill Recovery: percent faster cooldown recovery"),
    "ManaRegenRecoveryPct": ("ManaGenerationFlat", "Mana Generation: percent more Ultimate mana gained"),
    "InstinctFactorPct01": ("InstinctRatingFlat", "Instinct: the factor the game reads for Instinct (0-1 scale)"),
    "RunSpeed": ("MoveSpeedFlat", "Move Speed: run speed bonus"),
    "DefenseFactor": ("DefenseFlat", "Defense: damage multiplier taken at this DEF (1 = full damage)"),
    "ResistChance_ResMinusAcc": ("ResistanceFlat", "Resist chance (percent) where rating = target RES minus attacker ACC, "
                                                   "offset by 1500 (row 1500 = equal RES and ACC)"),
}


def stat_curves():
    cols = defaultdict(list)
    with open(LOOT / "StatCurves.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            for k in CURVES:
                cols[k].append(r(row[k], 6))
    return [{"id": k, "stat": CURVES[k][0], "meaning": CURVES[k][1], "ratingFrom": 0, "values": v} for k, v in cols.items()]


def tactics():
    _v, _p, strings = read_package(newest_package(GAME))
    battle = json.loads((GAME / "UserData" / "datapack" / "json" / "BattleData.json").read_text(encoding="utf-8"))
    out = []
    for f in battle["FormationTypes"]:
        out.append({
            "id": f["Id"], "name": strings.get(fnv1a64(f"md-FormationType-Name-{f['Id']}")),
            "requiredPlayerLevel": f.get("RequiredPlayerLevel"), "layout": f.get("Layout"),
            "slots": [{"position": s["Position"], "line": s["Position"].rstrip("0123456789"), "enemiesCount": s.get("EnemiesCount")}
                      for s in f.get("SlotsInfo") or []],
            "bonuses": [{"line": b["SlotLine"], "class": b.get("CharacterClass"), "stats": b["StatBonus"],
                         "valueType": "flat" if all(x.endswith("Flat") for x in b["StatBonus"]) else "percent",
                         "valuesByLevel": [round(x, 6) for x in b["ValuesByLevel"]]}
                        for b in f.get("Bonuses") or []],
        })
    prices = lambda key: [p["RawValues"] for p in battle.get(key) or []]
    return {"maxLevel": battle.get("MaxFormationLevel"), "teamPresetsLimit": battle.get("TeamPresetsCountLimit"),
            "levelUpPrice": {"fourSlot": prices("FourSlotFormationLevelUpPrice"), "fiveSlot": prices("FiveSlotFormationLevelUpPrice")},
            "tactics": out}


def main():
    manifest = json.loads((REPO / "data" / "manifest.json").read_text(encoding="utf-8"))
    head = {"gameVersion": manifest["gameVersion"], "extractedAt": date.today().isoformat()}
    hero_ids = {h["id"] for h in json.loads((REPO / "data" / "heroes.json").read_text(encoding="utf-8"))}

    def write(name, body):
        (REPO / "data" / name).write_text(json.dumps({**head, **body}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")

    c = combos(hero_ids)
    write("combos.json", {
        "source": "Hero skill configs (base timings at Combo Speed rating 0).",
        "note": "In play, combo timing is the same for every Invoker (observed in game). These per-hero values are the "
                "raw skill config and are NOT real timing differences: preSec/castSec/endSec are animation lengths, "
                "and requiredSec (0.4-0.9 s in config) does not translate into faster or slower combos either. Do not "
                "rank or compare heroes by these numbers; keep them for reference only.",
        "unconfirmed": ["How Combo Speed rating scales these timings is in stat_curves.json only if the game exposes it; "
                        "StatCurves has no Combo Speed column, so the scaling is not exported yet.",
                        "animationSec sums pre+cast+end over Combo1-5; requiredSec sums ComboAnimationRequiredTime "
                        "(the time before the next hit can start)."],
        "heroes": c})
    write("stat_curves.json", {
        "source": "The game's own rating -> effect functions, evaluated at every rating 0..3000 (StatCurves.csv).",
        "unconfirmed": ["Combo Speed and Accuracy have no curve of their own in this export."],
        "curves": stat_curves()})
    t = tactics()
    write("tactics.json", {
        "source": "BattleData.FormationTypes.",
        "unconfirmed": ["Team size: 4- and 5-slot Tactics exist (plus 1-slot ones used in special modes); which modes use which is not in this file."],
        **t})
    print(f"combos {len(c)} heroes, stat curves, tactics {len(t['tactics'])}")


if __name__ == "__main__":
    main()
