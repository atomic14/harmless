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
