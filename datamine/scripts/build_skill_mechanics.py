"""Build data/skill_mechanics.json (issues #123 item 8, #124, #134): the structured numbers inside each hero skill's
script, so the DPS simulator doesn't have to parse skill text.

Source: LootDump/output/json/HeroData.json (HeroById[].Skills[].Script, the game's skill graphs).

Per skill, the blocks that carry numbers:
  damage    DamageWithFormula / ConditionalDamageOrHeal: damage type and multipliers (x ATK / DEF / HP / max HP,
            target HP / target max HP, flat base). One entry per damage block in the graph (a block inside a loop or
            hit sequence can run more than once; the graph order is kept, the count of executions is not resolved).
  heal      HealWithFormula multipliers
  dots      DebuffBurn / DebuffBleed: duration, tick interval, damage per tick as fractions of max HP, caps
  control   ControlDebuff: effect, whether it can be resisted
  statusEffects  other buff/debuff blocks: type and whether they are unresistable
  mana      ManaGeneration: extra Ultimate/Titan mana a skill grants (on top of the base gain over time)
  byLevel   LookupBySkillLevel tables (value per skill upgrade level) found in the skill, in graph order

Usage: python build_skill_mechanics.py [lootdump_output_dir]
"""
import json
import sys
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
LOOT = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO.parent / "LootDump" / "output"
SKILLS = ["ActiveSkill1", "ActiveSkill2", "ActiveSkill3", "Ultimate", "Combo1", "Combo2", "Combo3", "Combo4", "Combo5", "ComboZero", "Passive"]
STATUS = {"BuffStat", "BuffShield", "BuffProtect", "BuffUnkillable", "BuffInvincibility", "BuffContinuousHealing",
          "BuffReflectDamage", "BuffIncreaseMaxHealth", "DebuffTaunt", "DebuffCurse", "DebuffReduceHealingReceived",
          "DebuffBlockRevive", "StealBuff", "TransferDebuff", "RemoveStatusEffect", "IncreaseStatusEffectDuration",
          "DecreaseStatusEffectDuration", "MovementEffect", "DestroyMaxHealth", "ReduceDamageShield", "ChangeActiveSkillCD"}


def r(x):
    return round(x, 6) if isinstance(x, float) else x


def mult(f):
    f = f or {}
    out = {"base": r(f.get("BaseValue", 0)), "atk": r(f.get("AtkMult", 0)), "def": r(f.get("DefMult", 0)),
           "hp": r(f.get("HpMult", 0)), "maxHp": r(f.get("MaxHpMult", 0)), "targetHp": r(f.get("TargetHpMult", 0)),
           "targetMaxHp": r(f.get("TargetMaxHpMult", 0))}
    return {k: v for k, v in out.items() if v}


def walk(o, found):
    if isinstance(o, dict):
        t = o.get("$type")
        if t:
            found.append((t, o))
        for v in o.values():
            walk(v, found)
    elif isinstance(o, list):
        for v in o:
            walk(v, found)


def skill(s):
    blocks = []
    walk(s.get("Script"), blocks)
    out = {"type": s["Type"], "cooldown": s.get("Cooldown") or None, "manaCost": s.get("Cost") or None,
           "damage": [], "heal": [], "dots": [], "control": [], "statusEffects": [], "mana": [], "byLevel": []}
    for t, b in blocks:
        if t in ("DamageWithFormula", "ConditionalDamageOrHeal"):
            out["damage"].append({"block": t, "damageType": b.get("DamageType"), "mode": b.get("FormulaMode"),
                                  "multipliers": mult(b.get("MultiplierFormula")), "ignoresSkillLevel": b.get("IgnoreSkillLevel")})
        elif t == "HealWithFormula":
            out["heal"].append({"multipliers": mult(b.get("MultiplierFormula"))})
        elif t in ("DebuffBurn", "DebuffBleed"):
            out["dots"].append({"effect": b.get("EffectType"), "duration": r(b.get("Duration")), "tickInterval": r(b.get("TickInterval")),
                                "enemyMaxHpPerTick": r(b.get("EnemyMaxHealthMultiplier") or b.get("TargetDamageMultiplier")),
                                "maxPerTick": {"stat": b.get("MaxDamageStat"), "multiplier": r(b.get("MaxTargetDamageMultiplier"))}
                                if b.get("LimitMaxDamage") else None,
                                "unresistable": b.get("Unresistable")})
        elif t == "ControlDebuff":
            out["control"].append({"effect": b.get("EffectType"), "canBeResisted": b.get("CanBeResisted"),
                                   "unresistable": b.get("Unresistable")})
        elif t in STATUS:
            e = {"block": t, "effect": b.get("EffectType")}
            if "Unresistable" in b:
                e["unresistable"] = b["Unresistable"]
            out["statusEffects"].append({k: v for k, v in e.items() if v is not None})
        elif t == "ManaGeneration":
            out["mana"].append({"to": b.get("Type"), "amount": r(b.get("Amount")), "formula": b.get("Formula")})
        elif t == "LookupBySkillLevel":
            out["byLevel"].append({"percent": b.get("IsPercent"),
                                   "values": [{"level": v.get("Level"), "value": r(v.get("Value"))} for v in b.get("Values") or []]})
    return {k: v for k, v in out.items() if v not in ([], None)}


def main():
    hero = json.loads((LOOT / "json" / "HeroData.json").read_text(encoding="utf-8"))
    heroes = {h["configId"] for h in json.loads((REPO / "data" / "heroes.json").read_text(encoding="utf-8"))}
    manifest = json.loads((REPO / "data" / "manifest.json").read_text(encoding="utf-8"))
    out = []
    for cid, h in hero["HeroById"].items():
        if int(cid) not in heroes:
            continue
        skills = [skill(s) for s in sorted(h["Skills"], key=lambda s: SKILLS.index(s["Type"]) if s["Type"] in SKILLS else 99)]
        out.append({"heroId": h["Name"], "skills": [s for s in skills if len(s) > 1]})
    out.sort(key=lambda h: h["heroId"])
    (REPO / "data" / "skill_mechanics.json").write_text(json.dumps({
        "gameVersion": manifest["gameVersion"], "extractedAt": date.today().isoformat(),
        "source": "Hero skill scripts (HeroData.HeroById[].Skills[].Script).",
        "damageByLevel": {"note": "Script multipliers are the level-11 (max) values. Damage at skill level L = multiplier "
                                  "x share[L-1]. Checked against the game's skill texts at every level.",
                          "share": [0.5, 0.53, 0.56, 0.61, 0.67, 0.72, 0.78, 0.83, 0.89, 0.94, 1.0]},
        "notes": ["damage multipliers are per damage block, at max skill level: atk 2.45 = 245% ATK at level 11, "
                  "122.5% at level 1.",
                  "DoT values are fractions per tick (0.01 = 1% of the target's max HP), capped at maxPerTick x the "
                  "caster's stat.",
                  "mana lists extra mana a skill grants; the base Ultimate mana gain is time-based (GameplayData "
                  "ManaValues.UltManaPerSec, scaled by mode multipliers and Mana Generation) - see issue #124."],
        "unconfirmed": ["How many times a damage block runs (loops, multi-hit sequences, per-target) is not resolved.",
                        "Which byLevel table feeds which value is not resolved; tables are listed in graph order."],
        "heroes": out}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"data/skill_mechanics.json: {len(out)} heroes")


if __name__ == "__main__":
    main()
