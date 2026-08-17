# 178 — The campaign simulator keeps its own copy of a purchase

**Kind:** defect · **Severity:** medium · **Size:** small · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** none

## Where we are

Chris asked for the next fix on 2026-08-17. This came out of a reading of
`test/campaign.ts`. docs/TODO/176 M3 named that file on a line count alone.

**The line count was not the defect.** The report writer it named is 271 lines
of 1,027, and it prints what the careers did. Nothing is wrong with it.

### An equipment purchase has two homes

**`src/game/screens/trade.ts:306` applies a purchase.** It deducts the
catalogue price, refunds the old gun, and sets the flag. Eighteen cases.

**`test/campaign.ts:556` applies a purchase too.** Sixteen cases, the same ids
and the same flags. It is a copy.

**Invariant 10 forbids exactly this:** *"Economic rules stay outside `game.ts`.
They live in modules that the headless campaign shares."* A purchase moves
credits, so it is an economic rule. It lives in a SCREEN, and the campaign keeps
a copy rather than sharing it.

### The copy hardcodes three constants the real game reads

| the rule | `screens/trade.ts` | `test/campaign.ts` |
| --- | --- | --- |
| the missile cap | `MAX_MISSILES` | `4` |
| refund on a beam | `PULSE_LASER_PRICE` | `4000` |
| refund on a military laser | `BEAM_LASER_PRICE` | `10000` |

**Measured on 2026-08-17, all three agree today.** The constants hold 4, 4,000
and 10,000. So this is a latent defect rather than a live one.

**NOTHING GUARDS IT.** `test/constants.test.ts` is the gate that exists for a
constant with a second home, and its scan root is `../src/`. So a copy under
`test/` is invisible to it.

### Three failure modes, and no gate reaches any of them

1. **A new item lands in the catalogue and in `trade.ts`.** The campaign deducts
   its price and applies nothing at all. A commander pays and owns nothing, and
   the balance report is quietly wrong.
2. **A price constant moves.** The game refunds the new value and the campaign
   refunds the old one, so the two economies drift apart.
3. **`MAX_MISSILES` moves.** The two caps drift the same way.

The first is the worst, because it is silent and it costs the commander money.

### `shop.ts` is already the home for the other half

`src/game/shop.ts` holds `equipmentOwned`, which is a switch over the same ids
that READS each flag. It is pure, and `test/campaign.ts` already imports it. So
the reader of the flag is shared and the writer is not.

## What to do

One milestone.

### M1 — one purchase rule, in the module both callers already share

**`applyPurchase` goes in `src/game/shop.ts`**, beside `equipmentOwned`. It
takes a commander and an id. It sets the state and it moves the refund.

**It stays pure.** The trumble's line is presentation, so `screens/trade.ts`
keeps saying it. The price deduction stays with the caller, because each caller
decides differently whether a purchase is allowed at all.

**Both callers then use it**, and `test/campaign.ts`'s switch is deleted.

**The gate is the silent failure.** Drive `applyPurchase` once per id in
`EQUIPMENT_CATALOGUE`, and demand the commander CHANGED. An id that reaches no
case fails, which is failure mode 1 caught before it ships.

## Decisions already made

- **Chris asked for the next fix on 2026-08-17**, after docs/TODO/177 landed.
- **The report writer is not the defect**, and docs/TODO/176's third candidate is
  withdrawn with this item's record. It was named on a line count.
- **`equipmentOwned` stays as it is.** It reads a flag and this writes one, and
  the two switches answer different questions.

## Open questions

None. The home is settled by the fact that `shop.ts` already holds the reader.

## Watch out for

- **The two switches are not identical, and the difference is deliberate.**
  `trade.ts` carries `fuel` and `trumble`, and the campaign carries neither. The
  campaign refuels through `refuelCost`, and a trumble is a joke item it never
  buys. `applyPurchase` covers both, and the campaign simply never asks for
  them.
- **The refund is a CREDIT, not a price.** `applyPurchase` adds it. What a
  purchase COSTS stays with the caller, and this item must not move it.
- **`test/economy.test.ts` and `test/trade.test.ts`** both drive the shop. Read
  what they already pin before adding a gate that says it again.
- **The campaign's numbers must not move.** If the copy and the real rule agree
  today, then sharing the rule changes no output at all. See Verification.

## Verification

The gates always run: `npm run check`.

**The tier table puts this at "the economy, or a career-long balance"**, so
`npm run campaign` runs at two sizes. **The evidence is that nothing moved.**
The copy and the rule agree today. So a campaign that shares the rule must print
what it printed before, byte for byte.

Take the baseline before M1, at both sizes.

**The gate must be proved able to fail**, and each claim alone:

1. add an id to `EQUIPMENT_CATALOGUE` that `applyPurchase` has no case for, and
   the per-id claim reddens;
2. change the beam refund to a literal, and the refund claim reddens.

**Report the assertion count**, and say what the campaign printed at both sizes.

## Outcome

### M1 — one purchase rule, shared

`applyPurchase` is in `src/game/shop.ts`, beside the `equipmentOwned` that reads
the same flags back. `screens/trade.ts` and `test/campaign.ts` both call it, and
the copy is gone.

**THE CAMPAIGN PRINTS EXACTLY WHAT IT PRINTED BEFORE.** Byte-identical at 40
commanders by 60 legs, and at 120 by 80, once the wall-clock line is masked.
That is the evidence the plan asked for: the copy and the rule agreed, so
sharing the rule moved nothing.

**THE SCREEN NOW IMPORTS NO ECONOMIC CONSTANT AT ALL, AND THE PLAN DID NOT HAVE
THAT.** `screens/trade.ts` imported `MAX_FUEL`, `MAX_MISSILES`,
`PULSE_LASER_PRICE` and `BEAM_LASER_PRICE`. All four went with the rule, and
`tsc` found them unused. A screen holding a price list was the shape of the
defect.

**THE GATE THE PLAN ASKED FOR ALREADY EXISTED.** `test/trade.test.ts` holds
*every catalogue id changes the commander when bought*, and it drives
`buyEquipment` to say it. **It could never reach the campaign**, because the campaign had
its own switch. So the fix's real value is that an existing gate now guards a
second caller. M1 added no duplicate of it.

**What M1 added instead is one scan: no second copy comes back.** It reads the
WRITE rather than the switch, and the first draft did not.

**THE FIRST SCAN WAS TOO NARROW, AND THE BREAK-IT STEP FOUND IT.** It looked for
`case 'largeBay'`. A copy written as an if-chain passed it. Fitting a piece of
kit is a write of `true`, whatever shape the code around it takes, so the scan
reads that now. `test/campaign.ts` holds one equipment write of its own, and it
is `escapePod = false` in the encounter model. That is a loss rather than a
purchase.

**THE PLAN'S SECOND BREAK-IT COULD NOT FAIL, AND THAT IS A FINDING.** It said to
write the beam refund as a literal and watch the refund claim redden. The
literal is 4,000 and `PULSE_LASER_PRICE` is 4,000, so the suite stayed green.
**Nothing in the tree catches an inline literal that happens to be right today.**
`test/constants.test.ts` reads declarations rather than expressions. The claim is
live, and a refund of `PULSE_LASER_PRICE + 1` reddens it.

**Proved able to fail three ways, and each one alone:**

1. a catalogue id with no case — the per-id check reads 16 of 17;
2. a copy written as an if-chain in the campaign — the scan reddens;
3. the same copy written as a switch — the scan reddens.

**Nothing was added to the suite's count.** It is 4,845 assertions, as it was.
Three checks arrived and the campaign's own switch took none away, because a
simulator is not part of `npm test`.
