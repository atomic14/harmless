# 205 — The pilot picks where the ship goes, and the ship flies itself

**Kind:** enhancement · **Severity:** high · **Size:** large · **Depends on:**
204 · **Blocks:** 206, 207, 208 · **GitHub:** none

## Where we are

**Chris wrote `MOBILE_CONVERSION.md` on 2026-09-11, the day 204 landed.** He
flew the touch controls of 204 on a phone, and he could not fly the ship. His
words: *"The current approach does not work - it's not possible to fly the ship
using mobile controls."* He saw a larger chance in that failure: *"This is chance
to make the game much more than just a combat space fighting game. We can make
it an immersive adventure game."* The brainstorm of that day is in the
conversation. Plans 205 to 208 are its result.

**Most of the parts exist already.** Each part below flies the player's ship
through one `FlightDemand`. A pair of hands makes the same thing, and
`PlayerShip.update` flies it:

- the docking computer flies the ship into the slot (`autopilot.ts`,
  `docking.ts`);
- the combat computer points the nose at a threat, in pure pursuit, and it
  pulls the trigger (`scripted-co-pilot.ts`);
- the torus drive crosses a system, and a mass lock stops it near a ship or the
  station (`flight-instruments.ts`, `world-step.ts`);
- the jump countdown starts on a key, and nothing stops it
  (`hyperspace-actions.ts`).

**No part decides what the ship does next.** Today the pilot decides that with
the stick. After this plan, the pilot picks from a short list, and a computer
flies the pick.

**The system around the station holds work today.** The review of 2026-09-11
measured four things:

- two to four asteroids line the arrival corridor, and a mining laser turns a
  rock into ore;
- a rock hermit sits 7,000 to 21,000 units from the station on 30% of worlds;
- a commander with fuel scoops skims the star for fuel, and heat kills a ship
  that goes too near;
- a derelict generation ship crosses on 8% of arrivals, with three to six
  canisters of goods near it, and today it offers only a message.

## The words this plan uses

- **A course** is one thing that the ship does next with no hand on the stick.
  "Fly to the station" is a course. "Skim the star" is a course.
- **The course list** is the set of courses that the present situation allows.
  It is derived state, as a prompt is (`prompts.ts`). The code saves the course
  that the pilot picks. It never saves the list.

**THE WORD IS "COURSE", AND NOT "ORDER".** `orders.ts` and invariant 16 already
use "order" for a signed contract or a live mission. One word has one meaning.

## What to do

Six milestones.

### M1 — the touch controls leave

Remove the code of 204's five milestones. The commits run from `aceb0fc` to
`95b9e92` on this branch. The code is the wanted speed in `Input`, and
`engine/touch.ts`. It is also the command row, the tappable prompts, the
flight menu and the fullscreen request. Remove the touch tests with the code.

**Keep `Input.press` and `Input.release`, with their test.** They let a button
hold a key. 206 needs them for the laser, which fires while it is held. 207
needs them for THRUST and BRAKE.

Remove the paragraph on touch flight from the manual and from the briefing.
Remove `throttleBand` and `TOUCH_STICK_TRAVEL`, then regenerate the catalogue.

Move the 204 plan from `completed/` to `retired/`. Give it a section in the
retired index with the reason. The reason is that a phone could not fly the ship
by a stick. Keep the work of 197 to 203. That work fits the docked screens to a
phone, and it is on `main` already.

### M2 — the course list

A new pure module, `game/courses.ts`, answers one question: what can the ship
do now? It reads the world and the commander. It returns the courses in order,
each with its words and its reason when it is not available. It returns no key.

The course list for each situation:

| situation | courses, in order |
| --- | --- |
| a launch | jump to the chosen system; mine the asteroids; visit the hermit; skim the star |
| an arrival | the mission objective; fly to the station; investigate the derelict; mine the asteroids; visit the hermit; skim the star; jump on |
| a course ends | the arrival list, less the work that is done |

Each course has a condition:

| course | the condition |
| --- | --- |
| jump, and jump on | a hyperspace target, and the fuel for it. `checkJump` already owns both refusals |
| fly to the station | the system has a station |
| the mission objective | a live leg has a target in this system (208 fills this in) |
| investigate the derelict | a generation ship is in the system |
| mine the asteroids | a mining laser, fuel scoops, and a rock in the system (206 flies it) |
| visit the hermit | a hermit is in the system |
| skim the star | fuel scoops, and a tank that is not full |

On an arrival, the console says what the long-range scan found. That is the
derelict, the hermit and the rocks. Chris's own words for it are *"Long range
scans indicate a derelict - investigate"*.

`test/courses.test.ts` pins every row of both tables.

### M3 — a course flies the ship

A new module, `game/course-pilot.ts`, flies the course that the pilot picked. It
decides and reports a `FlightDemand`, as the two computers do. It draws nothing
from the seeded stream.

| course | what the pilot module flies |
| --- | --- |
| fly to the station | point at the station, and engage the torus. Stop at a mass lock. Engage the torus again when the lock clears. At the docking range, hand over to the dock |
| investigate the derelict | fly to the ship, and stop 700 units out, beside its canisters |
| visit the hermit | fly to the rock, and arrive within 320 units below 40 u/s. The trade screen then opens, as it does today |
| skim the star | fly toward the star, and hold inside the scoop range and outside the heat that hurts. Stop when the tank is full |
| jump, and jump on | fly straight out while the countdown runs |
| mine the asteroids | fly to the nearest rock, and open the fight on it (206) |

