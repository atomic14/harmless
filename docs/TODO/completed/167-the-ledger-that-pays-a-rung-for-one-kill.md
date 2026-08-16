# 167 — The ledger that pays a rung for one kill

**Kind:** defect · **Severity:** low · **Size:** small · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** none — found by the sweep of
2026-08-16

## Where we are

**docs/TODO/160 gave a legal record a second way down.** `recordWorkedOff`
(`src/game/law.ts:201`) takes `KILLS_PER_RUNG` pirate kills off a rung.
`commander.atonement` counts how far through a rung a pilot is.

**docs/TODO/161 raised `SNAPSHOT_VERSION` to 3 and wrote the migration.** The
version 2 step fills the field in. Its comment in `src/game/snapshot.ts` says
why:

```
// 2 → 3. `commander.atonement` is WRITTEN rather than left to a default.
// `Persistence.restore` clones the commander straight in. So an absent
// field reaches `recordWorkedOff` as undefined, and the ledger runs at NaN.
// A commander in that state can never work a record off again, and nothing
// says so. 0 costs a pilot up to `KILLS_PER_RUNG - 1` kills of credit, once
// (docs/TODO/161).
```

**The code does the opposite of the sentence.** Measured, against the real
function:

```
KILLS_PER_RUNG = 5
fugitive(2), atonement undefined, one pirate kill -> { legalStatus: 1, atonement: 0 }
  second kill                                     -> { legalStatus: 1, atonement: 1 }
control: fugitive(2), atonement 0, one kill       -> { legalStatus: 2, atonement: 1 }
```

The arithmetic is three lines:

```
const paid = atonement + 1;
if (paid < KILLS_PER_RUNG) return { legalStatus, atonement: paid };
return { legalStatus: legalStatus - 1, atonement: 0 };
```

`undefined + 1` is `NaN`. `NaN < 5` is false. So the function skips the first
branch and takes the rung. Then it writes `atonement: 0`, and the ledger heals
itself.

**So two of the comment's claims are false:**

1. *"A commander in that state can never work a record off again."* The record
   comes down on the FIRST kill, and is worth five.
2. *"and nothing says so."* `LawActions.lowerLegal` sets `moved` to true and
   queues `recordVerdict`. The console announces it.

The comment names a silent loss. The behaviour is a loud gift.

## What the sweep found that the report did not

**The path is DEFENSIVE rather than live**, and 161's comment implies otherwise.
Two layers fill the field in before the rule ever sees it:

1. **The door.** Measured: a version 2 snapshot with no `atonement` key comes out
   of `parseSnapshot` at version 3 with `atonement = 0`. That is the migration
   161 wrote, and it works.
2. **The shelf.** `repairCommander` (`src/game/storage.ts:492`) opens with
   `{ ...newCommander(), ...stored }`, and `newCommander()` sets `atonement: 0`.
   `JSON.parse` never produces an explicit `undefined`, so an absent key does
   not overwrite that 0. `readSave` repairs `rec.world.commander` before any
   snapshot reaches the door.

**The shelf half is read from the code rather than measured.** `readSave` needs
a store, and node has no `localStorage`, so a headless run cannot exercise it.
Say that plainly in the outcome. Do not upgrade it to a measurement.

**The migration is still correct and still wanted.** Two layers that agree are
what this project asks for at a boundary. Only the stated REASON is wrong.

**A third claim is doubtful, and it is not measured.** The comment says 0 *"costs
a pilot up to `KILLS_PER_RUNG - 1` kills of credit, once"*. docs/TODO/160 added
`atonement` AND raised the version to 3 in one item. So no version 2 save can
carry a part-paid rung, and there is no credit to lose. This is an argument from
the record rather than a measurement. Confirm it before you write it down.

## What to do

Two milestones. M1 is the correction. M2 is a decision.

### M1 — the comment says what the code does

Rewrite the version 2 step's comment in `src/game/snapshot.ts`. It must say
three things:

1. an absent `atonement` reaches `recordWorkedOff` as `undefined`, and
   `undefined + 1` is `NaN`;
2. `NaN < KILLS_PER_RUNG` is false, so the first pirate kill takes a whole rung;
3. the migration writes 0, so no save reaches that branch.

**Do not cut the paragraph to make it short.** The rule the comment protects is
subtle, and the next reader needs the arithmetic.

**Check `docs/TODO/README.md` too.** Its 161 entry carries the same claim:
*"an absent `atonement` reaches `recordWorkedOff` as `undefined` and the ledger
runs at NaN — for the rest of that career, saying nothing."* That is a RECORD of
what was decided, and the house style does not rewrite one. A record that states
a false fact is different: correct the fact, and mark the correction.

### M2 — decide whether the rule guards itself

`recordWorkedOff` is a pure rule in `law.ts`. It takes two numbers and trusts
both.

**The case for a guard.** The rule is exported, and `test/` and `train/` may call
it with anything. A silent rung is the worst possible failure for a law rule,
and one line stops it:

```
if (!Number.isFinite(atonement)) atonement = 0;
```

**The case against.** `CLAUDE.md` asks for the cause to be fixed and not the
symptom. The cause is a save with no field, and two layers already answer it. A
third would be a rule with two homes, which `CLAUDE.md` forbids.

**Recommendation: no guard, and a test instead.** Pin the two layers with
assertions, so a future change to either one goes red. Then the arithmetic stays
where it is, and nothing new can disagree with it.

## Verification

