# 123 — You cannot buy off the law

**Kind:** feature · **Severity:** medium · **Size:** medium (three milestones)
**Depends on:** 122 M1 — M1 here is a choice inside the window 122 opens
**GitHub:** #21

**Landed 2026-08-10.** `npm run check` green at 3,882 assertions. All three
milestones shipped, M3 included: the offer is a gamble, not a price list.

## Where we were

You could buy off a pirate and you could not buy off anybody else.

`jettison.ts` was the whole mechanism: `dumpCargo` threw the most valuable thing
overboard, `appetiteOf` priced one pirate against what you arrived carrying, and
`offerBribe` set `npc.state.satisfied` on the ones who had had enough.
`isHostileToPlayer` honoured that field FIRST, before it asked what role the
ship was:

```ts
// npc.ts, before this plan
// A pirate that has taken its payday stops caring about you: this is what
// makes jettisoning cargo a real escape rather than a donation.
if (npc.state.satisfied) return false;
```

`game.ts` filtered `npc.role === 'pirate'` before offering, so police, hunters
and Thargoids were never asked. **The mechanism for "this ship stops being your
problem" already existed and was already honoured for every role. Only the offer
was missing** — and only the comment said "pirate", which is why widening it was
part of the work rather than tidying after it.

Which Viper is being bribed mattered, because a Viper only troubles you in two
distinct situations: you are a **Fugitive**, or you **provoked** it. Under 122
there was now a third moment — a patrol closing on scan range with a dirty hold,
a Viper that has not yet done anything to you. Chris asked for both halves: the
inspection and the fight.

## What shipped

**One cockpit command, `bribePolice`, on `KeyL`.** The plan said O; 122 M2 took
O for the contraband dump between the plan and the work, so the offer sits on the
key beneath it. The two answers to POLICE PATROL CLOSING are now one finger
apart — **O** throws the evidence out, **L** pays the man to look the other way
— and it is a plain letter rather than ⇧O because shift already means MORE OF
THE SAME on ⇧Y. L launches at the STATION, which is the established per-mode
convention (C, M and T each mean two things across the two tables) and not a
clash. It joins `NOT_IN_THE_SIMULATOR`: an exercise has no hold to inspect, no
police, and credits that are not the career's.

`constants/law.ts` gained three numbers and `constants/character.ts` one:

| constant | value | the rule |
| --- | --- | --- |
| `BRIBE_SHARE` | 0.5 | his cut of what the evidence is worth at market |
| `BRIBE_FLOOR` | 500 (50 Cr) | ...and the least the risk is worth to him |
| `PATROL_BRIBE_FINES` | 4 | a break-off, as a multiple of the rung's fine |
| `BRIBE_REFUSED` | 0.35 | how often an HONEST commander is refused |
| `DISREPUTE_BRIBE` | 12 | what the offer costs your name, taken or not |

### M1 — buy off the inspection

Inside 122's window — contraband aboard, `policeScanned` not yet latched, a
police ship inside the band the console warned you about — the offer is paid and
**the scan does not happen**: `session.policeScanned` latches with **no**
`raiseLegal`.

The price is `BRIBE_SHARE` of what the contraband aboard is worth at
`VALUE_PER_TONNE` — the one home for what a tonne fetches, which the jettison
toll and the pirate's assessment already share — floored at `BRIBE_FLOOR`.
Half, because the other answer to the same warning is to dump the evidence,
which costs you all of it: a bribe dearer than the cargo would never be worth
making, and a token one would delete the choice from the other side. The floor
because Slaves are 14th of 17 on the 1984 price table, so a share of one tonne
is a tip rather than a bribe. **It is not priced off `OFFENDER_FINE`**: 25 Cr is
what the station charges for the paperwork, and a man looking away from a hold of
narcotics is not selling the same thing.

**It costs your name, not your record.** `disrepute` rises by `DISREPUTE_BRIBE`
while `legalStatus` stays exactly where it was. That asymmetry is the whole
shape of the feature: the Galactic Government's paperwork stays clean and the
people who actually watch you know exactly what you did. It also gives
`disrepute` the third thing to drive that docs/TODO/96 closed asking for.

### M2 — call off the vipers on you

A police ship that is hostile — Fugitive or provoked — takes credits to break
off: `satisfied = true`, the same field a jettisoned tonne sets, honoured by the
same line. **Per ship**: one press buys ONE Viper, so a pair costs twice, exactly
as a gang of pirates does.

Priced off your **standing**, not your cargo — what a policeman wants to look
away from a Fugitive is not a function of the bay, and a Fugitive with an empty
hold is the commander who most needs the offer to exist. `PATROL_BRIBE_FINES`
times the fine for the rung: 300 Cr as a Fugitive, 100 as an Offender. Four
times, because **a bribe that undercut the fine would delete the fine** —
docking and paying stays the cheaper way to deal with a record. A Clean
commander pays the Offender rate: the only way to be shot at by the law with
clean paperwork is to have provoked it, and the deed being ignored is the same
deed. `fineFor` is deliberately not reused; it caps at what you can pay, which
is right for a fine you cannot escape and wrong for a price you can fail to meet.

**It does not clear the record.** You are still a Fugitive; you have bought this
ship, now, out of this fight.

The fight is offered before the inspection — buying a scan off a man who is
trying to kill you is money for nothing — and "who is in this fight" is
`nearestEngaging` in npc.ts, which shares `PLAYER_INTEREST_RANGE` with the
condition light rather than restating it.

### M3 — the cop who says no

