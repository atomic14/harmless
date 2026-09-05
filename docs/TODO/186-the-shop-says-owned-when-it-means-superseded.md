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
