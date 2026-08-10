# 127 — The survivor is handed over without asking

**Kind:** feature · **Severity:** medium · **Size:** medium (three milestones) ·
**Depends on:** none (reads docs/TODO/96's Character ladder) · **GitHub:** none —
asked by Chris from a real flight, 2026-08-10: *"I picked up a survivor and when
I docked they were handed to medical — this should be a choice we give the
player: do they want to be good or bad? They could sell the survivor as a slave
— let's force them to make that choice. And maybe there's a third option — take
a bribe to let the survivor go."*

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

Selling a person is a crime the Galactic Government would notice. The cheapest
honest answer is that it is a CONTRABAND SALE — `saleFallout` (game/market.ts)
already owns what a dirty sale does to your name and to the system's heat, and
routing the sale through it means no new rule. Whether it also sets a legal
status is Chris's call and is deliberately left for M3 rather than assumed.

**M3 is the milestone to cut** if the first two land and the appetite is gone.

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
