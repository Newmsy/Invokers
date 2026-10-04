"""Decode the game's local "box" snapshots (heroes, gear, accessories) into JSON. Reference for the site's importer.

Files: %USERPROFILE%/AppData/LocalLow/Hit_Zone/Invokers/aggregate_snapshots/
  PlayerHeroesModel.dat, PlayerRelicsModel.dat (gear), PlayerAccessoriesModel.dat, PlayerArenaModel.dat (Trophy Room only)

Layout of each file:
  byte 0      format version (4)
  then        MemoryPack version-tolerant object with 3 members:
                revision (int64), hash (8 bytes), model (the Player*Model object)
Version-tolerant object: [member count: 1 byte][member lengths: VarInt each][member bytes]  (see memorypack.py)
Members appear in the model's declared field order (listed per model below). Gear/accessory stat values are the
game's F64 fixed point, Q32.32 (raw int64 / 2^32); percent stats are fractions (0.077 = 7.7%).

Usage: python decode_box.py [snapshot_dir] [out.json]
"""
import json
import os
import sys
from pathlib import Path

from memorypack import Reader, f64, i32, i64, nullable_i32

ENUMS = json.loads('{"RelicSlot":{"0":"Unknown","1":"Weapon","2":"Shield","3":"Helmet","4":"Pauldrons","5":"Gauntlets","6":"Chestplate","7":"Belt","8":"Boots"},"Rank":{"0":"Unknown","1":"One","2":"Two","3":"Three","4":"Four","5":"Five","6":"Six"},"RelicRarity":{"0":"Unknown","1":"Common","2":"Uncommon","3":"Rare","4":"Epic","5":"Legendary","6":"Greater"},"RelicSet":{"0":"Unknown","1":"CrushTolerance","2":"ManaShockTolerance","3":"FrostTolerance","4":"DazeTolerance","5":"ParalysisTolerance","6":"NightmareTolerance","7":"MindFogTolerance","8":"FatigueTolerance","9":"BlightTolerance","10":"ManaBurnTolerance","11":"AtrophyTolerance","12":"BloodRotTolerance","101":"Attack","102":"Defense","103":"Health","104":"CriticalRate","105":"CriticalDamage","106":"Accuracy","107":"Resistance","108":"Instinct","109":"ManaGeneration","110":"SkillSpeed","111":"SkillRecovery","112":"LifeSteal","113":"IgnoreDefense","114":"Support","115":"ReduceBuffDuration","116":"EventSet1","117":"EventSet2","118":"ClanBossSet1","119":"ClanBossSet2"},"CharacterStatBonus":{"0":"Unknown","1":"AttackFlat","2":"DefenseFlat","3":"HealthFlat","4":"AttackPercent","5":"DefensePercent","6":"HealthPercent","7":"CriticalRatePercent","8":"CriticalDamagePercent","9":"AccuracyFlat","10":"ResistanceFlat","11":"MoveSpeedFlat","12":"ComboSpeedFlat","13":"SkillSpeedFlat","14":"SkillRecoveryFlat","15":"ManaGenerationFlat","16":"InstinctRatingFlat","21":"IgnoreDefensePercent","22":"IncreaseHealingDone","23":"IncreaseShieldDone","24":"DecreaseDamageTaken","25":"BuffReductionDoneWithCombo3and5","26":"DodgeChance","30":"AnimaDuration","31":"LifeStealByOtherSkills","32":"RunSpeedBonusOutOfCombat","33":"LifeStealByCombos","101":"CrushTolerancePercent","102":"ManaShockTolerancePercent","103":"FrostTolerancePercent","104":"DazeTolerancePercent","105":"ParalysisTolerancePercent","106":"NightmareTolerancePercent","107":"MindFogTolerancePercent","108":"FatigueTolerancePercent","109":"BlightTolerancePercent","110":"ManaBurnTolerancePercent","111":"AtrophyTolerancePercent","112":"BloodRotTolerancePercent"},"AccessorySlot":{"0":"Unknown","1":"Amulet","2":"Earrings","3":"Banner","4":"Talisman","5":"Flasks"},"AccessoryRarity":{"0":"Unknown","1":"Common","2":"Uncommon","3":"Rare","4":"Epic","5":"Legendary"},"CharacterFaction":{"0":"Unknown","1":"Eldrin","2":"Magi","3":"Stonehearts","5":"Freeborn","6":"Beastbloods","7":"Nocturna","9":"Ironbands","11":"Cambion","12":"Lightseekers","21":"Dragons","51":"Goblins","52":"Demons","53":"Broods","54":"Abyssals","55":"Giants","56":"Necro","57":"Ogre","58":"Volcanic","59":"Tropical","91":"Neutral"},"SkillKind":{"0":"None","1":"Combo","2":"Ultimate","3":"ActiveSkill1","4":"ActiveSkill2","5":"ActiveSkill3","6":"AnimaIn","7":"Tolerance1","8":"Tolerance2","9":"Passive","10":"ActiveSkill4","11":"ActiveSkill5","12":"ActiveSkill6","13":"ActiveSkill7"},"CharacterMarker":{"0":"None","1":"Favorite","100":"First","101":"Second","102":"Third","200":"Attack","201":"Defense","202":"Support","203":"Speed"},"CharacterSkin":{"0":"Unknown","1":"Normal","2":"Chroma"}}')


