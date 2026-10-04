---
title: "Stats that stop working"
description: "Instinct caps out at 362, and the first 100 points of Skill Speed are worth more than the 1,000 points from 1,000 to 2,000. How ratings really turn into stats."
date: 2026-09-08
gameVersion: "0.61.1514"
tags: [stats, gear]
---

Secondary stats are ratings that turn into an effect through a curve. **Almost every curve has steep diminishing returns, and Instinct simply stops.**

- **Stop stacking Instinct** near 362.
- Skill Speed, Mana Generation and Skill Recovery give most of their value in the first few hundred points, so spreading rating across them usually beats piling it into one.
- Defense is the exception: it rewards stacking, but only at high totals.

The sets that give these ratings: [Gear sets](/gear) and [Every gear set, by the numbers](/blog/every-gear-set).

## Instinct: hard cap at 362

| Instinct rating | 0 | 50 | 100 | 200 | 300 | 362 | 500+ |
|---|---|---|---|---|---|---|---|
| Effect | 0.30 | 0.53 | 0.70 | 0.86 | 0.95 | 1.00 | 1.00 |

The effect maxes at **1.00** by rating **362** (exactly 1.0 at 378). Half the gain is in by 85, and 90% by 280. Instinct past 362 is wasted.

## Skill Speed: the first 100 points do the work

| Skill Speed rating | 0 | 50 | 100 | 200 | 300 | 500 | 1,000 | 1,500 | 2,000 | 3,000 |
|---|---|---|---|---|---|---|---|---|---|---|
| Speed bonus | 0% | 10.0% | 16.8% | 23.7% | 27.8% | 32.9% | 39.8% | 43.9% | 46.7% | 50.8% |

The first 100 points give **+16.8%**; the 1,000 from 1,000 to 2,000 give just +6.9%. Half the maximum arrives by 236, and the last 10% needs more than 1,800.

## Skill Recovery and Mana Generation

| Rating | 0 | 50 | 100 | 200 | 300 | 500 | 1,000 | 2,000 | 3,000 |
|---|---|---|---|---|---|---|---|---|---|
| Skill Recovery | 0% | 12.5% | 25.0% | 37.7% | 46.1% | 57.4% | 73.6% | 90.3% | 100.3% |
| Mana Generation | 0% | 25.0% | 42.3% | 59.7% | 69.8% | 82.6% | 99.9% | 117.2% | 127.4% |

Skill Recovery tapers slowest (half its maximum at 361). Mana Generation front-loads hard: +42% from the first 100 points.

## Defense: the one that keeps going

| Defense rating | 0 | 200 | 500 | 1,000 | 1,500 | 2,000 | 3,000 |
|---|---|---|---|---|---|---|---|
| Damage taken | 100% | 96.7% | 91.9% | 84.6% | 78.0% | 72.0% | 61.7% |

No plateau. 200 rating cuts damage by only about 3%, but 3,000 reaches a **38.4% reduction**.

## Resistance against Accuracy

Resist uses **Resistance minus the attacker's Accuracy**. The first 50 points of difference count one for one; the first 100 are worth about 90 on the curve, and the next 1,400 add only about 155 more. We're not quoting a percentage chance yet. A small edge over enemy Accuracy is worth a lot; a huge one isn't worth much more.

*Numbers for game version 0.61.1514.*
