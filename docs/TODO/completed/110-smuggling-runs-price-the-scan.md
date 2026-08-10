# 110 — Smuggling runs price the scan

**Kind:** feature / economy · **Severity:** medium · **Size:** medium
**Depends on:** docs/TODO/109 (Chris's ordering for issue #9, and both re-cut
the same seeded offer roll — land the passenger cut first so this one
re-baselines the sweep once)
**GitHub:** #9 (second of two milestones)

## Why

The law is fully built and only ever spends. `law.ts` owns the contraband
table (`CONTRABAND = [3, 6, 10]`, `constants/law.ts:22`); the police scan
fires once per system visit within `SCAN_RANGE` and costs legal status,
disrepute and heat (`world-step.ts:533-546`); carrying contraband raises
pirate appeal (`threat.ts:172-180`, pinned by
`test/economy.test.ts:188-207`); selling it heats up your next arrival
(`trade.ts:137-168`). There is no code path anywhere that *pays* for
accepting that risk — `contracts.ts` imports nothing from `law.ts`, and the
only outlet is the rock hermit (`game.ts:1458-1462`).

A smuggling contract turns the existing punishment machinery into a priced
choice: the reward is high because everything that can go wrong already
exists and already works.

One gap makes this item sharper: **no test anywhere drives the police-scan
block** — `policeScanned` appears nowhere in `test/`. The first behaviour
this feature leans on is currently unpinned.

## What to do

1. **Add `'smuggle'` to the `Contract` kind union.** Commodity drawn from
   `CONTRABAND`, `qty` 2–5, loaded into the hold on accept exactly as the
   cargo branch does (`contracts.ts:321-326`) — from that moment
   `carryingContraband` is true and the scan, the threat appeal and the
   hermit outlet all apply with no new code.
2. **Settlement mirrors the cargo branch** (`contracts.ts:284-291`): the
   consignment must still be aboard, is deducted on payment, `incomplete` if
   you sold or dumped it, `expired` if late. No new refusal kinds.
3. **Reward prices the risk with a flat formula**, not `marketEstimate` —
   the estimate's own docstring records that the Narcotics mean lies (byte
   wrap, `contracts.ts:162-171`), and coupling a reward to it imports that
   lie. Opening bid: `round(qty * (80 + dist * 2) + 200)` — roughly 3× the
   per-tonne rate of an ordinary cargo run — deadline `day + 4 +
   ceil(dist / 12)` like cargo. Tune against the campaign ledger.
4. **Re-cut the roll once:** cargo < 0.40, courier < 0.60,
   passenger < 0.75, smuggle < 0.85, bounty the rest. A smuggle job is on
   any board but uncommon.
5. **Say what it is.** `describeContract`: `Move Nt COMMODITY to DEST — no
   questions asked`; the board row in `ui/screens.ts` marks it in amber the
   way the market screen already flags contraband. Reuse the palette
   spellings already in the file — docs/TODO/93 is counting new hex.
6. **Delivery has consequences, split where the state lives.**
   `settleContracts` already mutates the commander, so the smuggle-paid
   branch also applies `afterDeed(disrepute, DISREPUTE_CONTRABAND_SALE)` —
   commander-owned, pure, and the campaign gets it for free. Regional heat
   is `LivingGalaxy` state the pure module cannot see, so the orchestrators
   apply it from the `paid` event: `Game.applyContracts`
   (`game.ts:964-981`) and the campaign's settle site
   (`campaign.ts:190-193`) both call
   `living.addNotoriety(destination, …)` — modules decide, orchestrators
   apply (invariant 15). Scale the heat beside
   `DISREPUTE_CONTRABAND_SALE` in constants with its own `@rule`.
7. **Teach the campaign bot** (by 109 it accepts through the real
   `acceptContract`): traders refuse smuggle jobs, privateers take them; the
   existing sell loop already models notoriety from contraband
   (`campaign.ts:195-216`). Run `npm run campaign`; the wealth gates and
   `contractsDone > contractsFailed` must hold with the new kind in the mix.
8. **Pin the scan while standing here.** A `world-step` test: contraband
   aboard + police inside `SCAN_RANGE` → one scan per system visit, legal
   status raised, `DISREPUTE_CAUGHT` applied, message said; no contraband or
   no police → nothing. This closes the untested block regardless of the
   rest of the item.
