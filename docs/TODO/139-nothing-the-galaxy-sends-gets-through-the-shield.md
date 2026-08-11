# 139 — Nothing the galaxy sends can get through the shield

**Kind:** bug · **Severity:** high · **Size:** medium · **Depends on:** nothing;
**blocks 138 M3**, whose probe must not be baselined against a fight this
one-sided · **GitHub:** none — found by Chris flying it: *"is our shield and
energy recharging too fast — the laser hits from pirates don't seem to do much
damage — or they aren't very accurate at shooting..."*

## Where we are

**This section is the state BEFORE M2**, kept as written because it is the
argument the item was accepted on; the two sections after it are what was
measured and what changed. `SHIELD_REGEN` is 3.06 today, not the 8.925 below.

All three of those guesses are live, and the first one is provable without a
flight.

`SHIELD_REGEN` is **8.925 points a second, per face** (`constants/recharge.ts`:
`MAX_SHIELD` × `SHIELD_REGEN_FRACTION`, 0.035 — a flattened face back in 28.6s).
The bank recovers 6.375 a second on the Cobra anchor, a full bank in 40s.

Against that, the **best case an attacker can ever have** — point blank, the
capped 0.85 hit chance, never out of the firing gate, never missing a reload, and
already flying the hardest build the source ever filed for its job
(`role-variants.ts`) — measured through `npcLaserDamageToPlayer` against
`COBRA_MK_3_HULL_ID` at the mean 1.3s cooldown:

| tier | damage/hit | best-case points/s | seconds to strip the 510-point front pool, net of regen |
| --- | --- | --- | --- |
| t0 Sidewinder `V:17` | 13 | 8.50 | **never** |
| t0 Worm `G:14`, Ophidian `A:31` | 5 | 3.27 | never |
| t1 Krait, Mamba, Gecko, Moray, Cobra Mk I, Bushmaster | 13 | 8.50 | never |
| t1 Rattler `C:34`, Iguana `B:35` | 9 | 5.88 | never |
| t2 Cobra Mk III `T:10` | 13 | 8.50 | never |
| t2 Chameleon `U:37` | 9 | 5.88 | never |
| t2 Fer-de-Lance `W:24` | 21 | 13.73 | 106s |
| t2 Python `U:11`, Monitor `S:30` | 17 | 11.12 | 233s |
| t2 Asp Mk II `T:23` | 29 | 18.96 | 51s |

**Fourteen of seventeen pirate builds in the roster can never get through the
front pool at all.** Not "slowly" — the shield outruns them, so the fight has no
end state. The three that can are the top of the organised-gang tier, and the
hardest thing in the galaxy needs **51 seconds of unbroken perfect fire** to
strip a shield and a bank the player can also run from at any moment.

### The other direction, same assumptions

| player laser | tier-0 Sidewinder | the toughest, Python `U:11` |
| --- | --- | --- |
| pulse (the one you start with) | **2.8s** | 8.0s |
| beam | 1.5s | 6.0s |
| military | **0.7s** | 1.7s |

Laser heat does not rescue it: beam and military rise 0.556 and cool 0.22 a
second, so `LASER_CUTOUT` arrives after ~2.9s of continuous fire — which is more
than enough, because a military laser kills every tier-0 and tier-1 build in
under a second.

**So the exchange is 0.7–8 seconds against 51 seconds-to-never.** That is the
defect, and it is arithmetic rather than feel.

### Two independent confirmations, and the third term

- `npm run survivability`: four attackers, 45 seconds, **24%** of the
  commander's 765 points stripped and she is destroyed **0%** of the time. Four
  at once cannot do it either.
- `npm run flight-probe`: the scripted attacker hurts its target **13.8%** over
  an episode across 4.65 passes.
- `constants/npc-gun.ts:20` already stated the aim half, and it makes everything
  above optimistic: *"a pirate is only inside the firing gate for about 5% of a
  fight, so it is waiting to be aimed, not waiting on the cooldown."* That figure
  is a comment, not a measurement anything currently produces. **M1 is where it
  gets one.**

## What M1 measured — `npm run aim-probe`, 2026-08-11

600 episodes a row, confirmed at 200 on two independent seed bases; the tables
are in `train/logs/todo139/`. The tool flies `train/aim-fight.ts` — a fitted
commander in her own Cobra, armed, over 45 seconds, on two axes nothing else
varies: how SHE flies (`knife-fights`, the hard-turning target closest to
Chris's recorded envelope, or `runs`, survivability's defender that goes flat
out once hurt) and which pilot they fly (`pursuit`, what ships, or `scripted`,
the A/B control).

