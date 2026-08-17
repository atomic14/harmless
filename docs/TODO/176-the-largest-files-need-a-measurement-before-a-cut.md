# 176 — The largest files need a measurement before a cut

**Kind:** architecture · **Severity:** medium · **Size:** large · **Depends
on:** nothing · **Blocks:** nothing · **GitHub:** none

## Where we are

Chris asked for this on 2026-08-17: *"we should pick up the large files and
start breaking them down."*

**The decomposition programme ran twice and stopped twice.** docs/TODO/150
took nine responsibilities out of `game.ts`, and its M6 measured a tenth and
refused it. docs/TODO/169 took two out of `npc.ts`, and its M4 measured a third
and refused it. Both refusals were right, and both are the method this item
follows.

### What the tree measures today

`npm run sizes` reads 30 files over 400 lines, 1 recorded debt and 0 unlisted.
The ten largest, measured on 2026-08-17:

| lines | file | row |
| --- | --- | --- |
| 1,574 | `src/ai-training/scenario.ts` | reason stated |
| 1,537 | `src/game/npc.ts` | **DEBT** |
| 1,255 | `src/game/game.ts` | reason stated |
| 1,246 | `test/world-step.test.ts` | reason stated |
| 1,168 | `src/game/combat-sim-report.ts` | reason stated |
| 1,027 | `test/campaign.ts` | reason stated |
| 935 | `src/game/combat-sim.ts` | reason stated |
| 932 | `test/constants.test.ts` | reason stated |
| 897 | `test/economy.test.ts` | reason stated |
| 873 | `src/game/combat-sim-scenarios.ts` | reason stated |

**ONE OF THE TEN IS A DEBT, AND THE OTHER NINE ARGUE THEY ARE ONE FILE.** That
is the fact this item starts from. `tools/sizes.mjs` calls its ceiling a
detector rather than a rule. The `ALLOWED` list's bar is that a reason must say
why a file cannot be a parent plus children.

### The stated reasons are the thing nobody rechecks

Each of the nine reasons was written when its file crossed 400 lines. Some are
old. **A sentence written once and never checked again is this repository's most
frequent defect.** docs/TODO/164 found it in a path and docs/TODO/165 found it
in a citation. docs/TODO/166 found it in the map, and docs/TODO/174 holds five
more.

**A stated reason ages in one direction.** A file grows after the reason is
written, and the reason never says how much growth it was meant to cover. So the
nine rows are claims about a tree that moved under them.

### What docs/TODO/169 M4 already named

`npc.ts` is the one debt, and its row says what to measure next. Two members are
on no candidate list:

- `update`, at 154 lines of body;
- `updateTrader`, at 73.

**169 M4 said each needs a measurement before it gets a plan.** That is where
this item begins, because it is the one place the previous item left a signpost.

### The combat trainer is one subject in seven files

`npm run map:report` reads 28 of 56 modules over 200 lines as named nowhere in
`docs/ARCHITECTURE.md`. **Seven of the 28 are the combat trainer, at 4,274
lines**: `combat-sim-report.ts`, `combat-sim.ts`, `combat-sim-scenarios.ts`,
`screens/combat-sim.ts`, `combat-sim-compare.ts`, `screens/combat-sim-setup.ts`
and `combat-sim-opening.ts`.

docs/TODO/166 called what to do about it a reader's call rather than a queue
item. **It is a queue item now**, and the first thing it needs is a description
rather than a cut.

## What to do

Four milestones. Each one measures before it moves anything, and each may
report that no cut is worth taking.

### M1 — measure `npc.ts`'s two unmeasured members

Read `update` and `updateTrader`. For each, answer the three questions the
previous two programmes used to pick a winner:

1. what ONE responsibility does it hold, stated in a sentence;
2. how wide is the seam — how many times does it reach the class's own
   transform, flight stats and scratch vectors;
3. what does a caller need to know to call it.

**169 M3 is the precedent for refusing.** The debt row named the flight half for
months. 169 M3 measured it, found a seam 69 calls wide around a 21-line subject,
and refused the split. A wide seam around a small subject is a worse
file, not a better one.

**Land the measurement even when it refuses.** The row in `tools/sizes.mjs` is
repaired either way. A row that names a split nobody will take is the same
defect as a stale claim.

### M2 — take the cut M1 found, if there is one

One responsibility leaves `npc.ts`, with its own file and its own header.

**The file that loses a responsibility repairs its header in the same commit**
(`CLAUDE.md`, docs/TODO/152). It repairs `docs/ARCHITECTURE.md` in the same
commit when the map names the file (docs/TODO/166).

**Take a narrow interface rather than the class.** 169 M2 is the pattern.
`FleetShip` is a position and `alive`. `HostileShip` adds a role and three
flags. A generic type parameter meant no call site needed a cast.

### M3 — recheck the nine stated reasons

Read each row in `tools/sizes.mjs` against the file it describes. For each,
answer one question: **is this reason still true of the file that is there
today?**

Three outcomes, and each is a real result:

1. the reason holds, and the row is confirmed with the date;
2. the reason held and the file has since grown past it, so the row names the
   new subject and the file becomes a candidate;
3. the reason never held, and the file is a debt that nobody recorded.

**This milestone changes no code.** Its whole output is the rows and this
document's record of them.

