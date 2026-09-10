# 203 — A mission tells the player where to go

**Kind:** bug · **Severity:** high · **Size:** large · **Depends on:** 202 ·
**Blocks:** nothing · **GitHub:** none

## Where we are

**Chris played three side jobs on 2026-09-10 and could not tell how to finish
any of them.** He asked for a full review of every mission. He asked for the
mechanics the missions need, and for the game to tell the player what is
happening, in full sentences. The review is in the conversation of that day,
and this plan is its result.

**The game never tells the mission machine that the player arrived.** The
machine has an `arrived` input, and the ambush verb waits for it. The job
Clear the Lane succeeds only on a dock after an arrival at the target world.
No code sends the arrival. So the job cannot complete, and neither can the
first leg of the Vetitice arc. The tests pass because they feed the machine a
hand-made arrival.

**The game never tells the machine that a day passed.** Every side job has a
fourteen-day deadline. The deadline check runs on a `dayPassed` input, and
nothing sends it. So no job ever expires, and a change a mission leaves on a
world never ends.

**A target can appear outside the scanner.** A mission ship or canister
spawns 4,000 to 8,000 units from the player. The scanner reaches 6,000. So
about half the time the target is off the scanner on arrival. Nothing marks
it. On the scanner a mission ship is a trader or a pirate blip like any other.
A mission canister is a cargo blip like any other. The compass points at
the planet or the station, never at the target.

**A scan needs a missile lock, and nobody says so.** The seconds of a scan
count only while the ship is under the target lock. The lock exists only
while a missile is armed. The briefing says "do not fire". A scan target is
a trader whose clock starts at zero, so it leaves at once: half dock, and half
jump out. A target that docks vanishes without a word and the job stays open.
A target that jumps out fails the job. No counter shows the seconds.

**The lane has no pirates.** The side job promises pirates on the lane and
spawns none.

**The console says almost nothing.** One line on acceptance, one line when a
branch settles, and silence between. Nothing says that the narcotics went
aboard, that the pilot is aboard, that the target is near, or that a deadline
is close.

## What to do

Six milestones.

### M1 — the game reports an arrival and a day

Every jump that ends in a system sends `arrived` after the world is built,
and the console says what the machine answers. Every jump sends `dayPassed`
with the days it took, before the arrival. The tow after a distress beacon
sends its three days. The machine's deadline check gains two lines. When a
deadline passes, it says that the job ran out of time. When a job has
`DEADLINE_WARNING_DAYS` or fewer days left, it says how many.

### M2 — a target waits inside the scanner, and the lane has pirates

`MISSION_TARGET_RANGE` and its span shrink so a target spawns between 2,500
and 4,500 units from the player, inside the scanner. A scan target does not
leave the system until the scan is done. A leg may name ships that wait at
its world while it is live, and the two lane legs name pirates.

### M3 — the scanner and the screen mark the target

A ship or a canister that a live mission tagged is a `mission` contact on the
scanner, in amber, with a diamond. The nearest one gets a marker on the
screen, with the words MISSION TARGET. When it is out of view, an amber arrow
at the edge of the screen points at it, as the docking port's arrow does.

### M4 — the console speaks at every change, in full sentences

- On arrival at a target world, the game says what the player is there for.
  It says where the target is, as a distance and a bearing in words.
- On arrival at any other world with a job held, it says how many jumps away
  the job is.
- When the patron's goods go aboard, it says how many tonnes, and it says when
  the hold took fewer than the job needs.
- When a pod is scooped, it says the pilot is aboard and what to do next.
- When the player reaches the lane, it says to fight through and dock.
- While a scan runs, it counts the seconds aloud, once a second.
- Every line a side job speaks is a full sentence.

### M5 — a scan needs no missile

The seconds of a scan count while the target ship is in the player's view,
inside `WATCH_CONE` of the view's direction and inside scanner range. The
missile lock still counts, so a player who locked on loses nothing.

### M6 — the manual and the missions page say how a job works

One paragraph each. The target is marked on the scanner and the screen. The
console says where it is on arrival. A scan counts while the ship is in
view.

## Decisions already made

- **Full sentences everywhere** (Chris, 2026-09-10). A console line is a
  sentence with a subject and a verb, in capitals as the console prints.
