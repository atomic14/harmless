# 127 — The survivor is handed over without asking

**Kind:** feature · **Severity:** medium · **Size:** medium (three milestones) ·
**Depends on:** none (reads docs/TODO/96's Character ladder) · **GitHub:** #22

Asked twice, and the two askings are not identical — which is useful, because
between them they answer a question either alone would have left open.

**#22:** *"When you dock, you should be given a choice — set the 'passengers'
free or sell them — at that point your legal status should change."*

**Chris, from a real flight, 2026-08-10:** *"I picked up a survivor and when I
docked they were handed to medical — this should be a choice we give the player:
do they want to be good or bad? They could sell the survivor as a slave — let's
force them to make that choice. And maybe there's a third option — take a bribe
to let the survivor go."*

The issue asks for two options; the flight added the third. The issue also says
the LEGAL STATUS should move, which the flight version did not — so that is
decided rather than deferred (see M3).

## Where we are

You scoop an escape capsule and gain a `survivor` — a person, deliberately NOT
`cargo[3]` (SLAVES), because a rescued pilot must not read as smuggling
(docs/TODO/108). They cost no hold space and cannot be sold.

Then `Station.dock` (`station.ts:168-172`) does this, in the same breath as
resetting your shields:

```ts
if (c.survivors > 0) {
  const n = c.survivors;
  c.survivors = 0;
  messages.push(say(`${n} SURVIVOR${n > 1 ? 'S' : ''} HANDED TO STATION MEDICAL`, 4));
}
```

No choice, no consequence, no payment. The comment beside it is honest about
why it exists — *"without this they occupy a bay for the rest of the career"* —
which is a leak being plugged, not a decision being offered.

**So the one genuinely moral act in the game costs nothing and means nothing.**
That is the gap. The Character ladder (docs/TODO/96) exists precisely to make
"what kind of commander are you" legible, and rescuing someone is the clearest
place in the game to ask it.

## Decisions already made

- **Chris, 2026-08-10:** the choice is FORCED — a docking with a survivor aboard
  asks before it resolves. Three options: hand them to medical, sell them as a
  slave, or take a bribe to let them go.
- **The law moves on a sale** (#22: *"at that point your legal status should
  change"*). This was an open question in the first draft of this plan and is
  not one now: selling a person is an offence, and M3 applies it rather than
  weighing whether to.

## What to do

### M1 — the choice, and the good answer

A `SurvivorsScreen` opened by `enterDocked` when `commander.survivors > 0`,
before the menu — the same door the first-flight briefing already comes through
(docs/TODO/106), so the mechanism exists. It cannot be escaped: ESC re-asks, the
way the new-commander confirmation swallows every other key. `Station.dock` stops
resolving survivors and the screen's outcome does it instead, so the rule has one
home and the campaign harness can drive it.

**HAND THEM OVER** pays nothing and costs nothing, which is the point: being
decent is its own reward, and paying for it would make it a trade. It is the
only one of the three that leaves your Character where it was.

### M2 — the two dirty answers

- **SELL THEM** — pays the local price of a tonne of Slaves and raises
  disrepute. The price is the market's, not a new number: `commodity 3` already
  has one at every station, and reading it is what makes selling a person in a
  Feudal system pay differently from a Democracy. The disrepute is
  `DISREPUTE_HERMIT_KILL`-scale (40) rather than a nudge — one takes Honest
  clear to Dodgy, and this is the deed the ladder was built for.
- **LET THEM GO FOR A BRIBE** — pays less than the sale, costs less of your name.
  You are not selling a person; you are declining to file one. Half the sale
  price and `DISREPUTE_CAUGHT`-scale (10) is the shape to start from.

Both are worth a `@rule` id in `constants/character.ts` beside the existing
deeds, and both are settled by the campaign rather than by argument.

### M3 — the law's half

Selling a person is a crime the Galactic Government would notice, and #22 says
so outright. Two rules, both already written:

- **The fallout** is a CONTRABAND SALE. `saleFallout` (game/market.ts) already
  owns what a dirty sale does to your name and to the destination's heat, and
  routing the sale through it means no new rule and no second copy of one.
- **The record** is `raiseLegal(1)` — Offender, the same rung a police scan
  gives a smuggler who is caught. Not Fugitive: that is what destroying a
  lawful ship costs (`offenceFor`), and a sale made over a counter should not
  outrank killing someone.

**Which raises the question 122 is already carrying** — police hunt Fugitives,
bounty hunters take an interest in Offenders — so an Offender walks out of the
station unmolested. That is the same legibility problem, and it should be
answered once, in 122, rather than twice.

**M3 is NO LONGER the milestone to cut**, because it is the half #22 asked for
in as many words. If appetite runs out, cut the BRIBE option in M2 instead: it
is the one that came from the flight rather than the issue, and the good and the
dirty answer stand without it.

## Open questions — answered here

- **What if several survivors are aboard?** One choice for all of them. The
  message already pluralises, three prompts in a row would be tedious, and
  nothing in the fiction distinguishes them.
- **Can the choice be dodged by never docking?** Yes, and that is fine: they
  ride along, exactly as now. The choice is forced at the dock, not at the scoop.
- **Does the station refuse to let a Fugitive sell one?** No. A second rule
  about who may sell is a new gate with no reported need; the sale's fallout is
  the consequence.

## Watch out for

- **`survivors` is not cargo and must not become cargo.** docs/TODO/108 is the
  whole argument, and `test/combat.test.ts` holds `cargoTonnes` to it. Selling
  one is a transaction, not a hold operation: it must never add to `cargo[3]`
  on the way out, or a full hold could refuse the sale.
- **The docked entry already has a screen queued in some cases.** The briefing
  opens over the menu on a first boot; two screens racing for the same moment is
  the bug docs/TODO/106 warns about. Decide the order and assert it.
- **`Station.dock` returns EVENTS; it does not act.** Keep it that way — the
  screen decides, the orchestrator applies.
- **The campaign harness never docks with a survivor today.** If it starts to, it
  needs a policy per strategy, or the balance numbers move for a reason nobody
  asked for.

## Verification

Tier: unit per milestone, plus a campaign read if M2 moves the money.

- **M1** — docking with a survivor opens the screen and does NOT clear
  `commander.survivors`; the screen's HAND OVER outcome clears it, pays nothing,
  and leaves `disrepute` where it was. Escape does not dismiss it.
- **M2** — SELL pays the station's own Slaves price (asserted against
  `generateMarket`, not a literal) and moves `disrepute` by the named constant;
  BRIBE pays less and costs less. Both clear `survivors` and neither touches
  `cargo`.
- **M3** — a sale applies `saleFallout`, asserted against the same rule the
  market applies, not a copy of it.
- Prove each gate can fail by reverting the outcome it guards.

## Where we are now

**All three milestones landed** (`50b5d9a`, `f0700b4`, `23ba814`), and #22 is
closed with them.

**M1** — `SurvivorsScreen` opens from `enterDocked` when somebody is aboard, and
it cannot be escaped: ESC is refused and re-asks, because "do nothing" resolving
in the decent direction for free is the bug being fixed. `Station.dock` no
longer touches `survivors`; the leak its comment worried about stays plugged
precisely because the question cannot be dodged. The order against the briefing
was decided rather than left to chance: the prompt opens LAST, so it is on TOP —
it is what is holding the clearance up, and the briefing is reading matter that
is still there behind it. `game/survivors.ts` is the rule, pure and mutating the
commander the way `settleContracts` does, so the campaign harness could make the
same choice without a keyboard.

**M2** — SELL pays the station's own Slaves quote per person and marks the name
at `DISREPUTE_SLAVE_SALE` (40, the hermit-kill weight: one takes Honest clear to
Dodgy). LET THEM GO pays `SURVIVOR_RELEASE_SHARE` of that and costs
`DISREPUTE_SURVIVOR_RELEASED` (10). Neither touches `cargo`, which
`test/survivors.test.ts` holds to on both paths. `SLAVES`
(constants/commodities.ts) is named at last — the index was a bare 3 in four
comments explaining what it was — and `priceInTenths` (game/market.ts) deletes
the counter's duplicated rounding rather than adding a third copy of it.

**M3** — the sale applies `saleFallout` for the region's heat and `raiseLegal`
for the record, both decided in the pure rule and carried on the event.
OFFENDER, not Fugitive. Its `disrepute` term is deliberately not added on top of
M2's: that prices a tonne of narcotics, and charging both would price one deed
twice under two names. The record's meaning is queued behind the receipt as
`recordVerdict`, which is 122's line and 122's answer to "an Offender walks out
unmolested".

**One thing it found.** `raiseLegal` was reachable from the station for the
first time, and a docked ship is parked well inside `DEFENCE_RANGE`, so the sale
scrambled Vipers into a world the player is not in. `callStationDefence` returns
unless the base mode is flight now — misbehaving means in the sky — and the
empty pad is asserted.

**A NUMBER FOR THE PLAYTEST, not retuned from the armchair.** A tonne of Slaves
is 6 Cr at Lave and 16 at the dearest system in galaxy 1, so selling a person
pays 6–16 Cr against 40 disrepute. As shipped, the dirty answer is not a
temptation — nobody would take it — and the choice is therefore not yet the
choice this plan is for. The price being the market's is a decision this plan
made deliberately (it is what makes a Feudal system pay differently), so the
lever is a multiplier on top of the quote, and it wants the same flight that
129 M2 and 96's three unflown values want.
