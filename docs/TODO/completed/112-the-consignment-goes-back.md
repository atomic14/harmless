# 112 — The consignment goes back

**Kind:** bug / economy · **Severity:** high · **Size:** medium
**Depends on:** none. Re-tunes the cargo and smuggling **rewards**; it must not
re-cut the offer roll (110 did that last), or the fee change and a share change
cannot be read apart in the campaign.
**GitHub:** #17 (first of two milestones; the second is docs/TODO/113)

## Why

A cargo run hands you the consignment at acceptance
(`contracts.ts:258-263`) and no path anywhere takes it back.
`settleContracts` drops the contract on expiry (`contracts.ts:229-232`) or a
short delivery (`contracts.ts:216-219`) and leaves whatever is aboard in the
hold, where the trade screen sells it at the local quote.

Measured here on the shipped generator, at two sample sizes (2 galaxy-wide
sweeps, 1,240 and 3,634 cargo offers):

| | fee | consignment at destination | goods worth more than the fee |
|---|---|---|---|
| cargo | 11.4 Cr/t | 24.5 Cr/t | **61%** |
| smuggle | 24.1 Cr/t | 43.6 Cr/t | **58%** |

**The units are the trap, and they are why this survived review.** The ledger
stores tenths of a credit (`commander.ts:245-247`, and the trade screen's
`Math.round(m.price * 10)` at `trade.ts:118,146`); market prices are whole
credits. A cargo reward of `qty * (22 + dist * 1.6) + 90` reads like a
respectable fee and pays **7.9 Cr** for a 10 t run at 30 tenths' range. So the
best trade on the board is a 10 t Machinery run you never deliver: ~470 Cr of
goods for a fee you were only ever going to be paid ~79 Cr of.

