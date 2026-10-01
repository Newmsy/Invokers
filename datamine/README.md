# Datamining

How the data pack in `../data` is extracted from the game, and where each request stands. The extraction runs on
Newman's PC (it needs the game install, and sometimes the running game), by the local Claude Code session.

- Requests go in [`WISHLIST.md`](WISHLIST.md). The local session watches it and picks up changes.
- Scripts are in `scripts/`. Raw output goes to `out/`, which is not committed (it is large and is the game's own
  text); only the finished, documented files go into `../data`.
- Game version this reflects: **0.61.1516** (localization package `Prod_0.61.0_66`).

## Status

| # | Request | Status | Notes |
|---|---|---|---|
| 1 | Localization table (English strings) | Mostly done | Item, set, stat, element, faction, rarity, region and slot names exported (`data/items.json`, `stats.json`, `sets.json`) via the game's own `Localized.md_*` helpers. All 42,446 strings are decoded offline; 28,246 keys were named by logging lookups in a play session (`out/`, not committed). Event names still to wire up. |
| 2 | Images and icons | Not started | Art is in Unity Addressables bundles (`StreamingAssets/aa`, 179 bundles, 863 MB). Plan: extract offline with UnityPy, name files by internal id. |
| 3 | Hero stat growth / max stats | Done | `data/heroes.json`: `maxStats` and `statsByRank` from the game's own stat calculator (no gear or awakening). Awakening bonuses not included yet. |
| 4 | Skill values at every level | Done | `data/skills.json`: skill text at levels 1-11 (the cap for every rarity) for 231 heroes and 38 Titans, Titan passives at empowerment 0-6. `data/skill_costs.json` for upgrade costs. |
| 5 | Other event divisions | Blocked | The server only sends the player's own division. Needs captures from accounts in the other divisions. |
| 6 | Event scoring from game config | Not started | |
| 7 | Live event catalog, re-captured | Found on disk | The game caches it at `AppData/LocalLow/Hit_Zone/Invokers/tournament_catalog.dat` (MemoryPack). Decoder to write. |
| 8 | Exact mercy (pity) rules | Not started | Summons are server-side; rules come from summon config plus in-game text. |
| 9 | Star summon items with English names | Done | In `data/items.json` (e.g. `SI_WildStar`, `SI_FateStar`). |
| 10 | Sample of the local box file | Done | `samples/README.md` (location, format, ids, stats) and `samples/box-sample.json`; full reference decoder `scripts/decode_box.py` (heroes, gear, accessories from `aggregate_snapshots/*.dat`, binary MemoryPack). |
| 11 | Accessory set effects / slot restrictions | Done | Accessories have no set bonuses (no set config exists). Each accessory slot unlocks at a hero Awakening level (in-game text); main and sub stats are limited per slot (`AccessoryData.MainBonusesBySlot`). |
| - | In-game tips (issue #8) | Done | `data/tips.json` from `scripts/build_tips.py` (offline: localization + UI bundles via UnityPy). 40 loading-screen hints in game order with titles, 10 loading messages, 184 tutorial popup lines, 8 help labels. Boss Do/Don't lines are in `data/bosses.json`. |
| - | Boss guides (issue #11) | Done | `data/bosses.json` from `scripts/build_bosses.py`: 16 bosses with their Do/Don't lists, Corruptions and stage energy. The Do/Don't keys are built at runtime; the lists were found by running FNV-1a backwards from the hashes (see the script). Boss skills and stage HP still need a game session. |
| - | Arena trophy room | Done | `data/trophies.json` (issue #4): 15 levels per stat, bonus and medal cost per level. |

## Facts worth knowing

- Localization package: `Invokers_Data/StreamingAssets/i18n/<lang>.bin.br`, Brotli-compressed, `LOC1` format
  (documented at the top of `scripts/decode_localization.py`). 15 languages ship with the game.
- UI prefabs in the Addressables bundles name the localization keys they show (1,800+ keys not seen in code);
  `GameHintsDatabase` (a MonoBehaviour asset) lists the loading-screen hints. The bundles carry no Unity version:
  set UnityPy's fallback to `6000.3.21f1`.
- Code string literals: `Invokers_Data/il2cpp_data/Metadata/global-metadata.dat` (il2cpp metadata version 39).
- Static game data (heroes, gear, loot, events) is read from the running game by the LootDump mod; the full
  JSON sections live on Newman's PC in `Documents/MOD/LootDump/output`.
