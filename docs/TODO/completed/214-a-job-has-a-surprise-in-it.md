# 214 — A job has a surprise in it

**Kind:** enhancement · **Severity:** high · **Size:** large · **Depends on:**
213 · **Blocks:** nothing · **GitHub:** none

## Where we are

[`docs/MISSIONS-FLIGHT-REVIEW.md`](../MISSIONS-FLIGHT-REVIEW.md) flew every
kind of job eight times. Every hunt ended in four to thirteen seconds. The
ship ended 95 runs of 96 alive, and the one death was a crash. Five kinds of
job resolve in under thirty seconds with no decision in them.

Chris set the direction on 2026-09-13: *"I think the missions are too easy -
there should be surprises. Like collecting a canister triggers an ambush. Or
there are pirates waiting for you when you jump in. An escort mission should
be more difficult than just flying to the station."*

What exists today:

- `Leg.spawn` lists ships that wait at the leg's world, spawned on every
  arrival. Two legs use it, both with `LANE_PIRATES`.
- A verb reports a `VerbReaction` with a trigger, progress and a line. The
  machine turns it into effects, and the bridge applies the effects that are
  the commander's. Nothing reaches the world from an effect.
- The escort's charge flies to the station on its own. The commander's
  position is not measured. 213 M1 makes the charge recover from a hit.
- A hunted ship is a pirate, and a pirate never leaves the system.

## What to do

Four milestones. Each is one commit.

### M1 — pirates wait at the jump-in

`Leg.spawn` is the mechanism, and this milestone is data with a rule. Each
leg that sends the commander somewhere names who waits there:

| leg | who waits |
| --- | --- |
| a side hunt | the Krait and one wingman |
| a side deliver | two light pirates, because somebody wants the packet |
| a side recover | one pirate that circles the canister |
| a side scan | nobody; the job is to be quiet |
| an arc hunt | the target and two of its kind |
| an arc deliver | two pirates on the far end |

A spawn list is outside the dossier hash, so no dossier changes. The words
say nothing of it. That is the surprise.

### M2 — a scoop springs an ambush

- `Leg.ambush` names ships that jump in when the leg makes progress. That
  is a scoop for a recover or a rescue, and the scan's end for a scan.
- The verb's reaction carries `sprung: true` on that step. The machine
  emits a `spawn` effect with the ships. The bridge hands the effect back
  to its caller as a spawn order, because the bridge has no world.
- Two callers can hear it: the scoop in `world-step.ts`, and the scan's
  end. Each spawns the ships around the commander at `PIRATE_WAVE_RANGE`.
  The console says THEY WERE WAITING FOR THE CANISTER.
- The recover, the rescue and the scan side jobs get an ambush. The Lave
  arc's ledger and the Vetitice arc's pod get one.

### M3 — an escort is the commander's to keep

- **The charge keeps to the commander.** It moves while she is within
  `ESCORT_LEASH` of it, and holds where it is when she is not. The console
  says THE PYTHON IS HOLDING FOR YOU once.
- **The fee needs her there.** `escortSafe` also needs the commander within
  `DOCK_COMPUTER_RANGE` of the charge.
- **Pirates come for the charge.** The escort leg spawns a pack half way to
  the station, on the charge's line, with `job: 'hunt'`. A pirate preys on
  a trader when the commander is out of reach, so a commander who stays
  close draws the fight to herself.

### M4 — the hunt is a chase

- **A pirate can leave.** A hunted ship below `HUNT_FLEE_ENERGY` runs for
  the edge of the system as a trader does, and jumps out at
  `TRADER_JUMP_OUT`. The world already sends `fled` for it.
- **The hunt course pursues.** The fight of 206 already holds the target.
  A target that runs is a target the pilot chases at full throttle.
- **The dead branches go live.** `targetFled` on the three arcs, and the
  `ignores` on the side hunt from 213 M5 becomes a branch, which needs one
  dossier regeneration.

## Decisions already made

- **Surprises: an ambush on a scoop, pirates at the jump-in, and a harder
  escort** (Chris, 2026-09-13).
- **The words never tell the surprise.** A dossier is words, and the machine
  never reads one. A spawn list is rules, and the dossier never reads it.
- **The verb decides, and the machine applies** (invariant 15, one level
  down). A verb reports `sprung`; the machine names the effect; the
  orchestrator spawns.

## Open questions

- **How many pirates is a surprise, and how many is a wall?** M1 starts
  small, and the flight probe measures the death rate after each milestone.
  A side job should kill a fresh commander in about one run in eight, and
  no more.
- **Does M4's regeneration wait for Chris?** Yes. The generator runs through
  the `claude` command line on his machine.

## Watch out for

- **The seeded stream.** A spawn at a scoop draws positions from the world
  stream, as a pirate wave does. Draw once per ship, in a fixed order.
- **A spawn order is not a message.** The bridge returns messages today. A
  second return, or a field on the message, must not make a message
  carry a world change.
- **The lane pirates are untracked**, and so are these. A kill among them
  settles nothing. Say so in the model.

## Verification

The gates always run: `npm run check`.

The tier: a rule that changes how a mission and a fight go. The flight
probe runs after each milestone. The numbers to move:

- a hunt's time to done, from 4 seconds toward a minute;
- the escort's finish rate, to eight of eight, with fights on the way;
- the death rate on a side job, to about one in eight;
- a scoop that springs an ambush, seen in the probe's fight count.

Evidence:

- A real-game test scoops the recover canister and sees the ambush spawn.
- A real-game test parks the commander and sees the charge hold.
- A verb test sends `fled` to a hunt with a branch and reads the branch.
- Chris plays one side job of each kind on his phone.

