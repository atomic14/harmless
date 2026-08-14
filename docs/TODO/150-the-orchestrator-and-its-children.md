# 150 — The orchestrator and its children

**Kind:** refactor · **Severity:** low · **Size:** large · **Depends on:** 149 ·
**Blocks:** nothing · **Source:** the backlog's head, promoted 2026-08-14.

## Where we are

`src/game/game.ts` is **2,528 lines and 201 commits** — three times the collision
cost of anything else in the tree — and its own exemption admits what it is:

> DEBT: down from 3,244 and still the orchestrator plus leftovers. Target ~300.

It is eight times over the target it set itself.

**The rule it fails is Chris's, set on 2026-08-14:** one responsibility per file,
and *"single responsibility does not mean put everything in one file. A file can
import child files. The key is to keep files small so they can be easily
understood."* So the target is not a shorter `game.ts`. It is a small
orchestrator beside the children it composes.

## What the triage found

**It is 114 members over about thirteen areas**, none of them enormous:

| lines | area |
| ---: | --- |
| 272 | input, the step and the control mode |
| 236 | the law |
| 132 | the trainer |
| 130 | the world and spawning |
| 126 | saves and persistence |
| 122 | messages |
| 115 | rendering and the HUD |
| 110 | hyperspace |
| 103 | death |
| 88 | contracts and survivors |
| 75 | ordnance |
| 74 | the station |
| 59 | trade |
| 669 | the constructor (163) and a tail of 40 members |

**Most areas already HAVE a rules module.** `law.ts`, `persistence.ts`,
`contracts.ts`, `ordnance.ts`, `station.ts` and `world-step.ts` all exist and all
came out of this file — which is how it fell from 3,244. What is left in
`game.ts` is the ORCHESTRATION: the handler that spends a rule and applies its
consequence.

So the decomposition axis is not "move the rules out" — that is done. It is
**"move the handlers out, beside the rules they spend"**.

**The pattern is already in the codebase.** `station.ts` takes the state and a
narrow `StationHost` of the few things it needs back, and returns events the
Game applies. `Ordnance` and `WorldStep` are the same shape. A new child module
is not a new idea here; it is the sixth of its kind.

**M1's area was measured for coupling before it was chosen.** The six law
handlers touch `state`, three message helpers, the mode, a scratch vector and
each other — and nothing else:

```
bribePolice         41 lines   mode, offerTo, showMessage, state
throwOverboard      38 lines   mode, showMessage, state, tmp
raiseLegal          11 lines   callStationDefence, queueMessage, state
callStationDefence  22 lines   baseMode, queueMessage, state, tmp
offerTo             25 lines   markName, showMessage, state
payFine             11 lines   showMessage, state
```

That is a host interface of four methods.

## What to do

### M1 — the law's consequences leave

`src/game/law-actions.ts` takes the six handlers above. It sits beside
`game/law.ts`, which owns the RULES — what a bribe costs, what a record is worth
— and holds what the Game does with them: offering money to a patrol, throwing
the evidence overboard, raising a status, calling the station's defence, and
buying a name back.

It follows `station.ts`: the state plus a narrow host, returning events where it
can. The host is `showMessage`, `queueMessage`, `markName` and the mode.

**One responsibility: what the law does to a commander, and what she can do about
it.**

### M2 onwards — re-assessed after M1

**Do not fix the order here.** docs/TODO/149 M2 planned one chart file, measured
719 lines and found four subjects; the plan was right because it deferred to the
measurement. The same applies to every area above: the sizes are a map, not a
schedule.

What M1 has to answer, and what the next milestone is chosen on:

1. Does a child module of this shape actually shrink `game.ts`, or does it trade
   150 lines of handler for 100 lines of host wiring?
2. Is the host interface narrow enough to be worth having, or does the child end
   up calling back for everything?
3. Which area is next — the candidates by cost are the law (done), the trainer,
   the world and spawning, and saves.

The constructor is **163 lines** and is deliberately last. It is where every
child is wired, so it can only shrink once the children exist.

## Decisions already made

- **One responsibility per file, and a responsibility may be a parent plus
  children** (Chris, 2026-08-14).
- **No prose is cut to make anything fit** — docs/TODO/148's lesson.
- **Every comment travels with the code it explains** — 148 and 149.
- **The target is a small `game.ts`, not a shorter one.**

## Open questions, and the answers

**1. Why not start with the biggest area?** The biggest is input and the step at
272 lines, and it is the orchestrator's own job — dispatching a command and
running a frame is what a `Game` is FOR. It is the part most likely to stay.

