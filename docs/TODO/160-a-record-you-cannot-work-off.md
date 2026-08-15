# 160 — A record you cannot work off

**Kind:** enhancement · **Severity:** medium · **Size:** medium · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** #32 — *"Killing pirates should
decrease your criminal status."*

**Atonement** in this plan is the number of pirate kills counted toward the
commander's legal record since that record last rose. The word is new. It names
one field and one constant, and nothing else.

## Where we are

Every claim below is read off the code that runs.

**A record only ever goes up, and money is the only way down.** `raiseLegal`
(`src/game/law-actions.ts:93`) moves `commander.legalStatus` up.
`recordCleared` (`src/game/law.ts:51`) is the only rule that takes it down, and
`payFine` (`law-actions.ts:112`) is its only caller. Its doc says so in as many
words: *"buying your name back is `recordCleared` at a station, by choice, and
it is the only thing that clears one."* This item adds the second way, so that
sentence must change with the code.

**Killing a pirate is already free, and it pays.** `offenceFor`
(`src/game/law.ts:224`) answers Clean for a pirate, a Thargoid, a Thargon and a
rock. `raiseLegal` returns at once for a Clean answer
(`law-actions.ts:94`). `Combat.destroy` (`src/game/combat.ts:248`) credits the
bounty in the same pass.

**A pirate is worth 4 to 22 credits.** The bounties in
`src/game/ship-specs.ts:209-230` run from 40 to 220 tenths, and most of the band
sits near 100. The fines are 25 credits for an Offender and 75 for a Fugitive
(`OFFENDER_FINE`, `FUGITIVE_FINE`, `src/constants/law.ts:41`).

**The two ladders already move apart, and 156 is the precedent.** A record is
what the Galactic Government holds. A Character score is what people think of
you. docs/TODO/156 charged a capsule kill to the name and not to the record,
which is the same joint read from the other side.

**The Character ladder already decays and the record does not.** `afterDecay`
(`src/game/character.ts:76`) forgives disrepute over days. Nothing forgives a
record.

## What the triage found that the issue did not report

**The issue is one line and it names no rate.** The rate is the whole design, so
this plan chooses it and states the arithmetic. That choice is called out again
under **Decisions already made** as MINE rather than Chris's, so it can be
overruled cheaply.

**A record worked off must not also clear the name.** If a pirate kill moved
both ladders, a commander could murder a trader, shoot five pirates, and be
Clean and Honest at a profit. The record is the half that may be worked off. The
name is not. That is what makes the feature safe, and it is the reason it can
land without a balance probe.

**A Thargon drone would make the record free.** `THARGON_REDEPLOY` is 5 seconds
(`src/constants/encounters.ts`), and a live mothership keeps replacing drones.
So the rule counts pirates, and only pirates.

**The counter is persistent state and the snapshot rejects an old shape.**
`SNAPSHOT_VERSION` is 2 and `restore` fails on any other version
(`src/game/snapshot.ts:32`, `:272`). A new field on `CommanderData` is therefore
a version bump to 3, exactly as docs/TODO/156 bumped 1 to 2.

## What to do

ONE milestone, and therefore one commit. The rule, the state and the console
line are one change; splitting them would land a counter that nothing reads.

### M1 — a pirate kill pays down the record

**Two constants in `src/constants/law.ts`,** beside the fines they are priced
against:

- `KILLS_PER_RUNG` (5) — pirate kills that take the record down one rung.
- `ATONEMENT_ROLE` is NOT a constant. The role is `'pirate'`, written once, in
  the rule below.

**The arithmetic that chooses 5.** Five kills earn roughly 50 credits of bounty
at the median hull. One rung costs 25 credits as an Offender and 75 as a
Fugitive. So the fight route pays for itself and then some, and it takes five
fights and a survival. The fine is the fast way and needs a station; the fight
is the slow way and needs none. Ten kills take a Fugitive to Clean.

**One new pure rule, in `src/game/law.ts`:**

```
recordWorkedOff(legalStatus: number, atonement: number):
  { legalStatus: number; atonement: number } | null
```

It returns `null` for a Clean commander, because there is nothing to work off
and a bank of credit earned before a crime is not atonement. Otherwise it adds
one to `atonement`, and when the total reaches `KILLS_PER_RUNG` it takes one
rung off `legalStatus` and returns `atonement` to 0.

