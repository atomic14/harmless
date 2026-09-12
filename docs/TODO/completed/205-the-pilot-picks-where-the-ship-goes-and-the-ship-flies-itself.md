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
conversation. Plans 205 to 208 are its result. The note itself is not in the
repository, so the plans quote it.

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

Seven milestones.

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
| a launch | jump to the chosen system; mine the asteroids; skim the star. M2 found that the hermit cannot show here |
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

**M3 is two commits.** The first flies the station course and the jump
course, and it adds the saved course and the key override. The second flies the
derelict, the hermit and the star, and it takes the skim measurement below.

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

A commander with no fuel and no money is not stuck. The launch courses offer
work: the rocks and the star. Once the ship is in flight, the hermit shows too,
where the system has one.

### M5 — the course list on screen, for every player

In flight, the course list is a row of buttons over the view, and not a
screen. M4 found why. Under any screen the flight world stops stepping, and
many tests expect flight at once after an arrival. 204 found the same shape
for its flight menu. Each button sends its course's code from `COURSE_KEYS`,
the flight binding table answers it, and the Game applies the pick
(invariant 15).

The list shows by itself when the ship has no course: at an arrival, when a
course ends, and when a key takes the ship. A button opens it over a course
that flies. No new key does (Chris, 2026-09-11: *"We don't need to use the
keyboard. We have mouse and touch."*). The existing flight keys stay.

The course list also carries two fixed rows: the galactic chart and the pause.
A phone needs the chart in flight to pick the next jump.

### M6 — the manual and the briefing say how the game flies now

Rewrite the flight sections of the manual and of the briefing. Update the
landing page where it describes how you fly. The player-facing pages keep their
own style, and the house prose rules do not govern them.

### M7 — the skip forward button

A skip forward button runs the world faster while nothing needs the pilot. It
runs the same fixed step eight times in each screen frame, and it draws the
last one. The mass lock, the traffic and the encounters behave as they do at
normal speed. So the skip shortens the wait and changes no rule.

The button works only while no hostile ship is near. The skip stops by
itself in these cases:

1. a hostile ship comes near, by the rule that turns the condition light red;
2. the course ends, or no course is picked;
3. the pilot presses a flight key, or taps the button again.

A console line keeps its time in the player's seconds, so it can still be
read. M7 found that this is better than a stop for each new line. A trip
says MASS LOCK and TORUS DRIVE ENGAGED at every stop. A stop for each line
would end the skip at the very waits that it exists to shorten.

The skip works for the whole trip, and that includes the docking computer's
approach. A key and a button start it, and the key lives in the binding table.

**The game loop caps the steps in one frame.** `MAX_STEPS_PER_FRAME` is 5 and
`MAX_FRAME_TIME` is 0.25 s. The skip needs eight steps in a frame, so it raises
the cap for its own frames only. A slow device that cannot keep up skips
slower. It never skips a rule.

`test/skip.test.ts` proves that a skipped trip and a normal trip end in the
same world state, step for step. It proves each of the four stops above.

## Decisions already made

- **A new control takes a mouse click or a tap, and no key** (Chris,
  2026-09-11: *"We don't need to use the keyboard. We have mouse and
  touch."*). The flight keys of today stay as they are.

- **One flow for every player** (Chris, 2026-09-11). A keyboard player and a
  phone player pick from the same course list.
- **The touch controls of 204 go, all five milestones of them** (Chris,
  2026-09-11).
- **The rating stays** (Chris, 2026-09-11). The missions and the story arcs grow
  in weight, and 208 serves that.
- **A countdown that starts runs to the jump** (Chris, 2026-09-11), as it does
  today. A fight during the countdown does not stop it.
- **The torus drive is enough for the trip to the station** (Chris,
  2026-09-11). The measurement of M3 then showed a median trip of 148 s, and
  Chris chose a skip forward button the same day (M7). It runs the fixed step
  faster, at one fixed speed, and it changes no rule (*"instead of being able
  to cheat the mass lock we just skip time forward"*). He first chose a "carry
  on" tap past the mass lock, and the skip replaced it.
- **The skip has one fixed speed** (Chris, 2026-09-11: *"Fixed speed - let's
  keep it simple"*). It is eight times normal speed, and it is tuned after he
  plays it.
- **"Jump on" is a course when the tank holds the fuel** (Chris, 2026-09-11).
  "Skim the star" needs fuel scoops, and the ship flies to the star.
- **The home system's work stays, as courses** (Chris, 2026-09-11: *"maybe we
  keep these, they could be presented as options"*). The rocks and the star are
  launch courses too, and the hermit shows in flight (M2). That answers the
  commander with no fuel money. Chris confirmed this reading the same day.
- **Camera views wait.** They are GitHub #50.
- **The flight keys stay as an override on a keyboard** (Chris, 2026-09-11:
  *"keep the keys - we'll use mouse for any new buttons and hitting the
  keyboard will take control during combat"*). So a new button takes a mouse
  click on a desktop, and a tap on a phone. The two computers already hand the
  ship back on a key.
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

### M2

- **The launch list cannot show the hermit.** The station clears the sky
  while the ship is docked, and the launch builds it again. The hermit is a
  draw at the launch, on 30% of worlds. So nothing can know about it on the
  pad. The rocks are certain, because every system holds `ASTEROIDS_MIN` or
  more. The hermit shows on the list in flight.
- **A row whose object exists shows, even when the ship cannot fly it.** It
  then says what the ship needs, for example `NEEDS FUEL SCOOPS`. A row whose
  object does not exist never shows. The plan did not state this rule.
- **In flight, a chart with no target shows no jump row.** At a launch, the
  jump row always shows, and its reason answers why the ship cannot leave.
- **The suite has 5,656 assertions,** from 5,624.

### M3, first commit: the station course and the jump course

- **The course switch lives in `flight-instruments.ts`.** That file already
  holds the switches that change who flies the ship. `flight.ts` gains four
  lines, and it stays under its ceiling of 400.
- **The hand-over needs a new door, `Autopilot.handOverToDock`.** It engages
  the docking computer with none fitted. It is the stopgap until 207, and its
  doc comment says so.
- **A save carries the course with no new code in the snapshot.** The session
  is walked generically, and an old save restores the field at its default.
- **The trip is long, and the traffic makes it long.** Measured on 2026-09-11
  over 20 systems, from the witchpoint to the dock, with no hand on the stick:

| the sky | the trip, p10 / p50 / p90 | the torus runs | a mass lock holds |
| --- | --- | --- | --- |
| the arrival's own traffic | 116 / 148 / 164 s | 5 / 9 / 16 s | 73 / 111 / 126 s |
| an empty sky | 53 / 55 / 60 s | 19 / 21 / 26 s | 4 s |

  The course engages the torus whenever the drive is free. The time with
  neither is under 3 s at p90. So the lock is the cost, and the lock is any
  live ship within 4,500 units. The arrival puts traders and police along the
  corridor. The last 30 s of each trip is the docking computer's approach.
  All 20 trips docked, and 30 trips in one system docked too.

  **The stops, measured the same day.** A trip stops at a mass lock three
  times at the median, and five at most. About one stop in three has a hostile
  ship in it:

| sample | stops per trip, median | most in one trip | stops with a hostile ship |
| --- | --- | --- | --- |
| 20 trips | 3 | 4 | 16 of 50 |
| 40 trips | 3 | 5 | 32 of 103 |

  **The step is cheap.** With no graphics, the world step ran about 2,000
  times faster than real time on the development Mac, over 5 trips and over
  10. So a skip at eight times speed costs little. That number led to M7.

### M3, second commit: the derelict, the hermit and the star

- **An arrival flies to a standoff and stops there.** The speed follows the
  distance that is left. The torus drops 8,000 units short.
- **Every line goes round the planet.** A launch, the star and a rock far out
  have no promise that the planet is out of the way. A line that dips below
  5,000 units of height aims beside the planet instead.
- **The detour at first trapped a ship.** A hermit sat low over the planet, so
  the line to it always counted as blocked. The ship circled the detour point.
  The rule now ignores a line whose nearest point to the planet is the target.
- **A HERMIT CAN APPEAR INSIDE THE PLANET, and one did.** The scatter round the
  station never checks the planet. Over 128 systems, at arrival and at launch,
  2 of about 2,300 ships appeared inside it: a hermit and a police ship. The
  hermit course then flew the ship into the ground. The traffic placement in
  `spawning.ts` now lifts such a ship out to `SPAWN_PLANET_ALTITUDE`, which is
  1,000 units. The lift draws nothing from the seeded stream. After the fix,
  the same count found none. The rule first went into `World.spawn`. Four
  combat tests put a ship at the origin, where the planet sits, and the lift
  moved them. So the rule lives where the traffic is placed.
- **The derelict drifts at 25 u/s.** A course that asked for a stop beside it
  trailed it at 19 u/s and never arrived. The arrival now matches the target's
  own speed.
- **The measurements, with the arrival's own traffic in the sky:**

| course | sample | arrived | time, median | worst |
| --- | --- | --- | --- | --- |
| the hermit | 10 / 20 systems | 10 / 20 | 119 / 114 s | 161 s |
| the derelict | 10 / 20 systems | 10 / 20 | 26 / 25 s | 32 s |
| the star | 15 / 40 systems | 15 / 40 | 112 / 105 s | 131 s |

  On the star course, the cabin peaked at 0.489 in every sample, against a
  fatal 0.99. No ship came within 68,000 units of the star.

### M4

- **The LAUNCH row opens a screen, `screens/courses.ts`.** Each row is a
  course, and a pick leaves the station on it. A row the ship cannot fly says
  why, and a pick of it refuses with the reason on the console. The last row
  opens the galactic chart, and ESC from the chart returns to the list.
- **`Game.launch()` is still the transition itself.** Only the LAUNCH row's
  command changed. The tests that press `launch` by name still leave at once.
- **A course row sends a virtual code, `COURSE_KEYS` in `bindings.ts`.** The
  launch screen and the flight buttons of M5 share the codes, so the two
  cannot disagree.
- **The jump key and the course list ask one question.** `jumpCheck` in
  `hyperspace-actions.ts` holds the arguments that `startHyperspace` used to
  pass by hand.
- **The suite has 5,708 assertions,** from 5,694.

### M5

- **The course buttons read their codes as a screen reads its own.**
  `CourseActions.read` takes the codes of `COURSE_KEYS` in flight. So no key
  table spends a row on a button, and the `?` guide keeps no blank rows.
- **Chris ruled out a new key the same day.** The first draft bound Z to open
  the list. His words: *"We don't need to use the keyboard. We have mouse and
  touch."* The button that opens the list sends its own code instead.
- **The words on the buttons are the player's, and not the plan's.** Chris
  asked for plain words the same day: *"A user does not have all our
  context."* So no button says "course". A button under way says what the
  ship does, such as HEADING TO THE STATION. A reason says what to do, such as
  CHOOSE A SYSTEM ON THE GALACTIC CHART FIRST.
- **A launch and an arrival each play a tunnel.** The cockpit reads only a few
  keys while one runs, so a button pressed then does nothing. That is the game
  of today, and the test waits for the tunnel.
- **The suite has 5,721 assertions,** from 5,708.

### M7

- **The skip scales the loop, and nothing else.** The loop banks its frame
  time times `SKIP_SPEED`, and it caps the steps at five times that. So a
  frame still banks a bounded amount of world time. A test that reads the
  loop's source pinned the old clamp, and it now pins the scaled one.
- **A skipped trip reaches the same world as a normal trip.** The test
  compares every ship, the commander and the session after 1,200 steps. The
  console is left out, because it counts the player's seconds. One step more
  is a different world, which proves that the comparison can fail.
- **Both games in that test draw from one seeded stream.** Its first draft
  ran them one after the other, and the second trip saw other numbers. The
  police ships then differed, and the fault looked like the skip's. The test
  now restores the stream before each trip.
- **The skip stops at the condition light's own rule.** `hostilesNear` turns
  the light red, so the pilot sees the same reason on the dashboard.
- **The suite has 5,732 assertions,** from 5,721.

### M6

- **The manual and the briefing now teach the buttons.** The launch list,
  FLY TO THE STATION and FAST FORWARD replace the jump key and the torus key
  in the first journey. The manual says that a steering key takes the
  controls back.
- **The briefing's own test pinned the old journey.** `test/key-help.test.ts`
  asked the briefing to quote the jump key and the torus key. It now asks it
  to name the three buttons instead.
- **The fight text and the docking text wait for 206 and 207.** Those plans
  change what they describe.
- **The browser run on 2026-09-11 found two faults, and both are mended.**
  The station menu's two columns split the launch list, so the list has one
  column. The course buttons showed during a tunnel, where a press does
  nothing, so the cockpit shows none then.

## Outcome

205 landed on 2026-09-11. The pilot picks where the ship goes, and the ship
flies itself. The launch list asks where to go, and a ship with nowhere to go
stays on the pad. In flight, buttons over the view show the courses: the
station, the derelict, the hermit and the star. FAST FORWARD runs the world
eight times faster while nothing hostile is near, and it changes no step. The
work found and mended a hermit that could appear inside the planet.

The measurements: the station course docked 50 of 50 trips, with a median of
148 s in the arrival's traffic. The hermit, derelict and star courses arrived
20 of 20, 20 of 20 and 40 of 40 times. The dock probe docked 504 of 504
approaches with no scrape. The suite has 5,733 assertions, from 5,619 before
204.

## After it landed

**The chart row is the LOCAL chart** (Chris, 2026-09-12: *"The local chart
should be used for setting a destination, not the galactic chart."*). The
launch list's row, the button in flight, and the jump row's reason all name
it now. The local chart shows what the tank can reach, which is the question
a destination answers. The galactic chart is the wider view, and it keeps its
own key and its own row on the station menu.
