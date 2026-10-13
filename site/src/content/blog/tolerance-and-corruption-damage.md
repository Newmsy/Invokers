---
title: "Tolerance: how much Corruption damage it saves"
description: "A fully covered Invoker takes about half the damage of one with no Tolerance at boss stage 10, and a third of it at stage 20. DEF and RES don't touch Corruption."
date: 2026-10-13
gameVersion: "0.61.1523"
art: ["set:Blight Tolerance", "set:Bloodrot Tolerance", "set:Fatigue Tolerance", "set:Manaburn Tolerance"]
tags: [bosses, gear, stages]
---

**Matching Tolerance cuts the damage an Invoker takes from a boss by about half at stage 10 and by two-thirds at stage 20.** On high stages it beats extra DEF.

- Every boss hit is two parts: a normal part and a Corruption part, usually about 2:1.
- **DEF only reduces the normal part. RES does nothing to Corruption damage** (it only decides whether debuffs land).
- Only Tolerance reduces Corruption damage: each 1% removes 1%, and **100% makes you immune**.
- Boss stages 11-20 take Tolerance away (−100% at stages 19-20), so Corruption hits harder each stage.

## Fully covered vs no Tolerance

Damage taken, saved by matching Tolerance, compared with the same Invoker at 0%. Average over all ten bosses, with 3,000 [DEF](/stats).

| Stage | Stage penalty | 50% (a set alone) | 100% (new Legendary) | 150% | Fully covered |
|---|---|---|---|---|---|
| 10 | 0% | 26% | 51% | 51% | **51%** |
| 14 | −40% | 21% | 42% | 59% | **59%** |
| 16 | −60% | 19% | 39% | 58% | **62%** |
| 18 | −80% | 18% | 36% | 54% | **65%** |
| 20 | −100% | 17% | 34% | 50% | **67%** |

**At stage 20, an Invoker with no Tolerance takes three times the damage of a fully covered one.**

"Fully covered" means a maxed Tolerance skill (150% on Common to Epic, 200% on Legendary) plus a 3-piece Tolerance set (+50%). That is 200-250%, enough for immunity on every stage. More DEF raises these numbers, since it shrinks only the normal part.

## How Tolerance works

Corruption damage taken = Corruption damage × (1 − Tolerance), never below 0.

| Your Tolerance after the stage | Corruption damage taken |
|---|---|
| −100% | ×2 |
| −50% | ×1.5 |
| 0% | ×1 |
| +50% | ×0.5 |
| +100% or more | none |

Each boss stage adds a bonus or penalty to your Tolerance, most likely straight onto it. A penalty can take an Invoker below 0, and **negative Tolerance makes Corruption hit harder**.

| Stage | 1 | 5 | 9 | 10 | 12 | 14 | 16 | 17 | 18 | 19-20 |
|---|---|---|---|---|---|---|---|---|---|---|
| Tolerance | +75% | +45% | +25% | 0% | −20% | −40% | −60% | −70% | −80% | −100% |
| Needed for ×1 | | | | 0% | 20% | 40% | 60% | 70% | 80% | 100% |
| Needed for immunity | 25% | 55% | 75% | 100% | 120% | 140% | 160% | 170% | 180% | 200% |

Every stage: [How bosses scale](/blog/how-bosses-scale).

## Match the damage Corruption

Each boss has a control Corruption and a damage Corruption. **Only Tolerance to the damage one lowers damage**; Tolerance to the control one shortens its effect.

| Boss | Damage Corruption | Corruption share of its damage, before defences | Saved at stage 20, fully covered |
|---|---|---|---|
| [![Pentiax](boss:pentiax)](/bosses/pentiax) | ![](set:mindfog-tolerance) [Mindfog](/gear#set-mindfog-tolerance) | about 60-67% | 85% |
| [![Yskara](boss:yskara)](/bosses/yskara) | ![](set:fatigue-tolerance) [Fatigue](/gear#set-fatigue-tolerance) | about 55% | 80% |
| [![Koltmos](boss:koltmos)](/bosses/koltmos) | ![](set:blight-tolerance) [Blight](/gear#set-blight-tolerance) | about 40% | 68% |
| [![Althar](boss:althar)](/bosses/althar) | ![](set:fatigue-tolerance) [Fatigue](/gear#set-fatigue-tolerance) | about 35% | 64% |
| [![Sorgott](boss:sorgott)](/bosses/sorgott) | ![](set:manaburn-tolerance) [Manaburn](/gear#set-manaburn-tolerance) | about 35% | 64% |
| [![Hyxxis](boss:hyxxis)](/bosses/hyxxis) | ![](set:manaburn-tolerance) [Manaburn](/gear#set-manaburn-tolerance) | about 35% | 64% |
| [![Omnissi](boss:omnissi-fire)](/bosses/omnissi-fire) | Depends on element | about 33-35% | 63% |
| [![Ulgorim](boss:ulgorim)](/bosses/ulgorim) | ![](set:blight-tolerance) [Blight](/gear#set-blight-tolerance) | about 33% | 62% |
| [![Sakiel](boss:sakiel)](/bosses/sakiel) | ![](set:bloodrot-tolerance) [Bloodrot](/gear#set-bloodrot-tolerance) | about 33% | 62% |
| [![Galvos](boss:galvos)](/bosses/galvos) | ![](set:atrophy-tolerance) [Atrophy](/gear#set-atrophy-tolerance) | about 33% | 62% |

Omnissi's damage Corruption by element: [Astral](/bosses/omnissi-astral) Atrophy, [Fire](/bosses/omnissi-fire) and [Dark](/bosses/omnissi-dark) Manaburn, [Wind](/bosses/omnissi-wind) Fatigue, [Water](/bosses/omnissi-water) Mindfog, [Earth](/bosses/omnissi-earth) Bloodrot, [Light](/bosses/omnissi-light) Blight.

The shares leave out stacking Corruption, percent-of-HP hits and multi-hit repeats, so real fights can run higher.

## What to do

- **Stage 11 and up:** give every Invoker matching Tolerance before more DEF.
- **Below stage 10:** the stage bonus already covers you; Tolerance matters much less.
- Past 100% after the stage, Tolerance does nothing more for damage.
- Invokers with a matching Tolerance skill rank a tier higher on the [tier lists](/tiers).
- Which set to build first: *Which Tolerance set to build first*. All sets: [Gear sets](/gear).

*Game version 0.61.1523.*
