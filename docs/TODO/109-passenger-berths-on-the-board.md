# 109 — Passenger berths on the board

**Kind:** feature / economy · **Severity:** medium · **Size:** medium
**Depends on:** none (lands before 110 by Chris's ordering — both re-cut the
same seeded offer roll, and the cut should move once per milestone)
**GitHub:** #9 (first of two milestones; the second is docs/TODO/110)

## Why

The bulletin board offers cargo, courier and bounty work
(`contracts.ts:43-98`) and nothing that competes for the hold except the
cargo consignment itself. Passengers add the trade-off issue #9 asks for: a
berth occupies hold space, so a large bay (`LARGE_BAY_TONNES = 35` vs
`HOLD_TONNES = 20`, `constants/commander.ts:52-53`) is worth buying for
people as well as freight.

The machinery is all in place and shared with the campaign, which is the
point of it (invariant 10, cited at `contracts.ts:129` and
`screens/contracts.ts:3-4`):

- `Contract` is a closed union `'cargo' | 'bounty' | 'courier'` on saved
  state (`commander.ts:68-76`).
- One seeded roll cuts the kinds at 0.55 / 0.8 (`contracts.ts:60-61`); the
  offer sweep test reads the generator at two sample sizes and asserts every
  bound is reached (`test/contracts.test.ts:171-216`).
- `acceptContract` is where hold competition is enforced today — the cargo
  branch refuses on `cargoTonnes + qty > cargoCapacity`
  (`contracts.ts:321-326`).
- `settleContracts` pays `here && !late` (`contracts.ts:277-304`);
  `contractMessage` is a no-default switch, so a new event kind cannot land
  silently (`contracts.ts:345-372`).
- `npm run campaign` runs the real generator and settler but still carries
  its own transcription of *acceptance* (`test/campaign.ts:322-324`) — the
  exact failure mode invariant 10 exists to stop, and this item walks right
  into it if left alone.

## What to do

1. **Add `'passenger'` to the `Contract` kind union.** `qty` is heads (1–3),
   `commodity` stays 0, `progress` unused. No new commander field.
2. **Berths occupy the hold, derived, not stored.** `cargoTonnes` adds
   `qty × PASSENGER_BERTH_TONNES` for each in-hand passenger contract — the
   contracts are already on the commander, so the fact is derivable and needs
   no new state field (the lesson docs/TODO/88 records). Set
   `PASSENGER_BERTH_TONNES = 2` in `src/constants/contracts.ts` with its own
   `@rule` and rationale: a berth is bigger than a person, and 3 passengers
   at 2 t is a bite of a 20 t hold a large bay visibly relieves. Everything
   downstream — the trade screen's buy cap (`trade.ts:122`), the board's
   `HOLD n/mt` footer (`ui/screens.ts:1034`), the accept refusal — follows
   from `cargoTonnes` for free.
3. **Generation.** Re-cut the roll: cargo < 0.45, courier < 0.65,
   passenger < 0.80, bounty the rest — cargo and courier give up the slice,
   bounty keeps its 0.2. Reward starts at
   `round(qty * (90 + dist * 3) + 120)` with a courier-tight deadline
   (`day + 3 + ceil(dist / 16)`) — passengers pay less than freight of the
   same tonnage but demand punctuality. Both numbers are opening bids to be
   tuned against the campaign ledger, which is how every formula in this file
   got its values (`contracts.ts:37-42`).
4. **Accept and settle.** `acceptContract` gains a passenger branch:
   `noHoldSpace` when berths would overflow; nothing is loaded into `cargo`.
   `settleContracts` needs no new branch — passengers travel with the
   contract, cannot be sold short, so `here && !late` pays and `late`
   expires, exactly the courier shape. **No new `ContractEvent` kind in this
   milestone.**
5. **Words.** `describeContract`: `Carry N passengers to DEST` — and note
   the function's final `return` is the bounty fallback, so forgetting this
   line would read "Destroy N pirates". Board row and accepted list in
   `ui/screens.ts:999-1037` follow from it.
