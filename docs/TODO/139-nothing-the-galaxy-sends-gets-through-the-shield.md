# 139 — Nothing the galaxy sends can get through the shield

**Kind:** bug · **Severity:** high · **Size:** medium · **Depends on:** nothing;
**blocks 138 M3**, whose probe must not be baselined against a fight this
one-sided · **GitHub:** none — found by Chris flying it: *"is our shield and
energy recharging too fast — the laser hits from pirates don't seem to do much
damage — or they aren't very accurate at shooting..."*

## Where we are

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
  Sidewinders to poor commanders, and docs/GAP-ANALYSIS.md records the reasoning:
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

**M1 — measure time on aim, because nothing does.** Extend the probe set with
the number `npc-gun.ts` asserts from memory: over real fights, what fraction of
the time is an attacker inside `NPC_FIRE_GATE` and in range, how many shots does
it actually get away per pass, and what is the *effective* points-per-second
against the player — as against the best case tabulated above. Baseline it before
anything moves. This is 134's lesson and 136's: the probe comes first, or the fix
is scored by columns that cannot see it.

**M2 — move the regen, on a sweep.** `SHIELD_REGEN_FRACTION` and
`ENERGY_REGEN_FRACTION` are the pair the whole model is anchored on and the pair
a retune moves — their own comment says so. Sweep both against
`npm run survivability` and M1's effective rate, and state the rule the chosen
value satisfies. Two candidate rules to test, and the plan should land on one:
a tier-2 gang must be able to reach `LOW_ENERGY` inside a fight a player would
sit through; and a lone tier-0 pirate must still lose while costing a face.

**M3 — the aim, separately and afterwards.** With M1's baseline in hand, decide
whether the 5% is the flight model (`pursuit` never lines up) or the gate
(`NPC_FIRE_GATE` 0.25 rad is too tight for the geometry the run produces). These
are different fixes with different risks, and M1 is what tells them apart. **Do
not move both regen and aim in one measurement.**

**M4 — re-baseline what depends on it.** The combat simulator's wave ramp
(`docs/COMBAT-SIM.md`) and 138's roster probe are both scored against how hard a
fight is. Say what moved.

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
  destroyed column no longer 0% at the top end.
- M1's effective-points-per-second column before and after, so the claim is about
  the fight and not about a constant.
- `npm run elite-a` unchanged, and `test/elite-a-live-defence.test.ts` in
  particular: **no damage number moves**, which is the guard on the parity claim.
- `npm run check` green.
