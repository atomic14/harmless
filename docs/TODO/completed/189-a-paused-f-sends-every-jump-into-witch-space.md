# 189 — A paused F sends every jump into witch-space

**Kind:** feature · **Severity:** low · **Size:** small · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** none

## Where we are

**Chris asked on 2026-09-05 whether he can trigger a Thargoid ambush.** He
cannot. A mis-jump is a 9% roll on each jump, and 22% on the Constrictor leg.
The trainer's "Thargoid ambush" stages the drones by tier rather than by the
timer, so it does not show the live cap docs/TODO/188 set. Test mode has no
mis-jump row.

**Two designs were put to him, and he chose the Spectrum's.** He quoted the
cheat list:

> There was also a cheat so that you always launched into Witch Space. Pause
> the game. Press 'f' - you'll hear a beep. Un-pause the game, and hyperspace,
> as normal. You'll now appear in Witchspace, and will continue to do so until
> you pause and press 'f' again.

That quote is the specification.

### What the code says today

**A paused cockpit answers two keys, on purpose.** `WHILE_PAUSED` in
`game/bindings.ts` lists `togglePause` and `quitFlight`, and its comment says
why: a pause is the world stopped, not a place you can play from.
`test/quit.test.ts` pins the count at two.

**The jump rule has one seam.** `resolveJump` in `game/hyperspace.ts` rolls
the mis-jump against `witchspaceChance`, and it takes the roll as a parameter.
An escape jump from limbo skips the roll. `completeHyperspace` in
`game/hyperspace-actions.ts` reads the result and calls `enterWitchspace`.

**F is unbound in flight.** No table binds `KeyF`.

**A session field is saved with no ceremony.** `persistence.ts` walks the
session generically, and a field an old save lacks keeps the fresh default.

## What to do

One milestone.

### M1 — the key, the flag, the beep, and the jump

1. `session.misjumpArmed`, a boolean, fresh at false. It is saved state.
2. A command `armMisjump`, bound to `KeyF` in the flight table, and added to
   `WHILE_PAUSED`. Its handler refuses while not paused, and it says to pause
   first, as `quitFlight` does. While paused it flips the flag and beeps.
3. Two tones in `audio.ts`: `misjumpArmed` high, `misjumpDisarmed` low.
4. `resolveJump` takes `forced`. While forced, every jump is a mis-jump, the
   escape jump from limbo included. The fare is charged as before.
5. `command-help.ts` gets the entry, and the README's key table gets the row.
   `test/key-help.test.ts` holds both.

## Decisions already made

- **Chris chose the Spectrum design on 2026-09-05**, over a test-mode row. The
  quote above is the specification.
- **It is a toggle, and it holds until pressed again.** The quote says so.
- **It applies to the escape jump too.** The quote says every jump lands in
  witch-space while the cheat is on.
- **It does not mark the career.** The original did not. The fight is real,
  and the fare is charged.
- **Two pitches rather than one.** The quote says a beep. A high tone arms and
  a low tone disarms, so the ear can tell which state it left.
- **F while flying says to pause first.** A key that silently does nothing is
  a bug report (the house rule at `WHILE_PAUSED`).
- **`SNAPSHOT_VERSION` stays at 3.** A save that lacks the field reads false.

## Open questions

None.

## Watch out for

- **`test/quit.test.ts` pins the paused count at two.** The rule moves to
  three, and the test moves with it. The reason in the bindings comment moves
  too.
- **The pause filter runs in the launch tunnel as well.** F there is refused
  the same way, so no third state is needed.
- **Thargoid bounties on demand.** Two or three motherships pay 50 Cr each. A
  commander can farm rating and money with this. The original allowed it, and
  Chris chose the original. Record it here, and do not guard it.
- **`test/audio.test.ts` names every sound.** Two entries join the list.

## Verification

The gates always run: `npm run check`.

The tier: a jump rule and a key. No fight changes, so no probe runs. The
campaign abstracts flight, so it does not move.

The gate is a new `test/witchspace-trap.test.ts`, on `test/quit.test.ts`'s
rig:

- F while flying opens nothing, flips nothing, and says to pause first;
- paused, F arms the flag and beeps high;
- unpaused, a jump lands in witch-space;
- the escape jump from limbo lands in witch-space again while armed;
- paused, F again disarms and beeps low, and the next jump lands at the target;
- the flag survives a snapshot.

Prove it able to fail: make `resolveJump` ignore `forced` for one run.

## Outcome

### M1 — the key, the flag, the beep, and the jump

Landed as planned, in the five parts the plan named. `session.misjumpArmed`
is saved state. `armMisjump` is bound to F in the flight table, and it is the
third entry of `WHILE_PAUSED`. The handler lives in
`game/hyperspace-actions.ts`, beside the jump it arms. While flying it says to
pause first, and names both keys. `resolveJump` takes `forced`, and the escape
jump from limbo obeys it too. The two tones are in `audio.ts`.

**THE ROLL IS NOT MADE WHILE FORCED, AND THAT IS DELIBERATE.** A forced jump
returns before `rng()` is asked, so the seeded stream does not move for a roll
nobody reads. That is the rule docs/TODO/138 M4 stated for the blueprint draw.

**THE TEST IS 25 ASSERTIONS IN TWO PARTS.** The first drives the switch on its
own, with a stub host that records the beeps and the refusal. The second
drives the whole game with a keyboard, on `test/quit.test.ts`'s rig:

1. F while flying, which is refused;
2. P, F, P, which arms the trap;
3. a jump, which lands in limbo;
4. the escape jump, which lands in limbo again;
5. a snapshot round trip, which keeps the trap;
6. P, F, P, which disarms it;
7. the escape jump, which lands at the target.

**Proved able to fail**: a jump rule that ignores `forced` reddens five of
them. Every one of the five is a jump that arrived where it must not.

**Two pinned tests moved with their rules.** `test/quit.test.ts` counts three
paused commands. `test/audio.test.ts` names the two tones.

`README.md` carries the F row, and `test/key-help.test.ts` holds it to the
table. The header of `game/hyperspace-actions.ts` lists the switch as its
sixth way in and out of a system.

4,939 assertions became 4,972.
