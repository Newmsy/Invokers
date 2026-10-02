# Art

Exported from the game's Unity asset bundles by `datamine/scripts/export_art.py` (issue #12). WebP, quality 80.
Portraits are capped at 600 px on the long side, icons at 128 px. Game version: see `data/manifest.json`.

| Folder | Files | Source sprite | Named by |
|---|---|---|---|
| `heroes/` | 231 | `S_<id>_Large` | hero `id` in `data/heroes.json` |
| `titans/` | 38 | `S_<id>_Large` | Titan `heroId` in `data/skills.json` (`ANIM...`) |
| `skills/` | 1,039 | `S_<id>_Skill_<n>`, `S_<id>_Skill_Ultimate`, `S_<id>_Passive_1` | `<id>_ActiveSkill<n>`, `<id>_Ultimate`, `<id>_Passive` |
| `icons/element/` | 7 | `S_<Element>_Element_Icon` | element as in `heroes.json` (`Neutral` is the Astral icon) |
| `icons/class/` | 4 | `S_HeroClass_<Class>` | class as in `heroes.json` |
| `items/` | 138 | `S_Resource-<n>` (`n` = the item's `ResourceTypeId` value) | item `id` in `data/items.json` |

Not exported: gear set, faction and rarity icons. The game has no standalone sprites for them (they sit in packed
atlases or are built from card frames). Combo skills have no icon of their own.

Where the bundles are: most art is downloaded by the game on first launch into
`%USERPROFILE%/AppData/LocalLow/Unity/Hit_Zone_Invokers` (8.6 GB); the rest ships in
`Invokers_Data/StreamingAssets/aa`. The art is the game's own; it is here for the fan site only.
