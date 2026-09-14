# 219 — The Dark Wheel comes for a commander

**Kind:** enhancement · **Severity:** high · **Size:** large · **Depends on:**
217 · **Blocks:** nothing · **GitHub:** none

## Where we are

The tour is five arcs of seventeen legs, and the fifth ends it. Plan 217
measured the authored play at four to six hours. After it the game is
Elite's own loop: eight side jobs that repeat, and the climb to Elite.

Chris said, on 2026-09-13: *"I think there were rumours of some secret
organisation once you started to get to the higher levels - maybe there's
another layer we can add."* He chose the old names, the first whisper at
Above Average, and a reward that no shop sells.

The 1984 package hinted at a society of pilots that nobody admits exists,
and at a lost world. This plan writes the society: the Dark Wheel. It
finds the commander once the commander is worth finding, it tests before
it trusts, and its door is in witchspace.

What exists. A gate can read the rating, the kills, the flags, a clean
record and a finished skeleton. A settlement can set a flag, change a
world and leave a standing spawn. A hunt counts a gang. A misjump puts the
ship in witchspace, where the Thargoids wait, and the misjump can be armed
on purpose. The rock hermits trade in flight. The status screen paints the
rating. The rungs run from Harmless to Elite. Above Average is 128 kills.
Competent is 512, and Dangerous is 2,560.

## What to do

Five milestones. Each is one commit.

### M1 — the Wheel is a patron, and the lawless worlds carry its word

- A patron kind `wheel`. Its name is THE DARK WHEEL. It has no world, no
  face and no species. `patronFor` answers for it, and the missions screen
  paints a patron with no face.
- A Wheel skeleton is on the board at every Anarchy and every Feudal
  world, and nowhere else. The offers filter learns the kind.
- The first skeleton, `wheel-mark`, opens at Above Average. Its hail is
  the whisper: A NOTE WAITS FOR YOU. NO SENDER, NO NAME. Its job is a
  hunt of a gang with a named leader, at a lawless world two to seven
  light years out. The gang is a Fer-de-Lance with two Asps. It pays, and it sets the
  flag `wheel.marked`.
- The lint learns that a `wheel` patron needs no galaxy gate.

### M2 — the blockade

- A tagged ship can fly as police. The spawn's job gains `police`, and the
  role table maps it.
- `wheel-blockade` follows the mark. It asks for a clean record. It is a
  smuggle of five tonnes to a Corporate State world two jumps out, and
  three Vipers wait at the target. A scan at the target fails it, and the Wheel
  says so. It sets `wheel.trusted`.

### M3 — a leg in witchspace

- A placement kind `witchspace`. The leg's target is the witchspace
  sentinel, not a system. The arrival after a misjump spawns the leg's
  ships and items, beside the trap that is already there. The course row
  works there, and the missions screen says WITCHSPACE for the world.
- `wheel-pilot` follows the blockade. One of theirs is adrift in a pod in
  witchspace. Arm the misjump, find the pod among the Thargoids, scoop it,
  and land the pilot alive at any station. It sets `wheel.proven`.

### M4 — the door

- A tagged ship can fly as a Thargoid. The spawn's job gains `thargoid`.
- `wheel-door` opens at Competent, after the pilot. The Wheel names the
  place: witchspace, one more time. A Thargoid mothership waits with its
  drones, tagged as a gang. Clear it, and the door opens.
- The settlement grants a fit: a new effect, `grant`, that the game
  applies to the equipment. The reward is the cloaking device. A flag,
  `wheel.member`, puts one line under the rating on the status screen: OF
  THE DARK WHEEL. The last dossier speaks of Raxxla, and says no more.

### M5 — the cloaking device

- `equipment.cloak`, which no shop sells. A key and a gun row button, CLOAK,
  lit while it runs. While it runs, no ship is hostile to the commander,
  no missile locks on, and the energy bank drains at `CLOAK_ENERGY_PER_SECOND`.
  A shot drops it, because a shot is a flare. The console says CLOAKED and
  UNCLOAKED. The HUD's label says so while it runs.
- The manual gains one sentence of fact.

## Decisions already made

- **The old names** (Chris, 2026-09-13): the Dark Wheel, and Raxxla.
- **The first whisper at Above Average** (Chris, 2026-09-13).
- **A reward no shop sells** (Chris, 2026-09-13). The cloaking device is
  the choice here. It is the one fit the 1984 game gave and never sold,
  and it changes a fight rather than a number.
- **The door at Competent**, 512 kills. Dangerous is 2,560, which is fifty
  hours of hunting, and the layer should be reached.