def enum(kind, value):
    return ENUMS[kind].get(str(value), str(value))


def read_snapshot(path: Path):
    data = path.read_bytes()
    outer = Reader(data, 1).object()
    return {"formatVersion": data[0], "revision": i64(outer[0])}, Reader(outer[2]).object()


def bonuses(blob):
    r = Reader(blob)
    out = []
    for _ in range(r.i32()):
        b = r.object()
        out.append({"id": i32(b[0]), "stat": enum("CharacterStatBonus", i32(b[1])), "value": round(f64(b[2]), 6),
                    "upgrades": i32(b[3]), "rollsSum": round(f64(b[4]), 6)})
    return out


def gear(snapshot_dir: Path):
    # PlayerRelicsModel: LastId, RelicsById (SortedDictionary<int, PlayerRelic>), Randoms
    # PlayerRelic: InventoryId, Slot, Rank, Rarity, Set, EquippedHeroId (int?), Level, IsSeen, Bonuses
    meta, model = read_snapshot(snapshot_dir / "PlayerRelicsModel.dat")
    r = Reader(model[1])
    items = []
    for _ in range(r.i32()):
        r.i32()  # dictionary key = InventoryId
        m = r.object()
        b = bonuses(m[8])
        items.append({"id": i32(m[0]), "slot": enum("RelicSlot", i32(m[1])), "rank": enum("Rank", i32(m[2])),
                      "rarity": enum("RelicRarity", i32(m[3])), "set": enum("RelicSet", i32(m[4])),
                      "equippedHeroId": nullable_i32(m[5]), "level": i32(m[6]), "seen": bool(m[7][0]),
                      "mainStat": b[0] if b else None, "subStats": b[1:]})
    return meta, items


def accessories(snapshot_dir: Path):
    # PlayerAccessory: InventoryId, Slot, Rank, Rarity, Faction, EquippedHeroId, Level, IsSeen, Bonuses
    meta, model = read_snapshot(snapshot_dir / "PlayerAccessoriesModel.dat")
    r = Reader(model[1])
    items = []
    for _ in range(r.i32()):
        r.i32()
        m = r.object()
        b = bonuses(m[8])
        items.append({"id": i32(m[0]), "slot": enum("AccessorySlot", i32(m[1])), "rank": enum("Rank", i32(m[2])),
                      "rarity": enum("AccessoryRarity", i32(m[3])), "faction": enum("CharacterFaction", int.from_bytes(m[4], "little")),  # 16-bit enum
                      "equippedHeroId": nullable_i32(m[5]), "level": i32(m[6]), "seen": bool(m[7][0]),
                      "mainStat": b[0] if b else None, "subStats": b[1:]})
    return meta, items


ELEMENTS = {1: "Fire", 2: "Earth", 3: "Wind", 4: "Water", 5: "Light", 6: "Dark", 7: "Neutral"}


