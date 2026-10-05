---
title: "Stat curves from 0 to 800"
description: "Graphs of what Skill Speed, Combo Speed, Skill Recovery, Mana Generation, Instinct, Defense and Move Speed give at every rating from 0 to 800. The first 50 to 100 points are worth the most."
date: 2026-10-05
gameVersion: "0.61.1516"
tags: [stats, gear]
art: ["set:Spark", "set:Fury", "set:Mana", "set:Instinct"]
---

**Every speed and mana stat pays full rate for its first 50 to 100 points, then each point is worth less.** By about 200 rating (313 for Skill Recovery) each point gives under a quarter of the opening rate.

- **Skill Speed and Combo Speed**: +16.8% at 100, +37.6% at 800.
- **Skill Recovery**: +25% at 100, +68.3% at 800. It tapers slowest.
- **Mana Generation**: +42.3% at 100, +94.3% at 800.
- **Instinct** maxes out at 362. **Defense** barely bends at all.

Spreading rating over two or three stats gets far more out of it than stacking one. Point at or tap a graph to read any rating.

![Skill Speed, Skill Recovery and Mana Generation from 0 to 800 rating](curve:skill-speed,skill-recovery,mana-generation)

## Skill Speed and Combo Speed

![Skill Speed: how much faster skills play out](curve:skill-speed)

- **+0.2% per point up to 50** (+10%), then it bends fast.
- From 199 on, each point gives under a quarter of that.
- The first 100 points give +16.8%; the last 400 (400 to 800) give just +7%.

Combo Speed is estimated to follow the same curve, for combos instead of skills. Sets: ![Spark](set:).

## Skill Recovery

![Skill Recovery: how much faster cooldowns recover](curve:skill-recovery)

- **+0.25% per point up to 100** (+25%), the longest full-rate stretch.
- Gains fall to a quarter of that only from 313.
- Recovery divides cooldowns: a 10-second cooldown takes 6.6 seconds at 400 rating and 5.9 at 800.

Sets: ![Fury](set:) and ![Celerity](set:).

## Mana Generation

![Mana Generation: how much more Ultimate mana](curve:mana-generation)

- **+0.5% per point up to 53**, the fastest start of any stat.
- From 193 on, each point gives under a quarter of that.
- 200 rating gets you +59.7%; doubling to 400 adds only another 17.3%.

Sets: ![Mana](set:) and ![Celerity](set:).

## Instinct

![Instinct: chance to dodge danger zones while the AI controls the Invoker](curve:instinct)

- Starts at **30%** with no rating, 70% at 100 and 95% at 300.
- **100% at 362**. Anything past that is wasted.
- It only helps Invokers the AI controls. It never changes damage or crits.

Sets: ![Instinct](set:).

## Defense

![Defense: share of each hit blocked](curve:defense)

- Close to a straight line: about **1.6% less damage per 100 points**.
- 800 rating blocks 12.6% of every hit. It keeps climbing well past 800.

## Move Speed

![Move Speed: run speed bonus](curve:move-speed)

- +0.13 per point up to 50 (+6.5), then nearly flat: 800 rating gives +12.0.
- Movement only, so it adds nothing to damage.

## At a glance

| Stat | 100 | 200 | 400 | 800 |
|---|---|---|---|---|
| Skill Speed | +16.8% | +23.7% | +30.6% | +37.6% |
| Skill Recovery | +25.0% | +37.7% | +52.4% | +68.3% |
| Mana Generation | +42.3% | +59.7% | +77.0% | +94.3% |
| Instinct (dodge) | 70% | 86% | 100% | 100% |
| Defense (blocked) | 1.7% | 3.3% | 6.5% | 12.6% |
| Move Speed | +7.9 | +9.3 | +10.7 | +12.0 |

Accuracy has no curve: it is measured against the target's Resistance, point for point. Every rating up to 3,000 and the full Accuracy rule: [What stats do](/stats). Set bonuses: [Gear sets](/gear).

*Numbers for game version 0.61.1516.*
