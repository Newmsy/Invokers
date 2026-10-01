---
title: "Stats that stop working"
description: "Instinct caps out at 362, and the first 100 points of Skill Speed are worth more than the next 900. The game's own stat curves, explained."
date: 2026-10-01
gameVersion: "0.61.1514"
tags: [stats, gear]
---

Most of your Invokers' secondary stats are ratings: a number on the stat screen that the game turns into an actual effect through a curve. The game files contain those curves for every rating from 0 to 3,000, and they show something that matters a lot when you pick gear: **almost every rating has steep diminishing returns, and one of them simply stops.**

## Instinct: hard cap at 362

Instinct's effect starts at 0.30 with no rating and climbs to a maximum of **1.00**, which the curve reaches at a rating of **362** (exactly 1.0 at 378). Above that, extra Instinct does nothing.

| Instinct rating | 0 | 50 | 100 | 200 | 300 | 362 | 500+ |
|---|---|---|---|---|---|---|---|
| Effect | 0.30 | 0.53 | 0.70 | 0.86 | 0.95 | 1.00 | 1.00 |

Most of the climb happens early: half of the gain is in by rating 85, and 90% by 280. Once an Invoker is near 362 Instinct, any Instinct on gear is wasted.

## Skill Speed: the first 100 points do the work

| Skill Speed rating | 0 | 50 | 100 | 200 | 300 | 500 | 1,000 | 1,500 | 2,000 | 3,000 |
|---|---|---|---|---|---|---|---|---|---|---|
| Speed bonus | 0% | 10.0% | 16.8% | 23.7% | 27.8% | 32.9% | 39.8% | 43.9% | 46.7% | 50.8% |

The first 100 points give **+16.8%**. Going from 1,000 to 1,500 gives just +4.1%, under 1% per 100 points. Half of the maximum bonus arrives by rating 236, and the last 10% needs more than 1,800.

## Skill Recovery and Mana Generation

The same shape, slightly gentler:

| Rating | 0 | 50 | 100 | 200 | 300 | 500 | 1,000 | 2,000 | 3,000 |
|---|---|---|---|---|---|---|---|---|---|
| Skill Recovery | 0% | 12.5% | 25.0% | 37.7% | 46.1% | 57.4% | 73.6% | 90.3% | 100.3% |
| Mana Generation | 0% | 25.0% | 42.3% | 59.7% | 69.8% | 82.6% | 99.9% | 117.2% | 127.4% |

Skill Recovery is the most generous of the three: half its maximum at 361 rating. Mana Generation front-loads hard, with 42% of bonus from the first 100 points.

## Defense: the one that keeps going

Defense rating works the other way round. Its curve is a damage-taken multiplier that falls slowly and steadily, with no plateau:

| Defense rating | 0 | 200 | 500 | 1,000 | 1,500 | 2,000 | 3,000 |
|---|---|---|---|---|---|---|---|
| Damage taken | 100% | 96.7% | 91.9% | 84.6% | 78.0% | 72.0% | 61.7% |

Low amounts barely help (200 rating cuts damage by about 3%), but it never stops paying. At 3,000 it reaches a **38.4% reduction**.

## Resistance against Accuracy

Resist chance doesn't use your Resistance alone: the curve takes **Resistance minus the attacker's Accuracy**. The first 50 points of difference count one for one, and then the curve flattens quickly: the first 100 points of difference give about 90 on the game's scale, and the next 1,400 add only about 155 more. The files don't make the unit clear, so we're not quoting it as a percentage. The takeaway still holds: a small edge over the enemy's Accuracy is worth a lot, and a huge one isn't worth much more.

## What this means for gear

- **Stop stacking Instinct** once an Invoker is near 362.
- Skill Speed, Mana Generation and Skill Recovery give most of their value in the first few hundred points. Spreading rating across them usually beats piling it into one.
- Defense is the exception: it rewards stacking, but only at high totals.

*Source: the game's stat curve tables (rating 0 to 3,000), game version 0.61.1514.*
