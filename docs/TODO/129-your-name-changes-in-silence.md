# 129 — Your name changes and nothing says so

**Kind:** feature · **Severity:** medium · **Size:** small (two milestones)
**Depends on:** nothing; 128 M2's prompt promises the cost this plan makes
visible · **GitHub:** none — came out of Chris asking whether bribing a
policeman touches your Character, 2026-08-10

## Where we are

It does — and that is exactly the problem.

`DISREPUTE_BRIBE` is 12, applied inside `bribeOffered` (game/law.ts) on every
offer, taken or refused. Disrepute IS Character: `characterName` reads the same
score off the `CHARACTER` ladder. So one bribe takes an Honest commander to
**Dubious**, three to **Dodgy**, five to **Shady**, seven to **Notorious**, and
it feeds back — `refusalChance` falls as the score rises, so a pilot who bribes
his way across the galaxy becomes the kind of pilot a policeman takes money
from.

**None of it is visible from the cockpit.** Seven deeds move the score:

| deed | where |
| --- | --- |
| caught by a police scan | `world-step.ts:582` (`DISREPUTE_CAUGHT`) |
| bribing a policeman, taken or refused | `law.ts:162` (`DISREPUTE_BRIBE`) |
| cracking a rock hermit | `combat.ts:237` (`DISREPUTE_HERMIT_KILL`) |
| destroying a lawful ship | `combat.ts:239` (`DISREPUTE_MURDER`) |
| selling contraband over a counter | `screens/trade.ts:157` (`saleFallout`) |
| landing a no-questions consignment | `contracts.ts:178` |
| arriving short on a consignment | `contracts.ts:168` |

...and the only place the result appears is the word on the status screen (`I`)
and the test-mode panel. Nothing marks the crossing. You go Honest → Dubious in
silence, and a pilot who never opens the status screen can reach Notorious
without the game having mentioned it once.

That is the same defect docs/TODO/122 fixed for the scan: the consequence was
real, correct, and indistinguishable from nothing happening. The fix there was
not to rebalance it — it was to make the world say what it did.

## What to do

### M1 — the console says when a rung is crossed

One rule, in `game/character.ts`, which already owns the ladder:

```ts
/** The rung a deed moved you onto, or null when it moved you within one. */
export function rungCrossed(before: number, after: number): string | null;
```

`characterName(before) !== characterName(after)` and nothing more, so the
message cannot disagree with the label the status screen prints — the same
"assembled, not written out" bargain `recordVerdict` struck in 122.

The caller applies it. Every deed above already writes `afterDeed`, so each site
gains "keep the old score, ask, and say the line" — and the two that live in
pure modules (`combat.ts`, `contracts.ts`) push a message event, exactly as the
offence and bounty lines beside them already do.

**Queued behind the line that caused it,** the way `scanVerdictTimer` queues the
record verdict behind `POLICE SCAN`. The console is one line: `PATROL LOOKS THE
OTHER WAY — 141.0 Cr AND YOUR NAME` followed immediately by `CHARACTER:
DUBIOUS` would erase the first. Reuse the existing delay rather than inventing a
second one; if that machinery cannot be shared without contortion, say so and
give the crossing its own timer beside it.

**Only the crossing.** A deed that moves you within a rung says nothing — a
number nobody was shown does not want a line, and this must not become a
running commentary on a hidden score. The decay (`afterDecay`, 1.5/day) crosses
rungs downward too, and that is worth saying: your name fading is the good news
half, and it is the only feedback the decay has ever had.

### M2 — the number, once it has been flown

`DISREPUTE_BRIBE = 12` is reasoned and unplayed: more than `DISREPUTE_CAUGHT`
(10) because being scanned costs you the record, the fine and the bounty
hunters, while a bribe leaves the paperwork spotless — the name is the only
thing it costs, so it has to bite. Chris will fly it. M2 is whatever that flight
says, and it is deliberately empty until then: **do not retune it from the
armchair.**

The same flight should answer the other unflown values 96 shipped —
`DISREPUTE_HEAT`, `COURTESY_RATE` and `HERMIT_FAVOUR` — which is why this plan
is the natural home for the result.

## Decisions already made

