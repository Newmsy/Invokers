"""Build data/tips.json (issue #8): the game's loading-screen hints, tutorial popups and help text, in English.

Sources (all offline, from the installed game):
  - StreamingAssets/i18n/en_US.bin.br       the strings (see decode_localization.py)
  - StreamingAssets/aa/StandaloneWindows64/  Addressables bundles. UI prefabs name the localization keys they show,
                                             and the GameHintsDatabase asset lists the loading-screen hints in order.
  - global-metadata.dat string literals, and <game>/UserData/datapack/keys_seen.json (LootDump F11) if present,
    for keys used from code.

Usage: python build_tips.py [game_dir]      needs: pip install UnityPy brotli
"""
import json
import re
import struct
import sys
import warnings
from datetime import date
from pathlib import Path

import UnityPy

from decode_localization import DEFAULT_GAME, fnv1a64, metadata_literals, read_package

REPO = Path(__file__).resolve().parents[2]
GAME = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_GAME
BUNDLES = GAME / "Invokers_Data" / "StreamingAssets" / "aa" / "StandaloneWindows64"
UNITY_VERSION = "6000.3.21f1"  # the bundles don't carry it

# key pattern -> (context, screen); first match wins. Keys outside every pattern are not tips.
RULES = [
    (r"^ui-loading-screen-fake-sequence-", "loading", "Loading screen (progress messages)"),
    (r"^ui-battle-result-tutorial-", "tutorial", "Battle results"),
    (r"^ui-tutorial-next$", None, None),
    (r"^ui-arena-pvp-trophy-room-.*(tutorial|description)", "tutorial", "Arena trophy room"),
    (r"^ui-(tutorial-)?arena-(pvp-)?(shop|bazaar).*tutorial|^ui-arena-shop-tutorial", "tutorial", "Arena bazaar"),
    (r"^ui-tutorial-arena|^ui-arena.*tutorial", "tutorial", "Arena PvP"),
    (r"^ui-clan-boss-1-tutorial-", "tutorial", "Sorgott (accessory boss)"),
    (r"^ui-boss-relic-tutorial-", "tutorial", "Relic bosses"),
    (r"^ui-spires-|^ui-towerclimb-tutorial-", "tutorial", "Spires"),
    (r"^ui-multibattle-tutorial-", "tutorial", "Multi-Battle"),
    (r"^ui-team-selection-.*tutorial|^ui-element-scheme", "tutorial", "Team selection"),
    (r"^ui-skill-upgrade-tolerance-tutorial-", "tutorial", "Tolerances (skill upgrade)"),
    (r"^ui-chat-tutorial-", "tutorial", "Chat"),
    (r"^ui-tutorial-fuse|^ui-fuse-tutorial", "tutorial", "Fuse"),
    (r"^ui-clan-activity-tutorial|^ui-clan.*tutorial", "tutorial", "Clan"),
    (r"^ui-vip-status.*tutorial|^ui-vip-.*tutorial", "tutorial", "VIP"),
    (r"^ui-tutorial-titan-priority", "tutorial", "Team selection (Titan priority)"),
    (r"tutorial", "tutorial", None),
    (r"^ui-gear-auto-equip-help", "help", "Gear auto-equip"),
    (r"^ui-(titan-)?ascend-tab-.*-tip-label$", "help", "Ascension"),
    (r"^ui-empower.*-tip-label$", "help", "Titan empowerment"),
    (r"-tip-label$|-help$|-help-|-info-panel-", "help", None),
]
MIN_WORDS = 4  # tutorial/help strings shorter than this are button and column labels, not tips


def bundle_strings(path):
    """Length-prefixed (u32) ASCII strings in every MonoBehaviour of one bundle."""
    try:
        env = UnityPy.load(str(path))
    except Exception:
        return
    for obj in env.objects:
        if obj.type.name != "MonoBehaviour":
            continue
        try:
            raw = obj.get_raw_data()
        except Exception:
            continue
        for m in re.finditer(rb"[a-z][a-z0-9_\-]{3,120}", raw):
            start = m.start()
            if start >= 4 and struct.unpack_from("<I", raw, start - 4)[0] == m.end() - start:
                yield m.group().decode(), obj


def hints_database(obj, strings):
    """GameHintsDatabase: list of {?, ?, title key, text key, sprite guid, sprite name, sprite type} (order = hint index)."""
    raw = obj.get_raw_data()
    hints = []
    for m in re.finditer(rb"\x00\x00\x00(ui-[a-z0-9\-]+-title-\d+)", raw):
        title_key = m.group(1).decode()
        pos = m.end()
        pos += -pos % 4
        n = struct.unpack_from("<I", raw, pos)[0]
        text_key = raw[pos + 4:pos + 4 + n].decode()
        pos += 4 + n
        pos += -pos % 4
        pos += 4 + struct.unpack_from("<I", raw, pos)[0]  # sprite guid
        pos += -pos % 4
        n = struct.unpack_from("<I", raw, pos)[0]
        sprite = raw[pos + 4:pos + 4 + n].decode()
        hints.append({"key": text_key, "titleKey": title_key, "title": strings.get(fnv1a64(title_key)),
                      "text": strings.get(fnv1a64(text_key)), "context": "loading",
                      "screen": "Loading screen hints (also listed in the FAQ)", "order": len(hints) + 1,
                      "illustration": sprite})
    return hints


def main():
    warnings.filterwarnings("ignore")
    UnityPy.config.FALLBACK_UNITY_VERSION = UNITY_VERSION
    version, _package, strings = read_package(GAME / "Invokers_Data" / "StreamingAssets" / "i18n" / "en_US.bin.br")

    keys = set()
    hints = []
    for path in sorted(BUNDLES.glob("*.bundle")):
        for key, obj in bundle_strings(path):
            if fnv1a64(key) in strings:
                keys.add(key)
                if not hints and key.endswith("-title-1") and obj.peek_name() == "GameHintsDatabase":
                    hints = hints_database(obj, strings)
    keys.update(k for k in metadata_literals(GAME) if fnv1a64(k) in strings)
    seen = GAME / "UserData" / "datapack" / "keys_seen.json"
    if seen.exists():
        keys.update(k for k in json.loads(seen.read_text(encoding="utf-8")) if fnv1a64(k) in strings)

    hint_keys = {h["key"] for h in hints} | {h["titleKey"] for h in hints}
    tips = []
    for key in sorted(keys - hint_keys):
        for pattern, context, screen in RULES:
            if re.search(pattern, key):
                if context is None:
                    break
                text = strings[fnv1a64(key)]
                if context != "loading" and len(re.sub(r"<[^>]+>", " ", text).split()) < MIN_WORDS:
                    break
                tips.append({"key": key, "text": text, "context": context,
                             "screen": screen or key.removeprefix("ui-").split("-tutorial")[0].split("-tip")[0].replace("-", " ")})
                break

    out = {"gameVersion": version, "extractedAt": date.today().isoformat(),
           "source": "Installed game files (localization table and UI asset bundles); nothing comes from the server.",
           "unconfirmed": ["Whether every loading hint can appear for every player (the database has no unlock fields "
                           "this script reads).",
                           "Boss 'Tips & Strategy' (Do / Don't) lines are in bosses.json, not here."],
           "tips": hints + tips}
    (REPO / "data" / "tips.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    counts = {}
    for t in out["tips"]:
        counts[t["context"]] = counts.get(t["context"], 0) + 1
    print(f"data/tips.json: {len(out['tips'])} tips {counts}")


if __name__ == "__main__":
    main()