**2. Why not a `game/` directory?** Because `src/game/` already is one, and the
children belong beside the rules they spend: `law-actions.ts` next to `law.ts`.
A `game/game/` would be a directory named after the file rather than the
subject.

**3. Does the DEBT entry come off?** Not at M1. It is honest and it names a
target, so it stays until `game.ts` reaches it — and the entry gets the number
each milestone leaves it at.

## Watch out for

- **`test/playtest.js` drives the Game from a console paste**, and calls its
  methods by name. A method that moves has to keep a caller, or the agent breaks
  silently — nothing type-checks that file.
- **`game.ts` is PLATFORM** in `tools/portability.mjs`. A child that holds rules
  rather than wiring should be PORTABLE, so check which bucket each lands in.
- **The message helpers are the host's, not the child's.** `showMessage` and
  `queueMessage` decide whether a line takes the console or waits for it
  (docs/TODO/144 M3 found what happens when that is got wrong). One home.

## Verification

**The gates always run**, and they are `npm run check`. This moves code between
files and changes no rule, so docs/PROCESS.md's tier table asks for nothing more.
`npm run portability` runs too, because the module graph moves.

**A refactor's gate is that nothing needed a new test.** The law is covered by
`test/bribe.test.ts`, `test/bribe-flight.test.ts`, `test/law.test.ts` and
`test/record-line.test.ts`; all must pass untouched at the same assertion count.

**And the numbers that say it worked:** `game.ts` smaller by roughly the area
moved, the child under 400 with a stated single responsibility, and no new
`ALLOWED` entry.

## What landed

**M1, on 2026-08-14.** `npm run check` passes, `npm run portability` unchanged.

| | |
| --- | --- |
| `game/game.ts` | 2,528 → **2,251** |
| `game/law-actions.ts` | 302 (new) |

All 762 comment lines survive across the two files.

## What M1 found that the plan did not have

**1. The host is seven methods, not four.** The plan measured the handlers'
coupling and counted `showMessage`, `queueMessage`, `markName` and the mode.
The three it missed matter:

- **The mode is read TWICE, and they are different questions.** `mode()`
  includes an open screen, so a bribe is refused while a chart is up.
  `baseMode()` does not, because the defence fleet cares where the SHIP is
  rather than what is on screen. Reading one for the other would either
  scramble Vipers at a commander looking at a map, or refuse a bribe to a pilot
  being shot at. Two host methods, and the interface says why.
- **Two sounds belong to the host** because `audio.ts` is PLATFORM. A child that
  imported it would stop being portable, and the point of moving a handler out
  of `game.ts` is that the child CAN be portable when `game.ts` is not.

**2. Two methods stay on the Game as one-line delegates — and the reason I first
gave for them was wrong.** `raiseLegal` and `bribePolice` carry
`@internal — driven by test/playtest.js`, and I repeated that in the M1 commit
message without checking it. **`test/playtest.js` calls neither.** Both doc
comments are stale.

The delegates are still right, for a plainer reason: both have live callers
INSIDE `game.ts` — `raiseLegal` from the step host and two event appliers,
`bribePolice` from the command table — so the delegate is simply how the
orchestrator reaches its child.

**What `test/playtest.js` actually calls, which is the list the next milestone
needs**, since nothing type-checks that file:

```
acceptContract  buyCargo   buyEquipment  fireLaser
launch          lookAlong  massLocked    priceMultiplier
respawn         sendDistressBeacon       startHyperspace   update
```

Twelve methods. **`respawn` and `launch` are in it**, so the death area and the
station area both need a delegate when their turn comes. The two stale
`@internal` comments are left as found rather than corrected here, because a
sweep for stale `@internal` claims is its own small item and not this one.

**3. The shape works, and the numbers say so.** 277 lines out, 302 in, about 25
lines of wiring. The plan's first open question — does a child of this shape
shrink the parent, or trade handlers for host wiring — is answered yes.

## M2 — the sky, on 2026-08-14

`game/world-build.ts`, 187 lines. **game.ts 2,251 → 2,153.** All 678 comment
lines survive, `npm run check` passes, `npm run portability` confirms the child
landed portable while `game.ts` stays platform.

It holds the five contiguous methods that build a scene, choose the roster it
flies, drop into witch-space, and populate a system on a launch or an arrival.
**One responsibility: what is in the sky when you get there.**

### The plan chose the trainer, and measuring said no

This is the finding, and it is about the plan rather than the code. The section
below picked the trainer on a 132-line estimate taken from an area table that
counted doc comments. Measured:

