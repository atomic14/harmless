# 122 — The police scan arrives with no warning

**Kind:** feature / balance · **Severity:** medium · **Size:** small (two
milestones) · **Depends on:** none · 123 builds its bribe on M1's window
**GitHub:** #20

## Where we are

Half of what #20 asks for is already true, and the half that is missing is the
half the player can feel.

The scan does require proximity (`world-step.ts:563-577`):

```ts
if (!session.policeScanned && !session.witchspace) {
  if (carryingContraband(commander.cargo)) {
    const policeNear = world.npcs.some((n) =>
      n.state.alive && n.role === 'police' &&
      n.object.position.distanceTo(player.position) < SCAN_RANGE);
```

`SCAN_RANGE` is 2,600 against a 6,000 scanner (`constants/law.ts:37`,
`constants/console.ts:17`), it latches once per system visit, `station.ts:177`
clears it on docking, and on a LAUNCH police scatter 9,000–27,000 out
(`POLICE_PATROL_RANGE`, `spawn-placement.ts:29`), so a launch is never scanned
at the slot. `test/world-step.test.ts:578-620` bisects the range out of the step
rather than probing the constant. The mechanism is sound.

**What is missing is the telegraph.** The scan is a silent proximity test that
resolves into a verdict. There is no moment at which the player knows it is
about to happen, so there is no decision — a smuggler who flies the arrival
corridor (where police scatter 600–1,800 off the lane, `POLICE_SCATTER`) either
passes near one or does not, and finds out afterwards. Dumping the cargo is a
key away and there is nothing to tell you to press it.

One correction to the issue title, for the record: the scan makes you an
**Offender**, not a Fugitive — `this.host.raiseLegal(1)` — plus
`DISREPUTE_CAUGHT` on your name. That balance is not what #20 is about and is
left alone.

## A finding from the first real flight (2026-08-10)

Chris, flying it: *"I got 'police scan - contraband detected' but didn't get
attacked by the viper - I thought that should be automatic?"*

**Not a bug — but the reason is invisible, and it belongs to this plan.** The
scan calls `raiseLegal(1)`, so being caught makes you an **Offender**. And
`isHostileToPlayer` (`npc.ts`) splits the two roles deliberately:

```ts
(npc.role === 'police' && (legalStatus >= 2 || npc.state.provokedByPlayer)) ||
(npc.role === 'hunter' && (legalStatus >= 1 || npc.state.provokedByPlayer))
```

Police hunt **Fugitives**; bounty hunters take an interest in **Offenders**. So
a smuggler who is caught has a record, will be fined at the door and is now
worth a hunter's time — and the Viper that scanned him carries on patrolling.

That is defensible as a rule: contraband is a fine-level offence, not
shoot-on-sight. What is NOT defensible is that the player cannot tell any of it
happened beyond one line of text — which is exactly this item's subject. The
scan says CONTRABAND DETECTED and then the world appears to shrug.

**So it is scope for this plan, not a new one.** Whichever way it goes, the
window has to say what it did: either the consequence is legible (you are an
Offender, here is what that now means for you) or the police do engage, and then
`offenceFor`'s ladder is what moves. **Chris's call**, and worth taking before
M1 is written, because it decides whether the telegraph is a warning about the
scan or a warning about the fight after it.

## What to do

### M1 — the warning

A police ship carrying you toward its scan range says so, on the pattern the
same function already uses for ENERGY LOW (`world-step.ts:553-561`): a session
timer, a repeat while the condition holds, silence when it stops.

```ts
// constants/law.ts
/** A police ship this close is about to be able to read your hold. */
export const SCAN_WARN_RANGE = ...;   // > SCAN_RANGE, and <= SCANNER_RANGE
export const SCAN_WARN_REPEAT = ...;  // seconds between repeats
```

In the step, inside the block that already tests `policeScanned`, `witchspace`
and `carryingContraband`: if the nearest live police ship is inside
`SCAN_WARN_RANGE` but outside `SCAN_RANGE`, run the timer down and say
`POLICE PATROL CLOSING`. `SessionState` gains `scanWarnTimer`, which the
snapshot walks generically (`snapshot.ts:315`) and so persists for free.

**The rule the range must obey: you are never warned about a ship you cannot
see.** `SCAN_WARN_RANGE <= SCANNER_RANGE` makes the warning actionable — the
blip is on the scanner, so "which one?" has an answer — and it is the constraint
worth pinning in a test rather than the value itself.

No new flying. Police keep their patrol; the warning is the step reporting a
geometry that was always there.

### M2 — a dump you can aim

The window M1 opens is only useful if the player can act inside it, and today,
for half the contraband table, they cannot.

`dumpCargo` (`jettison.ts:35-54`) takes the **most valuable thing first**, and
that ordering is deliberate and load-bearing for the pirate bribe: *"it costs
you the good stuff, so it is never free to try."* Against the 1984 price table
that is fine for Narcotics (`basePrice` 0xeb — the most valuable commodity in
the game) and wrong for the other two:

| commodity | `basePrice` | rank of 17 |
| --- | --- | --- |
| Narcotics | 0xeb (235) | 1st |
| Firearms | 0x7c (124) | 7th |
| Slaves | 0x28 (40) | 14th |

