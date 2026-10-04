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
| `sets/` | 31 | `S_<set id>_Icon` | set `id` in `data/sets.json` |
| `splash/heroes/`, `splash/titans/` | 23 + 6 | `Shop_ExclusivePack_<id>`, `S_ShopPackBackground_<id>` | hero / Titan id; 1200 x 600 offer key art (the largest character art the game has; there is no per-hero splash, so only heroes with an offer have one) |
| `splash/other/` | 20 | `Shop_ExclusivePack_*` | sprite name; non-hero offer art (a pack's `artLayout` in `data/shop_packs.json`) |
| `events/` | 20 | `S_Background_<event>` | event key art, 1280 px (includes the Legendary hunts for CAM027, ELD036, ELD037, NOC044) |
| `events/icons/` | 22 | `S_GlobalEvent_Icon_<event>_Short` | event icons |
| `modes/` | 10 | `S_GameModeCard_<mode>` | game mode cards (Campaign, Dungeon, Arena, Tower...) |
| `loading/` | 1 + 40 | `S_GameLoadingIllustration_custom`, `S_FAQRewards_Illustration_<n>` | loading screen; `hints/<n>.webp` = loading hint with `order` n in `data/tips.json` |
| `rewards/` | 3 | `S_NewPlayerRewardsPart<n>Illustration` | new-player reward art |
| `cards/faction/` | 9 | `S_HeroIndexFactionCard_<faction>` | faction card (tall card with character art, not a small emblem) |
| `cards/rarity/` | 6 | `S_HeroCardRarityBackground_<rarity>` | hero card background per rarity |

Not exported: small faction and rarity emblems (the game has none as standalone sprites; `cards/` has the closest).
The daily-reward illustrations could not be read (their texture bundle is missing from the cache). Combo skills have no icon of their own.

Where the bundles are: most art is downloaded by the game on first launch into
`%USERPROFILE%/AppData/LocalLow/Unity/Hit_Zone_Invokers` (8.6 GB); the rest ships in
`Invokers_Data/StreamingAssets/aa`. The art is the game's own; it is here for the fan site only.