| area | lines of body | external deps |
| --- | ---: | ---: |
| world + spawn | 73 | **5** ← chosen |
| saves | 63 | 8 |
| contracts | 48 | 7 |
| hyperspace | 92 | 13 |
| death | 60 | 13 |
| render + hud | 89 | 16 |
| **trainer** | **39** | **12** ← the plan's pick, worst ratio in the file |

`simHost` alone touches twelve things. Thirty-nine lines out for a twelve-method
interface fails the test M1 set — the child would call back for everything.

**Twice now on this programme, deferring to measurement has changed the answer**
(docs/TODO/149 M2 planned one chart file and found four subjects). The lesson is
sharper than "defer": the plan was right to defer and wrong to name a favourite
while deferring, because the favourite gets picked up as a decision.

**So M3 names no area.** Measure the table above again after this milestone —
`world-build.ts` took callers with it, so the numbers have moved.

### Three more stale `@internal` claims

`buildWorld`, `enterWitchspace` and `spawnNpc` all say *"driven by
test/playtest.js"*, and that file calls none of them — the same fault as
`raiseLegal` and `bribePolice` in M1. **Five found across two milestones.** The
delegates stay regardless, because each has live callers inside `game.ts`; the
extraction surfaced three for `chooseBlueprintSet` alone. A sweep for stale
`@internal` claims is still its own small item.

## How to measure an area — run this, do not estimate

**The plan's own 132-line estimate for the trainer came from counting doc
comments, and it picked the worst area in the file.** So the method is written
down rather than described. Two numbers per area:

- **lines of body** — the declaration line to its closing brace. NOT the doc
  comment, which is what inflated the estimate. The comment still moves with the
  code, so the SHRINK is larger than this number; the RATIO is what this is for.
- **external deps** — every `this.x` the area touches that is not a member of
  the area itself. That is the host interface it will need.

Take the area with the most lines per dep. M1 was 6 handlers at 148/7. M2 was
73/5. The trainer was 39/12 and would have been a net loss.

