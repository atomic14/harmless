# 152 — The map at the top of game.ts is out of date

**Kind:** defect · **Severity:** low · **Size:** small · **Depends on:** 150 ·
**Blocks:** nothing · **Source:** Chris, 2026-08-14, on reading the comment
review: *"Comments should help explain the code."*

## Where we are

`src/game/game.ts` opens with a 26-line module header. It is the first thing a
reader of the largest file in the tree meets. **Three of its claims are wrong.**

### 1. It lists eight mode states. The type has fourteen.

The header says:

> Game owns the mode state machine (docked | flight | market | chart | local |
> equip | status | dead)

`type Mode` on line 119 declares fourteen: the eight above, plus `data`,
`contracts`, `saves`, `save-name`, `naming` and `briefing`.

### 2. It says the HUD is fed from here. It is not.

> Screens (ui/screens.ts) and the HUD (hud/hud.ts) are pure renderers fed from
> here.

docs/TODO/150 M3 moved that feed to `game/cockpit-view.ts` on 2026-08-14.
**I made this claim stale, and I did not correct the header.** docs/TODO/149
made the other half stale earlier: `ui/screens.ts` is one of fourteen files in
`src/ui/` now, and it is 298 lines rather than 1,953.

### 3. It says this file launches the Vipers. It delegates.

> combat.ts says a ship was destroyed and this file pays the bounty, escalates
> legal status and launches the Vipers.

`callStationDefence` moved to `game/law-actions.ts` in docs/TODO/150 M1.
`game.ts` names no Viper today.

## What is still true, and it is most of the header

The architecture half holds up. The host-and-event shape, the rule that a draw
from the seeded stream is a host call rather than an event, the split of input,
and the `__game` console view are all correct. **This is a repair, not a
rewrite.**

## Why it went stale, and the shape of the fix

**A module header describes a boundary, and this boundary moves every
milestone.** docs/TODO/150 has taken three responsibilities out of this file and
will take more. The header names its neighbours by file, so each extraction
invalidates a line of it.

**Two of the three claims are checkable and one is not.** That decides the
milestones.

## What to do

### M1 — repair the three claims

1. Replace the mode list with all fourteen states, or with a pointer to the
   type. Prefer the pointer: a list in prose is a second home for a union that
   the compiler already owns.
2. Correct the renderer sentence. Name `cockpit-view.ts` for the dashboard, and
   `src/ui/` for the screens.
3. Correct the consequence example. Pick one the file still performs, or name
   the child that performs it now.

Add the three children docs/TODO/150 has produced to the list of what is NOT
here: `law-actions.ts`, `world-build.ts` and `cockpit-view.ts`.

### M2 — the gate for the one claim that can carry one

The mode list is the only claim a machine can check. `tools/mode-header.mjs`, or
a case in the existing size or lint tool:

1. Read the mode list out of the header.
2. Read the union out of `type Mode`.
3. Fail when the two disagree.

**Prove that it can fail.** Add a fifteenth state to the type. Confirm the
failure. Remove it.

**If M1 replaces the list with a pointer, M2 has nothing to check.** That is the
better outcome, and it is a legitimate way to close this milestone. Record which
one happened, and why.

## Decisions already made

- **A comment must explain the code** (Chris, 2026-08-14).
- **This is a repair.** The architecture half of the header is correct and is
  not to be rewritten.
- **A rule gets one home** (`CLAUDE.md`). A list of modes in prose beside the
  union that declares them is two homes.

## Open questions, and the answers

**1. Why does this depend on docs/TODO/150?** Because 150 keeps moving the
boundary the header describes. A repair now goes stale at M4. Land this after
150 closes, or land it as 150's last milestone.

**2. Then why is it a separate item at all?** Because the defect exists today
and must not be lost. It also names a rule that outlives 150: **the milestone
that moves a responsibility updates the header of the file it left.** That rule
belongs somewhere permanent.

**3. Should every module header be audited?** Not here. This item is about one
file, and the evidence is about one file. A tree-wide audit is a different item
and needs its own measurement.

## Watch out for

- **`test/damage-paths.test.ts` reads a table out of a doc.** No test reads this
  header, and that was checked. Confirm it again before you edit.
- **docs/TODO/150 may extract more before this lands.** Re-read the header
  against the code on the day you do the work. Do not trust the three claims
  above to still be the only three.

## Verification

**The gates always run:** `npm run check`. This item changes a comment and may
add a check, so docs/PROCESS.md's tier table asks for nothing more.

**A new gate must be proved able to fail.** M2 states how, and states the case
where M2 correctly produces no gate.

**The number that says it worked:** every claim in the header resolves against
the code that runs, checked one by one, and the check is recorded in this doc.
