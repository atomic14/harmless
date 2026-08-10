# 124 — There is no way out of a flight

**Kind:** feature · **Severity:** small · **Size:** small (one milestone) ·
**Depends on:** none · **GitHub:** none — asked directly by Chris, 2026-08-10:
*"I need a way to quit when flying. And then I can test."*

**Landed 2026-08-10.** `npm run check` green at 3,711 assertions.

## Where we were

Once you launched, the cockpit had four exits and every one of them was a
transaction:

- **dock** — the hardest thing in the game, and 77,000 units away;
- **die** — puts you back at the docked checkpoint, via a game-over screen;
- **the distress beacon** — GalCop tows you in AND TAKES YOUR CARGO;
- **close the tab** — the flight ring resumes you into the same flight.

So a session that had gone wrong, or a test that needed the station again, had
no way home that did not cost something or take five minutes. That is the gap:
not a missing rule, a missing *door*, the same shape as docs/TODO/121's.

## What was decided

**Chris, on the semantics:** *"This is a quit game that takes you back to where
you were previously autosaved docked. Not magically dock you at your
destination."* So it ABANDONS the flight rather than banking it — the
alternative, an instant dock that kept what the flight earned, would have made
docking optional and turned the key into a way to launder a full hold.

**It is for every pilot, not for a marked career.** This was the open question,
and the answer is that quitting is outcome-identical to DYING: both land on this
career's docked checkpoint, written when you last docked and again immediately
before you launched. There is nothing to gain by quitting that flying home
would not have paid better, so it changes no balance — it removes a
frustration. The alternative, gating it behind test mode, would also have been
circular: you would need the mode switched on *before* launching to get back to
the station where the mode lives.

**Q, and it asks first.** Free in the cockpit, and already the "give up on what
you are doing" key in the other two tables — it backs out of the new-commander
confirmation at the station and ends an exercise in the arena. `controls.ts`'s
rule that a destructive action must not share a key is satisfied per mode.

**PAUSE FIRST** (Chris, on the shipped key): *"Q should only be available if you
Pause P during flying."* So giving up a flight is three deliberate presses — P
to stop the world, Q to ask, Y to answer — and a mistyped letter in a fight
costs nothing. `WHILE_PAUSED` is what a stopped world answers, and it is exactly
two entries: the key that starts it again and the one that gives up. Q pressed
unpaused reaches its handler and is REFUSED with the line that says what to
press instead, because a bound key that appears dead is a bug report; the same
refusal answers a Q pressed during the launch tunnel, where nothing is paused
either, which is why the gate needs no third state. The paused line itself —
`PAUSED — P TO RESUME · Q TO QUIT THE FLIGHT` — is the one place a player is
told the key exists, and it quotes both keys off the binding table rather than
spelling them (invariant 9).

**Backing out returns you to the pause.** `step` clears `paused` while any
screen is up, so without this a confirmation you declined would drop you live
into the fight you stopped to think about. The screen puts it back through
`QuitContext.keepFlying`.

**The confirmation is a SCREEN, not a `ControlMode`.** Two reasons. The screen
stack already freezes the world while an overlay is up (`Game.mode` is
`screens.topId ?? baseMode`, and only `'flight'` steps), so nothing can shoot
you while you decide — a confirmation that can get you killed is not one. And a
new mode would need a binding table, a `?` guide section and a host in
play.html, for two keys that are already every overlay's two keys.

**Not ENTER.** The screen can open over a fight and ENTER is the key a hand is
already resting on. Y confirms; N or ESC keeps you flying.

## Watch out for

- **THE SHARP EDGE: Q was already the arena's way out.** `BINDINGS.simulator`
  is the cockpit's table spread in AHEAD of its own Escape and Q entries, and
  the scan stops at the first match — so a cockpit Q that was not filtered out
  shadows `endExercise` and offers to abandon the CAREER from inside an
  exercise that must never touch it. `quitFlight` therefore joins
  `NOT_IN_THE_SIMULATOR`, and `test/quit.test.ts` reproduces the shadowing.
- **`forgetFlight()` comes first**, exactly as `die()` does it. The in-flight
  ring must not outlive the flight it recorded, or `respawn()` resumes the run
  that was just abandoned and you never leave the cockpit. `clearFlightSaves`
  re-aims the boot pointer at the checkpoint on its way past.
- **The launch tunnel eats input.** While it plays, `step` routes the frame as
  `pausedOnly` and P is the only command that applies — a test that flies 60
  frames and presses Q is testing the tunnel.

## Verification

Tier: unit, plus one behavioural pass through a real headless `Game`.

- The key: Q asks to quit in a PAUSED cockpit, is refused with a line naming
  both keys while flying, still ENDS THE EXERCISE in the arena, and is still NEW
  COMMANDER at the station.
- The screen: Y abandons exactly once and exits the stack; N and ESC back out
  having abandoned nothing; ENTER does nothing at all.
- The cost, flown for real: launch, earn credits/kills/a Fugitive record, take a
  real in-flight autosave, quit — and the commander that comes back is the one
  that LAUNCHED, the flight ring is gone, and the docked checkpoint is not.
- Backing out costs nothing: ESC leaves you flying with what you had.
- Eight gates proved failable: un-filtering the simulator entry reproduces the
  shadowing; ENTER-confirms breaks four assertions; dropping `forgetFlight()`
  leaves you in flight; docking-where-you-are keeps the flight's money; removing
  the pause gate opens the confirmation mid-flight; dropping `quitFlight` from
  `WHILE_PAUSED` makes it unreachable even when paused; not calling
  `keepFlying` resumes live; and a silent refusal fails the line that names
  both keys.
