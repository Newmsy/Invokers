---
title: "Every gear set, by the numbers"
description: "All 31 sets and what they really give. Twelve Tolerance sets hide the same +20% HP, ATK and DEF, and Vampire heals more than it says."
date: 2026-10-01
gameVersion: "0.61.1516"
tags: [gear, sets]
---

The game has **31 gear sets**. Every one of them gives its bonus at 3 pieces, 5 pieces, or both; none has an 8-piece bonus. Here is what each set gives, straight from the set config.

## The stat sets

| Set | 3 pieces | 5 pieces |
|---|---|---|
| Attack | +10% ATK | +20% ATK |
| Defense | +10% DEF | +20% DEF |
| Health | +15% HP | +30% HP |
| Crit Rate | +10% Crit Rate | +20% Crit Rate |
| Crit Damage | +20% Crit DMG | +40% Crit DMG |
| Accuracy | +50 ACC | +75 ACC |
| Resistance | +50 RES | +75 RES |
| Instinct | +30 Instinct | +45 Instinct |
| Mana | +30 Mana Gen | +45 Mana Gen |
| Spark | +30 Skill SPD | +45 Skill SPD |
| Fury | +30 Skill Recovery | +45 Skill Recovery |

The bonuses as listed are cumulative totals: a full Attack set gives +20% ATK, not +30%.

The rating sets (Instinct, Mana, Spark, Fury) look small next to the percentage sets, but the first points of a rating are the most valuable ones (see our post *Stats that stop working*). +45 Skill Speed on an Invoker with little of it is worth about +9% skill speed.

## The combination sets

| Set | 3 pieces | 5 pieces |
|---|---|---|
| Predator | +10% ATK | +40% Crit DMG |
| Vampire | +10% ATK | Lifesteal: 6% of skill damage, 1% of combo damage |
| Bulwark | +75 RES | +30% HP |
| Celerity | +45 Mana Gen | +45 Skill Recovery |
| Paragon | +15% heal and shield size | Allies move faster out of combat |
| Voodoo | Combo attacks 3 and 5 shorten 1 enemy buff (strength 1) | The same, at strength 2 |
| Guardian | +20% HP | All allies get a shield worth 20% of the wearer's max HP for 12 seconds |
| Spellwall | Willpower and Immunity buffs at the start of battle | +10% HP, ATK and DEF |

Predator's internal name is "IgnoreDefense", but it doesn't ignore any defence: it's an ATK and Crit DMG set.

**Vampire heals a little more than it says.** The game's own description says 5% of skill damage; the set data says **6%**. The combo figure (1%) matches.

Voodoo's description says each hit cuts a buff by up to 3 seconds; the set data only gives the strength values 1 and 2. Guardian's 5-piece shield and Spellwall's 3-piece buffs come from the game's descriptions; they're scripted effects, not stat bonuses, so the set table doesn't list them.

## The twelve Tolerance sets

Each Tolerance set protects against one boss corruption effect (Crush, Manashock, Frost, Daze, Paralysis, Nightmare, Mindfog, Fatigue, Blight, Manaburn, Atrophy, Bloodrot):

- **3 pieces:** +50% tolerance to that corruption, which shortens its duration by half.
- **5 pieces:** **+20% HP, +20% ATK and +20% DEF**, the same for all twelve.

That 5-piece bonus is the biggest all-round bonus of any set. It's also the same on every Tolerance set, so for a boss without that corruption, any Tolerance set you've already built still gives the +20% to all three.

## The short version

- No set has an 8-piece bonus; 5 pieces is the most any set rewards.
- Tolerance sets give the best all-round 5-piece bonus in the game, whichever corruption they're named for.
- Vampire's skill lifesteal is 6%, not the 5% its description says.
- Small rating sets are worth more than they look on Invokers with little of that stat.

*Source: the game's gear set config and set descriptions, game version 0.61.1516.*