```js
// node --experimental-strip-types tools/… or just paste into a node -e
import { readFileSync } from 'node:fs';
const lines = readFileSync('src/game/game.ts', 'utf8').split('\n');
const info = (name) => {
  const i = lines.findIndex((l) =>
    new RegExp(`^  (?:private |readonly )*${name}\\s*[(<]`).test(l));
  if (i < 0) return [0, new Set()];
  let d = 0, started = false, e = i;
  for (let n = i; n < lines.length; n++) {
    d += (lines[n].match(/\{/g) ?? []).length - (lines[n].match(/\}/g) ?? []).length;
    if (lines[n].includes('{')) started = true;
    if (started && d <= 0) { e = n; break; }
  }
  const body = lines.slice(i, e + 1).join('\n');
  return [e + 1 - i, new Set([...body.matchAll(/this\.(\w+)/g)].map((m) => m[1]))];
};
for (const [area, names] of Object.entries(AREAS)) {
  let n = 0; const deps = new Set();
  for (const m of names) { const [size, d] = info(m); n += size; d.forEach((x) => deps.add(x)); }
  const ext = [...deps].filter((d) => !names.includes(d)).sort();
  console.log(area.padEnd(13), String(n).padStart(4), String(ext.length).padStart(4), ext.join(', '));
}
```

**`AREAS` is the judgement, and it is the part to re-check each time** — an
extraction takes callers with it, so a member can change area. **M3 proved this
is the step that decides the answer**: the table as written at M2 had no entry
for the area that won. As at M3, with the three extracted areas removed:

```js
const AREAS = {
  trainer:    ['setCombatObserver','simHost','startExercise','endExercise'],
  saves:      ['openSaves','exportSave','importSave','savesContext','persistenceHost',
               'captureSnapshot','restoreSnapshot','autoSave','resumeSavedWorld','newCommanderGame',
               'loadOrWarmGalaxy','freshGalaxySeed'],
  hyperspace: ['startHyperspace','completeHyperspace','arriveInSystem','galacticJump'],
  death:      ['die','quitFlight','abandonFlight','respawn'],
  contracts:  ['generateContractOffers','applyContracts','acceptContract','survivorOffers',
               'answerForSurvivors','settleContracts'],
  rescue:     ['sendDistressBeacon','completeRescue'],
  trade:      ['tradeContext','buyCargo','sellCargo','buyEquipment','openHermitTrade'],
  ordnance:   ['applyOrdnance','armMissile','launchMissile','triggerEcm','detonateEnergyBomb','say'],
  combat:     ['fireLaser','destroyNpc','wreckNpc','applyPlayerDamage','applyCombat',
               'damageSomething','applyAutopilot'],
  sound:      ['playSound','placeOf'],
  messages:   ['showMessage','queueMessage','sayEvent','markName'],
  screens:    ['chartContext','openChart','openLocalChart','openSystemData','openReadingScreen',
               'showBaseScreen','handleScreenClick','setView','switchLayout'],
  station:    ['stationHost','applyStation','enterDocked','launch'],
  step:       ['update','step','pausedHint','finishStep','updateFlight','applyStep','handsOn',
               'pilotDemand','stepHost','handleInput','controlMode','runCommand','cameFrom'],
};
```

**Two of these are named here so that nobody has to find them twice.** The
messages area is 12 lines and the plan already rules it out — `showMessage` and
`queueMessage` are the HOST's, and they have one home. The step area is the
orchestrator's own job, which open question 1 settles.

**Then run the two checks before extracting**, both of which have already caught
something on this item:

1. Does the area have a rules module to sit beside? `law-actions.ts` had
   `law.ts`; `world-build.ts` had `spawning.ts`, `population.ts` and
   `blueprint-set.ts`. An area with no partner needs a name of its own, which is
   a harder decision than a move.
2. `grep` the area's method names in `test/playtest.js`. Nothing type-checks
   that file. The twelve it really calls are listed under M1 — `respawn` and
   `launch` are among them, so the death and station areas need delegates.

## M3 — the cockpit, on 2026-08-14

`game/cockpit-view.ts`, 250 lines. **game.ts 2,153 → 2,021.** `npm run check`
passes at 4,530 assertions. `npm run portability` needed one new entry, which is
the finding below.

It holds the four surfaces that turn the world into a picture: the gunsight
lamp, the laser beams' meeting point, the prompt line, and the dashboard frame.
**One responsibility: what the cockpit shows about the world.** Not one of the
four decides anything, which is what makes them one subject rather than four.

**The plan named no area, so the area was measured**, with the method the
section above writes down. The cockpit won on the plan's own rule — take the
most lines per dep:

| area | lines of body | external deps | ratio |
| --- | ---: | ---: | ---: |
| **cockpit** | **98** | **9** | **10.9** ← chosen |
| saves | 73 | 8 | 9.1 |
| hyperspace | 92 | 13 | 7.1 |
| contracts | 48 | 7 | 6.9 |
| death | 60 | 13 | 4.6 |

### Four things it found that the plan did not have

**1. The `AREAS` table was incomplete, and re-checking it is the whole job.**
The section above says so, and this milestone is the proof. The table carried no
entry for combat, for messages, for the screens, or for the cockpit — and the
cockpit is the one that won. A first pass grouped the distress beacon and the
rescue under contracts, which raised that area to 87/8; reading the code said no,
because a beacon is witch-space rather than a job. **Judgement about which
members form an area decides the answer before the arithmetic starts.**

**2. Two deps were not host methods at all, and counting them as such
understates every area.** `hudScratch` and `tmp2` are touched only inside the
area, so they MOVE with the child rather than becoming an interface. `tmp` did
not move, because `arriveInSystem` and `updateFlight` also hold it — the child
got its own pair, for the reason `soundAt` already states. **The measurement
script cannot see this**, so it over-counts. Read the dep list before trusting
the ratio.

**3. Three reads of `mode` were the same question.** The sight, the prompt line
and the dashboard each tested `mode === 'flight'`. They are one host method now,
`inFlight()`, so the three cannot drift apart. This is the opposite of M1's
finding, where two reads of the mode turned out to be two DIFFERENT questions and
needed two host methods. Both are only visible once the area is pulled out.

**4. The child is PLATFORM, and it is the first one that is.** `law-actions.ts`
and `world-build.ts` both landed portable. This one drives `hud/`, `ui/` and the
shell, so it cannot. **It costs the port nothing**: this code was already inside
`game.ts`, which is platform, so no portable line became platform and the
`ports unchanged` total is byte-identical at 32,907 lines.

**Why `game/` and not `hud/`.** Putting it in `hud/` would need no new platform
entry, and `hud-binding.ts` is the module it spends. It still goes in `game/`,
because `hud-binding.ts` opens by stating the rule for its own directory: *"There
is no `Game` here and no callback out."* This file IS the callback out — it holds
a host back to the Game — so filing it next door would contradict its neighbour.

### The overhead is worse than M1's, and the ratio is why

132 lines out, 250 in. M1 was 277 out and 302 in, about 25 lines of wiring; M2
was 98 out and 187 in. **The wiring is roughly fixed per child** — a module
header, a documented host interface, the imports and a constructor come to about
90 to 120 lines whatever the area is. So the ratio the plan measures is not only
about the host being narrow. It is what decides whether the child carries its own
overhead. At 10.9 this one just does; a 39-line area never could.

### `test/playtest.js` calls none of the six

Checked, as the section above requires. `keyPrompts` stays on the Game as a
delegate for a different reason: `test/prompts.test.ts` and
`test/bribe-flight.test.ts` read the offers off the Game.

### The beams path was proved rather than assumed

`view()` is a host METHOD, not a constructor argument, because the Game builds
its shell inside its own constructor — so the `Presentation` does not exist while
the Game's fields initialise, and a copy taken then would be `undefined`. That
made the beams a live risk, so a throw was put inside `aimBeams` and the suite
was run: it fired. `g.draw(1)` in `test/game.test.ts` covers the dashboard and
the sight the same way.

## M4 — the jump, on 2026-08-14

`game/hyperspace-actions.ts`, 266 lines. **game.ts 2,049 → 1,910.** `npm run
check` passes at 4,530 assertions, and the count is unchanged, which is the
refactor's own gate. `npm run portability` says the child landed portable.

It holds the five ways into and out of a system, and every one of them ends at
`arriveInSystem`: the countdown, the days a jump spends, the drop at the
witchpoint, the crossing to the next galaxy, and the tow when a mis-jump strands
you. **One responsibility: what a jump does to the world.**

**The plan named no area, so the area was measured**, with the method above. The
jump won on the plan's own rule:

| area | moves | deps | ratio |
| --- | ---: | ---: | ---: |
| **the jump** | **142** | **11** | **12.9** ← chosen |
| death + saves | 119 | 13 | 9.2 |
| saves | 69 | 8 | 8.6 |
| ordnance + combat | 112 | 15 | 7.5 |
| contracts + survivors | 48 | 7 | 6.9 |
| death | 60 | 13 | 4.6 |
| screens | 67 | 15 | 4.5 |

### Five things it found that the plan did not have

**1. The ratio alone picks a file that must not be written, and the size rule is
what stops it.** The sound area — `playSound` and `placeOf` — measures **41
lines against ONE external dep, a ratio of 41**, four times the best real
candidate. It is the wrong answer: M3 measured the wiring at 90 to 120 lines per
child, so a 41-line area pays more overhead than it moves. **The rule is
therefore two numbers, not one.** An area needs enough lines to carry a module
header, a documented host and a constructor, AND a good ratio. The section above
now says so.

**2. Grouping decided this one twice, and reading the code is what did it.**
`sendDistressBeacon` and `completeRescue` look like a subject of their own, and
M3 had already ruled they are not contracts. Measured apart they are 39 lines —
too small, like the sound. Measured WITH the jump they add 39 lines and remove a
dep, because `completeRescue` ends at `arriveInSystem` like every other arrival.
The same test moved `loadOrWarmGalaxy` and `freshGalaxySeed` in: the seed is
drawn the same way at a boot and at a galactic jump, and taking the pair removed
another dep. **Both moves raise the ratio, and neither is visible in a table of
members.**

**3. A child can take an earlier child as a collaborator, and that is what keeps
the host narrow.** Four of the eleven deps were `buildWorld`,
`enterWitchspace`, `chooseBlueprintSet` and `populateSystem` — all of them
`world-build.ts`, M2's child. Passing `WorldBuild` itself turns four host
methods into one constructor argument. The seam reads correctly too:
`hyperspace-actions.ts` decides WHEN a system is entered, and `world-build.ts`
decides what is in it.

**4. A move must not invent a constant.** The first draft named `250` and `3` as
`ARRIVAL_SPEED` and `RESCUE_DAYS`. Both were reverted. `src/constants/` owns
what a named constant is and where it lives, and a refactor that changes no rule
must not create one on the way past — that is its own decision, with its own
gate to answer to.

**5. 151's convention decided how the delegates read.** Four members keep a
delegate on the Game — `startHyperspace` and `sendDistressBeacon` for
`test/playtest.js`, `galacticJump` for `test/prewarm.test.ts`, and
`arriveInSystem` for `test/blueprint-override.test.ts`. Each delegate keeps the
claim that names its caller, and each moved method takes
`driven by src/game/game.ts` instead. `claims:check` reads all eight, so this
milestone could not copy a stale claim forward — which is what 151 ran first
for.

### The overhead, against M1 and M3

138 lines out, 266 in: **128 lines of wiring**, just above the 90-to-120 band M3
measured. Ten host methods is the widest interface yet, and four of them are the
machine the child must not import: the console, the tunnel and the two sounds.

### Portability

The child is **portable**, like M1's and M2's and unlike M3's. `ports unchanged`
goes from 32,909 to 33,176 and `platform` from 12,081 to 11,943 — so 138 lines
stopped being platform and no portable line became platform. No new entry in
`tools/portability.mjs`.

### The prose

825 comment lines before, 894 across the two files after. **No line was lost.**
Two were reworded, because `loadOrWarmGalaxy` now sits in the same file as the
`galacticJump` it points at, and one one-line claim became a fuller delegate
comment.

### What M4 did NOT touch

**The map at the top of `game.ts` is still out of date**, and it is left that
way on purpose. It names `persistence.ts`, `station.ts`, `autopilot.ts` and
`controls.ts` and none of M1 to M4's children. docs/TODO/152 owns that map. To
add one clause per milestone would leave four half-corrections for it to
reconcile.

## M5 — the career, on 2026-08-14

`game/career.ts`, 264 lines. **game.ts 1,910 → 1,810.** `npm run check` passes
at 4,530 assertions, unchanged again. `npm run portability` needed one new
entry, and the child is the second platform one.

It holds what a career keeps when a flight ends: the checkpoint written down,
the way back taken, the file handed to another machine, and the start with
nothing. **One responsibility: what a career keeps when a flight ends.** A
CAREER is one commander's continuing record — the thing `state.career` names.

**The area was measured, and the pair beat both halves**, which is M4's finding
used rather than repeated:

| area | moves | deps | ratio |
| --- | ---: | ---: | ---: |
| sound | 41 | 1 | 41.0 ← rejected on size |
| **death + saves** | **119** | **13** | **9.2** ← chosen |
| ordnance + combat | 112 | 15 | 7.5 |
| saves alone | 59 | 8 | 7.4 |
| contracts + survivors | 48 | 7 | 6.9 |
| death alone | 60 | 13 | 4.6 |

### Five things it found that the plan did not have

**1. The reading question had a measurable answer, and it is mutual reach.**
The plan says whether death and saves are one responsibility is a reading
question. Reading gives a countable answer: **death reaches into saves three
times and saves reaches back into death twice.** `die` forgets the flight ring
and draws the panel from the saves context, `abandonFlight` forgets it too,
`respawn` resumes the checkpoint — and on the other side `savesContext` reports
whether the commander is dead, and `persistenceHost` reads `baseMode` for the
same reason. **Two files would need a link in both directions.** The code says
it in its own words, in a comment that was already there: *"It costs what dying
costs because it lands where dying lands."*

**2. A host literal travels with the thing it is HANDED TO, and that rule
decided the file's edge.** `savesContext` and `persistenceHost` look like twins
— both are a slice of the Game handed to something else. They part company on
their callers. Every caller of `savesContext` moved, so it moved.
`persistenceHost` is handed to `new Persistence(...)`, which `game.ts`
constructs and nine other places use, so it stayed. Following the ratio instead
would have taken it: with the host the area measures 9.2 and without it 7.5.
**The rule is worth more than the 1.7.** Moving it would also have made the
child own a module the whole Game uses, and the host's own answers — the mode
machine and the scene rebuild — would have become relays.

**3. The extraction found a rule with two homes.** The game-over panel is drawn
by `die` and again by `showBaseScreen` when Escape closes the screen the panel
opened. Both wrote out the same three-part expression:
`renderGameOver(commander, checkpointSummary(savesContext()))`. It is
`showGameOver()` now, with one home in the child and the Game's base screen
calling it. Neither file could see the duplicate while both halves sat in one
2,000-line file.

**4. The overhead is the highest of the five, and delegates are why.** 136 lines
of area left and 264 arrived, but `game.ts` only fell by 100 — the difference is
**36 lines of delegate and host wiring that stayed behind.** Four members keep a
public delegate, more than any earlier milestone: `respawn` for
`test/playtest.js`, `newCommanderGame` for `test/career-identity.test.ts`,
`openSaves` for `test/saves.test.ts` and the docked S key, and `abandonFlight`
because the quit screen's context is built with the rest of the screen wiring.
**An area whose members are reached from outside pays twice**, and the
measurement cannot see it in advance.

**5. It is platform, and the reason is neither the sounds nor the storage.** A
career is READ ON SCREENS — the game-over panel, the save shelf and the file
transfer. `ports unchanged` is byte-identical at 33,176 lines, so no portable
line became platform; `platform` rises from 11,943 to 12,107, which is the new
wiring alone.

### The prose

792 comment lines before, 885 across the two files after. **No line was lost.**
One single-line comment became a block, because the moved `savesContext` needed
a claim naming its caller.

## M6 — what is left is the orchestrator, on 2026-08-14

**M6 measured, and the measurement says stop.** No sixth area clears the bar,
and the reason is not that the good ones are taken. It is that what remains is
the orchestrator's own job. This milestone ships the measurement and the
corrected target, and it moves no code.

### The first number: the price per line removed

**`game.ts` shrinks every milestone.** That is not in question and it is the
point of the item. What has changed is what each line of that shrink costs.

| milestone | `game.ts` falls by | the child | the TREE grows by | written per line removed |
| --- | ---: | ---: | ---: | ---: |
| M1 the law | 276 | 302 | +26 | **1.09** |
| M2 the sky | 98 | 187 | +89 | **1.90** |
| M3 the cockpit | 133 | 250 | +117 | **1.87** |
| M4 the jump | 138 | 266 | +128 | **1.92** |
| M5 the career | 101 | 264 | +163 | **2.61** |

**The fall in `game.ts` is flat, not falling** — 98 to 138 lines a milestone
since M1, which was an outlier because the law was a 276-line area with almost
nothing to wire. The last column is the one that moves: a child now costs about
two lines written for every line it takes out of `game.ts`, and M5 cost 2.6.

The wiring is not waste. A module header, a documented host interface and the
delegates left behind are what make a child readable on its own. But it is
roughly fixed per child, so the smaller the area the worse the trade — and the
areas left are small.

### The second number: 75% of `game.ts` is orchestration

| what | lines | share |
| --- | ---: | ---: |
| header, imports and fields | 570 | 31% |
| everything else — 44 members, 10 lines each | 448 | 25% |
| the appliers and the console | 163 | 9% |
| the constructor | 161 | 9% |
| the hosts and the contexts | 152 | 8% |
| the frame | 120 | 7% |
| the routing | 109 | 6% |
| the delegates | 87 | 5% |

Six of those eight buckets can never leave, and each has a stated reason:

1. **An `apply*` method IS the orchestrator**, by the project's own design rule
   — a module decides and returns an event, an orchestrator applies the
   consequence. `applyCombat` says so in its own words: *"Combat decides; the
   Game pays. Every consequence that reaches outside the world — the HUD, the
   law, the missile lock, the death screen — lands here."*
2. **A host literal travels with the thing it is handed to** (M5), and all six
   are handed to modules `game.ts` constructs.
3. **The routing is the whole surface on purpose.** The `commands` table is the
   single largest item in the file at 81 lines, and its own comment is the
   argument against moving it: *"This is the whole surface a replay, an AI or a
   test drives the game through."* Its arms call about sixty Game methods, most
   of them private, so a child holding the table would need a host of sixty.
4. **The frame and the input are the orchestrator's job**, which the plan's open
   question 1 settled before M1.
5. **The constructor is where every child is wired**, so it shrinks only when
   there is nothing left to wire.
6. **The delegates are the cost of the children that already left.** Twenty
   members, 87 lines, and every one of them exists so that a caller outside can
   still reach what moved.

### The third number: the target is not reachable this way

**Only 448 of the 1,810 lines sit in members that could still move.** Move every
one of the 44 and the file lands near 1,362 — and that figure moves both ways
in practice: the imports of what leaves go with it, and every member with an
outside caller leaves a delegate behind. Call it 1,300 to 1,400. **The stated
target of ~300 cannot be reached by taking areas out**, and that is the claim
this milestone is making. It is not a claim that moving code out fails to shrink
the file. It shrinks it by about 450 more lines, and then it stops.

And those 44 members do not form areas worth taking. Measured with the appliers
and the hosts set aside, the best is the weapon keys at 60 lines against 9 deps,
and reading them says what they are: `armMissile` is
`this.applyOrdnance(this.ordnance.arm(...))`. **They are the appliers' arms.** A
child holding them would call back into `game.ts` for the applier on every line.

### What the sound area finally settles

M4 rejected the sound area on size — 41 lines against ONE dependency, the best
ratio ever measured here. M6 found the second reason, and it is stronger:
**`sounds.ts` already argues that this code belongs in the orchestrator.** Its
header says the rule modules return a `SoundEvent` so that *"`game.ts` has ONE
place that turns a sound event into a call"*. `placeOf` cannot join it either —
`sounds.ts` keeps a three-import rule so that a headless run costs nothing, and
`placeOf` needs a real `three` import. The area is where it should be.

### The question this leaves, and it is Chris's

The five children did what the item asked: `law-actions.ts`, `world-build.ts`,
`cockpit-view.ts`, `hyperspace-actions.ts` and `career.ts` are each one subject,
each under 310 lines, each readable alone. `game.ts` fell 28%, from 2,528 to
1,810. **What is left is an orchestrator, and it is 1,810 lines.**

Three ways forward, and the choice is a scope decision rather than a
measurement:

1. **Re-aim the target.** Accept that an orchestrator of this game is about
   1,400 to 1,800 lines, correct the `~300` in `tools/sizes.mjs`, and close the
   item. The children stand.
2. **Keep taking marginal areas.** Each one now costs about 150 lines of tree to
   remove about 90 from `game.ts`. Four or five would reach roughly 1,400.
3. **Change the axis.** The remaining bulk is the mode machine: one file
   orchestrates the station AND the cockpit. Splitting the ORCHESTRATOR — a
   docked half and a flight half, with the frame and the routing shared — is a
   different and larger design, and it is the only one that reaches ~300.

**M6 does 1 in `tools/sizes.mjs`**, because a stated target that is known to be
unreachable is a false claim in a gate's own review surface, which is the defect
docs/TODO/151 was about. The choice between 1, 2 and 3 stays open for Chris.

### How to measure the composition

The area script above answers "what should leave next". This one answers "what
is this file now", which is the question M6 needed. It buckets every member by
whether it CAN leave.

```js
const HOSTS = ['stepHost','simHost','stationHost','persistenceHost','tradeContext','chartContext'];
const APPLY = ['applyStep','applyStation','applyCombat','applyOrdnance','applyAutopilot',
               'applyContracts','playSound','sayEvent','showMessage','queueMessage','markName'];
const ROUTE = ['runCommand','handleInput','controlMode','cameFrom','handsOn','pilotDemand'];
const FRAME = ['update','step','draw','updateFlight','finishStep','pausedHint','resize'];
// then bucket each member: constructor, delegate (a one-line reach into a child),
// host, applier, routing, frame — and whatever is left is the candidate pool.
```

## M7 onwards — open, and waiting on the decision above

**Still true from the plan:** the 163-line constructor is last, because it is
where every child is wired.

**M6 names no area either**, for the reason M2 wrote down: the plan was right to
defer and wrong to name a favourite while deferring, because the favourite gets
picked up as a decision. The M5 table above measures the file as it stood before
M5. Measure again, with the checks the section above lists.

**Four warnings the later milestones add to that method.**

1. **Subtract the delegates first** (M3). Some members are already one-line
   delegates onto an existing child. A delegate cannot leave — it is how the
   orchestrator reaches what it already extracted — so it inflates the body
   count without being work that can move.
2. **Read the size as well as the ratio** (M4). The wiring is 90 to 165 lines
   per child whatever the area is, so an area under about 60 lines pays more
   overhead than it moves however good its ratio looks. The sound area measures
   41 lines against one dep, and writing it would make the tree larger.
3. **Count what the area is reached BY, not only what it reaches** (M5). Every
   member with a caller outside `game.ts` leaves a delegate behind, so the
   parent keeps about nine lines of it. M5 moved 136 lines of area and `game.ts`
   fell by 100. The ratio cannot see this, and four delegates is what made this
   milestone the most expensive of the five.
4. **A host literal travels with the thing it is HANDED TO** (M5). Following the
   ratio would have moved `persistenceHost` and raised the area from 7.5 to 9.2.
   It stays, because `new Persistence(...)` stays.

5. **Set the appliers and the hosts aside BEFORE ranking** (M6). Ordnance plus
   combat measures 112 lines against 15 deps and looks like the largest area
   left. Nine of those fifteen are collaborators, which is the tell: the area is
   `applyCombat` and `applyOrdnance`, and an applier is the orchestrator by
   definition. Take the appliers and the host literals out of the pool and the
   same area is 60 lines against 9 — the appliers' arms.

**What is left is the orchestrator itself, and M6 measured it.** See the M6
section above: 75% of `game.ts` cannot leave, moving all 44 remaining members
would still leave 1,362 lines, and the choice between re-aiming the target,
taking marginal areas and splitting the orchestrator is Chris's.