**The 5% was a memory and it was wrong in both directions, because the two
fights fail differently.** The shipped pilot is inside `NPC_FIRE_GATE` and in
range for **11.9%** of a one-on-one knife fight and **26.5%** with four in the
sky — but for **55%** of a chase. The gun gets 7.5 shots a minute away in the
first case and 26.3 in the third, against the **46.2** this cadence allows, so
the substance of the comment holds everywhere: it is waiting to be aimed.

**What it is waiting for is not the same thing twice**, and this is what tells
M3's two candidates apart:

| she | median range | lined up | in range | mean aim error | hit rate |
| --- | --- | --- | --- | --- | --- |
| knife-fights, one | 364 | 11.9% | 100% | **85.6°** | 44.7% |
| knife-fights, four | 516 | 26.5% | 100% | 67.5° | 63.8% |
| runs, one | 3,456 | 55.0% | 57.8% | **1.4°** | 29.4% |
| runs, four | 3,223 | 54.7% | 55.9% | 0.5° | 29.9% |

In the knife fight the nose is 85 degrees off her — **six times the gate**, so
widening `NPC_FIRE_GATE` cannot be the fix there. In the chase the nose is
already on her and the ship is out of reach instead, at a median 3,456 against a
3,500 gun, which is why the hit rate sits at the bottom of the range curve.

**Nothing in the grid lands more laser on her than one face regenerates.** The
highest laser figure anywhere — four `pursuit` attackers in a knife fight, every
one of them shooting — is **6.31 points a second against `SHIELD_REGEN`'s
8.925 per face**. Per attacker the effective rate is 7.4% of its own best case
one-on-one and 24.8% with four, and by build it runs 12–29%: the Asp Mk II
manages 4.94 of a possible 18.96, the Fer-de-Lance 3.92 of 13.73, and the
thirteen-point builds 1.4–2.2 of 8.50.

**So the plan's table was optimistic and the ordering it forced is confirmed.**
Perfect aim would multiply the laser by three or four; the median build's best
case is 8.50 and the shield's is 8.925, so aim alone cannot get there for
fourteen of seventeen builds. Regen still moves first.

### Three things the plan did not know

- **The missile does more than the gun in the fight a player flies.** Warheads
  cost her 2.53 points a second one-on-one against the laser's 0.67, and 3.99
  against 6.31 with four. In the chase they cost **nothing at all** — nobody
  ever gets a launch in. Contact is 0.0–0.5 either way, so the flight model is
  not the threat; 136 and 137 hold. Her E.C.M. is fitted and never pressed by
  either stand-in, so the warhead column is an upper bound.
- **`npm run survivability` measures the chase, and the chase is the soft
  case.** Its defender runs; its attackers are the control pilot. Against the
  shipped pilot with her turning to fight, a gang of four costs **10.76 points a
  second by all causes against 5.64**, flattens a shield face in **31.7% of
  fights against 6.7%**, and destroys her in **7.8% against 0.2%**. M2's gate is
  stated on survivability's rows; on this evidence it should be stated on the
  knife fight, with survivability kept as the control.
- **The destroyed column is not zero once she stands and fights.** 7.8% at four
  attackers — mostly warheads. It is zero at one and two, which is what the
  "a lone opportunist should still lose" decision asks for.

M1 also put the measurement where the claim was: `constants/npc-gun.ts` states
what its gate and its cadence actually admit, and cites the tool.

## What M2 did — `SHIELD_REGEN_FRACTION` 0.035 → 0.012, 2026-08-11

**A shield face recovers 3.06 points a second instead of 8.925, so a flattened
one is back in 83 seconds instead of 28.6.** Nothing else moved: not the bank,
not a damage number, not the flying. The sweep, the confirmations and the
before/after pairs are in `train/logs/todo139/`, which also says how to take
them again.

**The rule the value satisfies, and it is now a test rather than a sentence:**
no build the galaxy can send may be one a shield face simply outruns. The bound
is the lightest gun in the roster — the Worm and the Ophidian, 3.27 points a
second at point blank — so anything at or above 0.0128 leaves builds that can
never strip a face however perfectly they are flown, which was the defect. 0.012
is the highest value under that bound, and the measured outcomes are already
flat there: between 0.014 and 0.010 the tier-2 columns move two or three points
on either seed grid. **The knee, not the floor**, exactly as 137 chose.
`test/role-variants.test.ts` pins the relationship and fails with fifteen names
in it when the rate goes back.

**What it bought, tier-2 gangs in a knife fight** (200 episodes, the fight a
player flies, before → after):

