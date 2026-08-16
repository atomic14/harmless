# 143 — The counter never says which tonnes a contract claims

**Kind:** defect · **Severity:** low · **Size:** small · **Depends on:** nothing
· **Blocks:** nothing · **GitHub:** #26 — *"I think the contract cargo can be
sold - I'm not sure this should be allowed."*

## Where we are

The sale is allowed, and it is allowed on purpose. `game/contracts.ts:167` says
so in the code that runs: *"a smuggling run is exactly as voidable as freight,
because what you sold at a better price on the way is the temptation the job is
built around"*. docs/TODO/112 took the freight back off a failed run.
docs/TODO/113 added the bill and the mark: a consignment that arrives short is
charged at the base price of the missing tonnes and costs
`DISREPUTE_SHORTED_CONSIGNMENT` (5).

**The triage measured whether the temptation pays. It does not.** The probe ran
`generateContractOffers`, `generateMarket` and `settleContracts` over 138 freight
jobs from 86 home systems of galaxy 1. It sold each consignment at the DEAREST
price any market in the galaxy can roll, then let the job expire.

| outcome | result |
| --- | --- |
| jobs where the sale beat delivering | 0 of 138 |
| closest the sale ever came | delivering pays 2.24 times the sale |
| mean over 50 jobs sold at the LOCAL price | deliver 1,781.8 Cr, sell 141.8 Cr |

So the rule is not a hole. The reward dominates the goods by an order of
magnitude, and the doc comment that says otherwise is stale: *"a 10t cargo run is
~470 Cr of goods against a fee of ~79"* described the board before the rewards
in `game/contract-offers.ts` were set against the campaign.

**What is actually wrong is that the pilot cannot see it.** The market screen's
`IN HOLD` column reads `c.cargo[i]` and nothing else
(`src/ui/screens.ts:315`). `MarketScreen.sell` knows nothing about contracts at
all (`src/game/screens/trade.ts:139`). The only screen that names a consignment
is the bulletin board, and **a rock hermit has no bulletin board** — the tunnel
opens the market and nothing else (`game/game.ts:1832`). That is why the issue
was found at a hermit. So a pilot sells 10 tonnes of Food, and learns three jumps
later that five of them were the job.

## What the triage found that the issue did not report

**A shortfall is charged at the door and free everywhere else.** `settleContracts`
bills and marks a consignment that arrives short. The same missing tonnes arriving
LATE cost nothing at all — `test/contracts.test.ts:151` pins that as *"an honest
late failure charges nothing and marks nothing"*, and it cannot see that the hold
is short because it was sold rather than robbed.

**This is recorded, not scheduled.** The measurement above is what settles it: a
commander who sells the consignment and never delivers is worse off than one who
delivers, at every price in the galaxy. There is nothing to close. Write it down
so that nobody has to measure it a third time.

## What to do

### M1 — the hold says what is spoken for

Add one derived reader to `src/game/commander.ts`, beside `berthTonnes`:

```
export function consignedTonnes(c: CommanderData, commodity: number): number
```

It sums `qty` over the `cargo` and `smuggle` contracts for that commodity.
DERIVED, never stored, for the reason `berthTonnes` gives in its own comment: a
stored copy can disagree with the list, and the screen, the sale and settlement
must not be able to hold three different answers.

`renderMarket` then marks the `IN HOLD` cell. A row with consigned tonnes reads
`10t · 5 CONSIGNED`, with the suffix in `--hud-amber`. That is the colour
`renderContracts` already spends on an illicit job (`src/ui/screens.ts:1415`), and
for the same reason: flagged, not disguised. Coin no new colour. Since
docs/TODO/93 there is nowhere to coin one except `src/palette.ts`.

### M2 — the sale asks once

`MarketScreen.sell` refuses the first press on a row that holds consigned
tonnes, and says `5T CONSIGNED — PRESS V AGAIN TO SELL`. The second press sells.

Arm one row at a time. Clear the armed row on any selection change, on the
opposite trade key, and on leaving the screen. `SELL ALL` arms the same way, so
the fastest way to void a contract is not one keystroke.

## Decisions already made

**Mark it; keep the rule** (Chris, 2026-08-13). The sale stays legal everywhere,
including at a hermit. The choice becomes an informed one instead of an accident.

**No new refusal, and no hermit-only door.** A rule with two homes is the thing
`CLAUDE.md` forbids, and the hermit is the worst place to put a door: it is the
one market that never asks what is in your hold.

**The warning is a second keypress, not a dialogue.** The screen host has no
confirm, and adding one for a single row would be a new screen kind for one
message. The two-press form is the smallest thing that stops the sale being
silent.

## Watch out for

