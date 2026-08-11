# 132 — The unflown values get anchors instead of a flight

**Kind:** chore (balance, closed by measurement) · **Severity:** medium ·
**Size:** small · **Depends on:** docs/TODO/96 and docs/TODO/129, which shipped
these values and parked them · **GitHub:** none — Chris, 2026-08-11: *"Do not
block things on my playtest. Use sensible default values."*

## Where we are

Four numbers were parked on a playtest that had not happened, and the queue was
being held open by them: `DISREPUTE_BRIBE` (129 M2), and `DISREPUTE_HEAT`,
`COURTESY_RATE` and `HERMIT_FAVOUR` (96's three unflown starting values).

**Every one of them turned out to have an anchor already in the codebase, and
nobody had gone and looked.** A value is only unflown if the question it answers
is a matter of feel. Three of these four are not.

## What to do

Give each one an anchor and close the question. **No value changes except one
that stops being a value at all** — which is the point: this is not a retune, it
is finding out what each number was already measured against.

### `DISREPUTE_HEAT` — stop typing it

Its own doc says it means *"a Notorious pilot flying clean looks about as
interesting as an honest one who just sold a fat cargo here."* That sentence
names a constant: `SALE_NOTORIETY_MAX`, the most a sale can put on the very
channel this feeds, and `infamy` is already normalised to 1 at Notorious. Both
were 0.5, typed out separately, free to drift — at which point the rationale
above silently becomes false.

So it is `SALE_NOTORIETY_MAX` now, the same trick `FAME_FULL`, `DISREPUTE_FULL`
and `HERMIT_REFUSES_AT` already use around it. **It is not a knob, it is an
equivalence**, and there is nothing left to fly. Its `@rule` id goes with the
literal.

### `DISREPUTE_BRIBE` — measured against the decay

129 M2 asked *"one bribe takes an Honest commander to Dubious — too much, or the
point?"* and waited for a flight. The missing input was never a flight: **a
deed's weight means nothing except against the rate that forgives it**, and the
two numbers had never been put side by side.

Measured over every jump galaxy 1 allows inside a full tank — 1,686 legs:

| | days | disrepute forgiven |
| --- | --- | --- |
| shortest jump | 2 | 3.0 |
| median jump | 4 | 6.0 |
| longest | 5 | 7.5 |

`DISREPUTE_BRIBE` is 12 — **exactly twice what a median jump forgives**. That is
the shape the constant's own paragraph asks for, and it holds from both ends:
one bribe is completely gone after two quiet jumps, and a bribe in every system
reaches Dodgy by the fourth and Shady by the eighth. Lower and the deed is free
to anyone who travels; higher and one bad afternoon is a career.

**Unchanged at 12, and no longer open.**

### `COURTESY_RATE` and `HERMIT_FAVOUR` — pin the design, not the mechanism

`test/economy.test.ts` already solves both back out of the real market and the
real threat model, so the mechanisms are gated. What was not gated is the
DESIGN, which is the half a re-tune breaks quietly:

- **The stick must outweigh the carrot.** A criminal name draws challengers at
  `CHALLENGE_RATE * DISREPUTE_DRAW` (0.175) and is spared at `COURTESY_RATE`
  (0.15). If courtesy ever exceeded that, infamy would become a defence, which
  is the opposite of what every other term in the model does.
- **The hermit's welcome is a perk, not an income.** At the widest favour his
  ore is 0.60x a station's price. The risk is not that the discount stops
  working — that is already caught — but that it grows into a reason to BE
  disreputable. The gate holds it above half the station price.

**Both unchanged.**

## Decisions already made

- **Chris lifted 129 M2's "do not retune from the armchair"** in as many words.
  It is recorded here because that rule was a good one and the reason it could
  be lifted matters: nothing below is a retune. One value became an expression
  and three kept their numbers with a gate underneath.
- **No value moved on taste.** If a flight later disagrees, the levers are one
  number each in one file, and the new gates say immediately what a change costs.

## Open questions — answered here

- **Does this make the playtest pointless?** No. It removes the playtest from
  the critical path, which is what was asked. What a flight is still worth is
  the thing no measurement reaches: whether being waved off by a hermit reads as
  a mechanic or as a bug, and whether a bribe FEELS like it costs something.
  Those are reports, not blockers.
- **Why not simulate the rest?** `test/campaign.ts` abstracts flight entirely,
  so no bribe, scan, hermit or murder runs in it — measured, not assumed: a
  60-commander bounty-hunter cohort over 80 legs ends at a median career peak
  disrepute of **0.0**. It can only see the trade half of the ladder.

## Verification

- **The bribe, over the real galaxy** — the legs are generated from `g1` and
  `daysForJump`, not remembered, so re-cutting the chart metric or
  `DISREPUTE_DECAY` re-cuts the claim. One bribe marks; two quiet jumps clear
  it; the habit reaches Dodgy by 4 and Shady by 8; and the control — one bribe
  and forty jumps of honest flying stays Honest.
- **`DISREPUTE_HEAT`** — no test needed, and that is the improvement: it cannot
  disagree with `SALE_NOTORIETY_MAX` because it IS it.
- **The two design gates** above, beside the mechanism checks that already
  existed.
- Prove they can fail: `DISREPUTE_BRIBE` at 6 (3 failures — the deed no longer
  outlives a jump) and at 30 (3 — one afternoon is a career); `COURTESY_RATE` at
  0.2 (the carrot outgrows the stick); `HERMIT_FAVOUR` at 0.5 (ore at 0.38x the
  station, a wholesale channel).

## Where we are now

**Landed.** `npm run check` passes: 4,120 assertions, 0 failed.
`DISREPUTE_BRIBE` 12, `COURTESY_RATE` 0.15 and `HERMIT_FAVOUR` 0.2 are
unchanged and gated; `DISREPUTE_HEAT` is `SALE_NOTORIETY_MAX`.

**129 M2 is closed and the queue is empty.** Nothing in the project is now
waiting on a flight. The playtest is worth doing for what it reports, not for
what it unblocks.
