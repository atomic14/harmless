# 209 — The torus drive says what stopped it

**Kind:** bug · **Severity:** medium · **Size:** small · **Depends on:** 205 ·
**Blocks:** nothing · **GitHub:** none

## Where we are

**Chris flew a trip to the station and reported a fault** (2026-09-12:
*"Jumping to the station did not seem to mass lock on neutral traders."*).

**The rule does fire.** `massLocked()` in `game/world-step.ts` drops the torus
drive within 4,500 units of any live ship that is not a rock. A measurement of
2026-09-12 put a stationary trader on the line to the station. The drive
dropped at 4,457 units. Over 20 trips, a trader was inside the lock radius at
9 of 36 stops.

**Two things hid it from the pilot.** The first is the message. It said `MASS
LOCK — TORUS DISENGAGED`, which names nothing. A pilot cannot tell a trader
from a rock hermit from the planet.

The second is the drive itself. The drive is off for about 240 seconds of a
290 second trip. The course brakes towards the station with the drive off, and
that is where the traffic is. So of 26 trader passes inside the lock radius
over 20 trips, only 7 dropped a running drive. The other 19 were silent.

**Chris wants a neutral ship to be a chance, not an event.** His words in the
design document of 2026-09-11: *"When anything is in range we should show a
list of objects that can be engaged - these can be outright hostiles or neutral
ships that we want to pirate."* The target list of 206 already holds every ship
in scanner range. The pilot had no reason to open it.

## What to do

**M1 — the drop names what stopped the drive.**

1. Add `massLockCause(state)` to `game/world-step.ts`. It returns the player's
   own words for the nearest thing that holds the drive down, or null.
2. Make `massLocked(state)` a wrapper over it, so the rule keeps one home.
3. Change the drop message to `TORUS DRIVE OFF — <what> IS TOO CLOSE`.
4. Change the flight key refusal the same way. It said `MASS LOCKED`.
5. Name a ship with `shipName()`, which `game/targets.ts` owns. The list and
   the message must not use two words for one ship.

**M2 — a neutral trader that comes close says so.**

1. Add `game/close-pass.ts`. It returns one line for each trader that comes
   inside `MASS_LOCK_SHIP` and was not announced yet.
2. Hold the flag on the ship, as the target pick is held (`NpcState`).
3. Clear the flag past `CLOSE_PASS_CLEAR`, so a wobble across the radius does
   not repeat the line.
4. Push the lines from `stepNpcs`, which is the orchestrator (invariant 15).
5. Say it in the manual.

## Decisions already made

- **A neutral ship must not stop the ship.** The pilot chose the course. The
  line tells the pilot that the chance is there. Chris's rule of 2026-09-11:
  the pilot owns the target choice.
- **The line names a trader, and no other role.** A hostile ship announces
  itself, by its guns and by the condition light. The law's ships are a risk
  rather than a chance. A line that invites an attack on a Viper beside the
  station is bad advice.
- **Nothing speaks inside the station's mass lock.** The pilot is on the
  approach there, and the traffic is thick.

## Open questions

None.

## Watch out for

- **The count of lines.** A line for each pass would be noise. Measure it.
- **`massLocked` has three readers**: the flight keys, the step and the
  harnesses through `window.__game`. The wrapper keeps all three.

## Verification

1. `test/world-step.test.ts` pins the named cause for the station, the planet,
   a trader and a clear sky.
2. `test/close-pass.test.ts` pins one line for each approach, the roles that
   get none, and the flag that clears.
3. A probe over 20 trips to the station counts the lines a trip shows.

## What the milestones found

**M1 — the lock did fire, and it said nothing useful.** Three measurements of
2026-09-12, before any change:

| measurement | result |
| --- | --- |
| a stationary trader on the line to the station | the drive dropped at 4,457 units |
| traders inside the lock radius at a stop, over 20 trips | 9 of 36 stops |
| trader passes inside the lock radius, over 20 trips | 26 |
| ...of those, passes that dropped a running drive | 7 |

So 19 of 26 passes were silent, because the drive was already off. The drive
runs for about 50 seconds of a 290 second trip.

**The name comes from `targets.ts`.** `shipName()` and `shipArticle()` moved
out of `targetList()`, so one ship reads the same on the list and in the
message. A message said `A OPHIDIAN` before the article rule existed.

**M2 — the first shape was too loud.** A line for every neutral ship inside
the radius gave a median of 6 lines per trip, and a maximum of 10. The law's
ships were half of them, beside the station. The rule now names a trader
only, and it says nothing inside the station's mass lock. That is a median of
1 line per trip, and a maximum of 3, over the same 20 trips.

**A ship the pilot already chose gets no line.** `test/law.test.ts` caught it:
the commander shot a trader, and the console answered with an invitation to
attack it. The rule now skips a ship that carries the target pick, and one the
commander already shot at.

## Outcome

Landed on 2026-09-12. `npm run check` passes, with 5,871 assertions.

- The torus drive names what stopped it, in the player's words.
- The flight key refusal names it too.
- A neutral trader that comes close is announced one time.
- The manual says both.