**A hermit market and a station market are the same array.** `game.ts:1839`
assigns `state.hermitMarket` into `state.market`, so the mark and the warning
follow the pilot into the tunnel with no hermit-specific code. Do not write any.

**Goods are fungible and the hold keeps no per-contract provenance.** A commander
carrying 15t of Food against a 5t consignment owns 10 of it. The mark says
`15t · 5 CONSIGNED`; it must not say the whole hold is spoken for.
`test/contracts.test.ts:157` pins the settlement half of that rule.

**A passenger contract carries no cargo.** `consignedTonnes` must skip
`passenger`, `courier` and `bounty`. Berths are `berthTonnes`, they are already
counted in `cargoTonnes`, and they appear on no market row.

**`test/playtest.js` sets `MarketScreen.selected` directly and calls `buy()`.**
The armed state must not make `sell()` unreachable from that path. Give the
harness the second press, or arm from the input handler rather than from `sell`.

**One word, one meaning.** The board says `CONSIGNMENT`. Use `CONSIGNED` on the
row, and do not reach for "reserved", "booked" or "contracted".

## Verification

Tier: this touches a screen and a derived reader. No game rule moves, no
constant moves and no balance number moves. `npm run check` is the whole of it.
Do not run `npm run campaign` for it — the harness never opens a market screen.

New gates:

1. `test/contracts.test.ts` or a new `test/consigned-hold.test.ts` —
   `consignedTonnes` over the five contract kinds, over a pooled hold, and over
   two contracts for one commodity.
2. A screen test through `test/screen-capture.ts`, the recording `document` that
   docs/TODO/140 built. Paint `renderMarket` and read the cell back: a consigned
   row carries the suffix, a clean row does not, and a pooled hold reports the
   consignment rather than the pool.
3. A trade test: the first `V` on a consigned row sells nothing and says so, and
   the second sells. Then the same for `SELL ALL`. Then that changing row
   disarms.

**Prove each gate can fail.** Delete the suffix for 2. Return `c.cargo[i]` from
`consignedTonnes` for 1. Sell on the first press for 3.

**Chris flies it.** The question no assertion reaches is whether the amber
suffix reads as a warning or as clutter on a screen that already carries four
columns and a fuel line.

## What landed

Both milestones landed on 2026-08-13. No game rule moved. No constant moved. The
sale of a consignment is as legal as it was, at every market, a hermit's
included.

**M1 — the hold says what is spoken for.** `consignedTonnes` sits beside
`berthTonnes` in `src/game/commander.ts` and is derived for the reason that one
gives. It sums a `cargo` job and a `smuggle` job, and it skips the three kinds
that carry no goods. `renderMarket` marks the `IN HOLD` cell:
`10t · 5 CONSIGNED`, in `--hud-amber`. No colour was coined.

**M2 — the sale asks once.** The first sell key on a marked row spends itself on
`5T CONSIGNED — PRESS V AGAIN TO SELL`. One row is armed at a time. Four things
take the arming down: a moved cursor, a click on a row, a purchase, and leaving
the screen. `SELL ALL` arms the same way.

`test/consigned-hold.test.ts` is 38 assertions. All three gates were shown to
fail, in the three ways the plan named. `npm run check` passes at 4,413
assertions, with zero constants findings and no unlisted oversize file.

## What the milestones found that the plan did not have

**The arming went into `input`, and the plan's warning names the wrong caller.**
`test/playtest.js` never calls `sell` at all. It moves cargo out of the hold
itself, and the only market call it makes is `g.buyCargo`. The path that DOES
reach `sell` is `Game.sellCargo`, the `@internal` handle beside it. Either way
the answer is the same one the plan offered second: the arming lives in the
input handler, so `sell` stays the plain action a scripted caller needs.

**A row already sold down to nothing still carries the mark.**
`consignedTonnes` reports the JOB and never the hold, so an emptied row reads
`- · 5 CONSIGNED`. That is deliberate, and it is the last warning the pilot
gets: `settleContracts` bills exactly those five tonnes at the door. The screen
test pins it.

**The warning and the receipt take one door.** Both go through `ctx.message`, so
a test that counts what the screen said counts the receipt too. The warning is
counted by its words instead.

**The message is allowed to spell a key, and one line of another gate is why.**
`test/key-prose.test.ts` fails on any message in `src/game/` that writes a bound
key in words. It excludes `src/game/screens/`, because a screen reads a raw code
and prints its own keyline. `PRESS V AGAIN TO SELL` is inside that exclusion.

**One message serves two buttons.** A click on `SELL ALL` arms the row and says
`PRESS V AGAIN TO SELL`, which names the other key. The second press of either
key sells, so the sentence is not wrong — but it is one door described by one of
its two names. Left as it is, because the plan fixes the words and because two
wordings for one warning is the thing "one word, one meaning" forbids.
