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

- Arriving short charges the base value of the missing tonnes, capped at what
  the commander has, and marks the name.
- An honest late failure charges nothing and marks nothing.
- The HUD names the bill; no contract can produce both `billed` and
  `incomplete`.
- `npm run campaign` shows arriving short is no longer a net gain for the
  trader cohort.
- Full gates: `npm test`, `npm run campaign`, `npm run constants:check`.

## Verify

Confirmed by reading, 2026-08-10: `fineFor`'s cap-at-credits shape at
`law.ts:31-34`; the deed table and its magnitudes at
`constants/character.ts:26-29`; settlement already applying a deed at
`contracts.ts:223-225`; `settleContracts`'s signature taking only the commander
(`contracts.ts:205`) and its three call sites (`game.ts:998`,
`station.ts:214`, `campaign.ts:191`); `basePrice` as a raw byte scaled by 4/10
into credits at `galaxy.ts:142-171`.
