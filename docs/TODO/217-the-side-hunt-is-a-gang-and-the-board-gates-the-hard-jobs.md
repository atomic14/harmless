# 217 — The side hunt is a gang, and the board gates the hard jobs

**Kind:** enhancement · **Severity:** high · **Size:** medium · **Depends on:**
214 · **Blocks:** nothing · **GitHub:** none

## Where we are

Plan 214 M4 made a hunt's target run when it is nearly dead, and it
measured the result. A Krait has 82 energy points and spawns inside the
laser's reach. With the trigger held it dies four seconds after the fight
starts, whether it runs or not. The side hunt is a four second job.

Chris said, on 2026-09-13: *"rather than a single ship - it should be a
gang of pirates. That will be more of a challenge and also, more
realistic."* Then: *"Let's do it. I think we should make it a tough gang.
I'm also wondering if we should start gating side quests by
equipment/number of kills?"*

What exists today. A hunt leg names one ship, and the machine mints one
entity for it. The leg's `spawn` list adds untracked company, which comes
back on every arrival. A kill among them settles nothing. The board hides
a job whose gate is shut. A gate can ask for kills, a rating, a clean
record, a galaxy, fuel scoops or a finished skeleton. Every side job but
the two scoop jobs is open to a fresh commander.

## What to do

Three milestones. Each is one commit.

### M1 — the hunt counts a gang

- The hunt verb gains `gang`, a list of hulls that fly with the target.
  The machine mints an entity for each at the leg's start, under the leg's
  own tag, so a dead member stays dead across an arrival. The arrival
  spawns the members that live, from the record, as it spawns the leader.
- The verb counts the gang. A kill of the leader or of a member is one
  ship gone, and the console says how many are left. The leg ends when
  every ship is gone. A leader that dies ends it with `targetDestroyed`.
  A leader that ran ends it with `targetFled`, once the gang is gone too.
  The machine marks a ship that fled or jumped out as gone from the
  record, and it says which. So the verb can read the leader's fate.
- The side hunt is a Fer-de-Lance with an Asp, a Krait and a Mamba. Four
  hulls, two missiles, two E.C.M. fits, and 372 energy points against the
  lone Krait's 82. M1 built it with a Cobra Mk III in the Krait's place,
  and M3's probe made the choice. The leader runs at a quarter, as
  M4 made it. The whole gang pays 1,500 Cr. A gang whose leader ran pays
  half, and the console says the leader got away.
- The course row says HUNT THE GANG with the count left. Its target is
  the leader while it lives, and then the nearest member.
- The dossier prompt names the gang, so the prose can too.

### M2 — the board gates the hard jobs

- The gang hunt asks for eight kills. The lane job and the escort ask for
  four. A fresh commander sees the delivery, the scan, the smuggle and,
  with scoops, the two scoop jobs.
- A test walks a fresh commander's board and a blooded one's.

### M3 — the numbers, and the words

- The flight probe flies the gang, and the plan records the time to done
  and the death rate. The probe's commander is fresh, so the rate is the
  worst case.
- Chris writes the side hunt's dossier again. Plan 214 lands on the same
  run.

## Decisions already made

- **A gang, not a lone ship** (Chris, 2026-09-13).
- **A tough gang** (Chris, 2026-09-13). The hulls are the roster's, at the
  top of the pirate list short of the Python.
- **The gang is the Asp, the Krait and the Mamba** (Chris, 2026-09-13),
  from three the probe measured. See M3.
- **The job ends when the lane is clear.** A kill of the leader alone does
  not end it, because pirates still shoot when the station pays.
- **A leader that ran halves the pay.** It keeps M4's surprise, and it
  does not throw away three kills.
- **A shut gate hides the job**, as the Navy's does. A visible row that
  says why it is shut is a better board, and a later plan.

## Open questions

- **An equipment gate?** The facts a gate reads carry the scoops alone. A
  laser or an E.C.M. gate needs a fact each, and a reason on the board.
  Chris raised it, and this plan gates by kills first.
- **Does a fresh commander die on the gang?** Likely, and the gate is the
  answer. M3 measures it anyway.

