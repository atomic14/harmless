# 166 — The map was not repaired with the headers

**Kind:** defect · **Severity:** high · **Size:** medium · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** none — found by the sweep of
2026-08-16

## Where we are

**`docs/ARCHITECTURE.md` is the map, and a reader opens it first.** Its own
opening says so: *"`INVARIANTS.md` is the authority on the rules. This file is a
map."* `CLAUDE.md` names it under "Sources of truth", beside the rule that
settles a disagreement: **when the documentation and the code disagree, the code
that runs is correct.**

**The decomposition programme moved nine responsibilities, and the map moved
none of them.** docs/TODO/150 took five subjects out of `game.ts`. docs/TODO/155
split the orchestrator in two. docs/TODO/156, 159 and 161 each split one more
file. Every module header was repaired. The map was not.

### Three claims are false

**1. Line 9 — *"`src/game/game.ts` owns the entities and orchestrates each
frame."***

`src/game/world.ts` owns them, and its own header says so: *"One place owns the
ships, the cargo, the effects and the system's scenery."* `game.ts` opens with
*"THE ORCHESTRATOR: which mode the game is in, and who gets the frame"*, and
then *"ONE RESPONSIBILITY... This file owns `baseMode`... Nothing else."*

`world.ts` is not named anywhere in the map.

**2. Line 38 — *"Laser fire, spawning and the hyperspace transition still stay
in `game.ts`."***

All three left, and `game.ts` delegates each one:

| the job | where it lives now | what `game.ts` does |
| --- | --- | --- |
| laser fire | `flight-weapons.ts` | `fireLaser()` calls `this.flight_.racks.fireLaser()` |
| spawning | `world.ts` | `spawnNpc()` calls `this.world_.spawnNpc()` |
| the jump | `hyperspace-actions.ts` | `game.ts:67` imports `HyperspaceActions` |

`game.ts:381` states the second one in as many words: *"a harness hook; the
world owns the spawn."*

**3. Lines 34 to 36 — *"`Game.raiseLegal` ... is the one home of what a moved
record says (`recordVerdict`)."***

Wrong twice.

`Game.raiseLegal` is one line at `game.ts:395`, and it delegates to
`this.law_.raiseLegal(level)`. The home is `law-actions.ts`.

And it is no longer the one caller. docs/TODO/160 added `LawActions.lowerLegal`,
which queues the same `recordVerdict` when pirate kills take a record DOWN. The
one home of the WORDS is `law.ts:276`, which is what the sentence should name.

### The map names none of the new modules

Fourteen modules came out of the programme. The map mentions none of them:

`world.ts`, `flight.ts`, `docked.ts`, `flight-weapons.ts`,
`flight-instruments.ts`, `world-build.ts`, `cockpit-view.ts`, `career.ts`,
`law-actions.ts`, `hyperspace-actions.ts`, `spawning-arena.ts`,
`combat-player.ts`, `snapshot-parse.ts` and `orders.ts`.

**Two of those absences cost a reader real time.** `world.ts` owns the entities
the map attributes to `game.ts`. `law-actions.ts` owns the law the map
attributes to `Game.raiseLegal`.

### Why nothing caught it

**docs/TODO/152 wrote the rule, and wrote it for a file.** `CLAUDE.md` carries
it beside the module-header line: *the milestone that takes a responsibility out
of a file repairs that file's header in the same commit.*

Every header obeyed it. The map is not a header, so the rule never reached it.

152's own record shows how sharp the failure mode is. The header 152 wrote was
wrong within an hour. 155 moved `stepHost()` in the very next commit.

**No gate reads prose for truth.** `claims:check` holds one comment form.
`ste:check` holds sentence length and tense over `src/`, and never opens `docs/`.

## What to do

Three milestones. M1 is the repair. M2 widens the rule. M3 is the check.

### M1 — the map describes the code that runs

Rewrite `docs/ARCHITECTURE.md`'s "Core boundaries" section against the tree.

Three claims change, and each becomes what the code says:

1. `game.ts` orchestrates. `world.ts` owns the entities.
2. Laser fire, the spawn and the jump each name their own module.
3. `law-actions.ts` applies a record. `law.ts`'s `recordVerdict` is the one home
   of the words, and two rules reach it.

Name the fourteen modules. Group them the way the code groups them: the two
halves (`docked.ts`, `flight.ts`) over their children, then the seven subjects.

**Keep the file a MAP.** It says where a thing lives. It does not restate the
rule, because a rule with two homes is what `CLAUDE.md` forbids. `game.ts`'s own
header is the long form, and the map points at it.

**Write it in the house prose style.** `CLAUDE.md` puts `docs/ARCHITECTURE.md` in
scope for ASD-STE100.

### M2 — the rule covers the map

Add one clause to `CLAUDE.md`, beside 152's sentence:

> The milestone that takes a responsibility out of a file repairs that file's
> header in the same commit. It repairs `docs/ARCHITECTURE.md` in the same
> commit when the map names the file.

**One sentence, one home.** Do not restate it in `docs/PROCESS.md`. That file
owns the ORDER of the steps, and `CLAUDE.md` owns the rules inside a step.

### M3 — a check that the map can rot

The map cites 53 file names. Every one resolves today, so a path check adds
nothing.

**Check the reverse direction instead.** A new tool asks: which files in
`src/game/` are over 200 lines and are named nowhere in `docs/ARCHITECTURE.md`?

Report the list. Do NOT fail on it. A map is not an index, and a gate that
demanded every file would force the map to become one.

**It joins `npm run check` as a REPORT only**, in the shape `ste.mjs` uses for
its `-ing` count: a number that a person reads, and a number no build turns red.

## Verification

