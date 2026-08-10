# 122 — The police scan arrives with no warning

**Kind:** feature / balance · **Severity:** medium · **Size:** small (two
milestones) · **Depends on:** none · 123 builds its bribe on M1's window
**GitHub:** #20

**Landed 2026-08-10.** `npm run check` green at 3,794 assertions.

## Where we were

Half of what #20 asked for was already true, and the half that was missing was
the half the player can feel.

The scan did require proximity (`world-step.ts`):

```ts
if (!session.policeScanned && !session.witchspace) {
  if (carryingContraband(commander.cargo)) {
    const policeNear = world.npcs.some((n) =>
      n.state.alive && n.role === 'police' &&
      n.object.position.distanceTo(player.position) < SCAN_RANGE);
```

`SCAN_RANGE` is 2,600 against a 6,000 scanner, it latches once per system visit,
`station.ts` clears it on docking, and on a LAUNCH police scatter 9,000–27,000
out (`POLICE_PATROL_RANGE`), so a launch is never scanned at the slot. The
mechanism was sound.

**What was missing was the telegraph.** The scan was a silent proximity test
that resolved into a verdict. There was no moment at which the player knew it
was about to happen, so there was no decision — a smuggler who flew the arrival
corridor either passed near a patrol or did not, and found out afterwards.
Dumping the cargo was a key away and nothing told you to press it.

One correction to the issue title, for the record: the scan makes you an
**Offender**, not a Fugitive — `raiseLegal(1)` — plus `DISREPUTE_CAUGHT` on your
name. That balance is not what #20 was about and is untouched.

## The finding from the first real flight (2026-08-10)

Chris, flying it: *"I got 'police scan - contraband detected' but didn't get
attacked by the viper - I thought that should be automatic?"*

Not a bug. `isHostileToPlayer` split the two roles deliberately: police hunt
**Fugitives**, bounty hunters take an interest in **Offenders**. So a smuggler
who is caught has a record, will be fined at the door and is now worth a
hunter's time — and the Viper that scanned him carries on patrolling. Defensible
as a rule: contraband is a fine-level offence, not shoot-on-sight.

What was not defensible is that the player could not tell any of it had
happened. Worse than it looked, in fact: `raiseLegal` says `LEGAL STATUS:
OFFENDER` itself, but the host applies it BEFORE the step's own message reaches
the console, so the scan line overwrote it in the same frame. The conviction was
literally unprintable.

## What was decided

**Chris, on the finding (2026-08-10): make it legible.** The rules do not move —
police keep hunting Fugitives only, and the Offender ladder is untouched. What
changes is that the world says what it did.

**Chris, on M2 (2026-08-10): build it.** The window is only worth opening if the
player can act inside it.

Carried over from the plan, unchanged:

- **Warning only, no new flying.** Police do not break patrol to inspect you, do
  not hail, and do not pursue. The change is a console warning and the window it
  opens.
- **The warning repeats while the condition holds**, rather than firing once on
  entering the band. A one-shot needs to know whether a ship is *closing*, which
  needs a previous distance per ship that the step does not keep; a repeat while
  a cop is in the band is the same information without the bookkeeping, and it
  goes quiet by itself. It is the pattern ENERGY LOW already established fifteen
  lines above.
- **No new sound.** Message only, so the change is one thing.
- **The scan itself is untouched** — same range, same latch, same Offender, same
  `DISREPUTE_CAUGHT`.
- **The warning only ever fires with contraband aboard.** A clean hold is never
  told the police are near, which is both cheaper and the correct tell: the
  message means something because it is only ever true.
- **The message does not name the distance.** The scanner already shows the
  blip, and a number would invite flying the number.

## What shipped

### M1 — the warning, and the verdict behind it

`constants/law.ts` gained three numbers and one vocabulary list:

