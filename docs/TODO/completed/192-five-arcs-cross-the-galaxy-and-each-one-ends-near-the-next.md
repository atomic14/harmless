# 192 — Five arcs cross the galaxy, and each one ends near the next

**Kind:** feature · **Severity:** low · **Size:** large · **Depends on:**
nothing · **Blocks:** 193 · **GitHub:** none

## Where we are

### Project context

HARMLESS is a browser space game built with TypeScript, Vite and three.js.
It is an unofficial, non-commercial tribute to Elite (1984). Galaxy 1 has 256
systems, and Lave is the starting world. A **jump** moves the ship between
systems and uses fuel. A full tank reaches 7.0 light years.

docs/TODO/190 built the mission machine. An **arc** is a main story mission
with several legs. A **skeleton** is one mission's rules in TypeScript. A
**lead** is a saved pointer to the next arc's start world. A **patron** is
the person who offers a mission. A **dossier** is a mission's generated
words, and docs/TODO/191 writes them.

### What the code says today

**One arc ships, and it is the Constrictor.** `src/missions/skeletons/`
holds it and eight side jobs. No skeleton has a lead, so the lead rules run
on fixtures in `test/mission-machine.test.ts` and `test/mission-offers.test.ts`
only.

**The jump graph exists, and it is measured.** `routeEstimate` in
`src/galaxy/route.ts` finds the cheapest chain of full-tank jumps between two
systems, or null. docs/TODO/190 measured galaxy 1 on 2026-09-06. Every world
is reachable from Lave. The most distant is 21 jumps out. The largest
minimum between any two worlds is 24. Galaxies 3, 4, 6, 7 and 8 each strand
a group of worlds.

**Three pieces of the model wait for an arc.**

- `Placement` has a `handover` kind, a band of jumps toward a named
  skeleton's start world. `placeLeg` returns `ok: false` for it, and the
  skeleton lint refuses a skeleton that uses it.
- `Gate.withinJumps` is declared, and `offers.ts` does not read it.
- `MissionEffect` has `worldOverride` and `standingSpawn`, and
  `mission-bridge.ts` ignores both. No verb asks for either.
- `Trigger` has `{ flag }` and `{ choice }` forms. `Settlement.setFlags`
  writes a flag, and nothing fires a flag trigger on a live leg. No screen
  sends a `choice` input.

**A lead moves across a galaxy by a placeholder rule.** `reachableFrom` in
`machine.ts` walks the system indices upward from the skeleton's start world
until a chain of jumps from the arrival reaches one.

**A local side job sits on a third of the boards by a placeholder rule.**
`localJobHere` in `offers.ts` hashes the world's chart position and the job's
id. The side jobs pay from `SIDE_JOB_PAY` in `src/constants/missions.ts`.

**Two overrides at one world conflict.** `missionOverride` in
`queries.ts` lets the first live leg win, and its comment names this plan.

**The lint holds the failure rules.** `lintSkeleton` in `src/missions/lint.ts`
checks every leg for a failure branch and a path to an end. It checks the two
leads for agreement, and the lead's target for an exclusion conflict. It
checks every band for a candidate from every world. It does not measure
jumps.

## What to do

Place five arcs across galaxy 1 from the seed. Write them. Build the three
waiting pieces of the model that the arcs need. Extend the lint to measure
the jumps between an arc's end and the next arc's start.

### M1 — The tour's shape, from the seed

1. Add `src/missions/tour.ts` with a pure `arcStarts(systems, seed)`. It
   picks five start worlds. The first is Lave. Each next start is four to
   six jumps from the previous arc's end region, by `routeEstimate`. The
   choice is deterministic from the seed, so the tour is the same in every
   career.
2. Build the `handover` placement in `placement.ts`. It picks a world whose
   jump count toward the named skeleton's start world is inside the band,
   with one random draw among the candidates. Remove the lint's refusal.
3. Add `test/tour.test.ts`. Check the five starts on galaxy 1, the jump
   distances between them, and that every start is reachable from Lave.
   Check `handover` on every world of galaxy 1.
