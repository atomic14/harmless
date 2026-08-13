# 138 — Every system in every galaxy flies the same roster

**Kind:** feature · **Severity:** low · **Size:** medium · **Depends on:**
**docs/TODO/139**, which this item's scoping found and which must land first —
its M1 baseline is meaningless against a fight nothing can win · **GitHub:**
none — raised by Chris after 137 flew

## What M1 did

`npm run roster-probe` exists, and the baseline is taken. It walks all eight
galaxies and all 2,048 systems, asks each one which roster it flies, and prices
that reception against a Cobra Mk III. Every number comes through the runtime —
`npcWeaponByte`, `npcLaserDamageToPlayer` and `npcBestCasePerSecond` — so the
probe cannot disagree with the game about what a hit is worth.

**The baseline, and the whole of it is that the tables are flat.** All eight
galaxies report the same row:

| galaxy | systems | sets | designs | builds | per hit mean/max | best case pts/s mean/max |
| --- | --- | --- | --- | --- | --- | --- |
| 1–8 | 256 each | — | 17 | 17 | 13.2/29.0 | 8.7/19.0 |

And the reception, by slot band, over the whole census:

| band | designs | builds | per hit min/mean/max | best case pts/s min/mean/max | beat a face |
| --- | --- | --- | --- | --- | --- |
| trader | 17 | 17 | 0.0/10.0/29.0 | 0.0/6.5/19.0 | 14/17 |
| pirate | 17 | 17 | 5.0/13.2/29.0 | 3.3/8.7/19.0 | 17/17 |
| police | 1 | 1 | 17.0/17.0/17.0 | 11.1/11.1/11.1 | 1/1 |
| hunter | 10 | 10 | 5.0/13.4/29.0 | 3.3/8.8/19.0 | 10/10 |
| thargoid | 1 | 1 | 21.0/21.0/21.0 | 13.7/13.7/13.7 | 1/1 |
| thargon | 1 | 1 | 9.0/9.0/9.0 | 5.9/5.9/5.9 | 1/1 |

The variety claim is read at two sample sizes, 80 systems and 240, spread evenly
across the eight galaxies. Both report **17 designs and 17 builds**, because
every system flies the same roster. That is the number M3 has to raise, and the
damage columns above are the guard it may not lower.

### Three things M1 found that the plan did not have

1. **`SHIELD_REGEN` is 3.06 points a second, not 8.925.** docs/TODO/139 M2 cut
   the fraction from 3.5% to 1.2% after this plan was written, so the arithmetic
   in "The measurement that has to come first" below is superseded. The probe's
   `beat a face` column is the current answer: **17 of 17 pirate builds
   out-damage one face at their best case**, where fourteen of them could not
   before. The premise that opened this item is settled, and 139 settled it.
2. **The floor is already tight, and a set can breach it.**
   `constants/recharge.ts` states the bound in as many words: the lightest gun in
   the roster is the Worm and the Ophidian at 3.27 points a second, against 3.06
   of regeneration. `test/role-variants.test.ts` pins it — no build the galaxy
   sends may be one a face simply outruns. A set that fills its pirate band with
   light designs only would hand M3 a reception that breaches that gate, so the
   gate is a constraint on the chooser and not only on the roster. M3 must say
   what happens then.
3. **The guard belongs on the three combat bands, not on all six.** The trader
   band's per-hit minimum is 0, because a trader is unarmed and is meant to be.
   A "damage must not fall" rule over that band would compare two numbers that
   describe nothing.

## What M2 did

`game/blueprint-set.ts` is the chooser, and it is pure. It takes a system, a
1-based galaxy, the two random bits and an optional override, and it returns one
of the 23 letters. It draws no dice, it decides no override, and it does not
restate bit 0.

Three files carry the rule between them, one home each:

1. `galaxy/tech.ts` — `isHighTechSystem(techLevel)`, which is bit 0. It is the
   test that also picks the Dodo station over the Coriolis, and
   `world/system-scene.ts` reads it now instead of spelling it out.