**Not cut.** The offer can be refused, on a roll against the seeded stream
(invariant 11), and a refusal is an offence in front of a witness:
`provokedByPlayer` goes true, so he engages under the rule that already exists,
the money stays in your account and the name pays anyway — the deed is the
asking.

Weighted by Character: `refusalChance` is `BRIBE_REFUSED` at Honest, falling
linearly to nothing at `DISREPUTE_MAX`. A Notorious pilot knows who to ask; an
honest one asks the wrong man. This is `disrepute` as a **credential**, the
shape 96 built for the rock hermit, rather than a third idea about what a bad
name is for — and it is what makes the key a gamble instead of a price list.

The roll is taken by `game.ts` off `random()` and passed IN to `bribeOffered`,
so `law.ts` keeps no randomness of its own and the same seed replays the same
refusals. A price you cannot cover is not an offer: it consumes no draw.

### Where the rules live

- **`game/law.ts` decides**: `inspectionPrice`, `patrolPrice`, `refusalChance`,
  `bribeOffered` (which returns exactly one of `short` / `refused` / `paid`) and
  `patrolReach`. `DISREPUTE_BRIBE` is applied inside `bribeOffered` rather than
  left to the caller, so no later half of this feature can quietly ship the
  version where money makes consequences go away.
- **`game.ts` spends**: one `offerTo(target, price)` shared by both halves, so
  neither can acquire an answer the other lacks; only the consequence of a taken
  offer differs.
- **Two rules that were about to be written twice got one home**: `patrolReach`
  owns `SCAN_RANGE` and `SCAN_WARN_RANGE`, so the offer cannot disagree with the
  warning that prompted it, and `nearestNpc` owns "which one is nearest, of the
  ones that count" for both the step's scan and the key.

## Verification

`test/bribe.test.ts` is the rules and `test/bribe-flight.test.ts` is the sky —
the same division the pirate bribe already has (pure in `test/combat.test.ts`,
flown in `test/jettison.test.ts`), and the reason there are two files is the
400-line ceiling rather than a second subject.

- **Prices from the rule, not from literals**: the inspection is
  `BRIBE_SHARE × VALUE_PER_TONNE × basePrice` read back out of the commodity
  table, floored at `BRIBE_FLOOR`, integer tenths at every hold size tried, and
  blind to legal cargo alongside; the break-off exceeds `fineFor` at both rungs
  and equals `PATROL_BRIBE_FINES × FUGITIVE_FINE`.
- **The three outcomes are exclusive**: a commander one tenth short buys
  nothing, says nothing, spends no name and consumes no roll; the last tenth in
  the account still buys it; a roll under the chance is a refusal that costs the
  name exactly what a taken offer does and carries no money to move.
- **The refusal ramp, measured at two sample sizes** (200 and 2,000 offers, off
  an independent seeded stream): an Honest pilot is refused within 0.08 of
  `BRIBE_REFUSED`, the rate falls monotonically from Honest through Notorious to
  Cutthroat, and it tracks `refusalChance` rather than a curve of its own. Every
  rung of the `CHARACTER` ladder is worth something, and a name fully made is
  never turned in.
- **Flown, M1**: a cop pinned in the warning band with three tonnes of narcotics
  aboard. The console warns; the offer is taken for exactly the price the rule
  set and `DISREPUTE_BRIBE` off the name; the record stays Clean **with the
  patrol at half of `SCAN_RANGE` for ten seconds** — the range that would
  otherwise have read the hold — and the cargo is still aboard. The control is
  the same fixture with no offer: it scans, the record moves, nothing is spent.
- **Flown, M1 control**: below the price, nothing is spent, nothing latches, the
  name is untouched, and a broke commander is still scanned when the cop closes.
- **Flown, M2**: a provoked Viper is hostile by `isHostileToPlayer`, is bought
  for `patrolPrice(CLEAN)`, and the same call returns false afterwards while
  `legalStatus` has not moved — the rule and the record moving independently is
  the point of the milestone. A Fugitive pays the Fugitive rate and is still a
  Fugitive. A pair costs twice, nearer first, one press at a time. A shortfall
  leaves him shooting.
- **Flown, M3**: a refused offer keeps the money, charges the name, turns the
  patrol that refused it into an attacker (`provokedByPlayer`, not `provoked`),
  leaves `satisfied` false and `policeScanned` unlatched — so the inspection
  still happens when he closes.

**The gates were proven able to fail**, each break reverted:

- removing the `disrepute` write → the name check fails, which is the one
  outcome this feature must never have;
- removing the `policeScanned` latch → the bought-off patrol reads the hold at
  knife range;
- removing the `satisfied` write → five failures, including both halves of
  "hostile, then not";
- removing the refusal branch → nine failures across the ramp, the measured
  rates and the flown refusal;
- removing `provokedByPlayer` on a refusal → the refused cop stays friendly.

`npm run check`: 3,882 passed, 0 failed. One catalogue warning remains by design
— the diff-scoped *confirm the meanings differ* prompt on `BRIBE_REFUSED`
sharing 0.35 with two other rates — and it is confirmed in the constant's own
JSDoc, which names them.

## What was deliberately left

- **Bounty hunters.** A hunter is a private contractor whose whole business is
  the bounty; there is no paperwork to look away from. A real design question,
  and not what #21 asked.
- **Bribing anything that is not police.** Pirates take cargo, and that is the
  older and better half of the same idea.
- **A bribed cop staying bribed after you dock.** `satisfied` is NPC state and
  the sky is rebuilt on arrival. Nothing to do; noted so nobody adds it.
- **A sound of its own.** Both refusals use `sfx.refused()`; whether a taken
  offer wants a noise is a question for after somebody has flown it.
