# 187 — The console reads ASTEROID on a rock hermit

**Kind:** bug · **Severity:** medium · **Size:** small · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** #40

## Where we are

**Chris reported it on 2026-09-05 (GitHub #40):** *"It's not obvious enough
that you are attacking a rock hermit. You need to be close before it is
identified as one. Maybe the first time you hit it a message should appear?"*

**The console never identifies a rock hermit at any range, and the cause is a
missing name.** The target bracket and the ship-ID line both print
`npc.object.name`. They print `ASTEROID` when the name is empty
(`hud/hud-model.ts`). `buildShip` names every tabulated hull. The hermit is the
one rostered ship with no tabulated hull. `npc.ts` builds it with
`buildAsteroid`, and that builder names nothing.

So a rock hermit reads ASTEROID inside 5,000 units on the bracket, and inside
4,500 on the ship-ID line. The one tell is the amber beacon on the rock, and it
reads only up close. That is what Chris saw.

**A hit says nothing either.** `Combat.fire` says a line on the first hit that
turns a ship against the commander, and the words are law's (`harmVerdict`).
The law does not protect a hermit, so the line is null. The consequence of a
hermit kill is disrepute, which `game/combat-wreck.ts` applies. No line comes
before it.

## What to do

Two milestones.

### M1 — the hermit carries its name

`npc.ts` names the hermit's mesh from the registry:
`registeredHull(this.designId).name`, which is `Rock hermit`. The bracket then
reads `ROCK HERMIT 3.2KM`, and so does the ship-ID line.

The gate is in `test/hud-model.test.ts`: a hermit's bracket label names it.

### M2 — the first hit says so

`Combat.fire` says one line on the first hit that lands on a hermit. The words
live beside the consequence, in `constants/character.ts`: `HERMIT_HIT_LINE`.
The hook is the frame on which `provokedByPlayer` latches. So the line is said
once per hermit, however long the burst.

Not for a kill. A destroyed hermit takes `combat-wreck.ts`'s own words.

The gate is a new `test/hermit-hit.test.ts`, on `test/lawful-hit.test.ts`'s
rig. The first hit says the line. The second hit does not. A hit on a pirate
says nothing new.

## Decisions already made

- **Chris's suggestion is M2.** A line on the first hit.
- **The line is character's, not law's.** `harmVerdict` refuses a role the law
  does not protect, and that refusal is right. A hermit kill costs disrepute,
  and disrepute belongs to `constants/character.ts`.
- **The words are a default.** `ROCK HERMIT HIT — SOMEBODY LIVES IN THAT ROCK`.
  The player-facing text is Chris's to reword.

## Open questions

None.

## Watch out for

- **The scanner blip.** `scannerContacts` gives a hermit the `ship` kind,
  because it is not an asteroid role. This item does not touch the blip.
- **`test/lawful-hit.test.ts` asserts that no role outside the law has a harm
  line.** The hermit line is not in `HARM_LINES`, so that claim holds.
- **`constants:check` scores a constant's home from the module header.**
  `constants/character.ts` opens on reputation, and a hermit hit is a
  reputation matter. Argue `@domain` only if the check disagrees.

## Verification

The gates always run: `npm run check`.

The tier: a label and one console line. No number moves, so no probe runs.

Gates:

- `test/hud-model.test.ts`: the bracket names a hermit. It fails today.
- `test/hermit-hit.test.ts`: the first hit says the line, once. Prove it able
  to fail: drop the hermit branch for one run.