2. `constants/blueprint-set.ts` — `UNSETTLED_GOVERNMENT` (2), and the three
   override letters. The doc names the three other government thresholds that
   already exist, so the fourth cannot be mistaken for one of them.
3. `game/blueprint-set.ts` — the bit arithmetic, the galaxy addition and the two
   overrides.

`eliteABlueprintSets()` is new in the catalogue, because nothing outside that
file may scan the generated arrays. The chooser indexes what the pack shipped,
so it holds no table of letters of its own.

`test/blueprint-set.test.ts` is 21 assertions. The bit table is hand-computed at
each bit, both random bits, all three unsettled governments, and one government
above them. The galaxy addition is pinned at both ends — galaxy 1 adds nothing,
galaxy 8 adds seven, and the top of the table is exactly W. Every real system of
all eight galaxies is put through it at all four bit values, and none leaves the
table.

**The pack corroborates both overrides without being made to.** Set G is the only
set the slot table ever fills slot 31 in, which is the Constrictor's own slot.
Sets C and D both carry Thargoids in slots 29 and 30. Two assertions, and they
are the strongest evidence available that the rule as recovered is the right one.

### The one-home gate, and the proof that it can fail

The set follows `DODO_TECH_LEVEL`. Moving the constant to 12 leaves all 21
assertions green. Re-inlining the threshold in `galaxy/tech.ts` while the
constant sits at 12 turns **ten of them red**, including the one that names the
rule. So bit 0 has one home, and the gate is not vacuous.

### Three things M2 found that the plan did not have

1. **Harmless's Dodo threshold is one tech band below the recovered rule, and bit
   0 inherits that.** The plan's table says bit 0 is 1 for tech level 10–14,
   which is the raw zero-based byte. `DODO_TECH_LEVEL` is 10 in SHOWN one-based
   units, so Harmless's test is raw ≥ 9. **201 of the 2,048 systems sit in that
   one band**: 28.5% of the galaxy sets bit 0 here, against 18.7% under the
   recovered rule. The plan's decision is followed and not reopened — one home,
   not two — and the two consumers stay consistent with each other, because they
   are one bit. Whether that bit should move to the source's band is Chris's, and
   it moves the station hull with it.
2. **The galaxy cannot be fully validated, and the guard says so.** The chooser
   throws when the number lands off the table. It cannot catch a wrong galaxy
   whose number still lands on it, because no constant states that there are
   eight galaxies — `hyperspace.ts` wraps at a literal 8 and `snapshot.ts`
   refuses a saved galaxy outside 1..8 at another one. The save boundary is the
   real gate, and the code comment names it rather than implying a promise the
   backstop does not make.
3. **`constants:check` warns that `UNSETTLED_GOVERNMENT` repeats the value 2**,
   which twelve other constants also hold. The tool's own remedy needs an
   `@rule` id on BOTH sides, and the other twelve have none. The new constant
   carries `@rule blueprintset.unsettledGovernment`, and the confirmation that
   the meanings differ is its doc comment. The warning is not an error and
   `npm run check` passes.

## What M3 did

The choice is wired in. A system draws two random bits from the seeded stream on
arrival, keeps the letter in `session.blueprintSet`, and the world is built with
what that set files. Four files carry it, one home each:

1. `game/set-roster.ts` — what a set narrows the roster to. `specsForSet` and
   `emptyBandsForSet`, and the two decisions below.
2. `game/ship-specs.ts` — `SPECS` is now named as the roster with NO set in
   force, `rosterSpec` takes the roster in force, and so does `pirateSpecForTier`.
3. `game/world.ts` — `World.roster`, set by `build(system, roster)`. The World
   resolves the row, because the World is the only thing that knows which system
   was built.
4. `game/game.ts` — `chooseBlueprintSet()`, called at each of the three entries:
   an arrival, a boot and a respawn.

`train/roster-census.ts` is new, and it is the measuring half of the probe split
out. `test/set-roster.test.ts` is 22 assertions.

### Four things M3 found that the plan did not have