| gang | a face flattened | reached ENERGY LOW | she was destroyed |
| --- | --- | --- | --- |
| 1 | 0.5% → **3.5%** | 0% → 0% | 0% → 0% |
| 2 | 58.5% → **84.5%** | 15.0% → **27.0%** | 4.0% → 8.5% |
| 3 | 78.0% → **95.5%** | 34.0% → **49.5%** | 15.0% → 35.5% |
| 4 | 87.5% → **97.5%** | 39.5% → **56.0%** | 23.5% → 45.5% |

Over every tier at 600 episodes the same columns go 27.7% → 34.8% flattened,
11.5% → 16.7% ENERGY LOW and 5.0% → 11.8% destroyed for three attackers. The
aim columns are unchanged to a decimal place, which is the control: this moved
what a hit is worth over time, not how anybody flies.

**`npm run survivability`, the control**, moves the way its own header predicts
it can barely move — its defender runs and its attackers are the A/B pilot: a
shield flattened 1% → 8% at four attackers, and **the destroyed column leaves
zero for the first time (0% → 1%)**. Pools stripped is unchanged at 8/14/18/24%,
which is right and worth stating: that column is cumulative damage BILLED, and
no regen rate changes what a gun landed.

### Which of the two candidate rules governs

**The tier-2 gang rule, and the tier-0 rule turned out not to be about this
constant at all.** Swept across the whole range — 0.035 down to 0.007 — a lone
tier-0 pirate never flattens a face, never reaches ENERGY LOW, never kills her,
and dies itself in essentially every fight (1.00 attackers lost an episode). It
cannot be otherwise: at 0.74 points a second it would need five and a half
minutes to take a face off, and it does not live one. So "a lone opportunist
should still lose" holds at every value, and "costing you a face" is decided by
how long a fight lasts rather than by what a face costs to put back. What the
regen does move for a lone attacker is the tier-2 one: 0.5% → 3.5%.

### Recorded, because it will not be true forever

Every shipped pilot flies hand-written code and `game/brains.ts` imports no
weights, so **this is a retune and not a retrain** (invariant 5). The moment a
trained policy ships, a change to this constant is a change to the world it was
fitted in and the weights are stale.

## Which of the three terms may move — and the ordering is forced

**Damage may not move.** `npcLaserDamageToPlayer` returns the pack's own
tabulated number for the (build, hull) pair, gated by 3,900 oracle rows and
`test/elite-a-live-defence.test.ts`. It is the parity claim. And selection has
already been spent: `role-variants.ts` exists precisely because the recommended
default barely bit, and it is already flying the hardest build of every hull the
source ever filed for the job. **There is nothing left to select.**

**Regen and aim are both explicitly Harmless policy**, and both say so where they
live. `constants/recharge.ts`: *"the source gives each hull only an
`energyRechargeRating` and no clock, so what a rating is worth in seconds is
Harmless policy and stated here."* `constants/npc-gun.ts` owns the gate, the
cooldown and the hit curve as ours. So the two terms that can move are exactly
the two that are ours to move, and no fidelity claim is touched by any of this.

**Regen has to move first, and the table above proves it rather than arguing
it.** Perfecting aim cannot fix fourteen builds whose *best case at 100% time on
target* still loses to the shield. Aim is a real second problem — it decides
whether a fight reads as a fight — but it cannot be the whole answer, and doing
it first would be measuring a term that is not binding.

## Decisions already made

- **A lone opportunist should still lose.** `threat.ts` deliberately sends
  Sidewinders to poor commanders, and records the reasoning where it does it:
  threat grows sub-linearly with the prize so upgrades stay felt. The target is
  not "a Sidewinder can kill you"; it is that **an organised gang can**, and that
  a lone pirate costs you something you have to fly home with.
- **The gate is stated against a gang, not a duel**, for the same reason, and
  therefore it is `npm run survivability`'s rows that have to move.
- **No number is chosen on taste.** 137's pattern: sweep the constant, plot the
  column, take the knee rather than the floor, and confirm on a second
  independent grid before believing it.
- **Shields already have a designed cliff and it is unreachable.** `regenerate`
  stops shield recovery below `LOW_ENERGY` (63.75, the last of four banks), which
  is the moment the console says ENERGY LOW and the player is supposed to break
  off. Nothing in the roster can drive a commander there. Making that cliff
  reachable is a large part of what this item is for.

## What to do

**M1 — measure time on aim, because nothing does. — LANDED 2026-08-11.**
`npm run aim-probe` (`train/aim-probe.ts` and the fight it flies,
`train/aim-fight.ts`), the baselines in `train/logs/todo139/`, the bounds a
measurement may not cross in `test/aim-probe.test.ts`, and the findings above.
This was 134's lesson and 136's: the probe comes first, or the fix is scored by
columns that cannot see it. It earned that again — the fight `survivability`
stages turned out not to be the fight the number is wanted about.

