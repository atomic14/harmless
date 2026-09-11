# 208 — Every kind of mission has a way to fly it

**Kind:** enhancement · **Severity:** high · **Size:** large · **Depends on:**
205, 206 · **Blocks:** nothing · **GitHub:** none

## Where we are

**Chris wants the missions to feel part of the game** (2026-09-11: *"Yes, the
missions are becoming much more important - they need to feel part of the
game"*). 205 gives the arrival a course list, and the mission objective is its
first row. This plan says what that row flies for each verb. A verb is one kind
of mission leg, and `src/missions/verbs/` holds the eight of them.

**Every mission target appears on an arrival.** The world spawns a tagged ship,
pod or canister 2,500 to 4,500 units from the witchpoint, in a random direction
(`spawning.ts`). The tag is `missionTag` on the ship or the canister. The verb
compares that tag with the live mission's own.

**What each verb needs today**, from the review of 2026-09-11:

| verb | what completes it | what fails it |
| --- | --- | --- |
| hunt | the player kills the tagged pirate | it jumps out, where the job allows an escape |
| scan | 20 s with the target inside 6,000 units and within 0.35 rad of the nose, or under a missile lock | the target dies or leaves |
| escort | the charge comes within 3,500 units of the station with no enemy within 3,500 units of it | the charge dies or leaves |
| recover | the player scoops the tagged canister | the canister is shot |
| rescue | the player scoops the pod, docks, and chooses to land or sell the survivor | the pod is shot before the scoop |
| ambush | the player arrives, then docks alive. The three lane pirates settle nothing | the verb reacts to nothing else |
| deliver | a dock at the target world | the deadline passes |
| smuggle | a dock at the target with the goods still aboard | a police scan, within 2,600 units of a Viper |

**The review found four faults that a course makes worse, or can mend:**

1. **A recover leg without fuel scoops is a trap.** The canister breaks on the
   hull, and the mission hears nothing (`world-step.ts`). A course that flies
   into it without scoops repeats the trap each visit.
2. **Nothing checks where the player is during an escort.** The charge flies
   itself to the station, and the pirates are the only test.
3. **The hunt verb reacts to `fled`, and nothing sends it.**
4. **The hunt target can die to another ship.** The game then sends
   `escortLost`, and the hunt verb ignores that input. So the leg stays open
   with no target.

## What to do

Five milestones.

### M1 — the mission row on the course list

`game/courses.ts` from 205 gains the mission row. It reads the live legs through
`missions/queries.ts`, and it names the target in the dossier's words where a
dossier exists. It names the patron as well. The row leads the arrival list. A
leg whose target is in another system gives no row. Its words go on the
MISSIONS screen, as they do today.

| verb | the row | what the course flies |
| --- | --- | --- |
| hunt | Hunt the named ship | to the target, then the fight of 206 with the target picked |
| scan | Scan the named ship | to a standoff inside 6,000 units, then hold the nose on it for 20 s |
| escort | Escort the named ship | beside the charge, to the station. A pirate in range opens the fight |
| recover | Recover the named goods | to the canister, then the scoop |
| rescue | Pick up the survivor | to the pod, then the scoop, then the station |
| ambush | Fly to the station | the station course. The row warns of the pirates on the lane |
| deliver | Deliver the goods | the station course, in the mission's words |
| smuggle | Slip past the police | the station course, on a path wide of every Viper (M4) |

### M2 — the scan and the escort hold their station

A scan course holds a standoff and keeps the nose on the target. The laser
stays the pilot's. The course shows the seconds of the scan, and the console
warns that a shot ends the job.

An escort course flies in formation with the charge. Fault 2 then stops being a
fault for a pilot on a course. Leave the rule as it is.

### M3 — the scoop legs cannot trap the pilot

The recover row and the rescue row need fuel scoops. Without them, the row says
so, and the course does not fly into the canister. That mends fault 1 for a
pilot on a course. A pilot on the flight keys can still break the canister.
Decide in this milestone whether the leg then spawns a new canister. Read
`missions/machine.ts` first.

Mend fault 4 here as well. A hunt target that dies to another ship completes
the leg with a lower fee, or fails it. The verb decides, and the machine
applies the branch. Remove the `fled` input from the hunt verb, unless a
milestone gives it a sender.

### M4 — the smuggle path goes wide of the police

The smuggle course is the one course that needs a new flight rule. It picks a
path to the station that stays outside 2,600 units of every police ship. The
path goes wider when it can, outside the warning band of 4,400 units. When no
such path exists, the row says so. The pilot may then dump the goods and fail
the job, or fly on and take the chance.

### M5 — the derelict tells a story

The derelict course of 205 ends 700 units from the generation ship, beside its
canisters. On arrival, the console tells what the scan finds, in words drawn
from the seed, as the system descriptions are. The course list then offers
"collect everything" (206). A later arc may use a derelict as a mission site.

## Decisions already made

- **Each mission verb gets a course** (Chris, 2026-09-11).
- **The missions and the arcs grow in weight, and the rating stays** (Chris,
  2026-09-11).
- **Rocks and derelicts use the fight of 206** (Chris, `MOBILE_CONVERSION.md`).

## Open questions

None. M3 names one decision that a reading of the machine settles.

## Watch out for

- **The verb decides, and the machine applies** (invariant 15, one level down).
  A course never pays, never moves a leg, and never reads the purse.
- **The seeded stream.** The derelict's words of M5 draw from the seed. Draw
  them on a derived stream, so no world outcome moves.
- **`test/mission-skeletons.test.ts` runs the lint over every skeleton.** A new
  rule for a verb goes into `missions/lint.ts` as data.
- **A dossier is words, and the machine never reads one.** The row reads the
  dossier for its words only.

## Verification

The gates always run: `npm run check`.

The tier: a rule that changes how a mission and a fight go. `ambush-probe` runs
once after M1.

Evidence:

- **Each of the eight side jobs completes with no hand on the stick.** A
  headless test flies each job in `skeletons/side.ts` from the arrival to its
  end, on the real world step, by the mission row alone. The fight of 206 runs
  on the pilot's trigger, which the test holds down.
- A test proves that a recover row without scoops refuses, and that the course
  never touches the canister.
- A test proves that the smuggle path keeps outside 2,600 units of each Viper
  where such a path exists.
- Chris plays the arc of one patron on his phone.

## What the milestones found

### M1 and M2

- **Five verbs need a course, and three do not.** A deliver, a smuggle and an
  ambush all end at the station, and the station course flies there. The
  other five get the first row of the list, in the job's own words. The rows
  read HUNT THE KRAIT, SCAN THE ANACONDA, ESCORT THE PYTHON, RECOVER THE
  CARGO and PICK UP THE SURVIVOR.
- **Four shapes cover those five.** A hunt is a fight, so the course picks the
  ship and the computer's aim flies it, exactly as mining does. A scan holds
  1,200 units off and keeps the nose on the ship. An escort flies 600 units
  off its charge, inside the ring the escort is judged by, so the fight comes
  to the pilot. A recover and a rescue are a scoop.
- **The run leads the list in a hunt, and that is right.** The hunt's own ship
  is hostile, so RUN FOR IT sits above the mission row (docs/TODO/206 M5).
- **The whole side-job flight is tested through the machine.** Each job is
  accepted through `runMissions`, moved to the system the ship is in, and
  flown by its button alone. A side job is on about a third of the worlds'
  boards, so the test walks the galaxy until it finds one that offers it.
- **The suite has 5,831 assertions,** from 5,820.

### M3

- **A scoop row says when the ship cannot fly it.** A recover or a rescue
  needs fuel scoops. Without them the canister breaks on the hull, and the
  leg hears nothing. The row says NEEDS FUEL SCOOPS, and the pick refuses,
  so the course never flies into it.
- **A hunted ship wrecked by somebody else ends the hunt.** The world sends
  `escortLost` for a tagged ship wrecked with credit to nobody, and the hunt
  verb ignored it. The leg stayed live with no ship left in the galaxy to
  kill. It takes it as destroyed now. A branch that paid less for another's
  kill would be a third outcome, and no skeleton has one.
- **The `fled` trigger has a sender at last.** Three arcs have a branch for a
  hunted ship that runs, and nothing ever sent the word. A tagged ship that
  leaves while it flees counts as fled. Any other one jumped out, and it
  escaped. So a side hunt no longer fails when its target runs.

### M4

- **The smuggling run is a course of its own: SLIP PAST THE POLICE.** It flies
  the station course on a line wide of every policeman in the way, at the
  warning band of 4,400 units. That is outside the 2,600 units a policeman
  reads a hold at, with a margin.
- **One rule holds both detours.** `sidestep` aims beside a thing in the way,
  on the same side as the line, and half as far again. The planet and the
  police both use it, and a target that is itself the nearest point needs no
  detour.
- **A leg without a tag is still a leg.** The lookup skipped every leg with no
  tagged ship, and a smuggling run has none. It asks for a way past the
  police, and nothing in the sky is its own.