- **A scan target waits.** A job that fails because a ship left before the
  player could find it is a job the player could not do.
- **A hunt target may still flee.** A pirate that runs from a fight is the
  fight's own outcome, and the skeleton already says what that costs.
- **The marker is amber.** The palette has four colours. Amber is the
  colour of the docking marker and the target lock, which are the two other
  things the player is told to fly at.

## Open questions

None.

## Watch out for

- **`arriveInSystem` serves the galactic jump and the rescue too.** An
  arrival is an arrival in each case.
- **The world-step rig.** `test/dead-drone.test.ts` shows how a test spawns a
  thing at a position and steps the world. The scan test uses the same rig.
- **`MISSION_TARGET_RANGE` is the Constrictor's too.** It moves nearer, which
  its comment already wants.
- **The skeleton lint.** A leg's spawn list carries tags the machine does not
  track. The lint must not read them as entities.

## Verification

The gates always run: `npm run check`. `npm run generate:constants` runs
first, because M1, M2 and M5 add or change constants.

The tier: a rule that changes how a scan and a lane go. `npm run elite-a`
runs once, because the spawn range moves the Constrictor's arrival.

Evidence:

- `test/mission-machine.test.ts`: a day past the deadline fails the job with
  a line, and a day inside the warning says the days left.
- `test/mission-game.test.ts`: a jump reaches the machine as a day and an
  arrival, and an ambush completes through the game.
- A new `test/scan-watch.test.ts`: a tagged trader in view for the leg's
  seconds sends `scanned` with no missile armed, and one behind the player
  does not.
- `test/hud-model.test.ts` or a new test: a tagged ship is a `mission`
  contact, and the marker points at it.
- Chris plays the three jobs on the preview.

## Outcome

All six milestones landed on 2026-09-10. 5,619 assertions, from 5,576. The
ship-data probe ran once and passed, because the spawn band moved the
Constrictor's arrival nearer.

### M1 — the game reports an arrival and a day

Every jump sends its days, queued behind ARRIVED, and every arrival sends
`arrived` after the world is built. The tow sends its three days. The
deadline check speaks three lines: the days left inside the warning, the
last day, and the day the job is lost. A real Game in `test/mission-game.
test.ts` jumps to a lane job's world, reads the warning, moves the leg on
arrival, and completes it on the next dock.

### M2 — a target waits inside the scanner, and the lane has pirates

The band is 2,500 to 4,500 units. A scan's subject keeps an infinite trading
clock until it is scanned. A leg may list ships that wait at its world, and
both lane legs list a Krait pair and a Mamba from `skeletons/lane.ts`.

### M3 — the scanner and the screen mark the target

A thing whose tag a live leg names is a `mission` contact: amber, a diamond
on the scanner, a diamond with the words MISSION TARGET on the screen, and an
amber arrow at the edge when it is out of view. A lane pirate stays a
hostile.

### M4 — the console speaks at every change, in full sentences

A verb's reaction may speak. The pod scooped and the lane reached both do.
On arrival `game/mission-arrival.ts` says where the target is, as a distance
to the hundred and a bearing in the ship's words, and how many jumps away a
job at another world is. The goods aboard say their tonnes, and a short load
says what the job still needs. A scan counts aloud. Every side-job line, the
board's count and a lead are sentences.

### M5 — a scan needs no missile

The seconds count while the subject sits inside `WATCH_CONE` of the view and
inside scanner range. The lock still counts. `test/scan-watch.test.ts` flies
a real Game with no missile armed and gets paid.

### M6 — the manual and the missions page say how a job plays

One paragraph each.

### What the plan did not have

- **A patron's line at the end of a job said AT ANY STATION.** The machine
  filled the world slot with nothing once the leg was over. The words name
  the leg's own world now, and a change still lands where she stands.
- **A line said in the same frame as ARRIVED never showed.** The mission
  lines queue behind it.
- **The machine crossed the size ceiling.** What a dock says moved to
  `hail.ts`.
- **The key-prose gate would have hunted an empty label**, had M2 of
  docs/TODO/202 not already left the rows out. Nothing to do.
- **The dossier lines carry no full stop**, by their own lint. They are full
  sentences already, and they stay as they are.