## What the milestones found

### M1

- **The company lives in `skeletons/lane.ts`**, beside the lane pirates:
  a pair of Sidewinders, a lone Krait, and a wingman of the target's own
  design. A side hunt flies with a Krait wingman. A delivery meets the pair
  at the far end, and a canister adrift has the Krait circling it. The arc
  hunts fly with one of their kind, and the arc deliveries meet the pair.
- **The lint holds a spawned ship to a roster row.** A design with no row
  for its job's role was skipped at the arrival in silence.
- **The flight probe moved.** A side hunt takes 7 seconds, from 4, and an
  Asp hunt 24, from 12. The Asp pair killed a fresh commander in one run of
  eight, which is the rate the open question asked for. A delivery meets
  2.5 fights on the way in, from 1.4. Every other row is as it was.
- **Two tests read the first tagged ship and met the wingman.** Both read
  the leg's own tag now.

### M2

- **The spawn of a tagged ship has one home**, `spawnTaggedShips` in
  `spawning.ts`. The arrival calls it at the mission target's reach, and
  the ambush calls it at a pirate wave's reach.
- **The bridge returns two things now.** `applyMissions` returns the lines
  and the spawn orders, and `runMissions` is the lines alone. Two callers
  hold the world and hear the order: the scoop, and the scan's end.
- **An ambush line queues behind the settlement's own.** THE CANISTER IS
  ABOARD reads first, and THEY WERE WAITING FOR THE CANISTER after it.
  PIRATE SIGNATURES DETECTED is said at once.
- **A laser held on a canister breaks it.** The real-game test flies the
  scoop with no trigger. The flight probe fires only while the computer
  aims, and that is the rule a pilot follows too.
- **The flight probe gained two cases** that go on to the station after
  the scoop, so the ambush is met. A recover meets 2.9 fights on the way
  home, from 1.4, and finishes eight of eight in 149 seconds. A rescue
  meets 1.4 and docks eight of eight. Nobody died.

### M3

- **The charge holds for her.** `holding` on the ship is decided by the
  world step each frame, from `ESCORT_LEASH`, and the working life reads it
  as a speed of zero. The console says THE PYTHON IS HOLDING FOR YOU once,
  through a second latch. The leash derives from the scanner, two thirds of
  it, so a charge that holds is still on her scanner.
- **The fee needs her there.** `escortSafe` asks four things now: the
  charge alive, inside station range, the commander inside that range of
  it, and no enemy inside it.
- **The pirates come with the charge.** A side escort meets a pair of
  Sidewinders at the jump-in, and the two arc escorts meet the lane pirates.
  A pirate goes for the commander first, and the leash keeps her beside the
  charge, so the fight is where the fee is judged.
- **The flight probe moved.** The escort finishes eight of eight in 500
  seconds, with 1.5 fights on the way, from 0.3, and 24 kills over the
  eight. The ship ends with energy 239 and shields 225 and 255.
- **`test/mission-verbs.test.ts` crossed the size ceiling.** The company
  blocks, and the lane block from 203, went to
  `test/mission-company.test.ts`. The four helpers every verb test uses
  went to `test/fixtures.ts`, so the two files share one fixture.
- **M4 waited for Chris.** A branch for a hunted ship that runs needs one
  dossier regeneration, and the generator runs through the `claude`
  command line on his machine. M1 to M3 stand on their own.

### M4

- **The run is one rule in `takeDamage`.** The world step stamps `canFlee`
  on the target of a hunt that `canEscape`, each frame, so a restored ship
  carries it again at once. A hit that leaves the target under
  `HUNT_FLEE_FRACTION` of its energy sets the run. The fighter behaviour
  flies it, straight away from the shot. The ship jumps out
  `TRADER_JUMP_OUT` short of a waypoint `DEEP_TRADER_RUN` out. Nothing ends
  the run.
- **The chase is the co-pilot's.** The mission course picks the target, so
  the computer's aim engages at once, and its throttle matches a target
  that recedes. The course pilot chases at full speed only while no
  co-pilot flies. The row says CHASE, and the console says THE KRAIT IS
  RUNNING FOR IT once.
- **The run makes no difference to the numbers.** A Krait has 82 energy
  points, and the laser reaches 3,500 units. The target spawns 2,500 out,
  so it is under the gun from the first frame. With the trigger held, it
  turns to run at three seconds and dies at 3.8, at a quarter or at half.
  A target that ran from the first frame died at three seconds, 1,700
  units out. The side hunt still takes 7 seconds in the probe, as after
  M1. The results are in
  `docs/reviews/missions-2026-09-12/flight-results-after-214-m4.txt`.
- **So a chase needs a target the gun cannot reach at the arrival**, or one
  that lives longer than four seconds of fire. Both are balance decisions
  outside this plan: the spawn range of a hunt's target, or its hull. The
  rule stands, and the branch is live. A pilot who lets go of the trigger,
  or who fights the wingman first, loses the bounty.
- **Six constants gained a rule id**, because the new fraction repeats a
  quarter five times over.
- **The side hunt's dossier was written again**, because the branch is in
  its hash. Chris ran the generator through `claude -p` with Sonnet 5.

## Outcome

Landed 2026-09-13, in four milestones. Pirates wait at the jump-in, a
scoop springs an ambush, an escort keeps its charge to the commander, and
a hunt's target runs when it is nearly dead. The run moved no number on
its own, because a lone Krait dies inside the laser's reach either way.
Plan 217 made the hunt a gang, and the side hunt's dossier was written
again on the same run. 6,153 assertions.
