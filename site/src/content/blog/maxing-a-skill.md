---
title: "Maxing a skill doubles its damage, and the cheap levels come first"
description: "Every hero damage skill hits exactly twice as hard at level 11 as at level 1. Here is what each level adds and costs."
date: 2026-10-01
gameVersion: "0.61.1516"
tags: [skills, codex, gold]
---

We checked the damage numbers of every hero skill in the game at all 11 levels. The result is unusually tidy: **for all 848 skills whose main hit scales with ATK, level 11 deals exactly double the damage of level 1.** Not roughly double. Exactly.

## Every skill follows the same steps

Each level adds a fixed share of the skill's level 1 damage, and the pattern is the same for every hero, every rarity and every skill slot:

| Upgrade to level | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|
| Damage added (of level 1) | +6% | +6% | +10% | +12% | +10% | +12% | +10% | +12% | +10% | +12% |
| Running total | 106% | 112% | 122% | 134% | 144% | 156% | 166% | 178% | 188% | 200% |

Ironblade Darus's Iron Kick shows it in practice: 122.5% ATK at level 1, 245% at level 11.

## What it costs

A Legendary's active skill, per level:

| To level | Gold | Rare Codex | Epic Codex | Legendary Codex | Damage added |
|---|---|---|---|---|---|
| 2 | 5,000 | 1 | 1 | | +6% |
| 3 | 10,000 | 1 | 1 | | +6% |
| 4 | 15,000 | 1 | 1 | 1 | +10% |
| 5 | 20,000 | 1 | 1 | 1 | +12% |
| 6 | 25,000 | 2 | 1 | 1 | +10% |
| 7 | 30,000 | 2 | 2 | 1 | +12% |
| 8 | 35,000 | 3 | 3 | 2 | +10% |
| 9 | 40,000 | 4 | 3 | 2 | +12% |
| 10 | 45,000 | 5 | 3 | 3 | +10% |
| 11 | 50,000 | 6 | 4 | 3 | +12% |
| **Total** | **275,000** | **26** | **20** | **14** | **+100%** |

Ultimates and Combos cost the same gold but more Codex: 48 Rare, 34 Epic and 24 Legendary in total. Maxing all five skills on one Legendary takes **1,375,000 gold, 174 Rare, 128 Epic and 90 Legendary Codex**.

Epics are much cheaper: 137,500 gold per skill, and at most 2 Legendary Codex for any one level. Rares never need Legendary Codex at all.

## Where the value is

Gold per point of damage climbs steadily, from about 830 gold per 1% at level 2 to over 4,000 gold per 1% at level 10 and 11. Legendary Codex is the real constraint: levels 2 and 3 need none, and levels 8 to 11 need 10 of the 14.

- **Levels 2 to 5 are the bargain**: +34% damage for 50,000 gold and 2 Legendary Codex on a Legendary.
- The last four levels add +44% but take 170,000 gold and 10 Legendary Codex.
- Spreading early levels across several Invokers' main damage skills gets more out of scarce Legendary Codex than pushing one skill to 11.

*Source: the game's skill texts at levels 1 to 11 and the skill upgrade cost table, game version 0.61.1516.*