## Watch out for

- **The dossier hash covers the verb**, so the gang changes it. One run of
  the generator at the end covers this plan and 214 M4.
- **`missionSpawns` puts the `spawn` list back on every arrival.** A gang
  member must come from the record instead, or a dead one returns.
- **The entity clean-up deletes by the skeleton's prefix**, so a member's
  tag must start with the leg's own tag.
- **`test/constants.test.ts` lists the skeleton names** that may hold a
  constant outside `src/constants/`.
- **The world step stamps `canFlee` on the leader alone**, by the live
  leg's tag. A member fights to the end.

## Verification

The gates always run: `npm run check`.

The tier: a rule of the mission machine, a skeleton, and the board.

Evidence:

- A machine test accepts the gang hunt and reads four entities. It kills
  the members in any order and reads the count said each time. It kills
  the leader last and reads the full pay. It lets the leader run, kills
  the rest, and reads half the pay and the leader's fate.
- A real-game test arrives on the gang hunt and reads four tagged pirates
  in the sky. It kills one, leaves, comes back, and reads three.
- A test paints the course row with the count, on the leader and then on
  a member.
- A test reads a fresh commander's board and a blooded one's.

## What the milestones found

### M1

- **The gang is on the verb, and the members are records.** `startLeg`
  mints one entity per member under the leg's tag with `#gang-N` on the
  end. So the end-of-leg clean-up finds them by the skeleton's prefix, and
  `missionSpawns` lists the members that live from the record. A dead one
  stays dead across an arrival, and a real-game test proves it: four at the
  jump-in, one killed, three on the next arrival.
- **The verb reads the record for one thing only**, the leader's fate. The
  machine marks a ship that fled or jumped out as gone and as `fled`, once
  a leg took the word. The Constrictor's verb takes no such word, so the
  Constrictor stays and comes back. The count itself is `progress`.
- **The record holds one mark for a ship that left.** So a leader that
  jumped out early ends the leg through `targetFled`, and the words say it
  ran. Only a leader that jumps out last says it jumped. Both pay half.
- **The row needs the commander's place.** `missionCourse` takes it now,
  so the row can point at the nearest member once the leader is gone.
- **The prompt line changes for a gang alone.** A lone hunt's line is byte
  for byte as it was, so no other dossier drifts.
- **The pay repeats the courier's 1,500 Cr**, so the courier's constant
  gained a rule id.

### M2

- **The gates are two constants**, derived and not typed. The gang hunt
  asks for the kills of the second rung, Mostly Harmless, and the lane job
  and the escort ask for half of that. So the numbers hold their reason.
- **What a fresh commander finds.** Every board holds two or three of the
  eight side jobs from the seed. Under the gates, a Harmless commander
  with no scoops finds 69 of the 256 boards empty. With scoops, 6. At four
  kills with no scoops, 11. At eight kills with scoops, none. The three
  open jobs are on 90, 73 and 60 boards each.
- **Every test and probe that accepts a gated job now carries sixteen
  kills**, and says so. The shared `boardFor` fixture bloods its commander,
  and a test about the gate passes its own kills.

### M3

- **The probe flew three gangs**, each led by the Fer-de-Lance, against
  a stock Cobra with a pulse laser. With an Asp, a Cobra Mk III and a
  Mamba, the commander died six times in eight, and the two that lived
  took 35 seconds. With an Asp, a Krait and a Mamba, three died, and the
  five took 34 seconds. With a Krait, a Cobra Mk III and a Mamba, nobody
  died, the eight took 29 seconds, and the shields ended about half down.
- **Chris chose the middle gang**, the Asp, the Krait and the Mamba. The
  bar from plan 214 was about one death in eight. This gang sits over it
  for a stock ship at eight kills, and the gate is one constant to move.
  The results are in
  `docs/reviews/missions-2026-09-12/flight-results-after-217.txt`.
- **The hunt is a fight now.** The lone Krait took 7 seconds. The gang
  takes 34, and it costs energy and shields.

## Outcome

(filled in at the end)
