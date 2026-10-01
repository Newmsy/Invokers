# Data pack

Exported from the game by the datamining side (`../datamine/scripts/build_pack.py`). The site reads these files at
build time and never writes to them. Game version and extraction date: `manifest.json`.

| File | What it holds |
| --- | --- |
| `manifest.json` | `gameVersion`, `extractedAt`, `schemaVersion` |
| `heroes.json` | The 231 playable heroes: `id` (internal code, e.g. `FRB003`, also used for art file names), `configId`, English `name`, `rarity`, `faction`, `element`, `class`, `baseRank`, `maxStats` (rank Six, level 60, no gear or awakening), `statsByRank` (rank → level → stats, levels 1/10/…/60 that the rank allows) |
| `skills.json` | Skills for every playable hero and all 38 Titans: `heroId`, `kind` (`hero`/`titan`), `name`, `skills[]` with `type`, `title`, `cooldown` (s), `levels[]` (`level` 1–11, `text` with the game's rich-text tags); Titan `PassiveBonus` has `empowerments[]` (0–6) instead |
| `skill_costs.json` | Skill upgrade cost by hero rarity, skill kind and target level |
| `items.json` | Resources, currencies, summon items and materials: `id` (game enum name), English `name`, `description` |
| `stats.json` | Stat names: stat bonuses (`AttackPercent`, …, `percent` flag) and character stat ratings (`kind: rating`) |
| `sets.json` | Gear sets: `id`, English `name`, `bonuses` keyed by pieces (`3`/`5`/`8`) with `stat`, `statName`, `value` (fractions for percent stats), and the game's `recommendation` text. The game's own 3/5-piece texts are placeholders, so describe bonuses from `bonuses`. |
| `trophy_room.json` | Arena trophy room: one room per element, 15 levels per stat, bonus per level and medal cost per level |
| `events.json` | Placeholder (not exported yet) |

Notes: stat values are as the game stores them (percent stats as fractions, e.g. `0.15` = 15%). Text keeps the game's
`<color>`/`<b>`/`<br>` tags; the site decides how to render them.
