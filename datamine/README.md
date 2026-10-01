# Datamining

How the data pack in `../data` is extracted from the game, and where each request stands. The extraction runs on
Newman's PC (it needs the game install, and sometimes the running game), by the local Claude Code session.

- Requests go in [`WISHLIST.md`](WISHLIST.md). The local session watches it and picks up changes.
- Scripts are in `scripts/`. Raw output goes to `out/`, which is not committed (it is large and is the game's own
  text); only the finished, documented files go into `../data`.
- Game version this reflects: **0.61.1514** (localization package `Prod_0.61.0_66`).

## Status

| # | Request | Status | Notes |
|---|---|---|---|
| 1 | Localization table (English strings) | In progress | Decoded offline: 42,446 English strings (`scripts/decode_localization.py`). Keys are hashed (FNV-1a 64), so only 1,194 UI keys are named so far. Item, set and stat names are built at runtime by the game's `Localized.md_*` helpers; a small mod will call those for every value. Needs one game session. |
| 2 | Images and icons | Not started | Art is in Unity Addressables bundles (`StreamingAssets/aa`, 179 bundles, 863 MB). Plan: extract offline with UnityPy, name files by internal id. |
| 3 | Hero stat growth / max stats | Not started | Base stats and level/ascension tables are in `HeroData`; formulas to be confirmed in code. |
| 4 | Skill values at every level | Not started | Every skill script stores per-level lookup tables, so all levels can be exported offline. |
| 5 | Other event divisions | Blocked | The server only sends the player's own division. Needs captures from accounts in the other divisions. |
| 6 | Event scoring from game config | Not started | |
| 7 | Live event catalog, re-captured | Not started | Needs the running game; capture after each new chase. |
| 8 | Exact mercy (pity) rules | Not started | Summons are server-side; rules come from summon config plus in-game text. |
| 9 | Star summon items with English names | Waiting on #1 | |
| 10 | Sample of the local box file | Not started | Locate the file the game writes on disk; strip account ids. |
| 11 | Accessory set effects / slot restrictions | Not started | |

## Facts worth knowing

- Localization package: `Invokers_Data/StreamingAssets/i18n/<lang>.bin.br`, Brotli-compressed, `LOC1` format
  (documented at the top of `scripts/decode_localization.py`). 15 languages ship with the game.
- Code string literals: `Invokers_Data/il2cpp_data/Metadata/global-metadata.dat` (il2cpp metadata version 39).
- Static game data (heroes, gear, loot, events) is read from the running game by the LootDump mod; the full
  JSON sections live on Newman's PC in `Documents/MOD/LootDump/output`.