1. **The number M1 asked M3 to raise could not rise, because it was already at
   its ceiling.** M1 read variety as distinct designs over a career, got 17, and
   called that "the number M3 has to raise". 17 is every pirate design Harmless
   files, every one of them is filed by SOME set, and the census is a union over
   arrivals — so the union was 17 before and is 17 after. What the choice buys is
   the opposite shape: a band of **4.4 designs per arrival where there were 17**,
   over **23 distinct pirate rosters**. The probe reads that now, and the census
   row is kept beside it because the two answer different questions.
2. **Every pirate in the game comes through the threat tier, not through the
   band.** `spawnPopulation` reads a tier off how attractive a target the
   commander looks and hands the hull in as an override, so narrowing
   `SPECS.pirate` alone would have left the one band this item is about
   untouched. `pirateSpecForTier` takes the roster in force. **Twelve of the 23
   sets empty a tier** — D, G, H and R file no pirate tough enough for tier 2 —
   and the rule there is the same one an empty band gets: the full roster
   answers. A set does not get to downgrade the threat rule. Measured: letting it
   costs a tier-2 hit 9.5%, against 2.9% under the rule that shipped.
3. **M1's floor worry cannot happen, and the reason is structural.** M1 said a
   set filling its pirate band with light designs only would breach the 3.06
   points-a-second regeneration gate, and that M3 must say what happens then.
   Nothing happens: M3 narrows which designs turn up and never touches a build,
   so the softest pirate any tier can send is the same ship it always was. The
   probe pins it at all three tiers, exactly rather than with a tolerance.
4. **A row is an ARRIVAL and not a system.** The two random bits give one system
   four receptions, so counting systems hid three quarters of what a commander
   can meet. The probe walks all four bit values rather than drawing, because
   four is the whole field.

### The damage guard, and where it is read

The plan's guard was "the probe's damage columns must not fall". Read on the
BAND, the pirate mean falls 13.2 → 12.4. Read on the path the game spawns
on, which is the reception a commander actually meets:

| tier | per hit, no set in force | per hit, set in force |
| --- | --- | --- |
| 0 | 5.0/8.0/13.0 | 5.0/7.4/13.0 |
| 1 | 9.0/12.0/13.0 | 9.0/12.3/13.0 |
| 2 | 9.0/17.5/29.0 | 9.0/17.0/29.0 |

**Tier 1 rose and tier 2 fell 2.9%.** Tier 0 fell 7.3% and is the tier meant to
be beatable — the opportunist a poor commander draws. Every minimum and every
maximum is unchanged, because no build moved. The test holds tiers 1 and 2 to a
twentieth and tier 0 to a tenth, and both bounds were shown to fail.

## What M4 did

The two released overrides have a caller. Three facts raise one and they sit in
three files, one home each:

1. `game/missions.ts` — `missionBlueprintOverride(commander)`, which owns both
   mission facts. The hunting leg AT the target system raises `constrictor`; the
   courier run raises `thargoid`. The stage numbers stay in the file that owns
   the five-stage machine, because `blueprint-set.ts` says in its header that it
   is TOLD which override applies and never works one out.
2. `game/game.ts` — `chooseBlueprintSet` names the override, and `enterWitchspace`
   chooses a set at all, which it did not before.
3. `constants/blueprint-set.ts` and `game/blueprint-set.ts` — unchanged. M2 built
   both ends of this and M4 is the wire between them.

`test/blueprint-override.test.ts` is 21 assertions and is new.

### Limbo outranks the hunt, and the two test systems are the reason it is provable

The Game asks the witch-space flag FIRST. A mis-jump on the hunting leg is still
limbo, and the Constrictor waits in a system rather than between two — so a
commander who mis-jumps out of the system she was sent to meets Thargoids and not
set G. That ordering is one line, and it is the fourth of the four gates below.

Both systems the wiring is tested at were chosen for what they are NOT. Tibedied
(low tech) flies A, E, I or M by its own number, and Biarge (high tech) flies B,
F, J or N — neither can reach C, D or G at any of the four bit values. The test
asserts that rather than assuming it, so an override that quietly stopped firing
cannot land on the right letter by luck.

### Four things M4 found that the plan did not have