**M2 — move the regen, on a sweep. — LANDED 2026-08-11**, 0.035 → 0.012, with
the reasoning and the numbers in the section above and the evidence in
`train/logs/todo139/`. What the milestone said to do:

`SHIELD_REGEN_FRACTION` and `ENERGY_REGEN_FRACTION` are the pair the whole model is anchored on and the pair
a retune moves — their own comment says so. Sweep both against
`npm run aim-probe`'s knife-fight rows, **which is the correction M1 makes to
this milestone**: this said survivability, and survivability stages the chase
against the control pilot, where no warhead ever lands and the gang's laser is
half what it is when she turns to fight. Keep survivability in the sweep as the
control — one constant, before and after, is exactly what it is good for — and
state the rule the chosen value satisfies against the fight a player flies. Two
candidate rules to test, and the plan should land on one: a tier-2 gang must be
able to reach `LOW_ENERGY` inside a fight a player would sit through; and a lone
tier-0 pirate must still lose while costing a face. M1 says where the second one
stands today: one attacker takes 3.19 points a second off her by every cause and
flattens a face in 0.2% of fights.

**M3 — the aim, separately and afterwards.** M1 answers the question this
milestone was to open with, and it is **both, in different fights**: chasing a
commander who runs, the nose is 1.4° off her and the ship is out of reach — the
gate is not the limit, `NPC_HIT_FALLOFF`'s curve is. Standing and fighting, the
nose is 85.6° off — six times the gate, so widening `NPC_FIRE_GATE` would buy
almost nothing and the flight model (`pursuitFly` against a hard-turning target)
is the term. What is left for M3 is to decide whether that geometry is worth
changing at all, now that the regen has moved. **Do not move both regen and aim
in one measurement.**

**M4 — re-baseline what depends on it. — HALF DONE 2026-08-11.**
`docs/COMBAT-SIM.md` says what moved: the wave ramp is untouched and every wave
is harder anyway, so a `furthestWave` from before this date is not comparable
with one after it. 138's roster probe does not exist yet — it is that item's M1,
and it will be baselined in the world this left behind, which is the whole
reason 139 went first in the queue.

## Watch out for

- **`ai-training/scenario.ts` shares these modules** (invariant 5). Every shipped
  pilot was fitted in a world with this regen in it; changing it changes the
  world the brains were trained in. Nothing trained ships today
  (`game/brains.ts` imports no weights), which is the only reason this is a
  retune and not a retrain — say so in the plan's own record, because it will not
  be true forever.
- **`survivability`'s attackers fly `scripted`, not `pursuit`**, and its defender
  is a stand-in that is weaker than the shipped defence. Its header is explicit
  that a row is a **floor**. It is the right tool for a before/after on one
  constant and the wrong one for an absolute claim about how hard the game is.
- The four-bank console reads quarters of one pool (`ENERGY_BANKS`). A regen
  change moves how fast banks come back, which is the most visible instrument on
  the screen — this is a change a player will feel before they can name.
- The escape pod, the torus drive and a station to run to all still favour the
  player, and none of them is in any number above.
- `MAX_SHIELD`/`MAX_ENERGY` are the released 255s (`constants/pools.ts`) and are
  **not** the lever. Only the rates are ours.

## Open questions

None for the queue. Which of the two M2 rules governs is answered by the sweep,
and if both can be satisfied at once the plan takes that value.

## Verification

- The sweep, at two sample sizes, per CLAUDE.md — a regen value that changes rank
  between 200 and 600 episodes has not been measured.
- A test that pins the **relationship**, not the value: the hardest build in the
  roster must be able to strip a full face faster than it regenerates. That is
  the rule this item exists to establish, it is what silently became false, and
  it must be shown to fail by temporarily restoring the old rate.
- `npm run survivability` before and after, all four gang sizes, with the
  destroyed column no longer 0% at the top end — **and `npm run aim-probe`'s
  knife-fight rows beside it**, where M1 found the destroyed column is 7.8% at
  four attackers already. Baselines for both are in `train/logs/todo139/`.
- M1's effective-points-per-second column before and after, so the claim is about
  the fight and not about a constant. The gate to beat is the one M1 states: no
  row in the grid puts more laser on her than one face regenerates.
- `npm run elite-a` unchanged, and `test/elite-a-live-defence.test.ts` in
  particular: **no damage number moves**, which is the guard on the parity claim.
- `npm run check` green.
