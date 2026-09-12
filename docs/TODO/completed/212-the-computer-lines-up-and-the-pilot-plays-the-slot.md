# 212 — The computer lines up, and the pilot plays the slot

**Kind:** bug · **Severity:** high · **Size:** medium · **Depends on:** 207 ·
**Blocks:** nothing · **GitHub:** none

## Where we are

**Chris flew 207's docking on a phone and it failed** (2026-09-12: *"I'm
testing on mobile. The docking does not seem to work at all."*). The touch
input was not the fault. His own diagnosis, the same day: *"lining up is not
actually very accurate until the last few moments. So we aren't actually flying
straight and rolling can send you off away from the slot. We may need a
different solution."*

**He is right, and the numbers are large.** A measurement of 2026-09-12 flew
the station course headless, then took over with an ideal pilot:

| at the hand-over | value |
| --- | --- |
| range to the station | 1,494 units |
| speed | 224 to 228 units a second |
| distance off the slot axis | 407 to 886 units |

The slot channel is 26 units across the half-width. So the pilot took the ship
hundreds of units off the line, at twice the speed the slot accepts.

**One stick has two jobs, and that is the root of it.** The ship has no yaw
axis, so a roll is how it aims. The slot wants that same roll for something
else: the wings lined up with the letterbox. `docking-sticks.ts` reconciles the
two for the docking computer. 207's split could not, because the pilot held the
roll and the computer held only the pitch. Every roll the pilot made turned the
computer's correction into a new direction.

**Measured over four seeds, the same approach, two pilots:**

| pilot | docked |
| --- | --- |
| matches the spin, and brakes | 0 of 4 |
| brakes only, and never rolls | 2 of 4 |

**Chris asked for a different shape** (2026-09-12): *"I'm wondering if we
actually get lined up by the computer and then hand off to a 'mini' docking
game. Something that is completely on rails."*

## What to do

**M1 — the pilot's stretch becomes two stages.**

1. The computer lines the ship up, with both sticks, exactly as the docking
   computer does. The pilot sees LINING UP, and has no controls.
2. The rails then take the ship. They hold it on the slot axis and point it
   down the axis. The pilot has the roll and the throttle, and nothing else.
3. The slot's own test is unchanged: the wings inside `ROLL_TOLERANCE`, and the
   speed under `SLOT_SPEED_LIMIT`.
4. A scrape lets the rails go, so the computer lines the ship up for another
   go. That is the retry Chris asked for on 2026-09-11.

**M2 — the rails are their own module**, `game/dock-rails.ts`. It is the one
file in the game that moves the commander's ship other than by flying it.
`test/docking.test.ts` scans for that, and it names the file.

## Decisions already made

- **The computer does the lining up.** Chris asked for it in those words.
- **The pilot keeps the roll and the speed.** Match the spin was his choice of
  2026-09-11, and the rails are what make it possible.
- **The rails pull, and never snap.** A snap is a teleport.

## Open questions

None.

## Watch out for

- **The game must not be over before it starts.** If the rails take the ship
  200 units out, the pilot has two seconds and nothing to do.
- **`world-step.ts` must not turn the ship by hand.** That rule is docs/TODO/126
  and `test/docking.test.ts` holds it.

## Verification

1. The whole game, flown headless: the course, the lining up, the rails, and a
   pilot's hand on the strip.
2. The control: a pilot who never touches the strip.
3. The length of the mini game, in seconds and in units.

## What the milestones found

**The rails take the ship 645 units out, at 107 units a second.** That is about
six seconds of mini game. The station turns 1.6 radians in that time, and the
slot is 1.3 radians wide, so the pilot must follow the spin rather than wait.

**The measurements, over eight seeds:**

| pilot | docked |
| --- | --- |
| matches the slot | 8 of 8 |
| never touches the strip | 3 of 8 |

The three are luck rather than skill. The slot fits either way up, so it is
lined up about two turns in five.

**The retry works.** A pilot who fluffs the slot scrapes, and the computer
lines the ship up again. Two of six seeds docked on the second go.

**The rails start with 210 to 240 units of error, and they close it.** The
first frame moves the ship 7 units across the line. The error is gone in about
two seconds, well before the mouth.

## Outcome

Landed on 2026-09-12. `npm run check` passes.