| constant | value | the rule |
| --- | --- | --- |
| `SCAN_WARN_RANGE` | 4,400 | the band a patrol is announced in |
| `SCAN_WARN_REPEAT` | 2 s | how often, while it stays there |
| `SCAN_LINE_SECONDS` | 4 s | the scan line's lifetime, and so the verdict's wait |
| `LAW_ROLE_NAMES` | — | POLICE / BOUNTY HUNTERS, beside `LEGAL_NAMES` |

**The band is 1,800 wide**, which is what the player's Cobra covers in about
four and a half seconds at its 400 u/s top speed — flying flat out straight at a
patrol, the worst case that is not deliberate. **The rule the value obeys, and
the one under test, is `SCAN_RANGE < SCAN_WARN_RANGE <= SCANNER_RANGE`**: you are
never warned about a ship you cannot see, so "which one?" has an answer.

In the step, the scan and its telegraph are now one block reading one geometry —
the nearest live police ship — against two ranges, with the scan winning the
frame it fires on. `SessionState` gained `scanWarnTimer`, which the snapshot
walks generically and so persists for free. Out of the band, scanned, jumping or
clean, the timer re-arms at 0, so the next patrol to close is announced on the
frame it does rather than after the remains of a countdown.

`POLICE PATROL CLOSING` holds the console for half the repeat period — the duty
cycle ENERGY LOW flashes at, derived rather than given a constant of its own.

**The verdict** is the finding's half. A second `SessionState` field,
`scanVerdictTimer`, counts the scan line out and then says what it cost you:

```
POLICE SCAN: CONTRABAND DETECTED
RECORD: OFFENDER — BOUNTY HUNTERS WILL ENGAGE
```

Delayed rather than pushed in the same frame, because the console is one line and
a verdict pushed alongside would erase the line it exists to explain — which is
exactly the bug that hid `LEGAL STATUS: OFFENDER` in the first place.

It is **assembled, not written out**. The threshold that decides who comes for a
record moved into `game/law.ts` as `lawTakesInterest(role, legalStatus)`;
`npc.ts`'s `isHostileToPlayer` now spends that function instead of restating the
two comparisons, and `recordVerdict` spends the same one to build the sentence.
So the message cannot promise a fight the rules will not deliver, and a Fugitive
is told the truth about his own case without a second branch:

```
RECORD: FUGITIVE — POLICE AND BOUNTY HUNTERS WILL ENGAGE
```

The test harness's `StepHost` stub now APPLIES `raiseLegal` as well as counting
it, because the step reads `commander.legalStatus` back to build that line. A
stub that only counted would have let the verdict say CLEAN while the real Game
said OFFENDER.

### M2 — a dump you can aim

`dumpCargo` takes the **most valuable thing first**, and that ordering is
load-bearing for the pirate bribe: *"it costs you the good stuff, so it is never
free to try."* Against the 1984 price table it is right for Narcotics and wrong
for the other two:

| commodity | `basePrice` | rank of 17 |
| --- | --- | --- |
| Narcotics | 0xeb (235) | 1st |
| Firearms | 0x7c (124) | 7th |
| Slaves | 0x28 (40) | 14th |

So a smuggler running slaves under a hold of furs and platinum had to jettison
almost the entire cargo to reach them: the warning said dump, and the dump key
threw the profit overboard while the evidence stayed aboard.

`jettison.ts` now states two rules over one mechanism. A private `dumpBest`
holds the ordering and takes the eligible set; `dumpCargo` passes the whole hold
and `dumpContraband` passes `CONTRABAND` — the set that already has exactly one
home. Neither export can quietly acquire the other's rule, and the pirate's
pricing is untouched. The dumped value still accrues to
`session.jettisonedValue`, so contraband thrown at a pirate buys peace exactly as
anything else does.

In `game.ts`, both keys now travel one road out of the ship — `throwOverboard`
takes the chooser and the refusal line, so the canister placement, the toll and
the bribe offer cannot drift apart between them. A hold with nothing illegal in
it is refused with `NO CONTRABAND ABOARD` rather than falling back on the
ordinary dump.

