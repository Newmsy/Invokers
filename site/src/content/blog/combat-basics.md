---
title: "How combat works: damage, elements and landing debuffs"
description: "The damage formula, every element matchup, and the exact Accuracy you need to land debuffs on each boss stage, from 50 at stage 1 to 635 at stage 20."
date: 2026-10-04
gameVersion: "0.61.1516"
art: ["element:water", "element:fire", "element:earth", "element:wind", "element:light", "element:dark"]
tags: [stats, bosses, elements]
---

**Match ACC to the enemy's RES and your debuffs always land. Fight with element advantage and you need 20 less.**

- Element advantage: **+30% damage**. Disadvantage: **-30% damage and half your Crit Rate**.
- Boss RES jumps at stage 10 (174) and again at 11 (275). That's where debuffs start failing.
- Buffs, heals and revives on your own team never roll against RES.

## Elements

![Water](element:water) beats ![Fire](element:fire) beats ![Earth](element:earth) beats ![Wind](element:wind) beats ![Water](element:water). Same element, Water vs Earth and Fire vs Wind are neutral.

| Matchup | Damage | Debuff chance | Crit Rate |
|---|---|---|---|
| Advantage | +30% | +20% | |
| Disadvantage | -30% | -50% | -50% |
| ![Light](element:light) or ![Dark](element:dark) attacking the other four | +15% | +10% | |
| The other four attacking Light or Dark | -15% | -25% | -25% |

**Light vs Dark** counts as advantage both ways in the Arena. Against bosses, only your side gets it.

Relic boss stages cycle Earth, Wind, Water, Fire, so stage 20 is ![Fire](element:fire): bring ![Water](element:water). Each boss's stage list is on its [boss guide](/bosses).

## Damage

Damage = ATK × skill multiplier × crit × DEF reduction × element × buffs and debuffs.

- **Crit** multiplies by 1 + Crit DMG: 100% Crit DMG doubles the hit.
- **DEF** cuts damage on a curve that never flattens:

| DEF | 500 | 1,000 | 1,500 | 2,000 | 3,000 |
|---|---|---|---|---|---|
| Damage cut | 8.1% | 15.4% | 22.0% | 28.0% | 38.4% |

More curves (Skill Speed, Skill Recovery, Mana Gen, Instinct): [Stats that stop working](/blog/stats-that-stop-working).

## Landing debuffs: RES minus ACC

The target's RES minus your ACC sets the resist chance:

| RES minus ACC | 0 or less | 25 | 50 | 75 | 100 | 110 | 120+ |
|---|---|---|---|---|---|---|---|
| Resist chance | 0% | 25% | 50% | 73.1% | 89.6% | 95.0% | 100% |

Then flat modifiers are added: **+50%** if the target has element advantage over you, **-20%** if you have it, plus RES Up, ACC Down and Mindfog (add), or ACC Up, RES Down and Atrophy (subtract). ACC Up and RES Down don't change the stat itself; they only shift this final chance.

Example: bosses on stage 14 have 380 RES. Against 260 ACC that's 100% resist. If the boss also has element advantage (+50), your RES Down (-70) and ACC Up (-50) still bring it down to 30%.

## ACC you need on every boss stage

Every boss uses the same RES and ACC per stage. "Always lands" assumes no modifiers.

| Stage | Enemy RES | ACC: always lands | ACC: always lands with element advantage | ACC: lands half the time | Enemy ACC | RES to resist everything |
|---|---|---|---|---|---|---|
| 1-3 | 50 | 50 | 30 | 0 | 0-5 | 120-125 |
| 5 | 60 | 60 | 40 | 10 | 15 | 135 |
| 8 | 110 | 110 | 90 | 60 | 25 | 145 |
| 10 | 174 | 174 | 154 | 124 | 40 | 160 |
| 11 | 275 | 275 | 255 | 225 | 50 | 170 |
| 13 | 345 | 345 | 325 | 295 | 70 | 190 |
| 15 | 440 | 440 | 420 | 390 | 90 | 210 |
| 17 | 515 | 515 | 495 | 465 | 115 | 235 |
| 20 | 635 | 635 | 615 | 585 | 175 | 295 |

Where ACC comes from: the [Accuracy set](/gear) (+75 at 5 pieces), Chestplate and Flask main stats, [Awakening](/blog/awakening-signs) (Sign of Actia +88) and [Titans](/titans) like Myrmadir (+196 ACC in boss fights).

## Skills and mana

- **Combo:** five hits on a loop, no cooldown, the main source of Ultimate and Titan Mana. Legendaries get a special fifth hit.
- **Active skills:** three per Invoker. Effective cooldown = base cooldown ÷ (1 + Skill Recovery %). 100 Skill Recovery rating gives +25%, so a 25s cooldown becomes 20s.
- **Ultimate:** mana stops at 100% until you cast it. Upgrading it lowers the cost.
- **Mana Gen** raises Ultimate and Titan Mana alike. Taking damage builds mana too.
- **AoE skills** hit up to 10 enemies on Legendaries, 9 on Epics and 8 on everyone else.

Every buff, debuff and control effect: [Status effects](/effects).

*Numbers for game version 0.61.1516.*