9. **Tests for the contract itself:** settlement (paid deducts the goods and
   applies disrepute; sold-en-route is `incomplete`; late expires);
   generation sweep at the two existing sample sizes asserting the smuggle
   share appears and **every smuggle commodity is in `CONTRABAND`** — the
   mirror of the ordinary-goods stray check at
   `test/contracts.test.ts:198-205`, which itself stays untouched.

## Decisions already made

- Chris (triage comment, #9): illicit-freight contracts use the existing law
  and scan mechanics, land after passenger accommodation, and run through
  the campaign economy before landing.

## Open questions — answered here

- **Does a scan void the contract or confiscate the goods?** No. The scan
  stays exactly what it is — status, disrepute, heat, and hostile bounty
  hunters from Offender up (`npc.ts:289-300`). That ladder *is* the risk
  being priced; confiscation would be a new mechanic bolted on in passing,
  and the trainer's stated assumption that "a scan cannot read contraband"
  in the sim (`combat-sim-safety.ts:77`) stays undisturbed.
- **Gate offers by government?** Not in this milestone. The generator would
  need to start reading government for kind selection, and an anarchic-only
  board is flavour, not mechanics. Recorded as follow-up flavour if the kind
  proves fun.
- **Can you fill a smuggle contract from a hermit or the market?** Yes, same
  as a cargo run — the consignment is fungible tonnage of the commodity.
  Buying replacement narcotics at a hermit to cover what you sold is exactly
  the kind of play this feature exists for; no code guards against it and
  none should.

## What is NOT in scope

- Character consequences beyond the existing deed constants — docs/TODO/96
  (deferred) owns "a smuggler in good odour"; this item must not implement a
  piece of it.
- Confiscation, bribes, or any change to the scan mechanic itself.
- Passenger work — landed by 109.

## Watch out for

- **The stray check duality.** `contracts.test.ts:198-205` asserts a cargo
  consignment is always ordinary goods. The smuggle mirror must be a
  separate assertion, not a widening of that one — the two sets are disjoint
  by construction (`constants/commodities.ts:24` says so) and should stay
  independently pinned.
- **Disrepute inside `settleContracts` is a first** — the function touches
  `credits` and `cargo` today, not `disrepute`. It is still commander state
  and still pure, but say so in the docstring, because the campaign's
  numbers move when settlement starts applying deeds.
- **Heat application must not double.** The game applies it in
  `applyContracts`, the campaign at its settle site — one each, from the
  same event. A second application in `station.ts`'s dock path would be easy
  to add by accident.
- **The scan test needs the world stream** (invariant 11) — drive it through
  the real `world-step` with seeded placement, not a hand-rolled police
  position that happens to work.

## Acceptance

- [x] Smuggle offers appear at the seeded rate with contraband-only
      commodities, verified at two sample sizes — 9.3% of 2,327 offers and
      9.6% of 11,614, measured out of the real `generateContractOffers` over
      the whole galaxy. All 1,331 jobs draw from `CONTRABAND` and carry 2–5 t.
      The contraband check is a SEPARATE assertion from the ordinary-goods one
      as the plan required: drawing smuggle commodities from `ORDINARY_GOODS`
      reddens the new check and leaves the cargo check green.
- [x] Accepting loads the goods; the police scan then fires on the way out —
      driven through the real `world-step` with a police ship spawned the way
      the world spawns one. Disabling the scan block reddens 5 checks. The
      range is BISECTED out of the step (measured 2600.01 against
      `SCAN_RANGE` = 2600) rather than probed at the constant, so widening it
      by a single unit fails.
- [x] Delivery pays, deducts the goods, applies `DISREPUTE_CONTRABAND_SALE`
      and heats the destination once in game and campaign alike; selling the
      consignment en route voids it as `incomplete`. The once-only property is
      pinned through the real dock in `test/game.test.ts`: a second
      `enterDocked` adds nothing, and both removing and doubling the
      application redden it.
- [x] `npm run campaign` passes all existing gates with smuggle jobs in the
      mix. The one failing check in the `all` run — the bounty-hunter cohort's
      "a commander who has upgraded is safer" — fails identically on `main`
      before this change (early 45 deaths · late 47, the same numbers), so it
      is pre-existing and untouched here.
- [x] Full gates: `npm run check` (lint, 3,400 tests, sizes, constants, the
      generated catalogues) exits 0, and `npm run campaign` passes.

## What the ledger said

**Smuggling pays the privateer about 10% more, and it earns it.** Measured on
40 commanders × 60 legs: net worth 7,245 → 7,973 Cr, deaths 1.0 → 0.8,
contracts 33.5/24.4 → 33.4/26.5 done/failed. Instrumented over the same run,
424 smuggle jobs were offered and 265 accepted, settling 132 paid · 59
incomplete · 74 expired. A 50% completion rate against 56% for the board as a
whole is the risk being priced working as intended: the 59 incompletes are
consignments that left the hold before the far end, and contraband aboard is
exactly what raises pirate appeal (`threat.ts`). The reward formula is kept as
the plan wrote it — nothing in the ledger asked for a change.

**The trader cohort never takes a smuggling job, and its numbers still moved —
upward.** At 1,000 commanders, where 109 established the median is stable to
±0.2%: net worth 6,495 → 6,981 Cr (+7.5%), contracts 27.1/23.3 → 28.7/23.0
done/failed. That is the seeded roll re-cut, not the new kind, and it is the
opposite direction to 109's 13% cost.

The reason is *where* the 10 points came from: 109 took them off cargo alone,
this milestone took 5 off cargo and 5 off **bounty**. Instrumented by kind over
300 trader careers (paid / failed, before → after):

| kind      | paid          | failed        |
|-----------|---------------|---------------|
| cargo     | 4291 → 4329   | 3153 → 3067   |
| courier   | 1776 → 2078   | 1520 → 1621   |
| passenger | 1350 → 1585   | 1197 → 1227   |
| bounty    | 700 → 660     | 1148 → 1006   |

Cargo completions are flat *despite* losing 5 points of the roll, and the gain
is entirely courier and passenger work — whose shares did not move at all. What
changed is what the three `MAX_CONTRACTS` slots are holding. A bounty job is the
one kind a trader accepts and then cannot work: `settleContracts` only counts
kills made in the job's own destination system, so it occupies a slot until the
deadline passes (the same finding that made the bot take one at a time). 182
fewer bounty jobs were taken, and the freed slots went to work that settles by
arriving.

So the trader sees *fewer* usable offers per board — it skips smuggle jobs
entirely — and completes more anyway, which says the binding constraint was
never offer supply. 109's trade-off is unchanged; this cut simply landed on the
wasteful side of the board.

## Also landed

- **`test/contract-offers.test.ts`.** `test/contracts.test.ts` crossed the
  400-line ceiling and was two subjects: what the board may OFFER (properties
  of `generateContractOffers`, swept over the galaxy at two sample sizes) and
  what taking a job costs and delivering it pays. They share no fixture, only
  the module. Split rather than exempted.
- **`SMUGGLE_DELIVERY_NOTORIETY` lives in `constants/contracts.ts`**, not
  beside `DISREPUTE_CONTRABAND_SALE` as step 6 proposed. It is a property of
  the JOB, like `PASSENGER_BERTH_TONNES` beside it, and `constants/character.ts`
  states in its own header that it is not about the Government or the regions.
  The two consequences are cross-referenced instead.
- `constants:check` flagged that 0.06 is also `HEAT_DECAY` — a rate per DAY
  beside a quantity per TONNE. Confirmed coincidental; both now carry distinct
  `@rule` ids so either may move alone.
- **The plan's premise about the market screen was wrong.** Step 5 says the
  board should mark a smuggle row amber "the way the market screen already
  flags contraband" — `renderMarket` does no such thing; nothing outside
  `game/screens/trade.ts`'s sell path calls `isContraband`. The board row is
  amber via `var(--hud-amber)`, the warning colour the file already spells
  everywhere else, so no new hex is coined (docs/TODO/93). Flagging contraband
  on the market screen itself is left unbuilt: it is a separate change and was
  not asked for.

## Verify

Confirmed by reading, 2026-08-09: the scan block and its once-per-visit
latch at `world-step.ts:533-546` with `policeScanned` reset on dock
(`station.ts:176`); no `policeScanned` reference under `test/`; no import
from `law.ts` in `contracts.ts`; the cargo settlement deduction at
`contracts.ts:284-291`; contraband sale consequences at
`trade.ts:137-168`.
