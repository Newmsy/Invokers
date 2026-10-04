"""Build data/events.json (issue #13, part 2): the live tournament catalog as last captured.

Source: <game>/UserData/datapack/json/Tournaments.json, written by the LootDump F11 dump from the game's tournament
catalog (FilesTournamentCatalog; the game also caches it in LocalLow/.../tournament_catalog.dat). Names and
descriptions come from the localization table (VisualSettings.LocalizationKeys).

Usage: python build_events.py [game_dir]
"""
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from decode_localization import DEFAULT_GAME, fnv1a64, newest_package, read_package

REPO = Path(__file__).resolve().parents[2]
GAME = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_GAME
SOURCE = GAME / "UserData" / "datapack" / "json" / "Tournaments.json"


def when(dt):
    """.NET DateTime as dumped: _dateData = ticks (low 62 bits) | kind (top 2 bits)."""
    if not isinstance(dt, dict) or "_dateData" not in dt:
        return None
    ticks = dt["_dateData"] & ((1 << 62) - 1)
    return (datetime(1, 1, 1, tzinfo=timezone.utc) + timedelta(microseconds=ticks // 10)).strftime("%Y-%m-%dT%H:%M:%SZ")


def clean(o):
    """Drop $type / interop fields, unwrap _Name_k__BackingField keys, turn Reward objects into item lists."""
    if isinstance(o, dict):
        if o.get("$type") == "Reward":
            items = [{"itemId": k, "amount": v} for k, v in ((o.get("Resources") or {}).get("RawValues") or {}).items()]
            for kind in ("Heroes", "Animas", "Relics", "Accessories", "AvatarFrames"):
                if o.get(kind):
                    items.append({"kind": kind[0].lower() + kind[1:], "details": clean(o[kind])})
            if o.get("VipPoints"):
                items.append({"itemId": "VipPoints", "amount": o["VipPoints"]})
            return items
        out = {}
        for k, v in o.items():
            if k == "$type" or "IResources" in k:
                continue
            m = re.fullmatch(r"_(\w+)_k__BackingField", k)
            key = m.group(1) if m else k
            out[key[0].lower() + key[1:]] = clean(v)
        return out
    if isinstance(o, list):
        return [clean(x) for x in o]
    return o


def main():
    catalog = json.loads(SOURCE.read_text(encoding="utf-8"))
    _v, _p, strings = read_package(newest_package(GAME))
    text = lambda key: strings.get(fnv1a64(key)) if key else None
    events = []
    for t in catalog:
        vis = t.get("VisualSettings") or {}
        keys = vis.get("LocalizationKeys") or {}
        dates = t.get("DateDetails") or {}
        e = {
            "id": str(t["TournamentId"]), "tournamentId": t["TournamentId"], "type": t.get("TypeId"),
            "format": t.get("SerializationType"),
            "name": text(keys.get("LongName")) or t.get("TypeId"), "shortName": text(keys.get("ShortName")),
            "description": text(keys.get("Description")),
            "advice": [text(v) for k, v in sorted(keys.items()) if k.startswith("Advice") and text(v)],
            "division": vis.get("Division"), "art": vis.get("BackgroundKey"), "icon": vis.get("IconKey"),
            "teaserStart": when(dates.get("TeaserStartAt")), "start": when(dates.get("StartAt")),
            "registrationEnd": when(dates.get("RegistrationEndAt")), "end": when(dates.get("EndAt")),
            "rewardPeriodEnd": when(dates.get("RewardPeriodEndAt")),
            "playerLevels": [{"min": g.get("MinPlayerLevel"), "max": g.get("MaxPlayerLevel")} for g in t.get("LevelGroups") or []],
            "bracketSize": t.get("BracketSize"), "entryPoints": t.get("BracketEnrollmentPoints"),
        }
        for field in ("Scoring", "PersonalRewards", "ProgressRewards", "MilestoneRewards", "BracketRewards",
                      "GlobalRewards", "ShopItems"):
            if t.get(field):
                e[field[0].lower() + field[1:]] = clean(t[field])
        if t.get("ShopResourceId"):
            e["shopCurrency"] = t["ShopResourceId"]
        events.append({k: v for k, v in e.items() if v not in (None, [], {})})
    events.sort(key=lambda e: (e.get("start") or "", e["tournamentId"]))
    captured = datetime.fromtimestamp(SOURCE.stat().st_mtime, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    (REPO / "data" / "events.json").write_text(json.dumps(events, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    meta = REPO / "data" / "events_meta.json"
    meta.write_text(json.dumps({"capturedAt": captured, "count": len(events),
                                "source": "Live tournament catalog captured from the game client (LootDump F11).",
                                "note": "Only the player's own division is sent by the server (division field)."},
                               indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"data/events.json: {len(events)} events, captured {captured}")
    for e in events:
        print(f"  {e['tournamentId']} {e['type']:16} {e.get('start')} -> {e.get('end')}  {e['name']}")


if __name__ == "__main__":
    main()
