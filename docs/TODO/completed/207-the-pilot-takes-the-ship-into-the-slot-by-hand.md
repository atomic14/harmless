# 207 — The pilot takes the ship into the slot by hand

**Kind:** enhancement · **Severity:** medium · **Size:** medium · **Depends
on:** 205 · **Blocks:** nothing · **GitHub:** none

## Where we are

**205 flies the ship to the station, and then the docking computer takes it in
for free.** That is a stopgap. Chris's words in `MOBILE_CONVERSION.md`:
*"Unless you have the docking computer, we still want this to be a challenge. We
should have the computer line you up so that you are facing the docking port,
but then we should have the user try and match the roll of the station and the
speed of docking."* He also wrote: *"Potentially, we could have a completely
different display for this. Let's think outside the box."*

**The dock today checks the position and the roll, and no speed.**
`dockingOutcome` in `docking.ts` returns `hull` for a ship that meets the
station outside the slot. It returns `slotMiss` for a ship in the slot with its
roll off by more than `ROLL_TOLERANCE`. Either one costs the same
(`world-step.ts`):

- a scrape of 230 points, which is 90% of one shield face;
- a bounce out to 420 units, at a speed of zero.

**The numbers that a trial plays against:**

| quantity | value |
| --- | --- |
| the station's spin | 0.26 rad/s, one turn in 24 s |
| the roll tolerance | 0.65 rad, which is 37° |
| the slot | 124 × 52 units |
| the docking computer's range | 3,500 units |

**Four concepts are playable.** They are on a private page that Chris can open
on his phone:
<https://claude.ai/code/artifact/f585afce-8974-46fe-a688-4ea120139eb1>. Each
concept runs on the numbers above. Each one starts 1,500 units out, and each
one uses the scrape and the bounce of today.

| concept | the hands | what the pilot judges |
| --- | --- | --- |
| Match the spin | two thumbs: a roll strip and two held buttons | the roll rate and the speed at once, as in 1984 |
| Stop the sweep | one thumb, four taps | the moment. The computer sweeps the roll, and a tap stops it level. A rough stop adds speed to the final run |
| Stir | one thumb on a dial | the angle of the thumb is the roll, and its distance from the centre is the speed |
| Gate tunnel | one thumb as a stick, over a new display | a line of gates shows how the slot will sit at contact |

**Chris picked Match the spin on 2026-09-11.**

## What to do

Four milestones.

### M1 — the computer lines the ship up, then hands over

The station course of 205 flies the ship onto the slot axis, as the docking
computer does today. `dock-path.ts` owns that curve. At the hand-over range,
the course stops, and the trial starts. The page starts the trial 1,500 units
out, and that is the first value to try. A ship with a docking computer never
stops. It flies in, as it does today.

### M2 — the pilot matches the spin

During the trial, the computer holds the ship on the slot axis. The pilot owns
two axes only: the roll and the speed. The slot stands still in the view when
the ship's roll rate equals the station's spin.

The controls on a touch screen are these:

- **The roll strip** fills the left of the bottom edge. The offset of the thumb
  from where it landed sets the roll rate. When the thumb lifts, the roll rate
  goes back to zero.
- **THRUST and BRAKE** are two held buttons on the right. With neither held, the
  ship keeps its speed.

On a keyboard, the roll keys and the speed keys of today feed the same two
axes. The trial shows three readouts: the range, the speed against the limit,
and the roll error in degrees.

The control reports a `FlightDemand` for the roll and the speed.
`PlayerShip.update` flies that demand, as it flies every other seat.

The page used three values, and they are starting points only:

| value on the page | meaning |
| --- | --- |
| 0.8 rad/s | the roll rate at full travel of the strip. The spin then sits at a third of the travel |
| 70 u/s² | the thrust while THRUST is held |
| 90 u/s² | the braking while BRAKE is held |

Run `npm run constants:find` for each one before it becomes a constant. The
player's own flight envelope in `PLAYER_FLIGHT` is the likely owner.

### M3 — the slot checks the speed

A ship that meets the slot too fast scrapes and bounces, as a rolled ship does.
The page proposes 120 u/s. `dockingOutcome` gains the check, and the console
names the cause: the roll, or the speed.

**`LAUNCH_SPEED` is also 120, and the two rules are independent.** A new
constant for the slot takes its own `@rule` ID. Run `npm run constants:find`
first, for "dock speed", "slot speed", "approach speed" and "120".

### M4 — the manual says how to dock

Rewrite the manual's docking section, and the briefing's.

## Decisions already made

- **A failed dock scrapes and bounces, and the pilot tries again** (Chris,
  2026-09-11). That is the rule of today.
- **The docking computer skips the trial** (Chris, `MOBILE_CONVERSION.md`).
- **Chris wants to see options before a pick** (Chris, 2026-09-11). The page
  above holds them.