1. **An override must not draw, and the ambush is what says so.** The number is
   not consulted when an override is in force, so a draw made to fill it would
   spend the seeded stream on a value nothing reads. It is not free: the
   Thargoid ambush rolls off the next values of the same stream two lines later,
   and an unconditional draw moves it from **three Thargoids to two** and every
   one of the nine coordinates with it. `chooseBlueprintSet` draws only when the
   number is going to be read, and the test pins the ambush to prove it.
2. **An override raised at a dock takes effect at the NEXT arrival**, and that is
   the arrival-only rule doing its job rather than a hole in it. The courier
   orders come at a station, and Harmless does not tear the system down when you
   dock — so the sky you launch into is the sky you docked out of, as M3 already
   recorded. Killing the Constrictor is the same shape from the other side: stage
   1 becomes stage 2 mid-flight, and the system keeps flying G until you leave
   it. The alternative is a system that restocks because you accepted a job.
3. **Witch-space picks its tech branch from the system you jumped FROM.** A
   mis-jump does not move `commander.systemIndex` — `resolveJump` returns before
   the assignment, and the chart target is retained for the escape jump and
   nothing else. So `this.system` in limbo is the system you left, and its tech
   level is what picks C or D.
4. **21 of the 23 sets file no Thargoid, so limbo had been flying the fallback.**
   The empty-band rule from M3 was answering for the ambush: whatever set the
   origin system had chosen filed nothing in slots 29-30 in 21 cases out of 23,
   and the full roster answered instead. The override is what makes limbo fly a
   file that actually carries the ship it is an ambush by, and the test reads
   `emptyBandsForSet` to say so rather than checking a letter.

### The four gates, each shown to fail

Per CLAUDE.md, by breaking the protected rule for a moment:

| break | reds |
| --- | --- |
| the caller names no override | 11 of 21 |
| the mission is asked before limbo | 1 — "limbo outranks the hunt" |
| a draw is made behind the override | 1 — the ambush moves, 3 Thargoids to 2 |
| limbo does not choose a set at all | 5 |

`npm run check` passes at **4,344 assertions**. `npm run roster-probe` is
unchanged, and it must be: the probe walks the number, and no override fires on
that path.

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

- **The set narrows the pool of DESIGNS; the build does not move.** The
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

**M1 — the probe, before anything changes — LANDED.** `npm run roster-probe`:
for a sample of systems across all eight galaxies, report the set each would
choose and what its reception is worth — designs by slot band, builds, damage per
hit, and best-case points per second against the Cobra. Baseline it on today's
collapsed roster first, so M3 has something to have changed. 134's lesson, and
136's: *docking well and flying well are different claims, and only the first had
a number.*

`rosterInForce(system, galaxy)` in `train/roster-probe.ts` is the seam M3
replaces. It ignores both arguments today and hands back the one module-level
roster. `test/roster-probe.test.ts` bounds what the probe may report: a role
never widens past its slot band, the ceiling is `bestCasePerSecond` and not the
probe's own arithmetic, a sample meets no more than the census holds, and the two
Harmless overlays acquire no band. All three of those gates were shown to fail
before they were believed.

**M2 — the chooser — LANDED.** `game/blueprint-set.ts`: a pure
`(system, galaxy, bits) → set letter`, the table above, plus the galaxy addition
and the two overrides. No rng inside it — the two bits are an argument.
`blueprintRandomBits(roll)` turns one draw of the seeded stream into those bits,
so a caller never has to know how wide the field is.

**M3 — wire it in — LANDED.** `specsForSet` is the roster as a function of the
set in force, and `rosterSpec`, `pirateSpecForTier` and `World.build` all take
it. `SPECS` keeps its name and is now stated as the roster with NO set in force,
which is what the training world, the viewer, the arena and a restore by design
all want. See "What M3 did" above for the four things it found.

**M4 — the overrides and witch-space — LANDED.** Constrictor system → G, plans or
witch-space → C/D by tech level. `blueprintSetFor` already took the override and
`test/blueprint-set.test.ts` already pinned both; what was left was the caller —
`chooseBlueprintSet` in `game.ts` naming the override, and `enterWitchspace`
choosing one at all. See "What M4 did" above for the four things it found.

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