4. Replace `reachableFrom` with a tour rule for another galaxy. The tour of
   galaxy N starts at the arrival world, and `arcStarts` runs on that galaxy
   from the arrival. Test reachability in all eight galaxies, because the
   five stranded galaxies are the case galaxy 1 cannot show.

### M2 — Five arcs

1. Write five arc skeletons under `src/missions/skeletons/arcs/`. Each has
   two to four legs, mixes verbs, and has a recovery leg for at least one
   failure. Each ends within two to four jumps of the next arc's start, and
   both outcomes lead there. The last arc has no lead. Each arc's patron is
   a world patron at its start world.
2. Give each arc a distinct theme that the dossier can write from. Name
   the theme in a comment. The words themselves are docs/TODO/191's.
3. Extend `lintSkeleton` with the jump rule. For an arc with a lead, the
   final leg's world must be two to four jumps from the lead's start world.
   A relative final leg is measured over every candidate of its band.
4. Extend the lint for override conflicts. Two live legs that force two
   different blueprint sets at one world is a fault the lint names.
5. Add the arcs to `SKELETONS`. `test/mission-skeletons.test.ts` lints them.
   Walk each arc end to end through the machine in `test/arcs.test.ts`,
   through success and through its recovery leg.

### M3 — The waiting pieces

1. Read `Gate.withinJumps` in `offers.ts`. An offer inside that many jumps
   of the skeleton's start world is open. Test it.
2. Fire a `{ flag }` trigger when a settlement sets that flag, on every live
   leg whose current branches name it. Test a two-mission flag handover.
3. Apply `worldOverride` and `standingSpawn` in `mission-bridge.ts`. Keep a
   list of world changes in `MissionState`, with the day each expires.
   `queries.ts` reads them on arrival beside the live legs. Test expiry.
4. Add a CHOICE prompt on the MISSIONS screen for a leg whose branches
   carry `{ choice }` triggers. The prompt sends the `choice` input. Test
   that an unanswered prompt starts nothing.

### M4 — Side jobs by world, and the balance

1. Replace `localJobHere` with a roster: each world of galaxy 1 offers two
   or three side jobs, chosen from the seed. Test that every side job is on
   some board, and that no board offers more than three.
2. Run `npm run campaign -- 40 60` and `npm run campaign -- 200 60`. Read
   the NAVY line and the cash lines. A change in either is this plan's to
   explain.

## Decisions already made

Chris made these decisions on 2026-09-06 (docs/TODO/190):

- Arcs dovetail across the galaxy. Each arc starts at a fixed world from the
  seed. Its final leg is two to four jumps from the next arc's start.
- A far player gets hints. A failure is a branch rather than a wall.
- Failure keeps the lead. Both outcomes of an arc lead to the same next arc.
- The intended tour is five arcs, each four to six jumps farther across the
  galaxy.
- A galactic jump relocates the leads to reachable worlds in the new galaxy,
  and this plan defines the repeatable placement.

## Open questions

Use these answers unless Chris changes them:

- **Do the arcs require sixteen kills, as the Constrictor does?** No. The
  first arc opens at Lave from the first dock. The Constrictor keeps its
  gate and stays a Navy arc outside the tour.
- **How long is an arc?** Two to four legs. A longer arc delays the next
  lead, and the lead is what pulls a player across the galaxy.
- **What does the last arc lead to?** Nothing. The tour ends, and the log
  tells it.

## Watch out for

- `arcStarts` must not draw from the world's random stream. It derives from
  the seed, as `species-prompts.ts` does.
- A `handover` band of jumps is measured on the jump graph, and a band of
  tenths is measured on the chart. Keep the two words apart in the code.
- A flag trigger evaluated on every settlement can fire twice. Fire it once
  per flag per leg.
- `MissionState` gains a field for world changes. `repair.ts` must read an
  absent field as empty, so a save from before it still loads.
- The five arcs are nine to twenty new legs. Each leg's `line` and `say`
  are plain words until docs/TODO/191 writes the dossier.
