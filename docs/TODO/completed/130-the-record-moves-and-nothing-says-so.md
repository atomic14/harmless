# 130 — The record moves and nothing says so

**Kind:** bug · **Severity:** medium · **Size:** small (one milestone)
**Depends on:** nothing; the machinery it spends is docs/TODO/129's
`session.queued` and docs/TODO/122's `recordVerdict` · **GitHub:** none — found
while flying docs/TODO/129's tests, 2026-08-10

## Where we are

Destroy a lawful ship in sight of a station and two things happen in the same
frame. `raiseLegal` (game.ts) moves the record and says so:

```ts
if (this.state.commander.legalStatus < level) {
  this.state.commander.legalStatus = level;
  this.showMessage(`LEGAL STATUS: ${LEGAL_NAMES[level].toUpperCase()}`, 3);
}
this.callStationDefence();
```

...and `callStationDefence`, three lines later, says `STATION DEFENCE LAUNCHED`
through the same single-line console. The first line is erased before a frame is
drawn. **Becoming a Fugitive — the most expensive thing that can happen to a
commander short of dying — is never on the console at all.**

It is the third sighting of one defect. docs/TODO/122 found it on the police
scan (`CONTRABAND DETECTED` erased its own consequence), docs/TODO/129 found it
on the Character ladder (eight deeds moved a score nobody was shown), and this
is the same shape one rung up. docs/TODO/129's own flown test has been carrying
the note since it landed (`test/character-line.test.ts:181`): *"which of those a
player reads is not this plan's business."* It is this plan's business.

Three other paths reach the same erasure:

| the deed | the line it says | what erases it |
| --- | --- | --- |
| destroy a lawful ship (`combat.ts:241`) | — (the explosion is the feedback) | — |
| destroy an escape capsule (`combat.ts:170`) | `ESCAPE CAPSULE DESTROYED` | `STATION DEFENCE LAUNCHED` |
| shoot the station (`combat.ts:187`) | `STATION HULL HIT — DEFENCES SCRAMBLING` | `STATION DEFENCE LAUNCHED` |
| hit a lawful ship (`combat.ts:196`) | — | — |

And the fix already exists twice, written out twice. The scan
(`world-step.ts:618`) and the survivor sale (`game.ts:1220`) each call
`raiseLegal` and then queue `recordVerdict(...)` themselves, because
`raiseLegal`'s own line was no use to them. So "your record moved" has **two
homes and three copies**: the `LEGAL STATUS:` string nobody ever reads, and the
`RECORD: … WILL ENGAGE` line two call sites assemble for themselves.

## What to do

One milestone. Give the rule its one home: **`raiseLegal` owns what a moved
record says, and says nothing over the deed that reached it.**

```ts
raiseLegal(level: number): void {
  if (level <= CLEAN) return;
  const moved = this.state.commander.legalStatus < level;
  if (moved) this.state.commander.legalStatus = level;
  this.callStationDefence();                        // queued: what the sky did
  if (moved) this.queueMessage(recordVerdict(level), SCAN_LINE_SECONDS);
}
```

- **`LEGAL STATUS: FUGITIVE` is deleted, not queued.** `recordVerdict` is the
  same fact plus the half that matters — who is now coming — and it is
  assembled from `lawTakesInterest` so it cannot promise a fight the rules will
  not deliver. Keeping both would be two lines saying one thing, which is what
  this project spends its time deleting.
- **The two call sites that queue their own verdict drop it** —
  `world-step.ts:618` and `game.ts:1220`. Both call `raiseLegal` before the line
  they wanted the verdict behind, so the queue order they have today is the
  order they get for free.
- **`STATION DEFENCE LAUNCHED` queues too**, and goes in FIRST, which is the
  answer to the open question the backlog entry left. See below.

### Which line is the cause and which is the consequence

Neither. Both are consequences, and the console has a running order:

> **what you did → what the sky did about it → where you now stand.**

The deed's own line goes first because it is the only one that explains the
other two. `STATION DEFENCE LAUNCHED` goes next: Vipers leaving the slot is a
thing happening now, and a player being shot at wants it before a sentence about
paperwork. The record goes last because it is the part that outlives the fight —
it is still true in the next system, which is exactly why losing it costs more
than losing either of the others.

Queueing the defence line is not a delay in the case that matters. `tickMessage`
promotes from an empty console on the next step, so a murder with nothing else
to say puts `STATION DEFENCE LAUNCHED` up a frame later. It waits only when
something is already speaking — which is precisely when it should.

## Decisions already made

- **One home.** After this, exactly one expression in the codebase turns a legal
  status into words for the console, and it is `recordVerdict`.
- **The record line is earned by the MOVE, not by the deed.** `raiseLegal` is
  reached on every laser hit that lands on a trader (`combat.ts:196`); a line
  per hit would be a console that shouts `RECORD: OFFENDER` down the length of a
  fight. Silence when the record did not move is correct — nothing happened.
- **The `LEGAL STATUS:` string goes.** It is not moved, not shortened, not kept
  for the status screen: `screens/status.ts` prints the label from `LEGAL_NAMES`
  and always did.

