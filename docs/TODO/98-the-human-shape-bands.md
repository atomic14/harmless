# 98 — The human-shape bands: a gate on the shape of the fight

**Kind:** verification/gameplay · **Severity:** high · **Size:** medium
**Chris was not in this planning session; Claude decided the shape below,
from the reconnaissance recorded here.**

## Where we are

The reference human fight (docs/TRAINING-LOG.md, "The reference fight — a
human, 215 seconds, six kills") measured the shape a good fight has: pirates
within laser range **95%** of the time, lined up on the player **5%** of the
time, mean facing error 79.7°, and the log's conclusion that the balance
rests exactly there — *"Doubling how often pirates point at the player kills
him"*, and the opposite failure is on record too (*"the ships didn't do
anything"*). The damage-model change of 2026-08 staled every hp and damage
figure; the log states the SHAPES transfer and the numbers do not.

Nothing asserts any of this. `train/flight-probe.ts` measures the right
signals but says of itself "NONE OF THESE IS A GATE", and no test anywhere
pins a lined-up share, an in-range share or a pass count over a flown fight.
Two mutation findings make the gap concrete: TODO 76's behaviour change moved
zero assertions, and the closest existing shape check is one inequality in
`test/pursuit.test.ts`.

**The design-deciding fact:** the training `Episode` drives `brainFly`/
`attack` only — it cannot fly `pursuit`, the pilot every shipped pirate uses
(`src/ai-training/scenario.ts:834-844`). A gate built on `Episode` measures
the A/B control and would stay green while the real fight turned into a
turret. `test/pursuit.test.ts:105-117` already flies a real `NpcShip` under
`{ pursuit: true }` against a hand-driven player object; that is the pattern
to scale.

## What to do

1. **A fixture that flies what ships.** Real `NpcShip`s flying `pursuit`
   through `update()` against hand-driven player stand-ins, seeded from a
   fresh held-out base (distinct from every base in the project — grep for
   the existing ones first), episodes a bounded number of seconds. Put it
   somewhere findable with a header saying what it is for — TODO 89 wants to
   reach for the same fixture later.
2. **Measure through the recorder, not new arithmetic.** Feed a standalone
   `CombatSimRecorder` one `FrameSample` per tick, the way
   `train/flight-probe.ts:163-206` does. `linedUpShare`, `onSixSeconds`,
   `countPasses`, range percentiles and both accuracies already live in
   `src/game/combat-sim-report.ts` with their constants
   (`NPC_FIRE_GATE`, `SIX_CONE`, `PASS_CLOSE`/`PASS_FAR`) — that is their one
   home; the fixture computes none of it.
3. **Two stand-ins, two labeled rows, never compared to each other**
   (TODO 84's trap, avoided by construction):
   - a **knife-fighter** — turns hard to face, barely translates; how the
     recorded human flies. This exercises the slashing mode.
   - a **translating target** — moves flat out and presents a tail. This
     exercises hold-six, the mode the knife-fighter makes structurally
     unreachable.
   These stand-ins are the fixture's own; do NOT touch `holding`/`weaving`
   in `src/ai-training/scenario.ts` — four probe columns are calibrated
   against them.
4. **Baseline before bands.** Run the fixture at two sizes (of the order of
   40 and 160 episodes) and confirm the numbers agree before any band is
   set; record both runs in this doc. The human figures justify WHICH
   quantities are banded and which side of each band is the dangerous one —
   they do not supply the values, because the stand-in is not Chris.
5. **Bands, two-sided, on properties not totals:**
   - **lined-up share**: a ceiling (a pirate that tracks the player kills
     the accidental balance the game rests on) AND a floor (a pirate that
     never lines up is "the ships didn't do anything");
   - **mean speed** above the turret floor, **range spread** not collapsed,
     **passes per episode** above zero — the fight keeps moving;
   - **in-range share** above a floor — they are in the fight, not standing
     off.
   Bands wide enough that a deliberate combat retune can re-baseline them
   confidently — TODO 89: a test nobody can re-baseline gets deleted.
6. **Break every band once** and record which mutation each caught —
   mutation-sweep style: pin the throttle to the floor (turret), stop the
   break-off (tracker), make the pirate passive (floor edges). Restore each.
7. **One line in `test/run.ts`** ("ships, and being shot at" block;
   `audio.test.ts` stays last). Total added runtime in the order of a
   second — `test/ai.test.ts`'s 60-episode precedent; `npm test` is ~5s
   today and stays that shape.

## Decisions already made

- The gate flies `pursuit` through real `NpcShip.update()` — not `Episode`,
  which cannot express it.
- Recorder definitions are the one home for every measured quantity.
- Bands come from a two-size baseline plus the human-shape rationale;
  assertions are inequalities on shares and counts, never exact totals.
- Rows are per-stand-in and labeled; no cross-row comparison, no shared
  band values.
- The two on-six definitions (`Episode.tailTime` vs the recorder's
  `SIX_CONE`) are different quantities; this gate uses the recorder's and
  never conflates them.

## Watch out for

- `src/constants/` in full before adding anything — the pursuit and
  recorder constants that already exist are exactly the ones this touches.
- The 400-line file ceiling (`tools/sizes.mjs`) applies to the fixture.
- A pair-of-pirates row is welcome if it stays inside the runtime budget;
  it is not required.
- No game code should need to change. If the fixture forces a real change
  in `src/game/`, stop and say so rather than making one quietly.

## Verification

- `npm run build` and `npm run elite-a` green; the new file runs inside
  `npm test` (which build runs) — no new command to remember.
- The two-size baseline recorded in this doc, with the sizes and seeds.
- Every band broken once, each break named here with the mutation that
  tripped it and the band that went red. A band no mutation can trip does
  not ship.
- No gameplay change is intended, so no flown check is owed; the campaign
  is untouched by construction.

## Outcome

(recorded when the cycle closes)