### M4 — describe the combat trainer, then decide

Give `docs/ARCHITECTURE.md` a section for the trainer's seven modules. Shape it
the way docs/TODO/166 shaped `game.ts`: the halves over their children, then the
subjects.

**Describe it before you cut it.** 169 M1's argument is that the act of stating
the one responsibility exposes the second. A header written after a split is a
header written to fit a decision already made. The map describes none of these
4,274 lines, and that is the largest such case in the tree.

**Then measure again and stop, or name the next item.** docs/TODO/150 M6 and
169 M4 both ended that way, and both were right to.

## Decisions already made

- **Chris asked for the programme on 2026-08-17.** The largest files are picked
  up, and the breaking down starts.
- **The 300-line target is gone.** Chris, 2026-08-14: *"we should not obsess
  over the 300 lines. What we are looking for is a clean architecture."*
- **A measurement may refuse a cut.** docs/TODO/150 M6 and docs/TODO/169 M3 and
  M4 all did, and each refusal is recorded as a result rather than as a failure.
- **`npc.ts` goes first.** It is the one recorded debt, and 169 M4 named exactly
  what to measure.

## Open questions

None that block. M1, M3 and M4 are measurements, and each states what its own
outcomes mean. M2 exists only if M1 finds a cut.

## Watch out for

- **A split that widens a seam.** 169 M3 measured 69 calls across a candidate
  seam and refused. Count the calls before you move anything.
- **`tools/sizes.mjs`'s `ALLOWED` list.** An exemption is available and it is
  usually the dishonest answer (docs/TODO/155). The bar is that a reason must
  say why a file cannot be a parent plus children.
- **The generated files.** `src/game/elite-a/slots.generated.ts` is 730 lines
  and a generator writes it. It is not a candidate, and no milestone touches it.
- **The test files in the top ten.** Four of the ten are tests. A test file's
  reason is usually that a claim is about a whole subject, and splitting it
  makes each half stop being an answer. Read the row before you assume a debt.
- **Invariant 15.** A module decides and returns an event; an orchestrator
  applies the consequence. Every cut this item takes must keep that shape.
- **`npm run map:report` never turns a build red** (docs/TODO/166 M3). M4 must
  not turn it into a gate, because a gate that demands a line per file turns the
  map into an index.

## Verification

The gates always run: `npm run check`, and that includes `npm run sizes`.

The tier table puts M1, M3 and M4 at "nothing more", because none of them
changes a rule. **M2 is a move rather than a rule change**, and the evidence for
a move is that nothing else moved:

- **every probe byte-identical**, at every milestone, against a baseline taken
  before M1. docs/TODO/169 held all five that way, and it is the strongest
  evidence a decomposition can offer;
- **the assertion count unchanged**, except where a new file gets its own test;
- **`npm run map:report`'s unnamed count moves only in the direction M2 and M4
  intend**, and the outcome states the before and after.

**A new file needs its own test**, and the test asserts behaviour rather than
the move. 169 M2's `test/hostility.test.ts` is the model. It holds a source scan
that the file names no ship class, plus a control that proves the scan can see
one. It then drives the real functions from a fixture, because a scan cannot say
whether a type is honestly narrow.

**M3 and M4 produce prose, and `npm run ste:check` reads all of it.**
`npm run titles:check` reads any heading M4 adds.

## Outcome

### M1 — the measurement

`npc.ts` is 1,544 lines rather than the 1,537 this plan's table states. docs/TODO/174
gave `approach` the doc comment it never had, on the same day.

**The class is 785 lines of member bodies, of 1,544.** `NpcState` is 184 more.
The rest is the module header, the imports and the doc comment beside each
member.

**`update` cannot leave, and the measurement is one-sided.** It is 154 lines. It
reaches `this.*` 81 times, over 21 members. Nineteen of the 81 are calls to eight
of the class's own methods. It reaches the transform 9 times, the scratch vectors
6 times, and the flight stats 3 times. It is also the file's stated
responsibility: *what it decides each frame*. A caller needs the whole ship.

**`updateTrader` is a cut, and M2 takes it.** It is 73 lines and 44 reaches, over
7 members. Only four handles are needed: `state`, `object`, `maxSpeed` and
`turnRate`. Twenty-eight of the 44 reaches go through the one `state` object, so
one handle answers 28 of them.

**THE PLAN DID NOT HAVE THE SCRATCH FINDING, AND IT IS THE STRONGEST ARGUMENT.**
`tmpMat` and `tmpQ` are read at three lines of the whole file, and all three are
inside `updateTrader`. The module header claims nine scratch vectors for the
allocation rule. Two of the nine serve one member. They leave with it.

**The member is already half a collaborator.** Its `docking` phase hands the work
to `planDocking` in `game/docking.ts`, which is a pure planner. So the shape M2
writes is the shape the hardest phase already has.

**The seam is five times narrower than the one 169 M3 refused.** That refusal was
69 reaches around a 21-line subject, at 3.3 reaches per line. This is 44 reaches
around a 73-line subject, at 0.60.

**Three things travel with the cut, and the plan did not have them.**
`approach` is a four-line local helper with eight call sites, and four of the
eight are in `updateTrader`. `random` and `randomDirection` come from
`game/rng.ts`. `ZERO` is a module constant that only the docking phase reads.
