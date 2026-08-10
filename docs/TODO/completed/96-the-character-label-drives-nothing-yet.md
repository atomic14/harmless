# 96 — The character label drives nothing in the world yet (phase 2)

**Kind:** feature / balance · **Severity:** medium · **Size:** large (four
milestones) **Depends on:** the Character phase-1 commit (`c7d90d6`) · this is
its planned phase 2 **GitHub:** none — phase 1's planned successor, deferred by
Chris 2026-08-09 ("drop for now") and picked back up 2026-08-10.

**Landed 2026-08-10** in four commits (`c10a838`, `fe9f48c`, `659f45c`,
`c6d61dd`). All four milestones are in the tree and `npm run check` is green.

**Closed without the flight, deliberately.** Chris: "we'll fly it later — mark
it as done and we'll create issues where it doesn't work." So the balance
evidence behind this plan is the campaign and the unit gates, and
`DISREPUTE_HEAT` (0.5), `COURTESY_RATE` (0.15) and `HERMIT_FAVOUR` (0.2) are
**unflown starting values**. Nothing about them is settled by this plan being
closed; what plays wrong becomes a GitHub issue and a new plan, not a reopening
of this one.

## Where we are

Phase 1 shipped a `disrepute` number on the commander and a **Character** label
on the status screen (Honest → Dubious → Dodgy → Shady → Notorious → Cutthroat,
Honest at the top). Shady deeds raise it, time erodes it. The rule is
`game/character.ts`; the numbers are `constants/character.ts`.

**It is deliberately the label alone.** Nothing in the world reads `disrepute`
yet — a Dodgy pilot is treated exactly like an Honest one. Phase 2 is making the
galaxy react to the name it already tracks, in both directions: the underworld
is a service as well as a risk.

The shape of it, decided with Chris before any code (see "Decisions"): one
number, two channels. To a **pirate** your name is one more thing they can see,
folded into the reputation model already there. To a **hermit** it is a
credential up to a point and a shut door past it — the same number that buys
you mates' rates at the tunnel is the one that gets you turned away.

## What phase 2 does

### M1 — one home for what a sale does to your name

`screens/trade.ts:152-165` and `test/campaign.ts:276-281` both hold the rule
"word gets around": the same `revenue / 40_000 + contraband * 0.04` heat, typed
out twice — and the campaign's copy is **missing the disrepute half** the game
applies. Today that gap costs nothing, because nothing reads `disrepute`. From
M2 it costs the measurement: the harness that is supposed to be checking this
balance change would under-count a smuggler's name.

So, first and on its own: one pure `saleFallout(index, sold, revenue)` →
`{ notoriety, disrepute }` in `game/market.ts`, called by both, with the two
literals named in `constants/market.ts` (run `npm run constants:find` first —
`0.04` and `40_000` are exactly the kind of value that already has a home).
Invariant 10 and "give every rule one home"; no behaviour change in the game,
and the campaign starts accruing the disrepute the game always did.

### M2 — the mark carries your name

`Mark` (`game/threat.ts:36`) gains `disrepute`, raw, the way `combatScore` is
raw; `markOf` reads it off the commander it is already handed. `pirateThreat`
normalises it against a rung of the ladder, exactly as `FAME_FULL` is expressed
from `RATINGS`:

```ts
const infamy = Math.min(1, mark.disrepute / DISREPUTE_FULL);   // Notorious = 1
// Regional memory of your cargo and galactic memory of your name are the same
// channel to a pirate: how visibly KNOWN you are.
const known  = Math.min(1, mark.notoriety + DISREPUTE_HEAT * infamy);
const appeal = clamp(prize - 0.7 * deter + 0.6 * known);
// ...and the same two-edged rule fame already has: a name draws challengers.
const renown = Math.min(1, fame + DISREPUTE_DRAW * infamy);
const challenged = rng() < CHALLENGE_RATE * renown;
```

`renown` replaces `fame` in the challenge roll **and** in the `count` term, so a
reception summoned by your name arrives with bodies in it; the reported `fame`
field becomes `renown` and its doc comment says reputation, not combat. At
`disrepute === 0` every one of these expressions collapses to today's, exactly —
which is the regression pin, not a hope.