It is shaped like `recordCleared` deliberately: the rule does the arithmetic and
the caller writes it down (invariant 10).

**`CommanderData` gains `atonement: number`,** defaulting to 0 at
`src/game/commander.ts:208`. `SNAPSHOT_VERSION` goes to 3.

**`LawActions` gains `lowerLegal(role: string)`,** beside `raiseLegal`:

- it does nothing unless `role === 'pirate'`;
- it applies `recordWorkedOff`;
- when the rung MOVES it queues `recordVerdict(newStatus)`, which is the one
  home of what a moved record says (`src/game/law.ts:208`). A commander who
  falls from Fugitive to Offender is told that bounty hunters still engage, and
  a commander who reaches Clean is told that nobody is coming.
- **Only a MOVE speaks.** That is the rule `raiseLegal` already states, and a
  line per kill would shout the ledger down the length of a fight.

**`raiseLegal` resets `atonement` to 0 when the status moves up.** A ledger
carried across a fresh crime would let a commander bank four kills before
committing one.

**`Combat.destroy` calls it** where it already asks `offenceFor`
(`src/game/combat.ts:248`). That is the one frame that knows the role and knows
the kill is the commander's. A pirate killed by the police credits nobody, which
is correct.

**A capsule does NOT count.** `Combat.podKilled` (docs/TODO/156) is a separate
path and stays one. Shooting somebody in a capsule is not police work.

**The Constrictor counts.** It is spawned in the `pirate` role
(`src/game/spawning.ts:158`). One kill of it is one rung's worth of five, which
is right: it is one ship.

**`recordCleared`'s doc comment is repaired in the same commit.** It says the
fine is the only thing that clears a record. After this it is not. `CLAUDE.md`
requires the milestone that takes a responsibility out of a file to repair that
file's claim in the same commit.

## Verification

The gates always run: `npm run check`.

Beyond them, tiered to the change. This changes a rule of the law ladder. It
changes no ship, no price and no combat number, so:

1. **`test/atonement.test.ts`**, a new file, is the gate. It asserts behaviour
   through the real `Game`, the real `Combat` and the real `LawActions`:
   - a Fugitive who destroys five pirates is an Offender, and the fifth kill
     says so on the console;
   - the fourth kill says nothing, because only a move speaks;
   - ten kills take a Fugitive to Clean, and the eleventh changes nothing;
   - a CLEAN commander banks no atonement, so a crime after twenty kills leaves
     an Offender who still needs five;
   - a fresh offence resets a part-paid ledger;
   - the CHARACTER score does not move on any of it, which is the half that
     must not change;
   - destroying a trader, a police ship, a Thargon and an asteroid pays down
     nothing;
   - a pirate killed by an NPC pays down nothing;
   - `atonement` survives a snapshot round trip, part-paid.
2. **Prove the gate can fail.** Return `null` from `recordWorkedOff` for every
   input, and count the failures. Then restore it and delete the reset in
   `raiseLegal`, and count the failures again. The two halves must fail
   separately.
3. **`npm run elite-a`.** No ship or combat datum moves, so it must be
   unchanged. It is cheap and it is the guard on that claim.

Not run: `npm run campaign`. `test/campaign.ts` never reads `legalStatus`,
measured by search, so the harness cannot see this rule at all.

## Decisions already made

- **Killing pirates takes the record down** (Chris, 2026-08-15, GitHub #32):
  *"Killing pirates should decrease your criminal status."*

## Open questions

None. Three were open at the start of the plan. Each is answered above, and each
answer is MINE rather than Chris's, so each is cheap to overrule:

- **The rate is five kills a rung**, on the arithmetic against the two fines.
- **Pirates only**, because a Thargon drone is replaced every five seconds.
- **The record moves and the name does not**, on docs/TODO/156's split.

## Watch out for

- `SNAPSHOT_VERSION` 2 saves are rejected outright by `restore`. Read
  docs/TODO/156's outcome before the bump; it is the last one and it records
  what the bump costs a player.
- `legalStatus` is a number with three values and no enumeration. Use `CLEAN`,
  `OFFENDER` and `FUGITIVE` from `src/constants/law.ts`, and take the rung down
  by one rather than by name.
- `recordVerdict` is assembled from `lawTakesInterest`. Do not write a second
  sentence for a record that fell; the one home already reads both directions.
- docs/TODO/158 changes who engages the commander near a station. It does not
  touch this rule, and this rule does not touch it. Land them in either order.