**The key is O**, for OVERBOARD: free in the cockpit, a few keys along the top
row from Y so the three ways of emptying a hold sit under one hand. Not a
shifted Y — ⇧Y is already five tonnes, and a modifier on a bulk dump would read
as more of the same rather than as a different rule. It joins
`NOT_IN_THE_SIMULATOR` for the reason the other two are there, and one more: an
arena has no law to hide from.

Invariant 9's surfaces: `controls.ts` binds it, `command-help.ts` says what it
does (and would not compile without a caption), the `?` guide and the manual are
rendered from the pair, and the hand-written README row is held in both
directions by `test/key-help.test.ts`.

## Verification

Extends `test/world-step.test.ts`'s police-scan block, off the `patrol(seed,
contraband, d)` fixture that block already had, plus a `holding` stepper that
pins the cop and stops the commander so what is measured is the range rule and
not two ships drifting.

- A cop at `SCAN_WARN_RANGE * 0.9` warns and does **not** scan; no record, no
  latch, `disrepute` unchanged. The claim of the whole milestone.
- A cop at `SCAN_RANGE * 0.5` scans, and the scan and the warning never share a
  frame.
- A cop beyond `SCAN_WARN_RANGE` says nothing.
- The warning repeats on `SCAN_WARN_REPEAT` — 5 in 9 seconds, wanted 5, computed
  from the constant — and goes quiet for good once `policeScanned` latches, over
  600 further steps.
- A **clean** hold at `SCAN_WARN_RANGE * 0.9` is never warned, over 600 steps.
- The band's edge is **bisected out of the shipped step** the same way the scan's
  is, and measured at 4,400.00.
- `SCAN_RANGE < SCAN_WARN_RANGE <= SCANNER_RANGE`, asserted as a rule rather than
  a value.
- The verdict follows the line it explains, once, naming the record the scan
  actually left; and across all three statuses the roles it names are exactly the
  ones `isHostileToPlayer` turns on for real spawned ships — so the sentence
  cannot drift from the rule.
- **M2**, pure half in `test/combat.test.ts`: a hold of slaves under furs and
  platinum, with the premise (*the dearest tonne aboard is legal*) read out of
  the commodity table rather than assumed. `dumpContraband` takes the slaves and
  leaves the freight; `dumpCargo` on the same hold takes the dearest legal tonne
  and leaves the crime; dearest-contraband-first is asserted against the table;
  the tonne is priced like any other, so it still buys off a pirate; and a hold
  with no contraband dumps nothing at all.
- **M2**, world half in `test/jettison.test.ts`: the chosen tonne actually leaves,
  clear of your own scoop reach by the same road as the ordinary dump, and is
  still gone a frame later; a clean hold refuses honestly.
- `test/ui.test.ts` pins O to `jettisonContraband`; `test/combat-sim.test.ts`
  pins it out of the arena.

**The gates were proven able to fail**, each break reverted:

- dropping the `< SCAN_RANGE` exclusion from the warning band → 2 failures, both
  the frame-sharing assertions;
- replacing `recordVerdict`'s derivation with a hard-coded `POLICE` → 2 failures,
  at Offender and at Fugitive;
- reverting `dumpContraband` to `dumpCargo` → 8 failures across both halves.

`npm run check`: 3,794 passed, 0 failed. Two catalogue warnings remain by
design, both the diff-scoped *confirm the meanings differ* prompt on a repeated
primitive; both are confirmed in the constants' own JSDoc, and
`SCAN_WARN_REPEAT` carries an `@rule` id because it shares the value 2 with
`FUGITIVE` eleven lines above it in the same file.

## What was deliberately left

- **The scan's own balance.** Same range, same latch, same Offender, same
  `DISREPUTE_CAUGHT`.
- **Police engaging Offenders.** Considered and declined at Chris's call: the
  consequence is made legible instead, so contraband stays a fine-level offence.
- **A sound of its own.** Whether the warning wants one is a question for after
  somebody has flown it.