The carrot half here is **professional courtesy**: a roll, after the reception
is built, that removes it.

```ts
const passed = !challenged && rng() < COURTESY_RATE * infamy;
```

A separate mechanism rather than a term in `deter`, deliberately: adding infamy
to deterrence *and* to appeal is two coefficients that partly cancel into one,
which is the same rule written twice. "More of them want you, and occasionally
one recognises you and calls it off" is two textures the player can feel apart.
`PirateThreat` gains `passed`, `count`/`tier`/`organised` go to nothing, and
`game.ts`'s `populateSystem` says so on arrival — an unfired ambush the player
never hears about is a mechanic that does not exist.

### M3 — the hermit's door

Both halves are the same ramp against one threshold, `HERMIT_REFUSES_AT`,
expressed off the CHARACTER ladder (the **Dodgy** rung, 25) in
`constants/hermit-market.ts`:

- **Refusal (binary).** `hermitRefuses(disrepute)` beside `hermitMarket` in
  `game/market.ts`. In `world-step.ts:664-682` the beacon still blinks and the
  hail at 900 still calls you in, but inside 320 a refused pilot gets
  `ROCK HERMIT — "WE KNOW WHAT YOU DID" — NO TRADE` and no market. It must set
  `session.hermitCooldown` on the refusal, the way leaving the market does
  (`game.ts:680`), or the message repeats every frame you sit there.
- **Favour (graded).** `favour = min(1, disrepute / HERMIT_REFUSES_AT)`, 0 at
  Honest and 1 at the door, scaled by one `HERMIT_FAVOUR` fraction:
  ore `HERMIT_ORE_PRICE * (1 - HERMIT_FAVOUR * favour)`, supplies
  `HERMIT_SUPPLY_PRICE * (1 + HERMIT_FAVOUR * favour)` — both moving the
  player's way, since you buy the ore and sell them the food. `hermitMarket`
  takes the score; `game.ts:1548` hands it `commander.disrepute`.

One hermit kill is 40 and lands you well past 25, so cracking a rock costs you
the tunnel for the ~17 days it takes to decay back under — the direct,
thematic punishment the phase-1 note asked for. A working smuggler at 5 a sale
oscillates inside the favour band and has to decide how dirty is too dirty,
which is the outlaw path being *playable* rather than only punishable.

### M4 — re-read the balance

`npm run campaign`, against the baseline taken before M1
(`scratchpad/campaign-baseline.txt`), plus a human flight. Details under
Verification; this is a milestone, not a checkbox — the numbers may send M2's
constants back for a second pass, and that is the milestone doing its job.

## Decisions already made (don't relitigate)

Phase 1's, still standing:

- **Slow decay** — people forget, but slowly (`DISREPUTE_DECAY`).
- **Honest is the top rung** — the scale only ever describes a fall from grace.
- **One galaxy-wide number**, not regional like heat — your name, not a place.
- **Deed/decay values are tunable** starting points in `constants/character.ts`.

Chris, 2026-08-10, on the three questions phase 1 left him:

- **The outlaw path gets its carrots.** Item 3 is in: better hermit prices in
  good odour, and pirates occasionally passing a notorious pilot by. Phase 2 is
  a two-sided reputation, not a penalty.
- **Disrepute folds into the "known" channel** — one blended scalar with
  regional heat feeding `appeal`, plus a share of the challenge roll. Not a
  fourth independent term, and byte-identical at disrepute 0.
- **The hermit refusal is binary.** Above the threshold, no trade. (The graded
  half of M3 is the *favour*, which is the carrot, not a softened refusal.)

## Open questions — answered here

- **Does the trainer's clone need a disrepute knob?** No. `ThreatContext`
  already carries the CAREER commander (`combat-sim.ts:456`), `markOf` reads
  `disrepute` off it, and "as they come" therefore sizes the reception against
  your real name with no new plumbing and no new panel row. The clone still
  flies with no cargo and no reputation; only the *opposition* knows who you
  are, which is the rule `ThreatContext` was written for.
- **Raw score or 0..1 on the `Mark`?** Raw, like `combatScore`. What a pirate
  observes is a fact; the curve over it (`DISREPUTE_FULL`) is policy, and policy
  lives in `pirateThreat` with the rest of it.
