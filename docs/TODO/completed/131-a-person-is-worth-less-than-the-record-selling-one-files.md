# 131 — A person is worth less than the record selling one files

**Kind:** bug (balance, but not a taste) · **Severity:** medium · **Size:** small
**Depends on:** docs/TODO/127, which shipped the choice and recorded the
question · **GitHub:** none — 127's own finding, promoted after measurement

## Where we are

docs/TODO/127 made docking ask what becomes of somebody you pulled out of a
capsule. Three answers: hand them over for nothing, sell them on the Slaves row,
or take money to let them walk. It priced the two dirty answers at the station's
own Slaves quote, which is the right instinct — a Feudal system pays more for a
person than a Democracy does, and that is what makes carrying one somewhere else
a decision.

It then recorded its own doubt, and docs/TODO/README.md carried it as a playtest
question: *"a tonne of Slaves is 6 Cr at Lave and 16 at the dearest system in
galaxy 1, so selling a rescued pilot pays 6–16 Cr against 40 disrepute. As
shipped, the dirty answer is not a temptation."*

**Measuring it made the flight unnecessary, and the answer is worse than the
question.** Across galaxies 1, 2 and 8 (256 systems each, off the real
`generateMarket`):

| | cheapest | median | dearest |
| --- | --- | --- | --- |
| galaxy 1 | 2 Cr | 10 Cr | 16 Cr |
| galaxy 2 | 2 Cr | 8 Cr | 16 Cr |
| galaxy 8 | 2 Cr | 8 Cr | 16 Cr |

A sale pays 2–16 Cr. It also files an **Offender** record, and `OFFENDER_FINE`
is 250 tenths — **25 Cr** to clear. So the deed does not cover its own cleanup at
any market in any galaxy, and it costs `DISREPUTE_SLAVE_SALE` (40) on top, which
takes an Honest commander clear to Dodgy in one act.

That is not "not a temptation". **It is strictly dominated.** No commander who
can do arithmetic ever picks it, which means 127's forced choice has three
branches and only two answers. The defect is in the same family as 122, 129 and
130 — a consequence the player cannot act on — except here the branch is not
invisible, it is pointless.

## What to do

One milestone. `SURVIVOR_SALE_TONNES` in `constants/survivors.ts`: what a PERSON
is worth on the Slaves row, counted in tonnes of it. `survivorOffers` multiplies
by it; `SURVIVOR_RELEASE_SHARE` still takes its half of the result, so the two
dirty answers keep moving together.

A multiple of the quote, never a price of its own — that is 127's own
prescription (*"the lever is a multiplier on top of the quote"*) and the reason
is that the quote is the part that must keep moving. Re-tune this and the
market's spread survives it.

### Why four

Two rules bracket it, and both are asserted over the real galaxy rather than
against remembered numbers:

- **The floor — a deed must cover its own cleanup at a MEDIAN market.** The
  median, not the cheapest: a person fetching enough everywhere would waste the
  one thing `survivorOffers` was built on. 4 is the smallest whole multiple that
  clears `OFFENDER_FINE` in every galaxy (3 fails in two of the three, where the
  median quote is 8 Cr rather than 10).
- **The ceiling — where you are docked must still decide.** At the cheapest
  market the sale must NOT clear the fine, or the quote stops being worth
  reading. That breaks at 13.

So the rule-bracket is 4–12 and the shipped value is the bottom of it. **An
unflown number belongs at the bottom of its bracket**: the playtest can raise it
on evidence, and the gate says immediately if that costs the control.

## Decisions already made

- **This is not the retune 129 M2 forbids.** That plan's rule is *make it
  visible before retuning it*, and it is about the CHARACTER ladder's weights,
  which are a matter of feel. This is an option that is never correct, argued
  from two of the game's own numbers, with no opinion about how bad selling a
  person ought to feel. `DISREPUTE_SLAVE_SALE` is untouched at 40.
- **The floor is the fine, not a feeling.** `OFFENDER_FINE` is the law's own
  statement of what an Offender's record is worth, the same way `patrolPrice`
  prices a policeman off the rung's fine rather than off taste.
- **Handing them over still pays nothing.** Asserted at the dearest market in
  the game, because that is where the floor would be most tempted to leak into
  an income.

## Open questions — answered here

- **Should the release share move too?** No. It is half of the sale and it
  followed automatically; the choice between the two dirty answers is unchanged
  in shape, only in scale.
- **Does this make capsule-farming a strategy?** At the bottom of the bracket, a
  sale at the dearest market pays 64 Cr against a career net worth the campaign
  harness measures at ~800 Cr after 80 legs. Meaningful to a new commander with
  100 Cr, trivial to an established one — which is the right way round for a
  moral choice. If the playtest disagrees, the number is the lever.

## Watch out for

- **The value is one number in one file** precisely so the playtest can move it.
  Nothing else in the game should learn what a person is worth.
- **The bracket is measured, not remembered.** The test regenerates the galaxies
  and reads `OFFENDER_FINE`; re-cutting either moves the bracket and the gate
  follows.

## Verification

- **Pure, over three galaxies** — the median market clears the fine; the
  cheapest does not; the quote genuinely spans the range in each.
- **Minimality** — one less than the shipped multiple fails the floor in at
  least one galaxy. This is the check that says the value was reasoned rather
  than liked.
- **The control** — handing them over pays nothing and marks nothing, at the
  dearest quote in the game.
- **The existing sale tests** move from `priceInTenths(quote)` to the multiple,
  pure and flown, so the price has one home and the flown path proves the
  console receipt agrees with it.
- Prove the gate can fail: measured at 3 (floor fails in 2 of 3 galaxies), at 12
  and 13 (minimality fails), and at 13 (the cheapest market clears the fine in
  all three, so where you dock stops deciding).

## Where we are now

**Landed.** `SURVIVOR_SALE_TONNES = 4`; a sale now pays 8 Cr at the cheapest
market, 32–40 Cr at a median one and 64 Cr at the dearest, against a 25 Cr fine.
`npm run check` passes: 4,109 assertions, 0 failed.

**What this does NOT do.** It answers one of the four questions the playtest was
carrying, and only because that one turned out to be arithmetic rather than
feel. `DISREPUTE_BRIBE` (12) and 96's three unflown values (`DISREPUTE_HEAT`,
`COURTESY_RATE`, `HERMIT_FAVOUR`) are untouched and still need a flight — see
docs/TODO/129 M2. The campaign harness cannot stand in for that flight: it
abstracts flight entirely, so no bribe, scan, hermit or murder ever runs in it.
Measured, not assumed — a 60-commander bounty-hunter cohort over 80 legs ends
with a median career peak disrepute of **0.0**, because nothing a fighting
commander does is modelled by it at all.
