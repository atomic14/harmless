# 138 — Every system in every galaxy flies the same roster

**Kind:** feature · **Severity:** low · **Size:** medium · **Depends on:**
**docs/TODO/139**, which this item's scoping found and which must land first —
its M1 baseline is meaningless against a fight nothing can win · **GitHub:**
none — raised by Chris after 137 flew

## Where we are

Elite-A did not ship one roster. It shipped **23**, the files `S.A` to `S.W`,
and it chose between them on arrival. Each file is a table of 31 numbered
**slots**, and a slot is a job: 16 is the cop, 17–24 the pirates, 11–14 the
traders, 29–30 the Thargoids, 31 the Constrictor. A file fills those slots with
its own designs and gives each one its own stat block, so where you were decided
both who jumped you and how hard they hit.

Harmless imports all of it and then collapses the dimension. `ELITE_A_SLOTS`
holds all 713 assignments and `ELITE_A_VARIANTS` all 260 builds, both gated by
`npm run generate:elite-a -- --check`. What runs is `SPECS` in
`game/ship-specs.ts`: a module-level const whose `profileId`s are resolved **at
import time** by `flying()` (`ship-specs.ts:58`), through
`roleCombatProfileId(role, designId)`. A Krait is the same Krait in all eight
galaxies and all 256 systems, for the whole life of the process.

The seam is already named and already the right shape.
`ship-identity.ts:228` says it in as many words — *"by system hands in a
different `profileId` and nothing else changes"* — and `catalogue.ts:173` says
the same about `recommendedNpcProfile`. Nothing downstream asks who chose: a
ship's `profileId` is in its snapshot, and a snapshot carrying no id is refused
rather than re-derived, so a restored ship keeps the exact build it had.

### The released rule, recovered

From bbcelite's deep dives (the disc-version blueprint dive for the base number,
the Elite-A dive for what Elite-A did to it). The pack does not carry this —
`elite_a_complete_ship_data.json` has `blueprintSets`, `slotAssignments` and
`npcBlueprintVariants` and no selection metadata at all — so it is a fourth
source and must be cited as one.

A number 0–15, built bitwise:

| bit | source rule |
| --- | --- |
| 0 | 1 for tech level 10–14, 0 for 0–9 — **the same bit that picks the Dodo over the Coriolis** |
| 1 | 0 for anarchy, feudal and multi-government; 1 for everything safer |
| 2–3 | random |
| 4–7 | 0 |

Elite-A then **adds the galaxy number** (`GCNT`, 0–7), giving 0–22 across the 23
files. It is loaded by `LOMOD` on launch from a station or on hyperspacing into a
new system.

Two overrides, and both are corroborated by data already in the repo:

- the Constrictor's system in mission 1 always picks **6, file G** — and the
  pack's own slot table puts slot 31, the Constrictor, in file G and nowhere
  else;
- mission 2 carrying the plans, or witch-space, overrides to **C** (low tech) or
  **D** (high tech) — and Thargoids occupy slots 29–30 in select files only.

The data and the rule agree without being made to, which is the strongest
evidence available that the rule as recovered is the right one.

### Bit 0 already has a home, and bit 1 nearly does

**Do not spell bit 0 twice.** `world/system-scene.ts:61` already chooses the
station hull on `sys.techLevel + 1 >= DODO_TECH_LEVEL` (`constants/station.ts`,
10). That expression *is* the source's bit 0 — in the released game one bit
picked the station and the blueprint file together, and here half of it has been
running since long before the catalogue arrived. The chooser reads that rule; it
does not restate it.

Bit 1 is `government <= 2` against `GOVERNMENT_NAMES` (`galaxy.ts:32`: 0
Anarchy, 1 Feudal, 2 Multi-Government). **It is not `government <= 1`**, which
appears three lines from where the chooser will read (`galaxy.ts:70`, anarchy
and feudal cannot be rich). Two different rules, adjacent, one off by one.

### The two random bits, and where they must live

Bits 2–3 are a coin the source flipped on arrival. Harmless may not flip it the
same way: invariant 11 puts all world chance on the one seeded stream, and
`role-variants.ts` records the standing rule that **nothing which decides a
future frame draws rng at resolve time**.

So the bits are drawn once, from the seeded stream, at the moment a system is
entered, and **the chosen set is saved world state** — CLAUDE.md's
"behaviour-changing data is saved state, not an ambient global", and invariant
12. A reload then flies the roster it flew before, and the set is a thing the
DATA ON SYSTEM page could show if it ever wanted to.

## The measurement that has to come first

**M1 exists because of what fell out of scoping this**, and it changes the
plan's own recommendation.

`role-variants.ts` does not fly the pack's recommended default. It deliberately
flies **the hardest build of a design the source ever filed under that job**,
and its header says why: a default pirate does 9 points to a Cobra Mk III's
510-point front pool, so it takes 57 hits. Threat was restored by *selection*.

Set-faithful selection would throw that away — a set gives you whatever build
*it* filed in slot 19, ranked by nothing. And the opposition cannot afford it.
Measured through the real modules
(`npcLaserDamageToPlayer` against `COBRA_MK_3_HULL_ID`, `NPC_HIT_CAP` 0.85, mean
cooldown 1.3s), the **best case** an attacker can have — point blank, capped hit
chance, never out of the firing gate:

| roster | damage/hit | best-case points/s |
| --- | --- | --- |
| tier-0 pirate (the opportunist) | 5–13 | 3.27 – **8.50** |
| tier-1 pirate | 9–13 | 5.88 – 8.50 |
| tier-2 pirate (the organised gang) | 9–29 | 5.88 – 18.96 |
| police | 17 | 11.12 |

`SHIELD_REGEN` is **8.925 points a second, per face**. A tier-0 pirate flying the
hardest build the source ever gave it, hitting perfectly, at knife range, **does
not out-damage the shield it is shooting at**. Most of tier 1 does not either.

`npm run survivability` agrees from the other end: four attackers over 45
seconds strip **24%** of the commander's 765 points and destroy her **0%** of the
time. And `constants/npc-gun.ts:20` already knew the other half — *"a pirate is
only inside the firing gate for about 5% of a fight"* — so the real rate is a
fraction of the best case above.

That is Chris's observation from flying, and it is arithmetic rather than feel.
**It is not this plan's to fix.** It became **docs/TODO/139**, which owns the
decision about which of the three terms moves (regen, damage, or time on aim),
and which sits in front of this item in the queue. What it settles here is the
one decision below.

## Decisions already made

- **The set narrows the pool; `role-variants.ts` still ranks inside it.** The
  faithful alternative — take whatever build the set filed — is measurably a
  weakening of an opposition that already cannot out-damage a shield, and it
  would be shipped on top of a defect rather than in front of it. Every build
  selected is still an exact released row of the vendored pack, so no parity
  claim moves; what stays Harmless is the *policy*, which
  `role-variants.ts` already states is ours.
  **This contradicts `docs/ELITE-A.md:241`**, which calls by-system selection "a
  swap of that policy and nothing else". The measurement above is why; that line
  gets corrected by this item.
- **The variety we are actually buying is WHICH DESIGNS turn up**, not which
  builds. That is the half a player can see, and it is the half that survives
  the decision above intact.
- **The chosen set is saved state**, drawn once from the seeded stream on entry.
- **Bit 0 is read from the Dodo rule, not restated.** One home.
- The chooser is pure and shared with the campaign simulator, like
  `market.ts` and `contracts.ts` before it (invariant 10).

## What to do

**M1 — the probe, before anything changes.** `npm run roster-probe`: for a
sample of systems across all eight galaxies, report the set each would choose and
what its reception is worth — designs by slot band, builds, damage per hit, and
best-case points per second against the Cobra. Baseline it on today's collapsed
roster first, so M3 has something to have changed. 134's lesson, and 136's:
*docking well and flying well are different claims, and only the first had a
number.*

**M2 — the chooser.** `game/blueprint-set.ts`: a pure
`(system, galaxy, bits) → set letter`, the table above, plus the galaxy addition
and the two overrides. No rng inside it — the two bits are an argument.

**M3 — wire it in.** `SPECS` stops being a module-level const of resolved ids
and becomes a function of the set in force; `rosterSpec` takes it. Everything
downstream is unchanged by construction, because the only thing that moves is a
`profileId` that was always going to be handed in.

**M4 — the overrides and witch-space**: Constrictor system → G, plans or
witch-space → C/D by tech level.

## Watch out for

- **`SPECS` is read at import by more than the game.** The viewer, the campaign
  simulator and `ai-training/scenario.ts` all touch this roster. A function-of-set
  signature has to leave every one of them a defined set — the training world
  must keep flying ONE fixed set, or every trained brain's world moves under it
  (invariant 5, and `ELITE-A.md`'s deferred item 3 is the same trap).
- **A set does not fill every slot.** 713 assignments, only **398 populated** —
  set A alone leaves slots 7–10, 14, 15, 20, 23 and 25 empty. The chooser must
  say what a role does when its band is empty in the set in force, and the answer
  must not be silent.
- `ship-roles.ts` builds its bands from the slot table at module load and is
  about PERMISSION, not selection. It does not change.
- The two Harmless overlays — the rock hermit and the generation ship — have no
  band and must not acquire one.
- Galaxy is 1-based in `CommanderData` and 0-based as `GCNT`. The off-by-one is
  worth exactly one test.

## Open questions

None for the queue. The one real decision — fidelity against an opposition that
cannot bite — is answered above and is Chris's to overrule.

## Verification

- `test/blueprint-set.test.ts` pins the bit table against hand-computed cases,
  both overrides, and the galaxy addition at both ends (galaxy 1 → 0, galaxy 8 →
  7, and that the result never leaves 0–22).
- A test that the chooser reads the **Dodo** rule: change `DODO_TECH_LEVEL` and
  the chosen set moves with it. That is the gate that proves bit 0 has one home,
  and per CLAUDE.md it must be shown to fail by temporarily breaking the rule.
- Determinism: same seed and system → same set, across a save/reload cycle
  (invariant 3), and no `Math.random` anywhere on the path (invariant 11).
- `npm run roster-probe` before and after: the claim is **variety**, so the
  number to move is how many distinct designs a player meets in the pirate band
  over a career's worth of systems — with the caveat that it is measured at two
  sample sizes before it is believed.
- The probe's damage columns must **not fall** against the M1 baseline. That is
  the guard on the decision above, and the reason the baseline is taken first.
- `npm run elite-a` and `npm run check` unchanged — no generated file, fixture
  or parity matrix is touched by any of this.