- **Where does infamy saturate?** At **Notorious** (80), expressed from
  `CHARACTER` rather than typed — one hermit kill (40) puts you halfway up the
  curve, two put you at the top of it. Same trick as `FAME_FULL`, same reason:
  move the ladder and the curve moves with it.
- **Does `passed` need to be visible?** Yes, one line on arrival. See M2.

## Watch out for

- **This is a balance change and the campaign is the instrument.** 33 rows are
  tuned against `pirateThreat` (`constants/threat.ts` header). Re-run and read
  the aggregate; do not eyeball one fight.
- **The trader cohort barely earns a reputation.** Measured after M1: mean 7.3
  at the reception, median career peak 15.0, worst 40.0 — an infamy of about
  0.09 on M2's curve. The change will be nearly invisible in that row and that
  is the *right* answer for lawful play; it just means the trader row cannot be
  the measurement. See M1's note under Verification.
- **RNG draw order.** `passed` adds a draw. Every seeded outcome downstream
  moves, so `test/game.test.ts`'s seeded pins will shift; that is expected, but
  check they shift rather than break, and keep the draw unconditional in
  position (invariant 11, `game/rng.ts`).
- **`lastThreat` is saved.** A new `passed` field rides in the snapshot
  (`persistence.ts:138`, `snapshot.ts:311`) — a save written before this loads
  without it, so read it defensively.
- **Fly it before tuning.** The reception change is a feel change; a human
  should meet a Dodgy pilot's pirates and get turned away from a rock before
  anyone touches a constant on the strength of a table.

## Verification

**M1 — done.** `test/economy.test.ts`, block "what a sale is noticed as": each
of the three numbers solved back out of `saleFallout` (the idiom already used
for `PRIZE_SATURATION` and `VALUE_PER_TONNE`), plus the real `MarketScreen`
driven through a sale and its heat and mark compared to the shared rule, so a
re-inlined literal at the call site fails here rather than in a playtest. Both
gates proved failable: zeroing the disrepute half fails the tonnage check, and a
0.9 factor at the call site fails the screen check (`got 0.2358, want 0.262`).

The campaign is byte-identical to the baseline, as it must be — nothing reads
`disrepute` yet. Its new `CHARACTER` line is the M4 instrument, and it already
says something worth knowing: **mean disrepute at reception 7.3, median career
peak 15.0 (Dubious), worst 40.0** across the trader cohort. Two consequences.
The counter-sale half M1 restored is worth almost nothing to this cohort — the
line does not move when it is zeroed, because a trader's disrepute is
overwhelmingly `settleContracts` — so the gate for it has to be the unit test,
not the campaign. And a typical trader sits at an infamy of 7.3/80 ≈ 0.09 under
M2's curve: nearly nothing, which is the correct answer for lawful play but
means **the trader cohort cannot measure this change**. M4 needs the privateer
and hunter cohorts, and probably a deliberately dirty row.

**M2 — done.** In `test/economy.test.ts`, in the measured shape the file
already uses:

1. **The zero pin, as four golden rows.** `pirateThreat` at `disrepute: 0` on a
   fixed seed, computed from the code as it stood at the M1 commit and pinned.
   Making the courtesy roll unconditional — one extra draw off the stream —
   fails all four, which is exactly the failure the pin exists for.
2. **`DISREPUTE_FULL` bisected** out of `appeal` and asserted to be the score at
   which `characterName` starts saying Notorious (80) — the cross-check
   `FAME_FULL` gets against `rating()`.
3. **`DISREPUTE_HEAT` measured as what it means:** the regional heat that makes
   a spotless commander exactly as attractive as a fully notorious one. Nothing
   in the test knows the appeal formula's weights. **`DISREPUTE_DRAW`** out of
   the challenge roll, **`COURTESY_RATE`** out of a scripted stream (a constant
   rng answers both rolls with the same number and never reaches the second).
4. **Both directions, as behaviour:** a Dodgy pilot never draws a softer
   reception than an Honest one and draws a harder one on 7 of 41 sampled
   holds; a Cutthroat is waved off 49 times in 400 seeded receptions and an
   Honest commander never.