- **Make it visible before retuning it** (this plan's whole shape). The rule
  works; nobody has seen it work.
- **The line is assembled from `characterName`**, never written out, so it
  cannot promise a rung the status screen does not show.
- **Only crossings speak.** The score stays hidden; the ladder is the interface.
- **The decay speaks too.** Falling back to Honest is the one piece of good news
  the character system has and it has never been delivered.

## Open questions — answered here

- **Does the status screen change?** No. It already prints the label, and a
  second surface for the same fact is what this project spends its time
  deleting.
- **Does a rung crossing want a sound?** Not in this plan. Every message in the
  game is silent unless the moment already had a noise; a name changing does not.
- **What about the raw score?** Stays out of the cockpit. Test mode shows the
  number (`screens/test-mode.ts`) and that is the right place for it — the game
  speaks in names.

## Watch out for

- **Seven call sites, one rule.** The temptation is a helper per module; the
  point is that `rungCrossed` is asked the same question everywhere, and a site
  that computes its own comparison is a site free to disagree.
- **`combat.ts` and `contracts.ts` are pure** (invariant 15): they return
  message events, they do not print.
- **`afterDeed` clamps** at 0 and `DISREPUTE_MAX`, so a deed at the ceiling
  crosses nothing and must say nothing.
- **The bribe raises the name on a REFUSAL too**, so the crossing line can
  arrive on a frame where no money moved — which is correct and worth a test,
  because it is the one case that reads like a bug if you have not read 123.

## Verification

Tier: pure tests for `rungCrossed` at every boundary of the ladder, plus one
flown assertion per family of deed that the line actually reaches the console.

- **Pure** — every threshold in `CHARACTER` returns its own name when crossed
  from below and null when the move stays inside a rung; downward crossings
  (decay) report the rung landed on; a move at the clamp reports nothing. Read
  from `CHARACTER` rather than from literals, so re-cutting the ladder re-cuts
  the test.
- **Flown, the bribe** — a taken offer that crosses Honest → Dubious puts
  `CHARACTER: DUBIOUS` on the console after the line that explains it, and a
  refused one does the same. Both through the real Game.
- **Flown, a kill** — destroying a lawful ship crosses two rungs at once
  (`DISREPUTE_MURDER` is 40) and says the rung it landed on, not each one it
  passed.
- **Flown, the decay** — a run of jump days that falls back across a threshold
  says so.
- **The control** — a deed that moves the score without crossing says nothing,
  asserted by counting console lines rather than by reading the score.
- Prove the gate can fail: hard-code the message to one rung name and watch the
  boundary cases fail.
- `npm run check` at the end of each milestone; commit per milestone.

## Where we are now

**M1 landed** (`8153086`). `rungCrossed`/`characterVerdict` (game/character.ts)
are the one rule — two `characterName` calls, so the line cannot promise a rung
the status screen does not show — and all eight occasions spend it: the scan,
the bribe taken and refused, a hermit, a murder, a dirty sale over a counter, a
settled consignment, and the decay, both on a jump and on the tow home.

**The queue could not be shared, and it is better for it.** `scanVerdictTimer`
was one slot, and a scan owes the console TWO lines — the record and the name —
so the second would silently have erased the first. It is `session.queued` now:
a list, drained by `tickMessage`, which runs docked as well as flying because a
dirty sale over a counter marks a name the same way a Viper does. Message events
carry a `queued` flag so a pure module can ask for the same thing. The scan's
own verdict goes through it, so 122's line and this one queue behind each other
in order instead of racing.

The gates are proven able to fail both ways: hard-coding the line to one rung
fails five pure boundaries and two flown ones, and making every move report a
crossing fails sixteen and the control.

**M2 IS STILL OPEN, and deliberately.** `DISREPUTE_BRIBE` is unchanged at 12.
The whole shape of this plan is *make it visible before retuning it*, and
nobody has flown it yet — the flight is the input M2 does not have. It is the
same flight 96's three unflown values (`DISREPUTE_HEAT`, `COURTESY_RATE`,
`HERMIT_FAVOUR`) are waiting on, and docs/TODO/127 has now added a fourth
question to it: a person sells for 6–16 Cr against 40 disrepute, which is not a
temptation.
