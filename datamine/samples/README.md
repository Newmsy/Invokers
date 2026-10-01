# Box file (player heroes, gear, accessories)

Answers issue #5. `box-sample.json` is a trimmed, decoded sample (5 heroes, 10 gear pieces, 3 accessories);
`../scripts/decode_box.py` is a complete reference decoder (Python, ~120 lines) to port to the site's importer.

## Where it lives

`C:\Users\<user>\AppData\LocalLow\Hit_Zone\Invokers\aggregate_snapshots\`

| File | Holds | Needed for import |
|---|---|---|
| `PlayerHeroesModel.dat` | Every hero owned: level, ascension rank, skill levels, awakening, equipped gear/accessory ids | Yes |
| `PlayerRelicsModel.dat` | Every gear piece ("relics" in game code) | Yes |
| `PlayerAccessoriesModel.dat` | Every accessory | Yes |
| `PlayerAnimasModel.dat` | Titans | Later |
| `PlayerModel.dat` | Profile (name, account) | **No - never read this one** |

There is no single box file and no JSON export: the game keeps one binary snapshot per area and rewrites each one
while it is running, whenever that area changes (e.g. gear after an upgrade), not on every launch. Players should
close the game (or wait a moment) before importing. `AppData` is hidden in Explorer; typing
`%USERPROFILE%\AppData\LocalLow\Hit_Zone\Invokers\aggregate_snapshots` into the address bar opens it.

## Format

Binary [MemoryPack](https://github.com/Cysharp/MemoryPack), version-tolerant mode, little-endian. Not compressed.

- Byte 0: file format version (2 heroes, 4 gear, 5 accessories at 0.61.1516). Then one object with 3 members:
  `revision` (int64, increases as the account changes), `hash` (8 bytes), `model`.
- Version-tolerant object: `[member count: u8]` `[byte length of each member: VarInt]` `[member bytes...]`.
  Member count 255 = null. Members are in the model's field order; removed fields stay as empty (0-length)
  members, so read by position and skip what you don't need.
- VarInt: signed byte; 0-127 is the value, otherwise a type code followed by that type: -121 u8, -122 i8, -123 u16,
  -124 i16, -125 u32, -126 i32, -127 u64, -128 i64.
- Lists/dictionaries: `i32` count (-1 = null), then elements (dictionary = key, value, key, value...).
- Enums are their underlying integer (4 bytes; the accessory faction is 2 bytes). `int?` = 8 bytes (has-value byte,
  3 padding, int32). Stat values are F64 fixed point: `int64 / 2^32`.

Member order per model (index: field) is documented at the top of each function in `decode_box.py`.

## Ids

| In the box | Maps to |
|---|---|
| hero `configId` (int64) | `data/heroes.json` `configId`; `heroId` in the sample is that hero's `id` (e.g. `NOC020`) |
| hero `id`, gear `id`, accessory `id` | Inventory ids, unique per account. A hero's `gearBySlot` / `accessoryBySlot` and an item's `equippedHeroId` use them |
| `set`, `slot`, `rarity`, `rank`, `faction` | Game enum names, as in `data/sets.json` and `data/heroes.json` (raw files store the integers; the enum tables are in `decode_box.py`) |
| `stat` | `data/stats.json` ids (`AttackPercent`, `ComboSpeedFlat`, ...) |
| hero `skills[].skill` | Skill slot (`ActiveSkill1`, `Ultimate`, `Combo`, `Tolerance1`...) matching `data/skills.json` types |

## Stats

`mainStat` and `subStats[]` per gear/accessory: `stat`, `value`, `upgrades` (times this stat was upgraded, the
in-game "1" arrows), `rollsSum` (sum of roll qualities 0.7/0.8/0.9/1.0). Percent stats are fractions
(`0.077` = 7.7%); flat stats are plain numbers.

## Personal data

None of the three import files holds an account id, player name, clan, device id or token. Inventory ids are
per-account counters only.
