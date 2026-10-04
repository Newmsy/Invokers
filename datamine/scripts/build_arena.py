"""Build data/arena.json (issue #55, Arena half): how battles change in Arena PvP.

Sources: <game>/UserData/datapack/json/GameplayData.json (LootDump F11): Pvp (PvpGameplayData) and ManaValues.
Texts: the game's own Arena stat-modification popup (ui-arena-pvp-team-selection-tutorial-*).

Usage: python build_arena.py [game_dir]
"""
import json
import sys
from datetime import date
from pathlib import Path

from decode_localization import DEFAULT_GAME, fnv1a64, newest_package, read_package

REPO = Path(__file__).resolve().parents[2]
GAME = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_GAME
TEXT_KEYS = ["description", "effects-scaling-title", "diminishing-title", "diminishing-mid", "diminishing-first",
             "diminishing-last", "diminishing-example", "titan-bound-effet"]


def main():
    gameplay = json.loads((GAME / "UserData" / "datapack" / "json" / "GameplayData.json").read_text(encoding="utf-8"))
    pvp, mana = gameplay["Pvp"], gameplay["ManaValues"]
    _v, _p, strings = read_package(newest_package(GAME))
    manifest = json.loads((REPO / "data" / "manifest.json").read_text(encoding="utf-8"))
    out = {
        "gameVersion": manifest["gameVersion"], "extractedAt": date.today().isoformat(),
        "source": "Static game config (GameplayData.Pvp, GameplayData.ManaValues) and the in-game Arena help popup.",
        "healthBonus": pvp["HealthBonus"],
        "titanStatsMultiplier": round(pvp["AnimaStatsMultiplier"], 6),
        "initialCooldownFactor": pvp["InitialCooldownFactor"],
        "endBattleDelaySec": pvp["EndBattleDelay"],
        "mana": {
            "pvp": {"ultimate": mana["ManaMultipliersPvp"]["Ultimate"], "titan": round(mana["ManaMultipliersPvp"]["Anima"], 4)},
            "pve4": {"ultimate": mana["ManaMultipliersFour"]["Ultimate"], "titan": round(mana["ManaMultipliersFour"]["Anima"], 4)},
            "pve5": {"ultimate": mana["ManaMultipliersFive"]["Ultimate"], "titan": round(mana["ManaMultipliersFive"]["Anima"], 4)},
            "spires": {"ultimate": mana["ManaMultipliersTowers"]["Ultimate"], "titan": round(mana["ManaMultipliersTowers"]["Anima"], 4)},
            "titanCooldownSec": {"pvp": mana["AnimaCooldownPvp"], "pve": mana["AnimaCooldown"]},
            "titanDurationSec": mana["AnimaDuration"], "titanManaCost": mana["AnimaManaCost"], "maxTitanMana": mana["MaxAnimaMana"],
        },
        "controlDiminishingReturns": {
            "windowSec": pvp["ControlDiminishingReturnsWindowDuration"],
            "immunitySec": pvp["ControlDiminishingReturnsLockDuration"],
            "durationMultipliers": [round(x, 4) for x in pvp["ControlDiminishingReturnsMultipliers"]],
        },
        "effectDurationPercent": [{k[0].lower() + k[1:]: v for k, v in row.items() if k != "$type"}
                                  for row in pvp["EffectDurationPercents"]],
        "texts": {k: strings.get(fnv1a64(f"ui-arena-pvp-team-selection-tutorial-{k}")) for k in TEXT_KEYS},
        "unconfirmed": [
            "healthBonus (8): read as Invoker HP x8 in Arena; the config gives the number only.",
            "titanStatsMultiplier (0.05): what the Titan's stats are multiplied by in Arena (as named in the config).",
            "initialCooldownFactor is 0.5 in config, so skills would start with cooldowns 50% done (or 50% remaining). "
            "The in-battle PvP tip says 70%; the tip may be outdated.",
            "effectDurationPercent: percent of the normal duration a buff/debuff lasts in Arena, by the kind of skill that "
            "applied it (single-target or AOE).",
        ],
    }
    (REPO / "data" / "arena.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print("data/arena.json written")


if __name__ == "__main__":
    main()