- **The trials pay credits too.** The Wheel is not poor, and a job that
  pays nothing is a job a player skips.
- **The Wheel's chain is not the tour.** The tour stays five arcs, and the
  arcs test keeps its count. The Wheel's skeletons live under
  `skeletons/wheel/`.

## Open questions

- **Where the whisper reaches a commander who avoids lawless worlds.**
  About a third of the worlds are Anarchy or Feudal, and a hunter meets
  them. If a playtest says otherwise, the rumour can read the rating and
  point at the nearest one.
- **Whether the cloak hides the ship from the police scan.** M5 says no:
  a scan is a hail, not a targeting.

## Watch out for

- **The dossiers.** Four new skeletons need four generated dossiers, at
  about seven cents each. Chris says when to run it.
- **`test/patrons.test.ts` expects every world patron in the patron
  file**, and a Wheel patron is none.
- **`test/constants.test.ts` lists the skeleton names** that may hold a
  constant outside `src/constants/`.
- **A witchspace target must survive a save.** The sentinel is a number
  the record can hold, and the repair reads it.
- **The misjump escape jump** uses the target the misjump kept. A leg
  that ends in witchspace must leave that path alone.
- **`isHostileToPlayer` is read by the threat light, the co-pilot, the
  run course and the pirates.** A cloak that lies to all of them at once
  is the point, and the tests must read each.

## Verification

The gates always run: `npm run check`.

The tier: a new patron, four skeletons, a placement, an effect and a fit.
The flight probe flies each trial after it lands.

Evidence:

- A test reads the Wheel on the board at an Anarchy and not at a
  Democracy, and only at Above Average.
- A machine test walks the four skeletons in order, on the happy path and
  through each recovery leg.
- A real-game test arms the misjump, arrives in witchspace on the pilot's
  leg, and reads the pod in the sky with the trap.
- A test grants the cloak through the machine and reads it on the ship.
- A test cloaks the ship, reads no hostile ship, reads the drain, and
  reads the cloak dropped by a shot.

## What the milestones found

### M1

- **The Wheel's boards are the lawless worlds by name.** The encounters
  file already had a `LAWLESS_GOVERNMENT`, and it reaches a dictatorship,
  because pirate waves do. The Wheel's line is narrower, so it is a list of
  the two governments' 1984 names, and not a second number.
- **A trial comes back after a failure**, as many times as its `cap`
  allows, and never after a pass. The offers filter reads the last outcome
  for a Wheel patron, where an arc reads any outcome as the end.
- **The whisper queues behind the Navy.** A commander with the Wheel's
  rating has the Navy's kills, so the dock says INCOMING NAVY TRANSMISSION
  first and the note behind it.

### M2

- **The blockade's world is any world one jump out**, not a Corporate
  State. A placement picks by distance, and it has no government filter.
  The three Vipers at the far end are the blockade, wherever it is.
- **The parcel is a smuggle job's load**, three tonnes, and not five.

### M3

- **The sentinel is a number the record holds**, and eight readers of a
  target learned it: the line's slot, the deadline, the arrival's line,
  the chart's marks, the course row's place, the mis-jump's spawn, the
  lint, and the prompt.
- **The rescue verb's line names no gender now.** LAND THE PILOT serves
  the survey pilot, the surveyor and the Wheel's own.
- **A real mis-jump on the leg finds the pod among the Thargoids**, and the
  trap is untouched.

### M4

- **A Thargoid is hunted under its own roster row.** The hunt verb names
  the role its target flies with, and the gun warning prices it there.
- **The grant is an effect**, so the machine stays pure and the bridge puts
  the fit on the ship. The cloak is a field of the equipment, and a save
  from before the Wheel reads it as off.

### M5

- **The cloak's draw had to beat the recharge.** A bank every thirty
  seconds was under it, and the cloak cost nothing. A bank every six
  seconds is about four points a second over the recharge, and a full pool
  cloaks the ship for about forty five seconds.
- **Two tests used Z as a key bound to nothing.** They use X now.
- **The pools' file owns every write to a pool**, so the draw lives there,
  and the five reporters that only read them moved out for the size gate.
  The mission effects moved out of the model for the same gate.

## Outcome

Landed 2026-09-13, in five milestones. The Dark Wheel is a patron with no
world and no face. Its note reaches a commander at Above Average on the
lawless boards. Four trials follow: a gang with two Asps, a parcel past
three Vipers on a clean record, a pod among the Thargoids in witchspace,
and a Thargoid at the door at Competent. The door grants the cloaking
device, which no shop sells, and the status screen says OF THE DARK
WHEEL. The four dossiers follow on a generator run. 6,159 assertions.
