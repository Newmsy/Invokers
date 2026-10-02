"""Export hero/Titan portraits, skill icons and UI icons to site/public/art (issue #12), as WebP.

Sources: Unity Addressables bundles. Some ship with the game (Invokers_Data/StreamingAssets/aa), most are downloaded
on first launch into %USERPROFILE%/AppData/LocalLow/Unity/Hit_Zone_Invokers/<hash>/<hash>/__data. The bundles
carry no Unity version, so UnityPy's fallback is set to the game's (6000.3.21f1).

Sprite names -> output:
  S_<id>_Large                        heroes/<id>.webp, titans/<id>.webp (Titan ids start with ANIM)
  S_<id>_Skill_<n> / _Skill_Ultimate  skills/<id>_ActiveSkill<n>.webp / skills/<id>_Ultimate.webp
  S_<id>_Passive_1                    skills/<id>_Passive.webp
  S_<Element>_Element_Icon            icons/element/<Element>.webp (Neutral -> Astral is left as Neutral)
  S_HeroClass_<Class>                 icons/class/<Class>.webp
  S_Resource-<n>                      items/<ResourceTypeId name>.webp (enum values from the game code)

Usage: python export_art.py [game_dir]      needs: pip install UnityPy Pillow
"""
import json
import os
import re
import sys
import warnings
from pathlib import Path

import UnityPy

from decode_localization import DEFAULT_GAME

REPO = Path(__file__).resolve().parents[2]
GAME = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_GAME
CACHE = Path(os.environ["USERPROFILE"]) / "AppData" / "LocalLow" / "Unity" / "Hit_Zone_Invokers"
OUT = REPO / "site" / "public" / "art"
UNITY_VERSION = "6000.3.21f1"
PORTRAIT, ICON, QUALITY = 600, 128, 80

# ResourceTypeId values (Il2CppShared enum, game 0.61.1516) for the ids in data/items.json
RESOURCE_IDS_FILE = Path(__file__).resolve().parent / "resource_type_ids.json"


def targets():
    heroes = {h["id"] for h in json.loads((REPO / "data" / "heroes.json").read_text(encoding="utf-8"))}
    titans = {s["heroId"] for s in json.loads((REPO / "data" / "skills.json").read_text(encoding="utf-8")) if s["kind"] == "titan"}
    classes = {h["class"] for h in json.loads((REPO / "data" / "heroes.json").read_text(encoding="utf-8"))}
    items = {i["id"] for i in json.loads((REPO / "data" / "items.json").read_text(encoding="utf-8"))}
    resource_ids = {str(v): k for k, v in json.loads(RESOURCE_IDS_FILE.read_text(encoding="utf-8")).items() if k in items}

    def plan(name):
        m = re.fullmatch(r"S_([A-Z]{3}\d{3}|ANIM[A-Z]{3}\d{3})_(Large|Skill_\d|Skill_Ultimate|Passive_1)", name)
        if m and (m.group(1) in heroes or m.group(1) in titans):
            code, part = m.groups()
            if part == "Large":
                return ("titans" if code in titans else "heroes") + f"/{code}.webp", PORTRAIT
            kind = {"Skill_Ultimate": "Ultimate", "Passive_1": "Passive"}.get(part) or "ActiveSkill" + part[-1]
            return f"skills/{code}_{kind}.webp", ICON
        m = re.fullmatch(r"S_(\w+)_Element_Icon", name)
        if m:
            return f"icons/element/{m.group(1)}.webp", ICON
        m = re.fullmatch(r"S_HeroClass_(\w+)", name)
        if m and m.group(1) in classes:
            return f"icons/class/{m.group(1)}.webp", ICON
        m = re.fullmatch(r"S_Resource-(\d+)", name)
        if m and m.group(1) in resource_ids:
            return f"items/{resource_ids[m.group(1)]}.webp", ICON
        return None

    return plan


def main():
    warnings.filterwarnings("ignore")
    UnityPy.config.FALLBACK_UNITY_VERSION = UNITY_VERSION
    plan = targets()
    files = sorted((GAME / "Invokers_Data" / "StreamingAssets" / "aa" / "StandaloneWindows64").glob("*.bundle"))
    files += sorted(CACHE.glob("*/*/__data"))
    done = {}
    for path in files:
        try:
            env = UnityPy.load(str(path))
        except Exception:
            continue
        for obj in env.objects:
            if obj.type.name != "Sprite":
                continue
            try:
                name = obj.peek_name()
            except Exception:
                continue
            target = plan(name) if name else None
            if not target or target[0] in done:
                continue
            try:
                image = obj.read().image
            except Exception as e:
                print(f"skip {name}: {e}")
                continue
            image.thumbnail((target[1], target[1]))
            dest = OUT / target[0]
            dest.parent.mkdir(parents=True, exist_ok=True)
            image.save(dest, "WEBP", quality=QUALITY, method=6)
            done[target[0]] = name
    counts = {}
    for rel in done:
        counts[rel.rsplit("/", 1)[0]] = counts.get(rel.rsplit("/", 1)[0], 0) + 1
    print(f"{len(done)} files -> {OUT}: {counts}")


if __name__ == "__main__":
    main()