- Two campaign sizes decide a balance claim, never one.

## Verification

Run `npm run check` after each milestone. Run both campaign sizes after M4.

Require this evidence before the plan is complete:

- The five starts are deterministic, reachable, and four to six jumps apart.
- Every arc passes the extended lint. A lead two jumps too far fails it.
- Each arc walks end to end through the machine on success and on its
  recovery leg. The next arc opens at its start world after both.
- `handover` places a world inside its band from every world of galaxy 1.
- Leads relocate to reachable worlds in every galaxy.
- The waiting pieces have a test each, including expiry and an unanswered
  choice.

Temporarily introduce each fault below to prove that its test can detect it.
Restore the correct implementation after each check.

| Temporary fault | Required test failure |
| --- | --- |
| Move one arc's lead to a world six jumps from its end | Lead too far |
| Make `arcStarts` read the world's random stream | Starts differ between runs |
| Let a flag trigger fire on every settlement | Flag fires twice |
| Drop the expiry from a world change | Change never expires |

## Outcome

Landed on 2026-09-07, in four milestones, one commit each. The tour of
galaxy 1 is Lave, Rabedira, Vetitice, Xeer and Edle. Five arcs sit on it,
each with a dossier written on Sonnet 5 through the command line, and the
gate holds every rule the plan named.

### What the milestones did

- **M1.** `missions/tour.ts` places five starts from the seed. Each is four
  to six jumps from the one before, and farther from Lave. `placement.ts`
  builds the handover by jumps on the full-tank graph. `route.ts` gains a
  single-source table. A galactic jump moves every lead by the tour of the
  new galaxy, and the test covers all eight galaxies.
- **M2.** Five arcs under `skeletons/arcs/`, each with a theme, two to four
  legs, mixed verbs, and a recovery leg. The lint measures a final leg
  against the lead's world, and names two legs that force two sets at one
  world. `test/arcs.test.ts` walks each arc through the machine on both
  paths.
- **M3.** `withinJumps`, the flag trigger, the world changes with expiry,
  and the choice prompt, each with its test.
- **M4.** Each world draws two or three side jobs from the seed. Both
  campaign sizes read line for line as before.

### What the plan did not have

- **A second arc at one dock took the console from the first.** The
  governor of Lave stands beside the Navy there. The machine now hails the
  first arc and queues the rest. Two fixtures that assumed a quiet dock at
  Lave wait for one.
- **A world patron's arc was offered everywhere.** The offer rule had no
  world check. It has one now, and `withinJumps` widens it.
- **Two legs of one skeleton are never live together.** The override rule
  compares two skeletons only, or the Constrictor's hunt and its courier
  run would conflict.
- **A recovery branch is not a recovery leg.** Three arcs first rejoined
  the happy path with no leg of their own. Vetitice and Edle gained one,
  and the walker takes the branch that leads off the happy path.
- **The fault "a flag fires on every settlement" is not observable.** A
  leg whose flag is already set moves when the leg starts, by design, so
  that fault changes nothing a test can see. The test counts one journal
  entry per flag instead.
- **The shared seeded pick must be the tour's exact hash.** An avalanche
  step moved the tour, and the arcs are pinned to its worlds.
- **The machine crossed the size ceiling twice.** The trigger vocabulary
  left in docs/TODO/191, and the three skeleton lookups left here, to
  `missions/lookups.ts`.
- **The screen cannot be driven to a choice in a test**, because it reads
  the shipped skeletons and none ships a choice leg. The renderer is
  driven through its own row type, and the machine's choice path is
  tested directly.

### Measurements

- 5,462 assertions, from 5,353.
- The five starts are 4, 4, 5 and 4 jumps apart, and 4, 8, 13 and 17
  jumps from Lave.
- Each world's board holds two jobs on 137 worlds and three on 119. The
  rarest side job sits on 60 boards, the commonest on 99.
- Both campaign sizes are unchanged to the digit at 40 and at 200
  commanders over 60 legs.