**M3 — done.** `test/economy.test.ts` bisects the door out of `hermitRefuses`
(25, the ladder's Dodgy rung), solves `HERMIT_FAVOUR` out of a real quote
(0.1993 off the ore, 0.2003 onto the supplies), walks the ramp point by point,
and holds a spotless commander's prices to today's. Moving the threshold a point
fails the bisect.

The world half went to a new `test/hermit-door.test.ts` rather than
`test/playtest.js`: a real `WorldStep`, a real hermit in the sky and a hundred
frames parked alongside it, which reaches everything the browser run would have
except the feel. An honest pilot gets the market; a hermit-killer gets no market
at all, is told why exactly once, and the approach hail stops with it. Deleting
the `hermitCooldown` line fails it three ways (100 refusals, 100 hails, no
cooldown).

**M4 — the campaign is read; the flight is not.**

`npm run campaign -- 200 60 all`, against the same command at the M1 commit
(both in `scratchpad/`, run from a worktree so the comparison is the same
harness):

| cohort | mean disrepute | appeal | opportunist/professional/gang | organised/career | deaths |
|---|---|---|---|---|---|
| **hunter** (M1) | 0.0 | 0.00 | 100 / 0 / 0 | 0.1 | 3.6 |
| **hunter** (now) | 0.0 | 0.00 | 100 / 0 / 0 | 0.1 | 3.6 |
| **trader** (M1) | 6.9 | 0.30 | 55 / 29 / 16 | 3.1 | 1.0 |
| **trader** (now) | 6.9 | 0.31 | 51 / 30 / 18 | 3.5 | 1.0 |
| **privateer** (M1) | 18.8 | 0.24 | 65 / 23 / 12 | 2.2 | 0.7 |
| **privateer** (now) | 19.2 | 0.29 | 55 / 26 / 19 | 4.5 | 0.9 |

What it says:

- **The zero pin holds end to end.** The bounty hunter flies clean, earns no
  disrepute at all, and every line of its 200-commander row is identical to the
  baseline — net worth to the tenth of a credit, deaths, tier mix, the lot.
  Lawful play did not move, in the live harness and not only in a unit test.
- **The cost scales with the name.** A trader at a mean of 6.9 barely notices
  (appeal +0.01, gangs 16→18%). A privateer at 19.2, whose median career peak is
  40 — Dodgy — meets visibly worse: appeal +0.05, gangs 12→19%, organised packs
  doubled from 2.2 to 4.5 a career, 53t of cargo lost against 48t, and about 3%
  off the median net worth. That is the intended shape: a dirty name is a real
  and survivable cost, paid by the commander who chose it.
- **Some of that delta is a re-rolled seed.** Any commander with a name takes an
  extra draw off the world stream, so the privateer's numbers are not a
  controlled A/B. The direction is unambiguous and the size is about what the
  arithmetic predicts (infamy 0.24 → appeal +0.047 against +0.05 measured), but
  do not read the third significant figure.
- **One pre-existing failure, untouched.** `most commanders have docked where
  the military laser is sold by then — 90/199` fails in the hunter cohort at 200
  commanders, and fails identically at the M1 commit and at 40 commanders it
  does not run. It is nothing to do with 96.

`npm run check` is green: 3,617 tests, no lint errors, no constants warnings
(`HERMIT_FAVOUR` and `HUNTER_CHANCE_LAUNCH` both took `@rule` ids for the 0.2
they share; the four unrelated `0.5`s that `DISREPUTE_HEAT` and
`SALE_NOTORIETY_MAX` collide with are docs/TODO/118's policy question and are
left warning-free only because the diff-scoped checker no longer looks at them).

**What is left: the flight.** The plan said a human should meet a Dodgy pilot's
pirates before anyone tunes a constant on the strength of a table, and that is
still true and still outstanding. The three numbers most likely to want a second
pass after it are `DISREPUTE_HEAT` (0.5 — is a Dodgy reception too hard?),
`COURTESY_RATE` (0.15 — does being waved off read as a mechanic or as a bug?)
and `HERMIT_FAVOUR` (0.2 — is the discount worth the detour?). A trial goes in
`docs/BROWSER-TRIALS.md` in that file's shape: a Dodgy commander's reception,
a refusal at a rock, and the courtesy line firing at least once.
