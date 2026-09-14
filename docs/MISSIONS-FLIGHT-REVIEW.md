# The ship finishes every job, and the job is over before the player arrives

Review date: 13 September 2026. Source revision: `cb7785b`. Part two of
[`MISSIONS-REVIEW.md`](MISSIONS-REVIEW.md), which reviewed the machine and its
data. This part asks two questions about the flight. Can a player succeed? Is
it fun?

**The mechanisms are there.** A fresh commander with a pulse laser can finish
every one of the eight kinds of job with the ship's own automation. The sky
is as shipped, with ordinary traffic. The probe flew each kind eight times and
finished 92 runs of 96. The four that did not finish are all escorts.

**The fun is the problem.** A hunt is over in four to thirteen seconds. The
target comes to the commander, the computer aims, and a pulse laser kills a
Krait before the arrival line leaves the console. Five of the eight kinds
resolve in under thirty seconds with no decision in them. Every leg then ends
with the same two-minute flight to the station. The escort is the one long
job, and it is long because a Python is slow. No production code changed
during this review.

## Scope and measurement

Two probes sit beside part one's in
[`reviews/missions-2026-09-12/`](reviews/missions-2026-09-12/).

[`flight-probe.ts`](reviews/missions-2026-09-12/flight-probe.ts) runs a real
headless game. A fresh commander holds one live leg whose work is in the
system the commander arrives in. Ordinary traffic stays in the sky. The probe presses
the job's own button. It holds the trigger while the computer aims. It
presses the button again when a fight dropped the course. It presses the
docking computer when the station course hands over. Scoops are fitted for a scoop.
A docking computer is fitted for a leg that ends at the station, because the
probe has no hands for the slot. Each kind is flown eight times, on eight
different days, so the arrival seeds eight different skies. The output is
[`flight-results.txt`](reviews/missions-2026-09-12/flight-results.txt).

[`escort-probe.ts`](reviews/missions-2026-09-12/escort-probe.ts) traces the
escort runs that stalled, ten seconds at a time. The output is
[`escort-results.txt`](reviews/missions-2026-09-12/escort-results.txt).

The numbers below are sim seconds from the end of the arrival. They do not
include the jump, the tunnel, or the slot.

| job | done | failed | dead | stalled | time to done | fights on the way | ship after |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| hunt a Krait | 8 | 0 | 0 | 0 | 4 s | 1.0 | full |
| hunt a Cobra Mk III (Lave arc) | 8 | 0 | 0 | 0 | 4 s | 1.0 | full |
| hunt a Fer-de-Lance (Xeer arc) | 8 | 0 | 0 | 0 | 8 s | 1.0 | fore shield 162 of 255 |
| hunt an Asp (Edle arc) | 8 | 0 | 0 | 0 | 12 s | 1.0 | fore shield 105 of 255 |
| hunt the Constrictor | 8 | 0 | 0 | 0 | 62 s | 1.0 | energy 213, shields 130 and 219 |
| scan an Anaconda for 20 s | 8 | 0 | 0 | 0 | 24 s | 0.1 | full |
| escort a Python to station range | 4 | 0 | 1 | 3 | 497 s | 0.3 | full |
| scoop a canister | 8 | 0 | 0 | 0 | 14 s | 0.3 | full |
| scoop a pod | 8 | 0 | 0 | 0 | 13 s | 0.1 | full |
| clear the lane, then dock | 8 | 0 | 0 | 0 | 130 s | 3.1 | full |
| deliver: fly to the station and dock | 8 | 0 | 0 | 0 | 125 s | 1.4 | full |
| smuggle: slip past the police and dock | 8 | 0 | 0 | 0 | 116 s | 2.6 | full |

A first batch of the smuggle run, before the days were varied, was scanned in
two runs of eight. The second batch was scanned in none. So the police read
the hold in about one run in eight.

## What a job costs the player, in time

A job has six parts, and only one of them is the job.

