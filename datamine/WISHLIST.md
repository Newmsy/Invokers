# What still needs datamining

Written 2026-10-01 for the app sections plan (index and ratings, event planners, star summons calculator, gear optimiser, blog). It's based on the gaps in datamine-inventory.md (project files), game version 0.61.1514. Your PC Claude does the extraction.

## Priority 1: blocks several sections

| # | What | Why | Notes |
|---|---|---|---|
| 1 | **Localization table (English strings)** | Items, sets and stats have no English names, and set bonuses without stats have no description. The optimiser, summons calculator and planners all show these. | One dump fixes items, sets and stats. Event names would then come from the game instead of the workbook's own labels. |
| 2 | **Images and icons** | Newms chose to publish game art. | Hero portraits (231) and Titan art (38); skill icons; element, faction, class and rarity icons; gear slot, set and rarity icons; item icons (currencies, summon items, ascension and fusion materials). Export as PNG or WebP with the internal id as the file name (e.g. `LTS017.png`) so the site can match them to data. Record the source asset name next to each one. |

## Invoker index and ratings

| # | What | Why |
|---|---|---|
| 3 | **Hero stat growth** (per level, per ascension star, awakening nodes), or a computed max-stats table | `stats.max` isn't stored. Pages and ratings need max-level stats. |
| 4 | **Skill values at every level** (multipliers, cooldowns, effect chances) | SkillTexts is level 1 but the workbook shows level 2. Having every level resolves that and lets pages show what upgrades do. |

## Event planners

| # | What | Why |
|---|---|---|
| 5 | **The other two event divisions** (level ranges, entry points, reward thresholds) | The server only sends the player's own division. This needs a capture from accounts in the other divisions, or a source that lists all three. |
| 6 | **Standalone event scoring from game config**, if the client has it | Points per activity currently come from the workbook (the live catalog). Taking them from config is easier to re-export each patch. |
| 7 | **Live event catalog and current chase tiers, re-captured regularly** | The workbook's calendar is a 27 Sep snapshot that's already stale. The calendar and the planners' chase targets need a fresh capture for each new chase. |

## Star summons calculator

| # | What | Why |
|---|---|---|
| 8 | **Exact mercy (pity) rules**: what counts toward it, when it resets, whether it's shared across summon items | The calculator's mercy counter depends on getting this right. Summons.csv has the fields, but the semantics need confirming. |
| 9 | **Which summon items count as "star summons"**, with their English names | Comes with #1. |

## Gear optimiser

| # | What | Why |
|---|---|---|
| 10 | **A sample of the game's local box file** (the one ggnoluck imports in the browser), with account ids and names removed | Shows the import format, so players can load their own gear without uploading it. |
| 11 | **Accessory set effects** and any slot restrictions | Accessories have the same shape as gear but haven't been checked for set effects. |

## Blog

Nothing needed.

## Every patch

Re-export the whole pack on each game update, with the version and extraction date in the manifest, so every page can show which version it reflects.