The gates always run: `npm run check`. The tier table puts a comment change at
"nothing more". M2 touches a law rule, so also run `npm run campaign` at two
sizes if a guard goes in.

The gate is a new block in `test/snapshot-migrate.test.ts`, which owns what is
raised. Three assertions:

1. A version 2 snapshot with no `atonement` key comes out of `parseSnapshot` at
   version 3 with `atonement === 0`.
2. `recordWorkedOff(FUGITIVE, undefined)` returns a MOVED rung. This pins the
   arithmetic the comment now describes, so the comment cannot rot again.
3. `recordWorkedOff(FUGITIVE, 0)` does NOT move. That is the control, and it is
   what makes assertion 2 mean something.

Prove the gate can fail: take the version 2 entry out of `MIGRATIONS`, and watch
assertion 1 go red.

## Decisions already made

- **The migration stays.** Only its stated reason changes.

## Open questions

- **Is the third claim about `KILLS_PER_RUNG - 1` right?** See "What the sweep
  found". **Recommendation: check it, then delete the clause.** A version 2 save
  cannot hold a part-paid rung, so the sentence prices a loss that cannot occur.

## Watch out for

- **`c.atonement` is read at `law-actions.ts:133` and written at 137.** Read
  both lines before you touch the rule. `lowerLegal` writes the whole result
  back, so a guard inside `recordWorkedOff` also repairs the commander.
- **Do not change `KILLS_PER_RUNG`.** docs/TODO/160 derived 5 from the bounty
  band and the two fine levels. This item does not re-open that.
- **`combat-sim.ts:767` drops the `atonement` event on purpose.** The exercise
  never moves the career's record. Leave it.

## What landed

**Both milestones landed on 2026-08-16.** `npm run check` passes at **4,721
assertions**, up 2. No rule moved. `constants:check` reports 387 exports and 76
rule ids, unchanged.

**The report was exact, and the measurement confirms it:**

```
recordWorkedOff(FUGITIVE, undefined) -> { legalStatus: 1, atonement: 0 }
recordWorkedOff(FUGITIVE, 0)         -> { legalStatus: 2, atonement: 1 }
recordWorkedOff(FUGITIVE, 4)         -> { legalStatus: 1, atonement: 0 }
```

An absent ledger behaves exactly like a fully paid one. The comment named a
silent loss. The behaviour is a loud gift of four kills.

**The third claim is false, and the record proves it.** `git log -S` shows that
`atonement` and `SNAPSHOT_VERSION = 3` arrived in ONE commit, 73dae16, which is
docs/TODO/160 M1. So no version 2 save can hold a part-paid rung. The clause
that priced the raise at up to `KILLS_PER_RUNG - 1` kills is gone from every
copy.

**THE ITEM'S REAL FINDING IS THE COUNT. One wrong sentence had six homes**, and
the plan named two of them. The sweep found the rest:

1. `src/game/snapshot.ts` — the migration comment, which is M1's subject;
2. `docs/TODO/README.md` — the 161 entry;
3. `docs/TODO/completed/161-a-save-that-is-refused-rather-than-raised.md` — the
   triage paragraph the other five descend from;
4. `docs/TODO/completed/README.md` — the 161 index entry;
5. `test/snapshot-migrate.test.ts` — the comment over the last block;
6. `test/atonement.test.ts` — the comment over the migration check, which
   carried the third claim rather than the first.

**A record is corrected rather than rewritten.** The three archive sites keep
their words and carry a dated correction note. The house style does not rewrite
a record of what somebody decided. A record that states a false FACT is a
different case: correct the fact, and mark the correction.

**M2's answer is no guard, and the proof is in the test.** `recordWorkedOff`
stays three lines and trusts its two numbers. The cause is a save with no field,
and two layers already answer it. A third would be a rule with two homes.

**The two new assertions live in `test/atonement.test.ts` rather than in
`test/snapshot-migrate.test.ts`, and that is a deviation from the plan.** They
pin what `recordWorkedOff` RETURNS, and that file's rule block is the home of
every other assertion of that kind. The migration file names it instead. The
plan's third assertion is not added at all: `a ledger of 0 does NOT move the
rung` is already the second check in that block, four lines above, so a copy
would be the same defect this item is about.

**Both gates were proved able to fail, and separately.**

1. With the version 2 entry out of `MIGRATIONS`, the migration checks in
   `test/snapshot-migrate.test.ts` go red. The raised snapshot comes back
   `undefined`.
2. With the guard M2 rejected put into `recordWorkedOff`, exactly the two new
   assertions go red — `got 2, want 1` and `got 1, want 0`. Nothing else in the
   file moves.

**The second proof is also M2's evidence.** A guard is a real behaviour change
rather than a tidy-up, and this test now says so out loud.

**The shelf layer is read from the code and is NOT measured.** `repairCommander`
(`src/game/storage.ts:492`) opens with `{ ...newCommander(), ...stored }`, and
`newCommander()` sets `atonement: 0`. `JSON.parse` never produces an explicit
`undefined`, so an absent key does not overwrite that 0. `repairCommander` is
private and `readSave` needs a store, which node has not got. So this half stays
an argument from the code. Do not upgrade it to a measurement without a store.

**One thing came out of it that the plan did not have.** The first draft of M1's
comment used a compound tense, and `npm run ste:check` failed it:
`snapshot.ts:96 tense: had claimed`. The gate docs/TODO/154 M4 landed caught a
comment written the same day it was told to gate.
