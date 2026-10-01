---
title: "What 130 Destiny Stars really buy you"
description: "The game's own summon rates, the mercy counters hiding in the config, and the chance of a Legendary in N pulls."
date: 2026-10-01
gameVersion: "0.61.1514"
tags: [summons, odds]
---

A Destiny Star has a **0.53%** chance to give a Legendary. That is the number straight from the game's summon config, and it means that without any help from mercy, half of all players need **130 pulls** or more for their first Legendary.

The good news is that the config also holds mercy counters, and they change the picture a lot.

## The published rates

Every summon item, with the rarity chances exactly as the game stores them:

| Item | Common | Uncommon | Rare | Epic | Legendary |
|---|---|---|---|---|---|
| Wild Star | 70% | 28.5% | 1.5% | | |
| Fate Star | | | 91.67% | 8.33% | |
| Destiny Star | | | 91.14% | 8.33% | 0.53% |
| Radiant Star | | | 91.14% | 8.33% | 0.53% |
| Divine Star | | | | 93.33% | 6.67% |
| Legendary Star | | | | | 100% |

The Wild Star's Uncommon figure is 25.65% for elemental heroes plus 2.85% for Light and Dark ones. Radiant Stars only give Light and Dark heroes.

Titan orbs work the same way:

| Item | Rare | Epic | Legendary | Mythic |
|---|---|---|---|---|
| Dream Orb | 92% | 8% | | |
| Wonder Orb | 91.15% | 8.3% | 0.55% | |
| Miracle Orb | | 90% | 9% | 1% |
| Mythic Orb | | | | 100% |

Inside a rarity, every hero has the same weight. A Destiny Star's Legendary pool has 38 heroes, so a **specific** Legendary is 0.53% ÷ 38, about **1 in 7,170 pulls**. The Radiant pool has only 19 Legendaries, which makes a specific one twice as likely: about 1 in 3,585.

## The chance of at least one Legendary

Here is the chance of getting at least one Legendary in N pulls, from the published rate alone (no mercy):

| Pulls | Destiny or Radiant | Divine |
|---|---|---|
| 10 | 5.2% | 49.9% |
| 50 | 23.3% | 96.8% |
| 100 | 41.2% | 99.9% |
| 130 | 49.9% | ~100% |
| 200 | 65.5% | ~100% |
| 300 | 79.7% | ~100% |
| 500 | 93.0% | ~100% |

Even 500 Destiny Stars leave a 7% chance of no Legendary at all, if the published rate were the whole story. It isn't.

## The mercy counters

> **Inferred:** the game doesn't explain these anywhere in its text. What follows is read from the field names in the summon config, and it hasn't been confirmed in game.

The config has four mercy fields on some summon rules: `FirstMercySummonNumber`, `MercySummonNumber`, `MercyLimit` and `PostLimitMercySummonNumber`. These are set:

| Item | Rarity | Field values | What it most likely means |
|---|---|---|---|
| Destiny Star | Legendary | First 50, then 190 | First Legendary guaranteed by pull 50, then one by every 190th pull without one |
| Radiant Star | Legendary | 200 | One guaranteed by every 200th pull without one |
| Divine Star | Legendary | 15 | One guaranteed by every 15th pull without one |
| Wonder Orb | Legendary | 190 | As Destiny, without the first-50 rule |
| Miracle Orb | Legendary | 15 | As Divine (Mythic has no mercy) |
| Fate, Destiny, Radiant | Epic | 15, limit 3, then 30 | An Epic by pull 15 the first 3 times, then by pull 30 |

If that reading is right, the "no mercy" table above is far too gloomy for Destiny Stars. Your first Legendary would come by pull 50 at the latest, and after that the worst case is 190 pulls. The data doesn't say whether a natural Legendary resets the counter, or whether the counter is shared between items.

## Bonus summons

Using summon items also fills bonus counters, which pay out more summon items:

| Use | Get | Required |
|---|---|---|
| Fate or Destiny Star | Divine Star | 85 |
| Divine Star | Legendary Star | 45 |
| Radiant Star | Radiant Star | 10 |
| Dream or Wonder Orb | Miracle Orb | 85 |
| Miracle Orb | Mythic Orb | 100 |

Every 85 Destiny Stars also hand you a Divine Star, which has its own 6.67% Legendary rate. Put the mercy counters (as read above) and the bonus summons together, and the long-run rate works out at about **0.94% per Destiny Star**, close to double the 0.53% on the label. That figure leans on the inferred mercy rules, so treat it as an estimate.

## Chroma

Each pull can also come out as a chroma (alternate colour) version:

| Rarity | Heroes | Titans |
|---|---|---|
| Common | 0.033% | |
| Uncommon | 0.05% | |
| Rare | 0.2% | 0.05% |
| Epic | 1% | 0.25% |
| Legendary | 2% | 0.5% |
| Mythic | | 2% |

## The short version

- 0.53% per Destiny Star is the real rate, and 130 pulls is the median wait without mercy.
- The config strongly suggests a guarantee at 50 for your first Legendary and every 190 after that.
- Radiant Stars are the better way to chase one specific Light or Dark Legendary, because their pool is half the size.
- Divine Stars are a different world: a Legendary in 10 pulls is a coin flip.

These are odds from the game's own numbers. They tell you what to expect over many pulls, not what your next pull will be.