6. **Route the campaign bot through `acceptContract`.** Delete the bot's own
   hold-check-and-push (`campaign.ts:322-324`) and call the real function,
   as it already does for settlement (`campaign.ts:190-193`). Teach the
   strategy filter (`campaign.ts:300, 317`) that traders and privateers take
   passengers. Then run `npm run campaign` and re-tune step 3 until its
   gates pass — including `contractsDone > contractsFailed`
   (`campaign.ts:796-797`) and the wealth floor/ceiling.
7. **Tests.** Extend `test/contracts.test.ts`: settlement pays/expires for a
   passenger job; acceptance refuses on berth overflow (mirror of the
   `noHoldSpace` case at `:111-142`); the generation sweep at both existing
   sample sizes asserts the passenger share appears, `qty` stays in 1–3, and
   the ordinary-goods stray check is left exactly as it is (passenger jobs
   carry no commodity, so they must not enter it). Hold arithmetic gets a
   case beside `test/economy.test.ts:313-341`'s hold-agreement section.

## Decisions already made

- Chris (triage comment, #9): issue #9 is two milestones — passenger
  accommodation first, then illicit freight; both run through the campaign
  economy before landing.

## Open questions — answered here

- **Cabin as purchasable equipment?** No. An equipment cabin adds a shop
  row, save field, campaign shopping rule and threat-mark question for no
  play value the berth-tonnage model doesn't already give: the large-bay
  trade-off the issue names emerges from shared capacity alone. Revisit only
  if passengers grow personalities.
- **Do passengers react to combat, scans, or sun-skimming?** Not in this
  milestone. No new failure modes beyond the deadline; the `ContractEvent`
  union does not move, which keeps the no-default `contractMessage` switch
  compiling untouched.
- **Refusal message says "CONSIGNMENT"?** Leave it. The `refused` event
  carries no contract (`contracts.ts:259`), and re-plumbing it for one word
  is not worth the churn.

## What is NOT in scope

- Smuggling runs — docs/TODO/110.
- Passenger-specific events (deaths, complaints, bonuses), news headlines,
  reputation effects.
- Any change to how survivors are counted — that is docs/TODO/108's call,
  and the two do not collide: a paying passenger demands a berth, a rescued
  pilot huddles in the crew spaces.

## Watch out for

- **The single seeded roll means every re-cut moves every seeded board.**
  The sweep test's expectations re-baseline once, deliberately, and the
  house rule applies: check the new kind's share at two sample sizes.
- **`storage.ts:479` repairs `contracts` to array-ness only** — rows are
  unvalidated. An imported save whose passenger contracts overflow the hold
  is tolerated the way an overfull hold already is (nothing crashes; you
  cannot buy more until you deliver). Do not add row validation here; that
  is a bigger item if it is ever wanted.
- **`markOf` reads capacity, not occupancy** (`threat.ts:70`), so passengers
  do not change pirate appeal. Correct — leave it; note it in the test so
  nobody "fixes" it.
- **Snapshot `contractOffers` rows are opaque by design**
  (`snapshot.ts:333-335`) — no parse change needed, and do not add one.

## Acceptance

- Passenger offers appear at the seeded rate, verified at two sample sizes;
  qty and reward bounds hold.
- Accepting refuses when berths would overflow the hold; the board footer
  and buy cap both count berths, asserted through `cargoTonnes`.
- Settlement pays on time and expires late through the real
  `settleContracts`; each assertion fails when its branch is reverted.
- The campaign bot accepts through `acceptContract` (its transcription is
  gone) and `npm run campaign` passes every existing gate with the new kind
  in the mix.
- Full gates: `npm test`, `npm run campaign`, `npm run constants:check`.

## Verify

Confirmed by reading, 2026-08-09: the kind roll and formulas at
`contracts.ts:56-95`; `acceptContract`'s cargo-only hold check at
`:321-326`; `settleContracts` deducts the consignment on payment at
`:284-291`; the campaign's own acceptance at `campaign.ts:322-324`; the
sweep test's two sample sizes and ordinary-goods stray check at
`test/contracts.test.ts:171-216`.
