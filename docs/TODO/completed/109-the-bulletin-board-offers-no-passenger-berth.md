# 109 — The bulletin board offers no passenger berth

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

- [x] Passenger offers appear at the seeded rate, verified at two sample
      sizes — 15.2% of 2,300 offers and 15.6% of 11,556, measured out of the
      real `generateContractOffers` over the whole galaxy. `qty` is 1–3 heads
      across all 2,155 jobs and none carries a commodity, so the
      ordinary-goods stray check above it stays exactly as it was.
- [x] Accepting refuses when berths would overflow the hold, including
      against berths already booked by another job — the case that fails if
      `cargoTonnes` reads the cargo array alone. The board footer and the
      trade screen's buy cap both call `cargoTonnes`, which counts berths;
      `test/economy.test.ts` pins the arithmetic beside the hold-agreement
      block, with a passenger job and stock in the same hold.
- [x] Settlement pays on time and expires late through the real
      `settleContracts`, with no new branch: passengers travel with the
      contract, so the courier shape already covers them. Dropping the
      contract is what gives the bays back, and the tests assert that too.
- [x] The campaign bot accepts through `acceptContract` — its
      hold-check-and-push is gone — and `npm run campaign` passes every gate
      with the new kind in the mix.
- [x] Each new gate was proved able to fail: removing the berth term from
      `cargoTonnes` reddens 6 checks, removing `acceptContract`'s passenger
      branch 3, removing `describeContract`'s line 2 (the remaining two are
      the bounty fallback describing passengers as a pirate hunt, which is
      why the line is pinned), deleting the generation branch 1, and widening
      `qty` past three heads 1.
- [x] Full gates: `npm run check` (lint, 3,373 tests, sizes, constants, the
      generated catalogues) exits 0, and `npm run campaign` passes.

## What the ledger said, and what moved because of it

**The fare pays MORE per tonne than freight, not less.** "What to do" step 3
predicted the opposite, but its own formula never gives it: at a typical
40-tenth hop a berth earns about 135 tenths a tonne against a cargo run's
100, at every `qty` and every distance. The formula is kept as written,
because the relationship it actually produces is the better game — a smaller
footprint and a tighter deadline, paid for at a better rate, is a choice;
less money for a harder deadline is a job nobody would ever take. The words
in this plan were the guess and the arithmetic is the answer.

**Passenger work costs the trader cohort about 13% of its net worth, and the
berths are not why.** Measured at 1,000 commanders, where the median is
stable to ±0.2%: 7,446 Cr before, 6,495 Cr after. Three controls locate it:

- berths priced at 0 t instead of 2 t recover almost none of it (6,587 Cr),
  so hold competition is not the cost;
- perturbing the offer generator's random stream without changing a single
  reward reproduces the baseline exactly (7,460 Cr), so it is not sampling;
- what remains is the roll re-cut, and specifically the 10 points taken off
  cargo.

**A cargo contract is worth far more than its reward, because failing one is
paid.** An expired or short consignment leaves the goods in the hold, and
both the game and the campaign bot then sell them: instrumented over 1,000
careers, failed cargo contracts abandon 55 tonnes per career worth 1,353 Cr —
comparable to a whole career's net worth and larger than every contract
reward combined. Cutting the cargo share therefore costs more than the
rewards it removes. That is a pre-existing flaw in the economy, not something
this milestone introduced, and it is out of scope here; it is the first thing
to look at if the ledger is ever re-tuned.

## Also landed

- **`src/game/market.ts`.** `contracts.ts` crossed the 400-line ceiling and
  was two subjects sharing a name: what the board offers you, and what a
  station charges you. No caller wanted both. The market half —
  `applyMarketPressure`, `makeLocalMarket`, `marketEstimate`, `hermitMarket`
  — moved unchanged; invariant 10 is satisfied by any pure module the
  campaign shares, not by that filename.
- **`test/missions.test.ts`.** Same reason: `test/contracts.test.ts` carried
  contracts, the Navy mission and trumbles, and crossed the ceiling. The
  latter two share the question "what happened while I was flying?".
- `constants:check` warns that 2 also appears as `CHART_Y_SQUASH`,
  `FUGITIVE`, `MISSILE_RELOAD` and ten more: confirmed coincidental, and
  `PASSENGER_BERTH_TONNES` carries its own `@rule` so it stays free to move.

## Verify

Confirmed by reading, 2026-08-09: the kind roll and formulas at
`contracts.ts:56-95`; `acceptContract`'s cargo-only hold check at
`:321-326`; `settleContracts` deducts the consignment on payment at
`:284-291`; the campaign's own acceptance at `campaign.ts:322-324`; the
sweep test's two sample sizes and ordinary-goods stray check at
`test/contracts.test.ts:171-216`.
