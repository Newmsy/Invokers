"""Build data/quests.json (issue #146): every achievement and Progress Quest with its reward.

Source: LootDump/output/json/QuestData.json (AchievementPrototypes, BookPrototypes, PeriodicPrototypes).
Text keys (the game hashes them lowercased; see decode_localization.py):
  achievements      md-QuestPrototypeAchievement-Singular-Title-<group number> (amount 1) or -Plural-Title-<group number>
                    (group number = QuestAchievementGroup enum)
                    md-QuestPrototypeAchievement-<group number>-Title-<level>    (groups with per-level titles)
  progress quests   md-QuestPrototypeBook-Title-<quest id>
{0} in a title is the quest's RequiredAmount. Named parameters such as {HeroUpgradeLevel} are filled by the game from
the quest's conditions and are left as they are.

Achievement tabs follow the group number ranges (QuestAchievementTab: Account, Summon, Collection, Gear, Battle).

Usage: python build_quests.py [lootdump_output_dir]
"""
import json
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

from decode_localization import DEFAULT_GAME, fnv1a64, newest_package, read_package

REPO = Path(__file__).resolve().parents[2]
LOOT = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO.parent / "LootDump" / "output"
ENUMS = Path(__file__).resolve().parent / "quest_achievement_groups.json"
TABS = [(100, "Account"), (200, "Summon"), (300, "Collection"), (400, "Gear"), (10 ** 9, "Battle")]


def tab(group_number):
    return next(name for limit, name in TABS if group_number < limit)


def rewards(reward):
    out = [{"type": "Resource", "id": k, "amount": v} for k, v in ((reward or {}).get("Resources") or {}).get("RawValues", {}).items()]
    for kind in ("Heroes", "Animas", "Relics", "Accessories"):
        for item in (reward or {}).get(kind) or []:
            out.append({"type": kind[:-1] if kind != "Heroes" else "Hero", "details": {k: v for k, v in item.items() if k != "$type"}})
    if reward and reward.get("VipPoints"):
        out.append({"type": "Resource", "id": "VipPoints", "amount": reward["VipPoints"]})
    return out


def fill(text, amount):
    if text is None:
        return None
    return re.sub(r"<[^>]+>", "", text.replace("{0}", f"{amount:,}").replace("{RequiredAmount}", f"{amount:,}"))


def main():
    quests = json.loads((LOOT / "json" / "QuestData.json").read_text(encoding="utf-8"))
    group_numbers = json.loads(ENUMS.read_text(encoding="utf-8"))
    _v, _p, strings = read_package(newest_package(DEFAULT_GAME))
    t = lambda key: strings.get(fnv1a64(key))
    manifest = json.loads((REPO / "data" / "manifest.json").read_text(encoding="utf-8"))

    achievements = []
    for a in quests["AchievementPrototypes"].values():
        n = group_numbers.get(a["Group"])
        form = "Singular" if a["RequiredAmount"] == 1 else "Plural"
        other = "Plural" if form == "Singular" else "Singular"
        title = (t(f"md-QuestPrototypeAchievement-{n}-Title-{a['Level']}") or t(f"md-QuestPrototypeAchievement-{form}-Title-{n}")
                 or t(f"md-QuestPrototypeAchievement-{other}-Title-{n}"))
        achievements.append({"section": tab(n) if n is not None else None, "group": a["Group"], "groupNumber": n,
                             "level": a["Level"], "order": (n or 0) * 1000 + a["Level"], "id": a["Id"],
                             "task": fill(title, a["RequiredAmount"]), "template": title, "required": a["RequiredAmount"],
                             "rewards": rewards(a.get("Reward"))})
    achievements.sort(key=lambda a: a["order"])

    pages = defaultdict(list)
    for b in quests["BookPrototypes"]:
        pages[b["Page"]].append(b)
    progress = []
    for page, items in sorted(pages.items()):
        items.sort(key=lambda b: b["SortOrder"])
        tasks, completion = [], None
        for b in items:
            title = t(f"md-QuestPrototypeBook-Title-{b['Id']}")
            if b["Action"] == "QuestComplete":  # "Page {0} Completion": finishing the page
                completion = rewards(b.get("Reward"))
                continue
            tasks.append({"order": b["SortOrder"], "id": b["Id"], "task": fill(title, b["RequiredAmount"]), "template": title,
                          "action": b["Action"], "required": b["RequiredAmount"], "rewards": rewards(b.get("Reward"))})
        progress.append({"page": page, "tasks": tasks, "completionReward": completion or []})

    periodic = [{"group": p.get("Group"), "order": p.get("SortOrder"), "id": p["Id"], "action": p["Action"],
                 "required": p["RequiredAmount"], "rewards": rewards(p.get("Reward"))} for p in quests["PeriodicPrototypes"]]

    out = {"gameVersion": manifest["gameVersion"], "extractedAt": date.today().isoformat(),
           "source": "Static game config (QuestData); English text from the localization table.",
           "notes": ["task = the game's title with {0} filled by the required amount. Named parameters like "
                     "{HeroUpgradeLevel} are filled in game from the quest's conditions and are left in place here.",
                     "achievement order = group number then level (the game lists groups in enum order)."],
           "unconfirmed": ["Achievement section (tab) comes from the group number ranges, not from a config table: "
                           "0-99 Account, 100s Summon, 200s Collection, 300s Gear, 400+ Battle. The tab names shown "
                           "in game may differ (e.g. 'General', 'Development').",
                           "Periodic (daily/weekly) quests have no English text in this export yet.",
                           "About 14% of achievement levels (mostly Greater Relic collection, formation upgrades and some "
                           "boss-stage groups) and ~50 Progress Quest tasks have no title found yet (task is null); their "
                           "rewards are still listed."],
           "achievements": achievements, "progressQuests": progress, "periodicQuests": periodic}
    (REPO / "data" / "quests.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    missing = sum(1 for a in achievements if not a["task"]) + sum(1 for p in progress for x in p["tasks"] if not x["task"])
    print(f"data/quests.json: {len(achievements)} achievements, {len(progress)} progress pages, {len(periodic)} periodic; "
          f"{missing} without text")


if __name__ == "__main__":
    main()