Until 207 lands, the hand-over at the docking range goes to the docking
computer, free of charge. So a course to the station always ends in a dock.

**The skim altitude is a measurement, and M3 takes it first.** The heat starts
to rise at 110,000 units, and the scoop works inside 80,000. A ship inside
21,000 dies at once. M3 measures a hold distance where the tank fills and the
ship lives, at two sample sizes, before it writes the constant.

**The course is saved state.** The snapshot carries the picked course.
`snapshot-parse.ts` reads a save with no course as a ship with no course.

**The flight keys stay as an override.** A flight key suspends the course, as
it suspends the two computers today. The course list then offers the course
again.

### M4 — the launch sends the ship on its way

The LAUNCH row on the station menu opens the launch course list. A jump course
starts the countdown at the launch. A local course launches the ship on that
course. When no course is available, the launch refuses, and the console says
why. An example is *"SET A HYPERSPACE TARGET ON THE GALACTIC CHART"*.

A commander with no fuel and no money is not stuck. The local courses offer
work: the rocks, the hermit and the star.

### M5 — the course list on screen, for every player

The course list is a screen with rows, behind `ui/screen-host.ts`. The world
keeps flying while it is up, as it does under the charts. A tap picks a row,
and so does the row cursor with Enter. The screen returns the picked course as
an outcome, and the Game applies it (invariant 15).

The screen opens by itself when the ship has no course: at a launch, at an
arrival, and when a course ends. A key and a button open it at other times.
Invariant 9 holds: the key lives in the binding table and nowhere else.

The course list also carries two fixed rows: the galactic chart and the pause.
A phone needs the chart in flight to pick the next jump.

### M6 — the manual and the briefing say how the game flies now

Rewrite the flight sections of the manual and of the briefing. Update the
landing page where it describes how you fly. The player-facing pages keep their
own style, and the house prose rules do not govern them.

## Decisions already made

- **One flow for every player** (Chris, 2026-09-11). A keyboard player and a
  phone player pick from the same course list.
- **The touch controls of 204 go, all five milestones of them** (Chris,
  2026-09-11).
- **The rating stays** (Chris, 2026-09-11). The missions and the story arcs grow
  in weight, and 208 serves that.
- **A countdown that starts runs to the jump** (Chris, 2026-09-11), as it does
  today. A fight during the countdown does not stop it.
- **The torus drive is enough for the trip to the station** (Chris,
  2026-09-11). No course skips time.
- **"Jump on" is a course when the tank holds the fuel** (Chris, 2026-09-11).
  "Skim the star" needs fuel scoops, and the ship flies to the star.
- **The home system's work stays, as courses** (Chris, 2026-09-11: *"maybe we
  keep these, they could be presented as options"*). The rocks, the hermit and
  the star are launch courses too. That answers the commander with no fuel
  money.
- **Camera views wait.** They are GitHub #50.
- **The flight keys stay as an override on a keyboard.** This plan made that
  call. The combat trainer, the flight probe and the dock probe fly by those
  keys. The two computers already hand the ship back on a touch.
- **M1 lands on the branch of 204.** This plan made that call too. Pull request
  #49 then carries the attempt and its removal together, so the record stays in
  one place.

## Open questions

None.

## Watch out for

- **Invariant 15.** The course pilot decides and reports. The Game starts the
  jump, opens the trade screen and applies the dock.
- **`pilotDemand` in `game.ts` chooses the seat.** Today it chooses between the
  scripted co-pilot and the trained seat. The course pilot joins that choice.
  Two seats must never both fly one frame.
- **A mass lock and the torus.** A course must not engage the torus under a
  lock. `massLocked` in `world-step.ts` is the one home of the lock.
- **The hermit opens its trade screen on distance and speed.** The course must
  slow below 40 u/s inside 320 units, or it circles the rock.
- **The star kills.** `SUN_KILL_DIST` is 21,000 units. The skim course must
  never plan a path inside it.
- **`flight.ts` is 388 lines, under a ceiling of 400.** The course switch goes
  in its own file.
- **The prompts line still offers the bribe and the cargo dump.** 206 turns
  both into courses. Until then, the prompts line stays.
- **The combat trainer is ordinary flight.** An exercise must not show the
  launch course list. `combat-sim-safety.ts` holds what an exercise may touch.

## Verification

The gates always run: `npm run check`. `npm run generate:constants` runs first,
because M1 removes constants and M3 adds constants.

The tier: a rule that changes how the ship flies. `npm run flight-probe` and
`npm run dock-probe` run once.

Evidence:

- `test/courses.test.ts` pins both tables of M2, for each condition on both
  sides.
- `test/course-pilot.test.ts` flies each course headlessly on the real world
  step:
  - the station course reaches the docking range from the witchpoint;
  - it stops at a mass lock, and it engages the torus again after the lock;
  - the hermit course ends below 40 u/s inside 320 units;
  - the skim course fills the tank, and the ship lives.
- A test proves that a launch with no course refuses, and that the console
  says why.
- A snapshot round trip keeps the course.
- Chris flies it on his phone. The playtest reports, and it does not block.

## What the milestones found

### M1

- **The code of 204 came out clean.** Every file that 204 touched went back to
  its state at `81fcb2b`, the commit before 204's code. No later commit on the
  branch changed those files. After the removal, no file in the tree cites
  the touch code.
- **The suite has 5,624 assertions.** That is 5,619 from before 204, plus the
  five checks of the kept pair.
