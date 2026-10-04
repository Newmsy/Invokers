# Data pack

Exported from the game by the datamining side (`../datamine/scripts/build_pack.py`). The site reads these files at
build time and never writes to them. Game version and extraction date: `manifest.json`.

| File | What it holds |
| --- | --- |
| `manifest.json` | `gameVersion`, `extractedAt`, `schemaVersion` |
| `heroes.json` | The 231 playable heroes: `id` (internal code, e.g. `FRB003`, also used for art file names), `configId`, English `name`, `rarity`, `faction`, `element`, `class`, `baseRank`, `maxStats` (rank Six, level 60, no gear or awakening), `statsByRank` (rank → level → stats, levels 1/10/…/60 that the rank allows), `soulSign` (Awakening type, matches `awakening.json`), `tolerances[]` `{slot: Tolerance1/Tolerance2, stat: the tolerance set id e.g. DazeTolerance, byLevel[] {level 1-11, percent}}` |
| `skills.json` | Skills for every playable hero and all 38 Titans: `heroId`, `kind` (`hero`/`titan`), `name`, `skills[]` with `type`, `title`, `cooldown` (s), `levels[]` (`level` 1–11, `text` with the game's rich-text tags); Titan `PassiveBonus` has `empowerments[]` (0–6) instead |
| `skill_costs.json` | Skill upgrade cost by hero rarity, skill kind and target level |
| `items.json` | Resources, currencies, summon items and materials: `id` (game enum name), English `name`, `description` |
| `stats.json` | Stat names: stat bonuses (`AttackPercent`, …, `percent` flag) and character stat ratings (`kind: rating`) |
| `sets.json` | Gear sets: `id`, English `name`, `bonuses` keyed by pieces (`3`/`5`/`8`) with `stat`, `statName`, `value` (fractions for percent stats), and the game's `recommendation` text. The game's own 3/5-piece texts are placeholders, so describe bonuses from `bonuses`. |
| `trophies.json` | Arena trophy room (issue #4): `rooms` (elements), `scope`, `trophies[]` per stat with `levels[]` of `cost[]` `{itemId, amount}` and `bonuses[]` `{stat, value, valueType}` (total at that level); `unconfirmed` lists what the config doesn't say |
| `tips.json` | In-game tips (issue #8): `tips[]` with `key`, `text`, `context` (`loading`/`tutorial`/`help`/`battle`), `screen`. The 303 `battle` tips are the in-battle hints: per campaign stage (with `region` and `stage`), Spires and Arena PvP. The 40 loading-screen hints (also in the FAQ) add `titleKey`, `title`, `order` and `illustration` (sprite name). `unconfirmed` lists what isn't covered yet |
| `bosses.json` | Dungeon and clan bosses (issue #11): `id` (region), `name`, `title`, `mode` (`relic boss`/`clan boss`/`Omnissi`/`Pentiax`/`other` = Crest bosses), `element` (Omnissi only; `Astral` for the neutral one), `description`, `dos`, `donts` (the game's own lines, in order), `corruptions`, `stages[]` `{stage, energy, level, element, hp, atk, def, skillLevel, accuracy, resistance, toleranceBonus}` (boss base stats, the enemy team's flat ACC/RES and the stage's Tolerance bonus or penalty) |
| `shop_packs.json` | Shop packs (96): `id`, English `name`/`description`/`shortName` (`{0}` is filled in by the game, usually with the main reward amount), `kind`, `type`, `tab`, `price` (`usd` whole-dollar price tier and store `sku` for real-money packs, or `resources` e.g. `{"Gem": 300}` for Gem-shop packs), `rewards[]` `{type, id, amount, secondary}`, `steps[]` for login calendars, `purchaseLimit`/`purchaseLimitCount`, `durationHours`, `discount`/`bonus` (percent shown on the pack), `artLayout` (the pack's art), `platform`, `replacesPackId` |
| `progression.json` | Road to 6★ (issue #22): `maxLevelByRank`, `xpPerLevel[]` `{level, xpToNext, totalXp}` (one table for every rarity), `levelCost` (empty: levelling is free), `ascension[]` `{fromRank, toRank, levelRequired, fodderCount, fodder, goldByRarity}`, `fodderXp` (by rank and by level), `xpItems` (potion XP); `unconfirmed` lists the rules the config doesn't state |
| `awakening.json` | Awakening (issue #26): `soulSigns[]` (8 soul classes) with English `name` (e.g. Vess), `title` (Sign of Vess), `description`, `baseBonus` and `levels[]` (awaken levels 1-6) of `nodes[]` `{id, parentId, bonuses[], costByRarity}`; `materialTiers` (tier 1 = levels 1-2, 2 = 3-4, 3 = 5-6) |
| `gear_costs.json` | Gear and accessory costs: `upgrade[]` `{rank, rarity, toLevel, gold, memorium}`, `sell`, `deactivate`, `destroy` |
| `sources.json` | Where Memorium, runes, essences, crests, Titan Sparks, Echoes and the Memorium/Rune boosters come from: `items.<itemId>[]` of stage drops `{source, region, difficulty, stage, energy, drop, min, max, chancePerRoll, rolls, expectedPerRun}` and shop packs `{source: Shop, packId, pack, price, amount}` |
| `events.json` | Placeholder (not exported yet) |

Notes: stat values are as the game stores them (percent stats as fractions, e.g. `0.15` = 15%). Text keeps the game's
`<color>`/`<b>`/`<br>` tags; the site decides how to render them.
