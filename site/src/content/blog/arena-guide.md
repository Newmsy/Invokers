---
title: "Arena guide: tokens, leagues, rewards and what changes in PvP"
description: "29 free tokens a day, a Monday reset, and skills that start at 50% cooldown. Everything the Arena does differently, with weekly chest odds and Arena Rush points per league."
date: 2026-10-04
gameVersion: "0.61.1516"
art: ["item:Gold Trophy", "element:light", "element:dark"]
tags: [arena, trophies]
---

**Play at least 10 offence battles a week, or you get no weekly reward and may drop a league.**

- Free tokens: 1 an hour (stores 10) plus 5 from Playtime, **29 a day** at most. More cost 50 Gems for 10.
- Leagues reset **Monday 11:00 UTC** to the bottom of your current league.
- Skills start on **50% cooldown**, so Skill Recovery and fast Titans matter more than in PvE.

## Teams and battles

- **Defence:** at least 1 Invoker. It fights on its own.
- **Offence:** up to 4 Invokers with Titans. You see the enemy team, levels and Power first.
- Battles start on Auto with a **5-minute** timer. Running out of time is a loss.
- Ultimate and Titan Mana build faster, Titan cooldowns are shorter, Titan stats are much lower.
- ![Light](element:light) and ![Dark](element:dark) both have advantage over each other here (+30% damage). In PvE only your side gets it.
- The opponent list refreshes free every 15 minutes, after you beat everyone on it, or for 10 Gems.

## Battle rules

**Control effects and big buffs last about half as long in the Arena.** Share of the normal duration, single target (AoE in brackets):

| Effect | Skill 1 | Skills 2–3 | Ultimate | Titan skills |
|---|---|---|---|---|
| Stun, Sleep, Freeze, Shock, Launch | 50% (AoE 35%) | 50% (AoE 35%) | 65% (AoE 50%) | 50% (AoE 40%) |
| Root | 50% (AoE 40%) | 50% | 65% | 60% (AoE 50%) |
| Taunt | 50% | 65% | 65% | 60% (AoE 50%) |
| Unkillable, Invincibility | 50% | 50% | 50% (AoE 40%) | 50% |

All other buffs and debuffs last their normal time. Who brings each: [Stun](/effects/stun), [Freeze](/effects/freeze), [Shock](/effects/shock), [Launch](/effects/launch), [Taunt](/effects/taunt), [Unkillable](/effects/unkillable), [Invincibility](/effects/invincibility).

**Control gets weaker when chained.** The first Control debuff starts a 10-second window. Control placed inside it lasts less:

- 1st: full time. 2nd: 60%. 3rd: 40%. 4th: 20%.
- Then the target is immune to Control for **7 seconds**, counted from when its last Control debuff ends.

**Titans come sooner.** Ultimate mana builds ×2 and Titan mana ×4 (×1 and ×2.4 in 5-Invoker PvE). A Titan costs 3,000 of its 4,500 mana, stays 12 seconds, and its cooldown is 90 seconds instead of 150.

## Leagues

Everyone starts on 500 points and can't fall below it. Leagues run Bronze, Silver and Gold, steps 1 to 4. A week with no offence battles marks you inactive: you drop one league at the reset.

## Rewards

- **Trophies** come from offence wins only and are never lost: 1 Bronze per win in Bronze 1, 4 in Bronze 4, more in Silver and Gold.
- **Arena Coins** come from every offence win (table below) and from melting Trophies: Bronze 1, Silver 5, Gold 10 Coins each. Spend them in the Bazaar on Echoes, Codexes, Prisms, Titanhearts and Stars (limits reset daily at 00:00 UTC, weekly on Monday and monthly on the 1st). A ![Rare Codex](item:) costs 1,000 (daily); ![Rare Prism](item:) 1,500, ![Epic Codex](item:) 3,000 and ![Epic Prism](item:) 3,500, five of each a week.
- **Trophy Room:** spend Trophies on stat upgrades for every Invoker of one element. Costs: [Trophy Room cost](/blog/trophy-room-cost) and [Trophies](/trophies).
- **Weekly chest:** 2 rewards in Bronze and Silver, 3 in Gold. Gems come up 55% of the time in Bronze (75 to 150) and 76% in Gold (150 to 250). Full odds: [Chest odds](/blog/chest-odds).

**Arena Coins per offence win**

| League | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| Bronze | 50 | 60 | 70 | 80 |
| Silver | 90 | 100 | 120 | 140 |
| Gold | 160 | 200 | 240 | 320 |

## Arena Rush points

During an Arena Rush event, each battle scores by league:

| League | Win | Loss |
|---|---|---|
| Bronze 1 / 2 / 3 / 4 | 40 / 50 / 60 / 70 | 20 / 20 / 30 / 30 |
| Silver 1 / 2 / 3 / 4 | 80 / 90 / 100 / 110 | 40 / 40 / 50 / 50 |
| Gold 1 / 2 / 3 / 4 | 120 / 130 / 140 / 150 | 60 / 60 / 70 / 70 |

A loss still scores about half a win, so spend every token during the event. Targets and energy: [Events](/events).

## Skill timing

Arena cooldowns start at 50%, then shrink with Skill Recovery: time to first cast = 0.5 × base cooldown ÷ (1 + Skill Recovery %).

| Base cooldown | No Skill Recovery | +25% (100 rating) | +46% (300 rating) |
|---|---|---|---|
| 20s | 10.0s | 8.0s | 6.8s |
| 25s | 12.5s | 10.0s | 8.6s |
| 30s | 15.0s | 12.0s | 10.3s |

Rating to percent: [Stats that stop working](/blog/stats-that-stop-working). Debuff chance against high-RES defenders: [How combat works](/blog/combat-basics).

*Numbers for game version 0.61.1516.*
