# 107 — One fight in the live sky and the trainer

**Kind:** combat fidelity / test architecture · **Severity:** high · **Size:** large
**Consolidates:** 74, 78, 89 and 101

## Where we are

The combat trainer is valuable only when its fight means the same thing as the
live sky. Four open plans describe one missing guarantee:

- no test flies two hostile NPCs through the real `WorldStep`;
- an armed freighter uses a range hit curve in training but a flat coin flip in
  live NPC crossfire;
- every training ram is charged to the target's fore shield, regardless of
  contact geometry;
- the frame sampler is copied three times and already differs, while the probe
  seed stride `7919` is copied sixteen times.

The original measurements and call-chain evidence remain in
[74](retired/74-the-armed-freighter-shoots-straighter-in-training.md),
[78](retired/78-every-ram-in-training-hits-the-fore-shield.md),
[89](retired/89-nothing-flies-npc-against-npc.md) and
[101](retired/101-one-home-for-the-frame-sampler.md).

## Milestone 1 — a live fight that can fail

Build a short seeded fixture that spawns real hostile `NpcShip`s and advances
the real `WorldStep`. Pin properties rather than exact totals: an NPC engages
and damages its target, a bounded fight ends, and a dead target is no longer
attacked. Prove the gate notices a meaningful targeting or crossfire break.

## Milestone 2 — one rule for each contact

- Use the range curve for live NPC-vs-NPC fire, the recorded product decision
  behind TODO 74, and make both worlds read it from one owner.
- Resolve a training ram's shield face from the same geometry as the live game;
  remove the default that silently means “fore”.
- Re-measure the armed-freighter accuracy and ram-face samples. State which old
  training figures are no longer comparable; do not pretend retired trained
  policies must be rebuilt.

## Milestone 3 — one measurement vocabulary

Move FrameSample construction and pooling beside `FrameSample` so the trainer,
flight probe and human-shape gate call one helper. Give the seed stride one
documented home and migrate every site without changing any generated seed.
Follow the constants catalogue/regeneration rule in `CLAUDE.md`.

## Decisions already made

- Live NPC crossfire adopts the range curve; training does not flatten itself
  to the old scenery-only coin flip.
- The live-world fixture lands before the crossfire rule changes.
- Retired neural-policy scores are historical evidence, not release gates.
- Seed sequences and existing human-shape output remain byte-identical during
  the sampler/stride refactor.

## Watch out for

- Keep the fixture short and deterministic. Exact damage totals make a brittle
  balance snapshot; assert the outcome that would hurt if it vanished.
- Preserve random draw count where a threshold changes.
- The ram position is read after collision separation in both worlds; assert
  that the direction remains the one used by the live resolver.
- This is gameplay and measurement infrastructure in one outcome, so commit and
  verify each milestone separately.

## Verification

- Milestone 1: targeted live NPC fight test, with an intentional break shown to
  fail it.
- Milestone 2: targeted fire/impact tests, then `npm run build`,
  `npm run elite-a`, `npm run campaign`, and a seeded trainer/live comparison.
- Milestone 3: identical seed lists and human-shape output before/after, then
  `npm run build` and `npm run constants:check`.
- Final flown check: observe an armed trader or police/pirate crossfire and run
  the equivalent seeded trainer fight; record the limits of the comparison.

## Outcome

(recorded per milestone and when the cycle closes)