1. **The offer.** The MISSIONS screen lists the title, the briefing pages,
   the patron and the fee. One button accepts.
2. **The chart.** A diamond marks the world. The readout under the cursor
   says how many days away it is. A launch with no destination is refused.
3. **The jump.** The countdown is five seconds, and then the tunnel.
4. **The job.** The arrival line says where the target is, in units and a
   bearing. The first course button says what to do about it, in the job's
   words. Four to twenty-seven seconds pass, and the console says the leg
   moved.
5. **The station.** The station is 62,000 to 82,000 units from the
   witchpoint. The station course takes 95 to 145 seconds, and one to three
   pirate waves drop it on the way. Fast forward runs eight times faster
   while no hostile ship is near.
6. **The slot.** A commander without a docking computer matches the
   station's roll and the speed by hand. A docking computer costs 1,500
   credits.

So a side job is about two minutes of flight with a few seconds of job in
it. The escort is the one exception, at eight and a half minutes.

| job | pays | the job's own seconds | seconds to the station |
| --- | ---: | ---: | ---: |
| hunt | 800 Cr | 4 | 125 |
| ambush | 600 Cr | 0, and the lane fight on the way | 130 |
| smuggle | 700 Cr | 0 | 116 |
| escort | 600 Cr | 497 | 0 |
| rescue | 500 Cr | 13 | 125 |
| recover | 400 Cr | 14 | 125, and the origin world after |
| deliver | 300 Cr | 0 | 125 |
| scan | 250 Cr | 24 | 125 |

A Cobra with twenty tonnes clears about 200 credits on a good trade jump. A
hunt pays four of those for one jump. The pull is strong. Part one found
that each side job is offered one time per career, so the pull stops after
eight jobs.

## 1. High priority: a hunt is over in seconds, and nothing threatens the ship