def trophies(snapshot_dir: Path):
    # PlayerArenaModel.dat (format 9 at 0.61.x): the Trophy Room is model member 8, a list of PlayerArenaHallBonus
    # {Element, Stat (CharacterStatBonus), Level}. ONLY member 8 is read: other members hold Arena opponents (other
    # players' names, ids and teams), the player's defense team and shop state, and must not be decoded or uploaded.
    meta, model = read_snapshot(snapshot_dir / "PlayerArenaModel.dat")
    r = Reader(model[8])
    out = []
    for _ in range(max(0, r.i32())):
        m = r.object()
        level = i32(m[2])
        if level:
            out.append({"element": ELEMENTS.get(i32(m[0]), str(i32(m[0]))), "stat": enum("CharacterStatBonus", i32(m[1])),
                        "level": level})
    return meta, out


def heroes(snapshot_dir: Path, code_by_config: dict):
    # PlayerHeroesModel: LastId, HeroesById, LobbyHeroIds, SeenHeroConfigIds, ReceivedHeroesCount, StarterHeroId, ...
    # PlayerHero is stored with 22 members (removed fields stay as empty slots, newer ones are appended):
    #   0 InventoryId, 1 ConfigId (int64), 2 Rank, 3 Level, 4 Experience, 5 TotalExperience, 6 Locked, 7 InStorage,
    #   8 Marker, 9 RecentBattleTime (DateTime?), 10 -, 11 RelicIdBySlot, 12 AccessoryIdBySlot, 13 -, 14 -,
    #   15 AwakeLevel, 16 AwakeNodeIds (List<int>), 17 ChromaEnabled, 18 Skin, 19 -, 20 -,
    #   21 SkillLevels (List<UpgradeableSkill {Kind, Level}>, stored as int32 pairs)
    meta, model = read_snapshot(snapshot_dir / "PlayerHeroesModel.dat")
    r = Reader(model[1])
    out = []
    for _ in range(r.i32()):
        r.i32()
        m = r.object()
        config = i64(m[1])
        skills = []
        sr = Reader(m[21])
        for _ in range(max(0, sr.i32())):
            skills.append({"skill": enum("SkillKind", sr.i32()), "level": sr.i32()})
        def slot_map(blob, kind):
            mr = Reader(blob)
            return {enum(kind, mr.i32()): mr.i32() for _ in range(max(0, mr.i32()))}
        nodes = Reader(m[16])
        out.append({"id": i32(m[0]), "configId": config, "heroId": code_by_config.get(config),
                    "rank": enum("Rank", i32(m[2])), "level": i32(m[3]), "locked": bool(m[6][0]),
                    "inStorage": bool(m[7][0]), "marker": enum("CharacterMarker", i32(m[8])),
                    "skills": skills, "gearBySlot": slot_map(m[11], "RelicSlot"),
                    "accessoryBySlot": slot_map(m[12], "AccessorySlot"), "awakenLevel": i32(m[15]),
                    "awakenNodeIds": [nodes.i32() for _ in range(max(0, nodes.i32()))],
                    "chroma": bool(m[17][0]) if m[17] else False, "skin": enum("CharacterSkin", i32(m[18])) if m[18] else None})
    return meta, out


def main():
    snap = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(os.environ["USERPROFILE"]) / "AppData/LocalLow/Hit_Zone/Invokers/aggregate_snapshots"
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / "out" / "box.json"
    repo = Path(__file__).resolve().parents[2]
    code_by_config = {h["configId"]: h["id"] for h in json.loads((repo / "data" / "heroes.json").read_text(encoding="utf-8"))}
    hm, hs = heroes(snap, code_by_config)
    gm, gs = gear(snap)
    am, acs = accessories(snap)
    tm, trs = trophies(snap)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"heroes": {**hm, "items": hs}, "gear": {**gm, "items": gs},
                               "accessories": {**am, "items": acs}, "trophies": {**tm, "items": trs}}, indent=1), encoding="utf-8")
    print(f"{len(hs)} heroes, {len(gs)} gear, {len(acs)} accessories, {len(trs)} trophy levels -> {out}")


if __name__ == "__main__":
    main()
