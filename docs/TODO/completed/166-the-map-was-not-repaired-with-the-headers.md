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

## Watch out for

- **Do not renumber an invariant.** M1 touches the map and never
  `docs/INVARIANTS.md`. The code cites the invariants 107 times by number.
- **Two quirks at lines 40 to 44 are deliberate**, and both still hold: witch-space
  reuses a normal system scene, and the tests measure docking in station-local
  space. Keep them.
- **`src/game/npc.ts` gets a header in docs/TODO/169.** M1 should describe
  `npc.ts` as it is TODAY, and not as 169 will leave it. Otherwise the map is
  false again the moment it lands.