- **Match the spin is the trial** (Chris, 2026-09-11: *"Match the spin is
  good."*). The other three concepts stay on the page as a record.

## Open questions

None.

## Watch out for

- **The NPC traders share the dock.** `docking.ts` serves both the traders and
  the docking computer. The speed check of M3 must not bounce a trader. The
  NPC hull margin is already separate, and the speed check follows the same
  split.
- **`dock-probe` and `dock-traffic` measure the dock.** Both run before M3 and
  after it.
- **The trial must not fight the course pilot.** One seat flies one frame.
- **THRUST and BRAKE are held buttons.** They need `Input.press` and
  `Input.release` from 204 M1. 205 M1 keeps that pair for this reason.
- **The roll strip must give fine control near the spin.** At 0.26 rad/s, a
  small error drifts the slot 37° in a few seconds. Try a curve on the strip
  that is flat near the centre, if a linear strip feels too coarse.

## Verification

The gates always run: `npm run check`. `npm run generate:constants` runs first,
because M3 adds a constant.

The tier: a rule that changes how a dock goes. `npm run dock-probe` and
`npm run dock-traffic` run once after M3.

Evidence:

- A test pins the speed check on both sides of the limit, for the player, and
  shows that a trader is not bounced.
- A test drives the control of M2 headlessly into a clean dock, and into a
  bounce for each cause.
- Chris docks on his phone.

## What the milestones found

### M1 and M3

- **The hand-over depends on the ship's kit.** With a docking computer fitted,
  the course hands over at that computer's own range, 3,500 units, and it
  flies the slot as it does today. Without one, the course flies on to 1,500
  units and hands the ship to the pilot.
- **The pilot's stretch is the docking computer's plan with two sticks given
  back.** The computer holds the ship on the slot axis, which is the pitch.
  The pilot owns the roll and the throttle. So the ship follows the same curve
  to the letterbox, and the last of the manoeuvre is the pilot's.
- **The stretch ends where it began.** A ship outside the docking computer's
  range is off the approach. The stretch then ends, and the course list offers
  the station again.
- **The slot now checks the speed, and it is one answer.** `dockingOutcome`
  takes the speed and returns `tooFast`, beside `slotMiss` and `hull`. A
  caller cannot hold half of the rule. The console says which of the three it
  was.
- **The docking computer keeps 10 units a second of room.** Its approach
  settles at 110 against the limit of 120. The dock probe docked 504 of 504
  approaches with no scrape after the change.
- **Two course tests pinned the free dock of the 205 stopgap.** They fit a
  docking computer now, and a new block flies the hand-over to the pilot.

### M2

- **The roll strip is a third platform seam**, beside the click and the held
  button. `engine/strip-control.ts` reads how far a pointer is from the
  strip's middle, and reports a stick between -1 and 1. A roll key beats it,
  as a key beats the mouse.
- **The strip moves its own knob.** The painter rebuilds the buttons only when
  their words change, and a knob moves every frame a thumb does.
- **The guns wait during the stretch.** The slot asks for two things, so the
  pilot's buttons are the strip, THRUST and BRAKE, and nothing else.
- **The speed bar carries the slot's limit as a mark.** It is placed from the
  rule itself, so the mark cannot drift from what the slot takes.
- **The label over the view says MATCH THE SLOT — GO IN SLOWLY** while the
  stretch runs.

### M4, and what the browser run found

- **The manual and the briefing teach the stretch.** The ship flies the
  approach, hands you the slot, and you match the spin and the speed. Both
  say that a scrape bounces you clear to try again, and that a docking
  computer flies the slot for you.
- **The course list showed during the stretch, and it should not.** The ship
  is in the station's mouth, and the only things to fly are the roll and the
  speed. The cockpit shows no course buttons while the stretch runs.
- **The hand-over at full speed was unfair, and the course now brakes.** The
  station course arrives at the hand-over on the arrival plan, at the slot's
  own limit. It was measured over 25 systems with a clear sky. The hand-over
  comes at 224 to 228 u/s, about 40 s after the arrival, with 1,500 units
  left. That is half a second of braking, and the rest is the roll.
- **The hand-over is a range rather than an arrival.** An arrival also waits
  for the speed to settle. A ship a few units a second over it sailed past the
  station and into the hull.
- **A fight now stops a trip, and that is the design.** A measurement with the
  arrival's traffic left 8 of 20 trips short of the station, because the
  computer lines the ship up and nobody fires. A pilot fires, runs or pays.
  With a clear sky, 40 of 40 trips reached the hand-over.
- **The speed bar's mark needed to be a different colour.** It is green over
  the amber fill, so it reads at any speed.

## Outcome

207 landed on 2026-09-11. The station course flies the approach and hands the
pilot the last 1,500 units, at the speed the slot will take. The computer holds
the ship on the slot axis. The pilot matches the station's spin with the roll
strip or the roll keys, and the speed with THRUST and BRAKE. The slot refuses a
ship that arrives rolled wrong or above 120 units a second, and the console
says which. A scrape bounces the ship clear, and the pilot tries again.

A docking computer still flies the slot from 3,500 units out, and it skips the
stretch. The dock probe docked 504 of 504 approaches with no scrape under the
new speed rule. The suite has 5,820 assertions, from 5,804.