A smuggler running slaves under a hold of furs and platinum has to jettison
almost the entire cargo to reach them. The warning tells them to dump and the
dump key throws the profit overboard while the evidence stays aboard.

So: a **JETTISON CONTRABAND** command, one tonne per press, most valuable
*contraband* first, using `CONTRABAND` from `constants/law.ts` — the set that
already has exactly one home. Free letters in the cockpit table: L, O, Q, R, Z.

A separate command rather than a mode on `dumpCargo`: the bribe's ordering is a
priced rule that pirates are balanced against (`constants/jettison.ts`), and
threading a flag through it would put two rules in one function. The dumped
value still accrues to `session.jettisonedValue`, so contraband thrown at a
pirate still buys peace, exactly as it does today.

**M2 is the milestone Chris may want to cut** — it is the player's half of the
window, not the police's, and #20 as written only asks for the police's half.
It is here because a warning nobody can act on is a notification, not a
mechanic.

## Decisions already made

- **Warning only, no new flying** (Chris, 2026-08-10). Police do not break
  patrol to inspect you, do not hail, and do not pursue. The change is a console
  warning and the window it opens.
- **The warning repeats while the condition holds**, rather than firing once on
  entering the band. A one-shot needs to know whether a ship is *closing*, which
  needs a previous distance per ship that the step does not keep; a repeat while
  a cop is in the band is the same information without the bookkeeping, and it
  goes quiet by itself when they drift off. It is also the pattern ENERGY LOW
  already established fifteen lines above.
- **No new sound.** Message only, so the change is one thing. Whether this
  wants an alert of its own is a question for after somebody has flown it.
- **The scan itself is untouched** — same range, same latch, same Offender, same
  `DISREPUTE_CAUGHT`. #20 reports the absence of a warning, not the verdict.
- **The warning only ever fires with contraband aboard**, inside the existing
  `carryingContraband` guard. A clean hold is never told the police are near,
  which is both cheaper and the correct tell: the message means something
  because it is only ever true.

## Open questions — answered here

- **Should the message name the distance?** No. Every console line in this game
  is two or three words and the scanner already shows the blip. A number would
  invite flying the number.
- **What about a police ship that is in the band when you arrive?** It warns
  immediately, which is right: you dropped out of witchspace next to a patrol
  with a dirty hold. `session.witchspace` still suppresses the whole block
  during the jump itself.
- **Does M2's key work in the simulator?** No — `jettison1`/`jettison5` are
  already in `NOT_IN_THE_SIMULATOR` because the clone's hold is empty
  (`controls.ts:176-198`). The new command joins them for the same reason.

## Watch out for

- **`constants:find` before naming anything.** `SCAN_WARN_RANGE` sits between
  two existing distances and `SCANNER_RANGE` is 6,000; a value equal to an
  existing constant needs a distinct `@rule` id, per the catalogue's
  duplicate-value policy. Run `npm run constants:find` for the proposed name,
  two synonyms and the value, then `npm run generate:constants` and
  `npm run constants:check`.
- **`world-step.ts` is 743 lines.** M1 is a dozen lines inside a block that
  exists; keep it there rather than opening a new section.
- **M2 adds a binding, so invariant 9's four surfaces apply** — `command-help.ts`
  (will not compile without a caption), the `?` guide section, the manual, and
  the hand-written README table that `test/key-help.test.ts` holds in both
  directions.
- **Do not let the warning re-arm the latch.** `policeScanned` guards the whole
  block; once scanned, the warning must go quiet too — being told the police are
  closing after they have already read your hold is the same class of bug as
  #19.

## Verification

Tier: extend `test/world-step.test.ts`'s existing police-scan block, which
already builds an arrival with contraband and one police ship at a chosen
distance (`patrol(seed, contraband, d)`, `:587-598`). Everything below is one
more call to that fixture.

- A cop at `SCAN_WARN_RANGE * 0.9` warns and does **not** scan; the record and
  `disrepute` are unchanged. This is the claim of the whole milestone.
- A cop at `SCAN_RANGE * 0.5` scans, and the scan message and the warning do not
  both appear for the same frame.
- A cop beyond `SCAN_WARN_RANGE` says nothing.
- The warning repeats on `SCAN_WARN_REPEAT` and stops once `policeScanned`
  latches — fly on 600 steps and assert silence, mirroring the latch assertion
  already at `:610-613`.
- A **clean** hold at `SCAN_WARN_RANGE * 0.9` is never warned — the control that
  matters, in the same shape as the existing clean-hold control at `:616-619`.
- `SCAN_WARN_RANGE > SCAN_RANGE && SCAN_WARN_RANGE <= SCANNER_RANGE`, asserted in
  `test/constants.test.ts` as a rule, not a value.
- **M2:** a hold of slaves under furs and platinum. `jettisonContraband` removes
  a tonne of slaves; `dumpCargo` on the same hold removes the platinum. Both
  asserted from `CONTRABAND` and the commodity table, so the test states the
  rule rather than restating the ordering code.
- Prove the gates can fail: drop the `< SCAN_RANGE` exclusion from the warning
  band (the warning then fires alongside the scan), and revert `jettisonContraband`
  to `dumpCargo`.
- `npm run check` at the end of each milestone.
