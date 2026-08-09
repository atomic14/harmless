# 101 — One home for the frame sampler, and a name for the seed stride

**Kind:** architecture/test infrastructure · **Severity:** medium · **Size:** small
**Found by** the code-review pass on 98 (2026-08-09). Deliberately deferred
from that cycle because both fixes are src/-side refactors and 98's handoff
forbade game-code changes.

## Where we are

1. **The FrameSample/contact builder has three hand-rolled copies** —
   `combat-sim.ts:812-841`, `flight-probe.ts:189-206`, and 98's
   `test/human-shape.test.ts` — building the same block (dist, speed,
   theirAim/yourAim via `aimAngle`, doing via `describeFlight`), and they
   have already drifted: flight-probe omits `describeFlight`'s sixth
   `breaking` argument while the other two pass it. The pooling rules
   (passes summed per episode, ranges/speeds pooled) are copied alongside.
   The one home is an exported sampler/pooling helper beside `FrameSample`
   in `combat-sim-report.ts`; the three call sites then shrink to it.
2. **The seed stride 7919 is hardcoded at 16 sites** across test/ and
   train/, none in `src/constants/`, and seed bases are chosen partly so
   strided sequences stay disjoint — a convention holding by copy-paste. A
   `SEED_STRIDE` constant (or a `probeSeed(base, episode)` helper) with the
   disjointness reasoning beside it is the home; migrate the sites to it.

## Watch out for

- The flight-probe drift (missing `breaking` argument) is latent only
  because its `Episode` cannot fly pursuit, so nothing breaks off there
  today. Unifying the sampler changes what its `doing` strings would say if
  that ever changes — that is the point, not a regression.
- Migrating 16 stride sites is mechanical but must not change any seed
  VALUE — prove equivalence: same seeds before and after, byte-identical
  probe output on one run each.

## Verification

- One sampler home; the three call sites import it; `npm run build` green.
- Seed values provably unchanged (diff a captured seed list per site).
- 98's gate output byte-identical before/after the refactor.

## Outcome

(recorded when the cycle closes)
