# 113 — What you cannot hand back, you are billed for

**Kind:** feature / economy · **Severity:** medium · **Size:** small–medium
**Depends on:** docs/TODO/112 — the reclaim branch this bills against does not
exist until 112 lands, and billing before the fee is re-tuned would read the
campaign against a curve that is about to move.
**GitHub:** #17 (second of two milestones)

## Why

112 closes the honest failure: whatever of the consignment is still aboard goes
back to the shipper, and being late costs you the trip. It cannot close the
other 22% — **arriving short**. There is nothing left to reclaim, because you
sold it, jettisoned it, or lost it. Today that is worth 295 Cr a career on the
trader cohort (issue #17); after 112 it is the only way the goods stay yours,
so it is where the whole leak will go if it is left open.

Selling a consignment you were entrusted with is a *deed*, not a failure. The
two acts deserve different answers, and the machinery for both is already
built and already precedented:

- `law.ts:31-34`'s `fineFor` is the pattern for a charge capped at what you can
  pay, so a broke commander is never trapped — the cost is the credits, not the
  impossibility (`recordCleared` at `law.ts:45` says exactly that).
- `constants/character.ts:26-29` is the deed table, and `settleContracts`
  already applies one: `DISREPUTE_CONTRABAND_SALE` on a landed smuggling run
  (`contracts.ts:223-225`).
- `COMMODITIES[i].basePrice * 4` is a tonne's base value in ledger tenths
  (`galaxy.ts:142-159` and `generateMarket`'s `price = (price * 4) / 10` at
  `galaxy.ts:171`) — a valuation `contracts.ts` can compute **without** a
  market, which is what keeps settlement pure.

The point is not to make theft impossible. It is to turn "keep the cargo" from
the default winning move into a deliberate outlaw play with a bill and a name
attached — good money now, paid for later.

## What to do

1. **Bill the shortfall.** In the `incomplete` branch, after 112's reclaim has
   taken what it can, charge `shortfall * COMMODITIES[k.commodity].basePrice * 4`
   ledger units, capped at `c.credits` — the `fineFor` shape, spelled out
   locally rather than imported, because this is the shipper's invoice and not
   the Government's fine.
2. **A new event kind, because a new thing happens.** `{ kind: 'billed';
   contract; tonnes; charged }` beside `incomplete` in `ContractEvent`
   (`contracts.ts:158-164`). `contractMessage`'s no-default switch
   (`contracts.ts:290-317`) then cannot let it land silently:
   `CONSIGNMENT SHORT — BILLED 340.0 CR FOR 5T MACHINERY`. Emit `billed`
   *instead of* `incomplete` when anything was charged, so the two lines never
   both appear for one contract.
3. **Name the deed.** `DISREPUTE_SHORTED_CONSIGNMENT` beside
   `DISREPUTE_CONTRABAND_SALE` in `constants/character.ts`, applied through
   `afterDeed` in the same branch. Value **5**, matching the contraband sale: a
   nudge that only adds up over a run of them, not a career-marker like a
   hermit kill at 40 — one shorted job is a bad week, a habit is a reputation.
   Its own `@rule` id, since it shares the value 5 with the contraband sale and
   the two must stay free to move apart. Constants process applies:
   `constants:find`, then `generate:constants` and `constants:check`.
4. **Tests:**
   - short delivery bills the base value of exactly the missing tonnes, not the
     whole consignment;
   - a commander with less than the bill pays everything and lands at zero, and
     `credits` never goes negative (the campaign asserts this independently);
   - the deed lifts `disrepute`, and an honest late failure (112's `expired`)
     does **not** — the mirror of the honest/dishonest split at
     `test/contracts.test.ts:143-171`, which is where the smuggling deed is
     already pinned this way;
   - **prove the gate can fail:** drop the `afterDeed` call and the disrepute
     check must go red.
5. **Re-read the campaign** and check the falsifiable claim below.

## Decisions already made

- **Base price, not the local quote.** The issue offered both. Base price wins
  on two grounds: `settleContracts(c)` takes only the commander, so a local
  quote means threading a market lookup through `game.ts:998`,
  `station.ts:214` and `campaign.ts:191` into a function whose purity is the
  thing invariant 10 is protecting; and the base price is *below* what you sold
  at in a good market, which is the leniency that makes the piracy case
  survivable (below).
- **Loss to piracy is billed.** The freight is the commander's responsibility
  and the shield is the insurance — the campaign loses ~38 t/career to pirates
  and that should cost something, or shields never have to matter. The
  gentleness lives in the price (base, not local) and the cap (never more than
  you have), not in an exemption nothing in the code could tell apart anyway:
  a hold is short, and settlement cannot see why. Trumble losses are the same
  case and get the same answer.
- Chris's ordering: this lands after 112, never merged with it — the fee
  re-tune and the bill must be readable apart in the campaign.

## Open questions — answered here

- **Does the bill need its own `ContractEvent` kind, or does `incomplete`
  carry it?** Its own — step 2. `incomplete` survives for the case where the
  reclaim covered everything and nothing was charged.
- **Should the deed fire when the shortfall was piracy?** Yes, and this is the
  one place it grates. The alternative — a deed only for a sale — needs
  settlement to know *why* the hold is short, which nothing records. Charging
  the credits always and marking the name always keeps one rule; if it reads
  mean in play, the lever is the deed's value, not a new branch.
- **Does this need #96?** No. The bill bites immediately in credits. The
  `disrepute` half is inert until #96 gives the character label teeth — it is
  scored and saved today (`contracts.ts:223-225` already does exactly this),
  just not yet read by the world. Ship it scored; #96 turns it on.

## Watch out for

- **Theft must not still pay.** The falsifiable check, and the reason to
  re-read the campaign: after this lands, the trader cohort must show **no net
  gain** from arriving short. Sold-at-local minus billed-at-base is still
  positive in a dear market, and if the campaign shows commanders profiting on
  shortfalls, the lever is a surcharge multiplier on the bill — decided by that
  measurement, in this milestone, not left to a later one.
- **`incomplete` fires only for an on-time arrival at the destination**
  (`contracts.ts:211-219`); short *and* late is `expired`, which 112 leaves
  free of any bill. That asymmetry is deliberate — do not "fix" it into
  billing late arrivals, or the honest failure 112 just priced correctly
  becomes punishable again.
- **The smuggling case bills you for contraband you were carrying illegally.**
  That is correct and needs no special branch — the shipper wants paying either
  way — but the wording must not name the commodity in a way that reads as the
  station taking an interest in it.
- **The constants gate** rejects a new top-level `UPPER_CASE` const outside
  `src/constants/`, which is where the deed goes anyway.

## Acceptance

- [x] Arriving short charges the base value of the missing tonnes — exactly the
      missing ones, not the consignment — capped at what the commander has, and
      marks the name. Zeroing the charge or dropping the `afterDeed` call
      reddens the checks that pin each.
- [x] An honest late failure charges nothing and marks nothing: the same job,
      the same missing tonnes, one day past the deadline, asserted beside the
      billed case.
- [x] The HUD names the bill — `CONSIGNMENT SHORT — BILLED 93.6 Cr FOR 2T
      MACHINERY — 3T RECLAIMED` — and a contract produces `billed` or
      `incomplete`, never both.
- [x] `npm run campaign` shows arriving short is a cost and never a gain: the
      new SHORTFALL line reports 6.2 t never arriving and 88.4 Cr billed per
      trader career, and the sweep below shows the sale would not have covered
      it either.
- [x] Full gates: `npm run check` (lint, 3,427 tests, sizes, constants, the
      generated catalogues) exits 0, and `npm run campaign` passes.

## What the ledger said

**Theft no longer pays, and it is measured where the campaign cannot see it.**
The campaign's bots hold every consignment back on purpose, so a cohort of them
can show what being robbed *costs* and can never show whether selling the
freight would have *paid*. So the falsifiable claim is asserted in
`test/contract-offers.test.ts`, over every offer the real generator makes, with
the bill taken from the real `settleContracts` rather than transcribed: sell the
consignment at the destination, arrive empty, pay the invoice, against simply
delivering it.

| | offers where selling beats delivering | mean margin |
|---|---|---|
| issue #17, before 112 | **61%** (goods vs fee) | +11.5 Cr/t of free goods |
| after 112, with no bill | **46.3% / 44.2%** | −0.2 / −0.6 Cr |
| after 113 | **0.7% / 0.7%** | **−163.1 / −163.7 Cr** |

Both figures are read at the file's two sample sizes (1,155 and 5,658 freight
jobs). The middle row is this milestone's gate proving it can fail: neutering
the charge alone takes the share from 0.7% to 46%. The 0.7% that survives is
the deliberate outlaw play the plan wanted left open — a dear market on a short
haul, where the fee was small — so no surcharge multiplier is needed, which was
the lever this measurement was meant to decide.

**The campaign, 1,000 careers × 60 legs, against the same run on `main`:**

| cohort | before | after | shorted | billed |
|---|---|---|---|---|
| trader | 6,886.9 Cr | 6,557.7 Cr (−4.8%) | 6.2 t | 88.4 Cr |
| privateer | 8,777.6 Cr | 8,101.9 Cr (−7.7%) | 10.8 t | 220.1 Cr |
| bounty hunter | 628.4 Cr | 628.4 Cr | 0.0 t | 0.0 Cr |

The bounty hunter is *identical to the digit* — the control: it takes no
freight. The privateer pays most because it flies as bait and is robbed most,
which is the shape the plan predicted and wanted: liability is what makes a
shield worth money. The cost to a career is several times the credits billed
(329 Cr of net worth for 88 Cr of invoice) because the charge lands early and
compounds through the cargo it would have bought. Read again at a second size —
500 careers × 120 legs — the trader goes 23,921 → 23,272 Cr (−2.7%), so the
effect does not grow with career length. Both are comfortably clear of the
5,000 Cr wealth floor.

## Also landed

- **The module split.** `game/contracts.ts` crossed the 400-line ceiling with
  the bill in it, so what the board OFFERS and how a job READS moved to
  `game/contract-offers.ts` (169 lines) — the seam the tests had already found
  in 110, and one-way: settlement imports `describeContract`, nothing there
  imports settlement. `test/contracts.test.ts` crossed too, and what TAKING a
  job costs the hold is `test/contract-acceptance.test.ts` now; the
  `describeContract` phrasing checks went with their function.
- **`tonnesShort` and `creditsBilled` at the campaign's settle site**, printed
  as a SHORTFALL line. `billed` also carries `reclaimed`, which the plan did not
  ask for: without it the tonnage handed back on a short arrival would have
  vanished from the harness's ledger the moment `billed` replaced `incomplete`.
- **`DISREPUTE_CONTRABAND_SALE` gained a rule id too.** The plan asked for one on
  the new deed because the two share the value 5; `separateRules` only frees a
  pair when *both* carry ids, so one id would have been half a fix.

## Decisions taken while building

- **The deed marks the act, not the payment.** A commander with nothing in the
  account is charged nothing — the cap says so — but is still marked, and the
  event falls back to `incomplete` because a `BILLED 0.0 Cr` invoice says
  nothing. Tying the deed to the charge instead would have made spending down
  before the door a way to launder a shorted consignment into a free one.
- **The HUD names the commodity once.** `reclaimedClause` was not reused for the
  bill line: it would have printed the goods twice on a part-reclaimed,
  part-billed arrival, and the plan's caution about the wording is exactly that
  the line must read as the shipper's invoice, not as the station taking an
  interest in what was aboard.

## Verify

Confirmed by reading, 2026-08-10: `fineFor`'s cap-at-credits shape at
`law.ts:31-34`; the deed table and its magnitudes at
`constants/character.ts:26-29`; settlement already applying a deed at
`contracts.ts:223-225`; `settleContracts`'s signature taking only the commander
(`contracts.ts:205`) and its three call sites (`game.ts:998`,
`station.ts:214`, `campaign.ts:191`); `basePrice` as a raw byte scaled by 4/10
into credits at `galaxy.ts:142-171`.

Confirmed by measurement, 2026-08-10: the two tables above, each read at two
sample sizes; both new gates shown failing when the rule they protect is broken
(the `afterDeed` call removed → 3 disrepute checks red; the charge zeroed →
the theft-share check red at 46.3%/44.2%).
