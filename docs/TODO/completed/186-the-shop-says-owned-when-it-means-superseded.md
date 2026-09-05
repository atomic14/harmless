# 186 — The shop says owned when it means superseded

**Kind:** bug · **Severity:** low · **Size:** small · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** #38

## Where we are

**Chris reported it on 2026-09-04 (GitHub #38):** *"I bought a military laser
and that marked the beam laser as "owned" as well."*

**The report is true, and the cause is one line.** `equipmentOwned` in
`game/shop.ts` answers the beam row with `e.laser !== 'pulse'`. A commander
holds one laser grade: pulse, beam or military. So a military laser makes the
beam row read as owned.

**The line was a purchase guard inside an ownership check.** The shop sells
forward only. A beam laser is an upgrade from a pulse laser, and a military
laser is an upgrade from either. The check refused the beam row under a
military laser, and the only word the row could say was OWNED.

### Three readers, three wrong answers

`equipmentOwned` has three readers, and each one repeats the false answer:

| reader | what it says today |
| --- | --- |
| `ui/screens-trade.ts`, `equipRows` | the beam row reads OWNED under a military laser |
| `ui/screens.ts`, the status screen | the fit lists Beam Laser and Military Laser together |
| `test/campaign.ts`, `kitValue` | the net worth counts a beam the commander does not hold |

**The campaign buyer is the one reader that needs the false answer.** It skips a
row that reads as owned. Under a strict check, a commander with a military laser
would buy a beam laser, and `applyPurchase` would fit it. That is a downgrade,
and the refund is a pulse laser's price. So the strict check needs a second
question beside it.

## What to do

One milestone.

### M1 — two questions in the shop

`game/shop.ts` answers two questions, in two functions:

1. `equipmentOwned(id, c)`: is this row the fit? The beam row answers
   `e.laser === 'beam'`.
2. `equipmentSuperseded(id, c)`: does a better gun fill the mount this row
   would fill? Only the beam row can answer yes. It does so under a military
   laser.

`equipRows` gives the row a third status, `SUPERSEDED`. `renderEquip` prints
it. `buyEquipment` refuses any status that is not empty, so the purchase guard
holds with no change.

The campaign buyer skips a row that is owned or superseded. `kitValue` reads
ownership alone.

## Decisions already made

- **The shop sells forward only.** No downgrade is on sale. The manual calls the
  beam laser "the first upgrade that changes a fight", and nothing in the
  product sells a gun back. A row under a better gun is refused, as it was.
  Only the word changes.
- **The word is SUPERSEDED.** It is one word, and it is not OWNED.

## Open questions

None.

## Watch out for

- **`applyPurchase('beam')` refunds a pulse laser's price, whatever the fit.**
  That is correct today, because the shop refuses the row under a military
  laser. It stays correct only while the refusal holds. The test pins the
  refusal.
- **`npm run campaign` will move.** `kitValue` no longer counts a beam under a
  military laser. So the net worth of a commander with a military laser falls
  by the beam's price. Record the two sizes before and after.

## Verification

The gates always run: `npm run check`.

The tier: the change touches the economy's report, so `npm run campaign` at two
sizes, before and after. The only figure that may move is net worth, and only
for a commander who holds a military laser.

The gate is in `test/trade.test.ts`:

- under a military laser, the beam row reads SUPERSEDED and not OWNED;
- a purchase of that row is refused, and no money moves;
- `equipmentOwned('beam')` is false under a military laser, and true under a
  beam laser;
- the status screen's fit lists one laser.

Prove it able to fail: restore `e.laser !== 'pulse'` for one run.

## Outcome

### M1 — two questions in the shop

`game/shop.ts` asks two questions. `equipmentOwned('beam')` answers
`e.laser === 'beam'`. `equipmentSuperseded` answers yes for the beam row under
a military laser, and for nothing else. `equipRows` gives the row the status
`SUPERSEDED`, and `renderEquip` prints the word. `buyEquipment` did not change:
it refuses any status that is not empty, and that is the purchase guard.

The campaign buyer skips a row on either answer. `kitValue` and the status
screen read ownership alone, so each lists one laser.

**THE GATE IS 12 ASSERTIONS IN `test/trade.test.ts`, AND IT WAS PROVED ABLE TO
FAIL TWO WAYS.** The old line, `e.laser !== 'pulse'`, reddens three of them.
A superseded question that always answers no reddens six. In that second run
the shop sold the beam laser back under a military laser, and the fit went to
`beam`. That is the downgrade the plan warned of, and the gate sees it.

**THE CAMPAIGN MOVED, AND ONLY WHERE THE PLAN SAID IT WOULD.** Measured at
40 x 60 and at 200 x 100, all three strategies, before and after:

| size | strategy | column | before | after |
| --- | --- | --- | --- | --- |
| 40 x 60 | trader | best career | 14,252.1 Cr | 13,252.1 Cr |
| 40 x 60 | trader | beam owned | 95% | 90% |
| 40 x 60 | privateer | best career | 21,489.0 Cr | 20,489.0 Cr |
| 40 x 60 | privateer | beam owned | 90% | 83% |
| 200 x 100 | trader | median net worth | 17,974.5 Cr | 17,007.4 Cr |
| 200 x 100 | trader | beam owned | 96% | 30% |
| 200 x 100 | privateer | median net worth | 22,049.0 Cr | 21,278.2 Cr |
| 200 x 100 | privateer | beam owned | 95% | 17% |

**The best career fell by exactly 1,000 Cr at both sizes**, which is the beam
laser's price. That career held a military laser, and its net worth counted a
beam it did not hold. **The beam column now reads ownership.** At 200 x 100,
66% of traders end with a military laser, and the beam column fell from 96% to
30%. The sum of the two is the old figure, because every one of those
commanders traded the beam in on the way up.

**Cash in hand did not move by a tenth of a credit at either size.** Nor did
any other equipment column. So no purchase changed, and the buyer's second
question is the same refusal the old check made.

**THE SCALING ROW MOVED, AND THE PLAN DID NOT HAVE IT.** At 200 x 100 the
poorer half's appeal read 0.32 and reads 0.33, and the gang rate moved by 0.1.
The row sorts careers by net worth to split the halves. A corrected net worth
moved a few careers across the median, and the halves' membership moved with
them. The fights themselves did not change, because the cash and the kit did
not.

**A COMMIT WENT OUT WITH `ste:check` RED, AND IT WAS THE TRIAGE COMMIT.** The
index paragraph that announced this item held a 30-word sentence. The gate
reads the index, and the plans were checked before the index was written. The
landing commit splits it.

4,915 assertions became 4,927.