**Evidence:** the table above, [`mission-course.ts`](../src/game/mission-course.ts),
[`flight-course.ts`](../src/game/flight-course.ts),
[`autopilot.ts:168`](../src/game/autopilot.ts#L168).

The target spawns 2,500 to 4,500 units from the witchpoint. It is a pirate,
so it turns to attack the commander. The mission course picks it as the
target, the computer engages by itself, and the aim holds it in the sights.
The probe holds the trigger. A Krait dies in four seconds and a Cobra Mk III
in four. An Asp, the fastest and best-armed hull an arc names, dies in
twelve. The ship ends every hunt with full energy, and only the Asp and the
Fer-de-Lance mark a shield.

The Constrictor is the same story, one minute long. The gun warning says a
pulse laser needs 115 unbroken hits, and it is right. It does not matter.
The computer's aim gives 115 unbroken hits in a minute, and the ship ends
with energy 213 and shields 130 and 219.

The warning itself is wrong on every other hunt. `huntWarning` says TARGET
ARMOUR HALVES LASER FIRE for any target where a military laser scores more
than the fitted one. That is every ship, so every side hunt and every arc
hunt says it. Only the Constrictor halves a hit.

**What this means for the player.** The hunt was the 1984 game's whole
content. Here the decision is one press, and the outcome is never in doubt.
A pilot who holds the trigger cannot lose a hunt with the starting gun.

**Recommended changes.** The fight has to be the content, or the hunt has to
be a chase.

- A hunted ship does not come to the commander. It runs, and the commander
  runs it down. Part one found that a pirate never leaves the system, so the
  escape branches the skeletons already carry are dead. A target that CAN
  leave makes the four seconds count.
- A hunted ship flies with company. The lane already spawns three pirates
  beside a job, and that job is the one with a fight in it.
- The tier tables that scale ordinary pirates to the commander's standing
  can scale a mission target too.
- The warning names the Constrictor's halving on the Constrictor alone.

## 2. High priority: the escort's charge flees for ever, and the course follows it into the planet

**Evidence:** [`escort-results.txt`](reviews/missions-2026-09-12/escort-results.txt),
[`npc.ts:793`](../src/game/npc.ts#L793),
[`npc-trader.ts`](../src/game/npc-trader.ts),
[`world-step.ts:590`](../src/game/world-step.ts#L590),
[`course-pilot.ts`](../src/game/course-pilot.ts).

Three escorts of eight stalled, and one killed the commander. The traces
show one cause. A trader that takes a hit from anybody sets `fleeing`, and
nothing ever clears it. A fleeing trader runs from the point of the hit at
full speed for the rest of its life. It never returns to its working life. So it never comes inside station range, and the leg never ends.

Seed 1 met a pirate wave at fifty seconds. The charge took a hit in the
crossfire. From sixty seconds to six hundred it flew at 160 units a second. It went
between 34,000 and 39,000 units from the station, and back. The commander
was 370 units behind it.

Seed 2 met nobody. At twenty seconds the commander's fore shield was 165 of
255 and the charge was fleeing. The escort course rammed it. The course
flies to a standoff of 600 units at the charge's own speed, and the approach
overshoots into the hull. A ram is a hit from the commander, so the charge
fled from the commander, and it fled for 580 seconds more.

Seed 5 ended with CRASHED INTO THE PLANET at 559 seconds. The ship had full
energy and full shields, 80 units above the surface at 89 units a second. The
fleeing charge flew through the planet, because a ship does not crash. The
escort course aimed 600 units short of it. The course steers round the
planet on the way to a target. It does not refuse a target that is below
the clearance altitude.

The four escorts that finished took 464 to 559 seconds. A Python flies to
the station at 136 units a second, and the station is 72,000 units away.
That is eight and a half minutes beside a ship that needs nothing from the
commander until something shoots it. Fast forward would cut it to about a
minute, and nothing on the screen says so.

**Recommended changes.**

- `fleeing` clears after some seconds with no attacker alive and no shot
  fired. A trader that was hit once should go back to work.
- The escort standoff cannot ram. The approach speed near the charge is
  capped, as the collect course caps its own.
- A course refuses a target below the planet's clearance altitude, and says
  so, rather than fly the commander after it.
- The charge waits for the commander, or moves only while the commander is within some
  distance. Plan 208 named this fault and left it. Until then the escort is
  a job the commander watches.
- The charge starts nearer the station, or flies at the commander's pace, so
  the leg is two minutes rather than nine.

## 3. Medium priority: the tour opens with a job a new commander cannot fly

**Evidence:** [`lave.ts:29`](../src/missions/skeletons/arcs/lave.ts#L29),
[`side.ts`](../src/missions/skeletons/side.ts),
[`course-actions.ts:220`](../src/game/course-actions.ts#L220),
[`shop.ts:57`](../src/constants/shop.ts#L57).

A new commander starts with 100 credits, a pulse laser and no fuel scoops.
Fuel scoops cost 525 credits at a world of tech level five or more. Three of
the eight side jobs are a scoop, and so is the first leg of the Lave arc. The
Lave arc has no gate, so its hail is the first thing a new commander hears at
Lave. The commander accepts it, jumps, and reads NEEDS FUEL SCOOPS on the one button
that matters. The row is honest, and the arc holds a slot for thirty days.

The arc has a way round. A canister shot before the scoop turns the leg into
a scan, and then into a hunt. Nothing tells the commander that the way round exists,
and shooting the patron's ledger is not a thing a new player tries.

**Recommended changes.** Gate the arc on the scoops, on a kill count, or on
credits. Or open the tour with a leg that needs nothing: a delivery, a lane,
or a hunt. The recovery can be the second leg.

## 4. Medium priority: every leg is the same two-minute flight to the station

**Evidence:** the second table, [`courses.ts`](../src/game/courses.ts),
[`course-actions.ts`](../src/game/course-actions.ts).

The job is four to twenty-seven seconds. The flight to the station is 95 to
145 seconds, and one to three pirate waves interrupt it. The waves are the
same waves a commander meets with no job. So the play a job adds is a few
seconds at the witchpoint, and the play that fills the time is the ordinary
lane.

The lane job is the one whose content is on the way. Three pirates wait for
the commander, the fight takes the course, and the station is the end. It
finished eight of eight with no death and full shields, so it is not hard.
It is the right shape.

**Recommended change.** Put the job where the time is. A target near the
station, or on the line to it, makes the flight the job. A hunt that starts
when the commander is half way in is a hunt that interrupts something.

## 5. Low priority: the smuggling run is scanned one time in eight

**Evidence:** [`course-pilot.ts`](../src/game/course-pilot.ts),
[`course-clearance.ts`](../src/game/course-clearance.ts),
[`world-step.ts:870`](../src/game/world-step.ts#L870).

The slip course aims wide of every policeman within two scanner ranges, at
4,400 units, outside the 2,600 units a Viper reads a hold at. It worked in
fourteen runs of sixteen. A Viper that spawns on the final approach, inside
the hand-over, still reads the hold. That is a fair risk for 700 credits.
The failure says what the police found, and the machine says the job is
lost.

## 6. Low priority: the scan and the two scoops are short and sure

The Anaconda waits near the station and never leaves. The hold course keeps
it in view, and the count runs. Twenty-four seconds, eight of eight. A
canister and a pod are scooped in thirteen to fourteen seconds, eight of
eight, with scoops fitted. Without them the row says NEEDS FUEL SCOOPS and
refuses. Mechanically these are sound. As content, a scan is twenty seconds
of a number that counts up.

## The words the player reads

The dossiers are good. THE GOVERNOR'S MISSING LEDGER has three briefing
pages in the patron's voice. Each leg has an arrive line, a success line and
a failure line, with the world and the fee in them. KRAIT ON THE LANE
says who asks and what it pays in two sentences. The arrival line says
where the target is, in units and a bearing. The course button says HUNT THE
KRAIT. The console says the count of a scan and the tonnes of a smuggling
load. A player is never lost for what to do next.

Two lines are wrong. The gun warning is finding 1. The hail THERE ARE N
SIDE JOBS ON THE STATION BOARD is said on every dock where any are open. It
hides the patron's messages, which is part one's finding 5.

## Is it fun?

Not yet. The pieces are all present, and each one is sound. Together they
make a loop in which the player decides one thing, and then watches.

- **The decision is the accept.** After it, the player presses the one row
  the situation offers. The commander holds a button while the computer aims. The commander
  presses the station row. No job asks a second question.
- **The threat is gone.** The computer's aim and the auto-engage make every
  fight a matter of the trigger. A fresh commander with a pulse laser
  came through 95 runs of 96 alive, and the one death was a crash. The lane's
  three pirates took nobody.
- **Failure costs nothing.** Standing moves and nothing reads it. A deadline
  is fourteen or thirty days, and a jump is one to three. A failed job is a
  fee not earned.
- **The choice trigger exists and no skeleton uses it.** The machine can
  put a question to the player mid-arc. None of the five arcs does.
- **The travel is the game, and fast forward skips it.** The flight to the
  station is where the pirates are. The job is over before it starts.

**What would make it fun**, in the order a plan would take them:

1. Make the hunt a chase. A target that runs, or that has to be found with
   a scan first, turns four seconds into a pursuit with a scanner.
2. Make the escort about position. The charge moves while the commander is
   near, and stops when the commander is not. Then the escort is the commander's.
3. Ask a question. The `choice` trigger is built and tested. One choice per
   arc, with a consequence the log tells, is a story.
4. Let standing mean something. A patron who remembers a failure offers
   less, or nothing. A patron who remembers a success opens the next arc a
   jump early.
5. Put the job on the way in, not at the witchpoint.

The arcs give the game a spine, and the log tells the path a player took.
The words are there. What is missing is a moment in each job where the
player can get it wrong.
