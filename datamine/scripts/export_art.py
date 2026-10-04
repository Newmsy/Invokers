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
  S_<set id>_Icon                     sets/<set id>.webp
  S_Background_<event>                events/<event>.webp (event key art), S_GlobalEvent_Icon_<event>_Short -> events/icons/
  S_GameModeCard_<mode>               modes/<mode>.webp
  S_GameLoadingIllustration_custom    loading/loading-screen.webp; S_FAQRewards_Illustration_<nn> -> loading/hints/<n>.webp
                                      (n = the hint's `order` in data/tips.json)
  Shop_ExclusivePack_<id>, S_Background_GetLegendary<id>, S_ShopPackBackground_<id>
                                      splash/heroes/<id>.webp or splash/titans/<id>.webp (the largest character art;
                                      the game has no per-hero splash, these are offer and event banners)
  other Shop_ExclusivePack_*          splash/other/<sprite name>.webp (a pack's `artLayout` in shop_packs.json)
  S_HeroIndexFactionCard_<faction>    cards/faction/<faction>.webp (faction card with character art)
  S_HeroCardRarityBackground_<rarity> cards/rarity/<rarity>.webp (hero card background per rarity)
  S_DailyRewardsIllustration_<n>, S_NewPlayerRewardsPart<n>Illustration   rewards/
  boss portraits (BOSS_SPRITES below)  bosses/<region id>.webp, the ids in data/bosses.json

Set ART_ONLY_FILES (a file with one bundle path per line) to scan only those bundles.

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
KEY_ART, CARD, SPLASH = 1280, 800, 1200

# ResourceTypeId values (Il2CppShared enum, game 0.61.1516) for the ids in data/items.json
# boss portrait sprite -> data/bosses.json id (Omnissi has one portrait per element; Space = Astral)
BOSS_SPRITES = {
    "S_BOSS_OGR049_Large": "DungeonRelics1", "S_NEC009_Large": "DungeonRelics2", "S_BOSS091_Large": "DungeonRelics6",
    "S_BOSS031_Large": "ClanBoss1", "S_BOSS008_Large": "DungeonTitan", "S_BRD001_Large": "DungeonTank",
    "S_VOL012_Large": "DungeonSupport", "S_GIA043_Large": "DungeonMelee", "S_TRO012_Large": "DungeonRanged",
    "S_BOSS001_Space_Large": "DungeonEssenceNeutral", "S_BOSS001_Fire_Large": "DungeonEssenceFire",
    "S_BOSS001_Water_Large": "DungeonEssenceWater", "S_BOSS001_Wind_Large": "DungeonEssenceWind",
    "S_BOSS001_Earth_Large": "DungeonEssenceEarth", "S_BOSS001_Light_Large": "DungeonEssenceLight",
    "S_BOSS001_Dark_Large": "DungeonEssenceDark",
}

RESOURCE_IDS_FILE = Path(__file__).resolve().parent / "resource_type_ids.json"


def targets():
    heroes = {h["id"] for h in json.loads((REPO / "data" / "heroes.json").read_text(encoding="utf-8"))}
    titans = {s["heroId"] for s in json.loads((REPO / "data" / "skills.json").read_text(encoding="utf-8")) if s["kind"] == "titan"}
    classes = {h["class"] for h in json.loads((REPO / "data" / "heroes.json").read_text(encoding="utf-8"))}
    items = {i["id"] for i in json.loads((REPO / "data" / "items.json").read_text(encoding="utf-8"))}
    sets = {x["id"] for x in json.loads((REPO / "data" / "sets.json").read_text(encoding="utf-8"))}
    resource_ids = {str(v): k for k, v in json.loads(RESOURCE_IDS_FILE.read_text(encoding="utf-8")).items() if k in items}

    def plan(name):
        if name in BOSS_SPRITES:
            return f"bosses/{BOSS_SPRITES[name]}.webp", PORTRAIT
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
        m = re.fullmatch(r"S_(\w+)_Icon", name)
        if m and m.group(1) in sets:
            return f"sets/{m.group(1)}.webp", ICON
        m = re.fullmatch(r"S_Background_((?:Collect|Get|Upgrade|Summon|Win|Campaign|Novice|ClanBoss)\w+)", name)
        if m:
            return f"events/{m.group(1)}.webp", KEY_ART
        m = re.fullmatch(r"S_GlobalEvent_Icon_(\w+)_Short", name)
        if m:
            return f"events/icons/{m.group(1)}.webp", ICON * 2
        m = re.fullmatch(r"S_GameModeCard_(\w+)", name)
        if m:
            return f"modes/{m.group(1)}.webp", CARD
        if name == "S_GameLoadingIllustration_custom":
            return "loading/loading-screen.webp", 1920
        m = re.fullmatch(r"S_FAQRewards_Illustration_(\d+)", name)
        if m:
            return f"loading/hints/{int(m.group(1))}.webp", CARD
        m = re.fullmatch(r"(?:Shop_ExclusivePack_|S_Background_GetLegendary|S_ShopPackBackground_)((?:ANIM)?[A-Z]{3}\d{3})", name)
        if m and (m.group(1) in heroes or m.group(1) in titans):
            return ("splash/titans" if m.group(1) in titans else "splash/heroes") + f"/{m.group(1)}.webp", SPLASH
        if re.fullmatch(r"Shop_ExclusivePack_\w+|S_ShopPackBackground_\w+", name):
            return f"splash/other/{name}.webp", SPLASH
        m = re.fullmatch(r"S_HeroIndexFactionCard_(\w+)", name)
        if m:
            return f"cards/faction/{m.group(1)}.webp", ICON * 2
        m = re.fullmatch(r"S_HeroCardRarityBackground_(Common|Uncommon|Rare|Epic|Legendary|Mythic)", name)
        if m:
            return f"cards/rarity/{m.group(1)}.webp", ICON
        m = re.fullmatch(r"S_DailyRewardsIllustration_(\d+)|S_NewPlayerRewardsPart(\d)Illustration", name)
        if m:
            return (f"rewards/daily-{m.group(1)}.webp" if m.group(1) else f"rewards/new-player-{m.group(2)}.webp"), CARD
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
    if os.environ.get("ART_ONLY_FILES"):
        only = {Path(l.strip()).resolve() for l in open(os.environ["ART_ONLY_FILES"], encoding="utf-8") if l.strip()}
        files = [f for f in files if f.resolve() in only]
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
            image.thumbnail((target[1], target[1]))  # never upscales
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
