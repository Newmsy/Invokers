---
title: "New: Tank mode, and why HP beats DEF"
description: "The DPS simulator now shows how tough an Invoker is against Ulgorim. One HP roll adds far more effective HP than one DEF roll, and here's why."
date: 2026-10-04
gameVersion: "0.61.1516"
banner: collect-dungeon-relics-6
art: ["class:Tank", "hero:Valentu the Devoted", "hero:Ironblade Darus"]
tags: [stats, gear, bosses]
---

**For toughness, pick HP rolls over DEF rolls.** One HP roll adds up to 14 times more effective HP than one DEF roll.

The [DPS simulator](/dps-simulator?tab=toughness) now has a **Toughness** tab for every Invoker, with its own **Toughest gear from your box** and a **Toughest (effective HP)** sort in the picker.

![The Invoker picker sorted by toughest](/blog/tank-picker.jpg)

## How to use it

1. Open the [Toughness tab](/dps-simulator?tab=toughness) and pick an Invoker. Choose **My box** to use your own gear, or **Any Invoker** for 6★ level 60, fully awakened, with no gear.
2. Pick an Ulgorim stage. Higher stages hit harder, so you survive fewer hits.
3. Read **Effective HP** and the **HP or DEF** table. With a box imported, **Toughest gear from your box** suggests swaps.

No box yet? [Import it on My box](/my-box) to see your own numbers.

## What it shows

- **Effective HP:** how much damage the Invoker can take before falling, once DEF is counted. It's HP divided by the share of each hit that gets through DEF.
- **Against this stage:** Ulgorim's ATK, the size of one hit after your DEF, and how many hits you survive.
- **HP or DEF:** the effective HP that one normal (B grade) 5★ roll adds: **+168 HP**, **+2.2% HP**, **+17 DEF** or **+2.2% DEF**.

![Toughness against Ulgorim for Valentu the Devoted at stage 16](/blog/tank-toughness.jpg)

## Why HP wins

DEF cuts damage slowly. Most of each hit still gets through at the DEF Invokers actually have:

| Your DEF | Share of each hit you take |
|---|---|
| 250 | 96% |
| 500 | 92% |
| 1,000 | 85% |
| 2,000 | 72% |
| 3,000 | 62% |

So 17 more DEF barely changes the share you take, while 168 HP is pure extra health.

- ![Ironblade Darus](hero:) (4,115 HP, 402 DEF): **+168 HP adds 4.1%** effective HP. **+17 DEF adds 0.3%**.
- ![Valentu the Devoted](hero:) (13,523 HP, 1,081 DEF): **+2.2% HP adds 2.2%**, +168 HP adds 1.2%, and either DEF roll adds under 0.4%.

**Flat or %?** % HP grows with the Invoker's own HP from level and Awakening. Flat HP is better until that passes about 7,800, and % HP is better above it. The simulator ranks all four rolls for whoever you pick.

## What to keep in mind

All numbers are **estimated**:

- Toughness counts HP and DEF only. It leaves out shields, healing and Tolerances.
- "One hit" and "hits survived" assume each Ulgorim hit deals his ATK. Effective HP and the HP or DEF table don't depend on this.

Use it to compare Invokers and rolls rather than as an exact number of hits.