The gates always run: `npm run check`. The tier table puts prose at "nothing
more". `npm run ste:check` reads `src/` only, so M1's prose is not checked by a
machine. Read it against the caps by hand.

**M1 is proved by the three claims.** For each one, open the file the map names
and confirm that it says the same thing:

1. `world.ts`'s header against the entity claim.
2. `flight-weapons.ts`, `world.ts` and `hyperspace-actions.ts` against line 38.
3. `law-actions.ts` and `law.ts:276` against the record claim.

**M3 is proved by its own output.** Run it before M1 and after M1. The count of
unnamed modules must fall, and the fourteen above must leave the list.

## Decisions already made

- **The map stays a map.** It points at a home. It never restates a rule.
- **M3 reports and does not fail.** See M3.

## Open questions

- **Does `docs/ARCHITECTURE.md` still want the "Combat and pilots" section at its
  current length?** It is 56 lines, and much of it restates what
  `ship-roles.ts`, `blueprint-set.ts` and `set-roster.ts` each say in their own
  headers. **Recommendation: shorten it to the three-way split and the pointer.**
  Do that in M1, and record what came out.
- **Should `npm run ste:check` read `docs/` too?** That is docs/TODO/168, and it
  is a bigger question than this item. Do not answer it here.

## What landed, 2026-08-16

All three milestones landed. `npm run check` passes at 4,715 assertions.

### M1 — the three claims, and three more

**The plan named three false claims. The repair found five.** The two it did not
have are the same defect at a different site:

1. **The blueprint override.** The map said *"`missions.ts` and `game.ts` name
   the override"*. `missionBlueprintOverride` has one caller, and it is
   `world-build.ts:112`. `game.ts:379` forwards `enterWitchspace` and nothing
   else. docs/TODO/150 M2 moved that job, and the map stayed.
2. **The chart painters.** The map said *"`ui/screens.ts` paints only what those
   models return"*. docs/TODO/149 split that file eight ways.
   `ui/chart-galactic.ts` and `ui/chart-local.ts` paint the stars, and
   `ui/chart-overlays.ts` paints the marks. `ui/screens.ts` holds no chart code
   at all.
3. **The prompt label.** The map said the edge looks a label up in `game.ts`.
   `cockpit-view.ts:190` calls `flightPrompts`, and the `boundKey` join is
   beside it.

**A fourth claim was incomplete rather than false.** The map said the HUD is
`hud-model.ts` plus `hud.ts`. It is three files: `hud-model.ts` works out where
a marker goes, `hud-binding.ts` turns the state into a dashboard, and `hud.ts`
paints one.

**A fifth was stale prose rather than a wrong path.** The console bullet still
said *"what a deed cost your name"*. docs/TODO/162 made REPUTATION the player's
word, and made `name` mean what a thing is CALLED. That line is
*"what a deed cost your reputation"* now.

**The fourteen modules are named**, and three more went in with them:
`spawning.ts`, `screen-shell.ts` and `snapshot.ts`. Two of the fourteen needed a
section rather than a line — `orders.ts` states invariant 16, and
`spawning-arena.ts` is the counterpart to `spawning.ts`.

**The children are a section of their own**, and its shape is `game.ts`'s own
header: the two halves over their children, then the seven subjects. It ends
with the pointer the plan asked for, so no rule gained a second home.

### M1's open question — the roster block

**Shortened, and it lost four sentences.** The three-way split stays whole,
because it is the map's job to say which module answers which part. What came
out is the detail each header already states: how permission is read off all 23
sets, what `blueprint-set.ts` is a pure function OF, and how the chooser is told
which override applies. One sentence now points at the three headers.

**Nothing else in "Combat and pilots" was cut.** The plan asked about the
section's whole length. Measured, the rest of it names one module per bullet and
says what that module owns, which is what a map does.

### M2 — the rule covers the map

One clause, beside docs/TODO/152's sentence in `CLAUDE.md`. It is not restated
in `docs/PROCESS.md`.

### M3 — `npm run map:report`

`tools/map-coverage.mjs`, in `npm run check`, and it never exits 1.

**42 of 56 before M1, and 28 of 56 after it.** All fourteen modules left the
list, and so did `law.ts`, `snapshot.ts` and `spawning.ts`.

**Two decisions are in the tool.** The threshold is 200 lines, which is half of
`tools/sizes.mjs`'s ceiling: that ceiling detects a file with two
responsibilities, and this one detects a file with one big enough to name. A
generated file is skipped, because the map describes code.

**A file in a subdirectory carries that directory.** `src/game/combat-sim.ts`
and `src/game/screens/combat-sim.ts` share a base name, so a base-name match
would report the second one as named.

**Proved able to detect**, which is the honest test for a report. With
`src/game/world.ts` renamed to a name no file carries, the count goes 28 to 29.
It cannot be proved able to FAIL, because by design it never does.

### What the report says next

**28 modules are still unnamed, and that is not a debt list.** Seven of the 28
are one subject the map never describes: the combat trainer, at 4,274 lines
across five modules and two screens. Five more are screens, which the map covers
by the seam rather than one at a time. A map is not an index, so what to do
about the trainer is a reader's call rather than a queue item.

## Watch out for

- **Do not renumber an invariant.** M1 touches the map and never
  `docs/INVARIANTS.md`. The code cites the invariants 107 times by number.
- **Two quirks at lines 40 to 44 are deliberate**, and both still hold: witch-space
  reuses a normal system scene, and the tests measure docking in station-local
  space. Keep them.
- **`src/game/npc.ts` gets a header in docs/TODO/169.** M1 should describe
  `npc.ts` as it is TODAY, and not as 169 will leave it. Otherwise the map is
  false again the moment it lands.