## Open questions — answered here

- **Does an already-Fugitive smuggler still hear a verdict when scanned?** No,
  and that is the point of the previous decision. Today `world-step.ts` queues
  the verdict unconditionally, so a Fugitive who is scanned is told `RECORD:
  FUGITIVE` — a line announcing that nothing changed. The scan still costs the
  name, and `characterVerdict` still says so when a rung is crossed.
- **Does the defence launch keep its sound?** Yes, unchanged and immediate.
  `sfx.stationDefenceLaunched()` fires with the launch; the console line is the
  only thing that waits, so the sky and the speaker still agree on the frame.
- **Does this touch the fine, the bounty hunters or `isHostileToPlayer`?**
  Nothing. This plan changes what is said, not what is true — the same
  distinction 122 and 129 drew.

## Watch out for

- **Order inside `raiseLegal`.** `callStationDefence` must be called before the
  verdict is queued, or the record line jumps the launch. The two lines are
  queued in one method now, so this is a two-line ordering that a test has to
  pin rather than a comment.
- **`level` versus `commander.legalStatus`.** The verdict must name the record
  the commander now holds. They are equal on the branch that speaks, but the
  status is the one that stays true if the guard is ever re-cut, and it is what
  the existing test compares against.
- **Double-queuing.** Deleting `world-step.ts:618` and `game.ts:1220` is not
  tidying; leaving either in place puts the same line on the console twice.
- **`combat-sim.ts` refuses `raiseLegal`** (`combat-sim.ts:750` swallows the
  offence event, `combat-sim-safety.ts:58` stubs the verb). An exercise must
  still say nothing at all — the trainer cannot reach a career (invariant 5).

## Verification

Tier: flown. The rule being fixed is not arithmetic — `recordVerdict` and
`session.queued` are both already pinned by pure tests — it is what a pilot
reads, so every check drives the real `Game` and reads `session.messageText`
frame by frame, the way `test/character-line.test.ts` does.

New `test/record-line.test.ts`, sharing that file's console-watching shape:

- **A murder in sight of a station** — the console shows `STATION DEFENCE
  LAUNCHED` and then `RECORD: FUGITIVE — …`, in that order, and the verdict is
  `recordVerdict(commander.legalStatus)` rather than a written-out string. This
  is the defect: today the run contains no `RECORD:` line at all.
- **A murder out of the station's sight** — no defence launches, and the verdict
  still arrives. The record does not depend on anyone watching.
- **An escape capsule destroyed near a station** — `ESCAPE CAPSULE DESTROYED`
  survives to be read, with the launch and the verdict behind it.
- **The control** — a hit that does not destroy takes a Clean commander to
  Offender and says so ONCE; twenty more hits over the following seconds say
  nothing further, counted in console lines rather than read off the status.
- **The exercise** — a kill inside the combat simulator says neither line.
- **Regression, already written** — `test/world-step.test.ts`'s scan block and
  `test/survivors.test.ts`'s sale block both assert the verdict follows the line
  it explains. They must pass untouched: the queue order is now produced by
  `raiseLegal` instead of by hand, and those two tests are what says it is the
  same order.
- Prove the gate can fail: restore the `showMessage` in `raiseLegal` and the two
  deleted queue sites and watch the new file fail on ordering and on the
  duplicate verdict.
- `npm run check` at the end; one commit.

## Where we are now

**Landed.** `raiseLegal` (game.ts) queues `recordVerdict` behind
`callStationDefence`, which queues too; `LEGAL STATUS:` is gone from the
codebase, and so are the two hand-written verdicts at `world-step.ts` and
`answerForSurvivors`. Five deeds reach the one rule — a murder, a hit that only
provokes, a destroyed capsule, a shot at the station, and a sale over a counter
— and every one of them now leaves a line a pilot can read.

`test/record-line.test.ts` is the flown gate, and building it found two things
worth recording:

- **A watcher that reads the console cannot count.** It reports a line when the
  text CHANGES, which is what a player sees — so two identical verdicts in a row
  are invisible to it. It simply holds the same sentence for twice as long.
  Both duplicate probes (the scan's copy, the sale's copy) passed against the
  first version of the test for exactly that reason. What catches them is
  `session.queued` read on the frame the deed fires, and the console being
  QUIET once the dust settles — which is also the only thing that catches a
  missing move-guard, where twelve laser hits queue twelve copies and leave
  nearly a minute of backlog with the rest of the game waiting behind it.
- **The scan's verdict left `test/world-step.test.ts`.** That file drives a stub
  `StepHost`, and the verdict is the host's line now; a stub that reproduced
  `raiseLegal` in order to pass would have been the rule asserting itself. The
  step keeps what it owns — the scan fires, takes the frame it fires on, asks
  the host once — and the wording is flown for real in the new file.

Five probes, all confirmed failing against the shipped tests: the defence line
unqueued (3 failures), the record line unqueued (3), the move guard deleted (2),
the scan's duplicate restored (1), and the sale's duplicate restored (1, in
`test/survivors.test.ts`).

`npm run check` passes: 4,096 assertions, 0 failed.
