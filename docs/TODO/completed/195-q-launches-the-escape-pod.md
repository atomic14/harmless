# 195 — Q launches the escape pod

**Kind:** enhancement · **Severity:** medium · **Size:** small · **Depends
on:** nothing · **Blocks:** nothing · **GitHub:** #43

## Where we are

**Chris reported it on 2026-09-06 (GitHub #43):** *"No escape pod button - I
think it should be Q?"*

**The pod exists, and only death fires it.** `constants/shop.ts` sells it for
10,000 credits at tech level 6. `Equipment.escapePod` holds it. `Career.die`
in `game/career.ts` reads it. With a pod, death spends the pod, empties the
hold, and puts the commander docked at the local station. The line is
`ESCAPE POD DEPLOYED — CARGO LOST`. No key reaches that branch before the
ship dies. The manual names the pod under equipment and names no key.

**Q is taken, and by design.** `game/bindings.ts` binds Q to `quitFlight` in
the cockpit. Its comment says Q is the key that gives up on what you are
doing, in all three tables. `WHILE_PAUSED` lets it through only with the world
stopped, and it asks before it acts. `test/combat-sim.test.ts` refuses two
bindings on one key in one mode, so Q cannot carry both.

**The free plain letters are few.** `engine/keymap.ts` owns the flight axes,
and A, S, W, D, X and F are axes or fire in one layout or the other. Escape
closes every overlay, and it is read outside the tables. Z is the one free
plain letter. `Binding.shift` supports a shifted key.

## What to do

Two milestones.

### M1 — the pod has one launcher

`Career` gains `launchEscapePod`. `die` calls it when a pod is fitted, and so
does the key. The shared body spends the pod, empties the hold, forgets the
flight saves, and docks the commander. `die` keeps its explosion and its
sound. The key's path plays no explosion, because the ship is not destroyed.

The key refuses in three cases, and it says why each time:

1. no pod is fitted: `NO ESCAPE POD FITTED`;
2. the world is paused: the game's own paused refusal, because the command is
   not in `WHILE_PAUSED`;
3. the launch or docking tunnel is playing: the same refusal a hyperspace key
   gets there.

The simulator subtracts it. The arena's clone may carry a pod, and a dock
from the arena would write the career's save.

### M2 — Q is the pod, and ⇧Q gives up the flight

`bindings.ts` binds Q to `launchEscapePod`, and moves `quitFlight` to ⇧Q. The
shifted entry sits above the plain one, because the scan stops at the first
match. `command-help.ts` gains the pod's line under `combat`. The quit line
already reads its key through `boundKey`, so it follows the move.

The manual's controls table and the `?` guide render from the tables, so both
show the new key with no hand edit. The manual's equipment entry gains the
key, through the same `boundKey` rule the other prose obeys.

## Decisions already made

- **Q is the pod.** Chris named the key. The pod is the ultimate way to give
  up a flight, so it keeps the meaning the comment gives Q.
- **`quitFlight` moves to ⇧Q, still paused only.** It stays the same letter
  and the same act. A shifted key is a smaller cost than the loss of a plain
  one, and the pod is the key you press in a hurry.
- **No confirmation.** The original fired on one key. A pod is pressed with the
  shields gone, and a second press there costs the ship. The refusals above
  stop the mistyped case that matters: a press with no pod fitted spends
  nothing.
- **The pod's consequence is death's consequence.** One body serves both.
  Survivors aboard are lost with the hold, as they are today on death.

## Open questions

None.

## Watch out for

- **`test/quit.test.ts` pins the paused table at three commands.** The pod is
  not paused-only, so the count holds.
- **`test/key-help.test.ts` needs a `section` on every cockpit command**, and
  a help line for each. The compiler refuses a command with no help entry.
- **`test/campaign.ts` models pod use on death at 70%.** It is the career
  simulator's own copy of the death rule, and this item does not touch it.
- **Death in witch-space with a pod docks the commander at the local station
  today.** The key inherits that, and this item does not change it.
- **The Q comment in `bindings.ts` says Q is free in the cockpit.** Rewrite it
  with the move.

## Verification

The gates always run: `npm run check`.

The tier: a key, a shared body and prose. No number moves, so no probe runs.

Gates:

- `test/escape-pod-key.test.ts`, new. Q with a pod docks the commander with an
  empty hold and no pod. Q without a pod refuses with the line. Q while paused
  refuses. The simulator does not answer Q with the pod. ⇧Q while paused opens
  the quit screen. Prove it able to fail: bind Q to `quitFlight` for one run.
- `test/combat-sim.test.ts`: no two cockpit bindings share a key. It holds the
  ⇧Q order.

## Outcome

### M1 and M2 — one commit, because M1 alone left a gate red

`Career.deployEscapePod` is the one body. It spends the pod, empties the hold
and docks the commander, and `die` calls it when a pod is fitted.
`launchEscapePod` forgets the flight saves first, as death does, and then
calls it. With no pod it refuses with `NO ESCAPE POD FITTED`. Plain Q binds
it, and ⇧Q gives up the flight, still paused only. The simulator subtracts
it. The help line sits under `combat`.

**THE TWO MILESTONES LANDED AS ONE COMMIT.** `test/combat-sim.test.ts` holds
a control for every subtracted command: the cockpit must still bind it. M1
added the command to the subtraction with no cockpit key, so that control went
red until M2 bound Q. The plan split a rule from its key, and the gate
refused the split.

**THREE SURFACES PIN THE KEY, AND THE PLAN NAMED ONE.** The README's commands
table is held to the tables by `test/key-help.test.ts`, so it gained a Q row
and a ⇧Q row. The simulator test writes the subtraction list out by name, so
it gained the pod. The manual's equipment entry names the key through a new
hook in `src/manual.ts`: an element with `data-bound-key` is filled from the
tables. That hook was not read in a browser.

**SURVIVORS ARE KEPT.** The plan said a survivor is lost with the hold, as on
death. Death kept a survivor all along, so the body keeps one too, and the
comment says nobody asked. That is a question for Chris: whether a pod holds
two.

**IN THE TUNNEL THE KEY IS SILENT**, as every command outside `WHILE_PAUSED`
is. The plan promised the hyperspace key's refusal there, and that key is
silent there too. Nothing changed.

`test/escape-pod-key.test.ts`: 23 assertions. **Proved able to fail**: the two
Q commands swapped redden nine of them. 5,515 assertions became 5,538.