The campaign agrees. Trader cohort, 1,000 commanders × 60 legs, instrumented
at settlement (issue #17):

| | jobs/career | tonnes abandoned | value |
|---|---|---|---|
| expired (late, freight still aboard) | 7.8 | 43.6 t | **1,059 Cr** |
| incomplete (arrived short) | 2.7 | 11.6 t | 295 Cr |
| **total** | **10.5** | **55.2 t** | **1,354 Cr** |

against 14.2 cargo contracts actually completed per career and a median net
worth of 6,981 Cr after 110. **About a fifth of a trader's career is freight
they were paid to deliver and didn't** — and it is why cutting cargo's share
of the roll by 10 points in 109 cost the cohort 13% of its net worth, far more
than the rewards removed. Every economy milestone measured against
`npm run campaign` is measured against that distortion until this lands.

**78% of the leak is simply being late.** No dishonesty is involved: the
freight is in the hold, the deadline passed, and the game hands it over as a
consolation prize. There is no deed there for `disrepute` to price, which is
why this milestone is not a character change — the character half is 113.

Smuggling has the same hole and 110 only just opened it: an expired smuggling
run leaves contraband aboard with a hermit outlet that never asks questions.

## What to do

1. **The consignment is bonded, and it goes back.** In `settleContracts`, both
   failure exits reclaim freight before dropping the contract: take
   `min(k.qty, c.cargo[k.commodity])` out of the hold on `expired` and on
   `incomplete`, for `cargo` **and** `smuggle`. No fee, no goods. Being late
   costs you the trip and the hold space you tied up — the honest failure,
   honestly priced.
   - `min`, not `qty`: goods are fungible, the hold has no per-contract
     provenance, and a commander who bought more of the same commodity has in
     effect covered the consignment. It is also what stops the hold going
     negative, which would break the campaign's own no-negative assertions.
2. **The events carry the tonnage.** Add `reclaimed: number` to the `expired`
   and `incomplete` variants of `ContractEvent` (`contracts.ts:158-164`); 0 for
   courier, passenger and bounty. Not a new event kind — the *event* is
   unchanged (the contract failed) and the orchestrator has nothing new to
   apply — but the number cannot be recomputed from the contract after the fact
   and both the HUD line and the campaign's ledger need it.
3. **Say it.** `contractMessage` is a no-default switch (`contracts.ts:290-317`)
   and branches on `e.contract.kind` for the wording: an expired freight run
   reads `CONTRACT EXPIRED — 8T MACHINERY RECLAIMED`, a courier or passenger
   run keeps `CONTRACT EXPIRED`. `incomplete` keeps
   `CONSIGNMENT INCOMPLETE — CONTRACT VOID` and appends the same clause when
   anything was taken back.
4. **Then the fee has to cover the job.** Once the goods are not yours, the fee
   is the whole reward, and 11.4 Cr/t to haul freight worth 24.5 Cr/t is not
   worth a hold slot. Raise the per-tonne term of both freight rewards
   (`contracts.ts:77` cargo, `contracts.ts:124` smuggle) — the flat terms and
   the deadlines stay. Measured brackets on the same two sweeps, cargo:

   | coefficients (tenths) | fee |
   |---|---|
   | `22 + dist*1.6` (today) | 11.4 Cr/t |
   | `55 + dist*4.0` | 26.1 Cr/t |
   | `66 + dist*4.8` | 31.0 Cr/t |

   **Start at `55 + dist*4.0` and let `npm run campaign` set the final pair**;
   scale smuggle's `80 + dist*2` by the same factor so illicit freight keeps
   the ~2x premium 110 gave it. The target is the trader cohort's median net
   worth back to ≈6,981 Cr — the post-110 baseline, and comfortably clear of
   the 5,000 Cr floor at `campaign.ts:817-820` — without tripping the runaway
   ceiling. This is the one part that must be tuned rather than argued.
5. **Tests** (`test/contracts.test.ts` owns settlement):
   - expiry reclaims: hold back to zero, contract dropped, `reclaimed` equals
     the consignment. The existing expiry check at
     `test/contracts.test.ts:94` asserts only that the contract is dropped —
     extend it, do not add a second one beside it.
   - short delivery reclaims **what is there, not what was owed**: 2 t aboard
     against a 5 t job leaves the hold at 0 and reports `reclaimed: 2`.
   - pooled goods: a 5 t Food job plus 10 t of bought Food leaves 10 t.
   - a smuggling run expires the same way, and the hold is clean afterwards.
   - courier, passenger and bounty failures report `reclaimed: 0` and touch no
     cargo (the passenger checks at `test/contracts.test.ts:111-134` are the
     pattern).
   - the offer sweep gains a per-tonne fee bound at its existing two sample
     sizes (`test/contracts.test.ts:171-216`).
   - **Prove the gate can fail:** revert the reclaim line alone and the expiry
     test must go red.
6. **Re-read the campaign** and record the new trader/hunter/privateer medians
   in the plan's completion note. This moves the money curve more than 109 or
   110 did.

## Decisions already made

- Rules stay in `src/game/contracts.ts` so `npm run campaign` exercises the
  same code the game runs (invariant 10, cited at `contracts.ts:8-11`).
- The reward coefficients stay inline literals beside the roll, as 109's and
  110's did. They are the shape of one formula, not a threshold with a second
  reader, and a new top-level `UPPER_CASE` const in `src/game/` fails
  `test/constants.test.ts` anyway.

## Open questions — answered here

- **Is loss to piracy forgiven?** In this milestone, yes, by construction: you
  can only hand back what is aboard and there is no bill, so cargo the pirates
  took is simply gone along with the fee. Liability is 113's question.
- **Should a late delivery still pay something?** No. A partial-pay curve is a
  second economy change landing in the same milestone as a fee re-tune, and the
  campaign could not tell the two apart. Late stays void; the reduced-fee idea
  is a candidate follow-up once the fee itself is settled.
- **Does the reclaim need a new `ContractEvent` kind?** No — see step 2. 113
  adds one for the bill, which genuinely is a new thing happening.
- **Does the reclaim let a smuggler launder a hold at the door?** No. The
  police scan fires in flight (`world-step.ts:539-541`), not at the dock, so
  the run has already been scanned by the time settlement reclaims anything.

## Watch out for

- **The trader cohort's bounty contamination.** `settleContracts` counts a
  bounty kill only in the job's own destination system
  (`combat.ts:218-227`), so a bounty job a trader takes ties up one of
  `MAX_CONTRACTS = 3` slots until its deadline. 110's instrumentation
  (issue #17 comment) showed 182 fewer bounty jobs taken shifting ~540 paid
  jobs into courier and passenger work. That is the harness's acceptance
  policy (`campaign.ts:313-355`), **not** a rule of the game — but it means
  slot allocation moves whenever the board moves. Change the fee only, never
  the roll, and the two effects stay separable.
- **Cargo completions were flat across 110** (4,291 → 4,329) while cargo lost 5
  points of share: the slot constraint binds, not offer supply. Expect
  completions to hold and the *income mix* to move, and read the campaign that
  way rather than by contract counts.
- **The wealth floor is close.** Removing ~1,354 Cr/career from a 6,981 Cr
  median against a 5,000 Cr gate means the fee and the reclaim must land in the
  same commit; a reclaim landed alone will fail CI's economy gate, correctly.
- **`test/campaign.ts:191` settles through the same module** (invariant 10) and
  will see `reclaimed` for free — but its own ledger needs the field read, or
  the abandoned-goods line it prints will silently report zero.

## Acceptance

- [x] No path leaves an unpaid consignment in the hold: expiry and short
      delivery both reclaim what is aboard, for cargo and for smuggling runs.
      Reverting the one line that empties the hold reddens 6 checks and leaves
      the rest of the suite green.
- [x] The reclaim takes what is there, not what was owed: 2 t aboard against a
      5 t job leaves the hold at 0 and reports `reclaimed: 2`. Pooled goods are
      handled by the same `min`: a 5 t Food job against 15 t aboard leaves 10 t
      whether it is paid or expired.
- [x] The HUD says what was taken back — `CONTRACT EXPIRED — 8T MACHINERY
      RECLAIMED` — and never says it for courier, passenger or bounty work, nor
      for freight with nothing left aboard to take.
- [x] The trader cohort's median net worth is back to 6,887 Cr on
      `npm run campaign -- 1000 60` against the 6,981 Cr post-110 baseline
      (−1.3%), with the abandoned goods — 53.6 t a career, formerly income —
      now handed back and the fee making up the difference.
- [x] Full gates: `npm run check` (lint, 3,414 tests, sizes, constants, the
      generated catalogues) exits 0, and `npm run campaign` passes.

## What the ledger said

**The leak was worth more than the goods it left behind.** With the reclaim in
and the fee untouched, the trader cohort's median net worth falls 6,981 →
4,454 Cr over 1,000 careers — a 36% cut, against the ~1,354 Cr of abandoned
freight the instrumentation valued. The difference is compounding: the goods
were being sold early in a career, when the money buys a large bay that pays
for everything after it, so removing them costs the trading capital as well as
the sale.

That is what set the fee. The plan's opening bracket, `55 + dist * 4.0`,
overshot to 7,346 Cr (+5.2%); the campaign was read at six pairs and
`54 + dist * 3.9` lands at **6,887 Cr, −1.3% from baseline** — inside the band
109 established the median is stable to (±0.2% is the sampling noise; the
remaining 1.1% is real and in the honest direction, since a late run now costs
the trip). Smuggling's `80 + dist * 2` is scaled by the same 2.45x, which
holds the per-tonne premium at 1.9x (25.2 Cr/t cargo against 48.2 smuggle,
swept over 30,000 t of offers).

**All three cohorts, 1,000 commanders × 60 legs, before → after:**

| | trader | bounty hunter | privateer |
|---|---|---|---|
| median net worth | 6,981 → **6,887** Cr | 628.4 → **628.4** Cr | 8,456 → **8,778** Cr |
| never went broke | 928 → 930 | 1000 → 1000 | 972 → 978 |
| contracts done/failed | 28.7/23.0 → 28.4/23.1 | 5.1/2.3 → 5.1/2.3 | 36.1/25.7 → 36.5/25.6 |
| tonnes handed back | — → 53.6 t | — → 0.0 t | — → 61.2 t |

The bounty hunter is *identical to the digit*, which is the control this change
wanted: it takes no freight, so a change to freight must not move it. Its two
failing balance checks fail the same way on `main` before this commit and are
untouched here (the same pre-existing pair 110 recorded).

**The plan's forecast held.** Completions did not move (28.7 → 28.4 for the
trader) exactly as the slot constraint predicted, and 53.6 t handed back
against the 55.2 t the instrumentation measured — the freight was already being
counted correctly, it was simply being kept. The privateer gains 3.8%: it is
the cohort that takes smuggling work, so it collects the 2.45x on the narrowest
slice of the board and hands back the most tonnage (61.2 t) at the same time.

## Also landed

- **`reclaimed` is read at the campaign's settle site**, and the harness now
  prints `53.6t handed back on failure` on its CONTRACT line. Without that the
  line the plan asked for would have reported zero whether or not the rule
  worked, because the tonnage leaves the hold before anything downstream can
  count it.
- **A per-tonne fee bound in `test/contract-offers.test.ts`**, swept at the
  file's existing two sample sizes: a cargo fee between 20 and 40 Cr/t, and
  illicit freight between 1.5x and 3x that. This is the bound that could not
  exist while a failed run left its consignment behind — the fee did not have
  to cover the job, because the goods were the real reward. Reverting the
  coefficient to `22 + dist * 1.6` reddens it at 11.2 Cr/t.
- **The smuggling comment said "roughly 3x" and always meant ~2x** (24.1
  against 11.4 Cr/t measured before this change). Corrected while the line
  was being touched; the ratio itself is unchanged.

## Verify

Confirmed by reading and measurement, 2026-08-10:

- both failure exits `continue` without touching `c.cargo`
  (`contracts.ts:216-219, 229-232`); acceptance loads it at
  `contracts.ts:258-263`.
- the tenths convention: `formatCredits(tenths)` at `commander.ts:245-247`,
  `Math.round(m.price * 10)` at `trade.ts:118,146`, and `generateMarket`'s
  `price = (price * 4) / 10` at `galaxy.ts:171` — so a raw `basePrice` byte
  times 4 is a tonne's base value in ledger units.
- the fee and value figures above were measured by driving the shipped
  `generateContractOffers` over all 256 systems at two seeds and two day
  spans, valuing each consignment at the destination's 16-fluctuation mean.
- the cargo reward formula has been unchanged since 8ceff31 (2026-07-27), so
  the leak predates 109 and 110 and is not a regression from either.
