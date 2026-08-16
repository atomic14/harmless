# 161 — The game refuses an old save rather than raising it

**Kind:** defect · **Severity:** high · **Size:** small · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** none — Chris, 2026-08-16: *"We
should migrate snapshot v2 to v3."*

A **migration** in this plan is a function that raises a stored snapshot from
one version to the next. The code has no such thing today. This plan gives it
one, and the word is used only for that.

## Where we are

Every claim below is read off the code that runs.

**One line refuses a whole career.** `parseSnapshot`
(`src/game/snapshot.ts:275`) opens with
`if (s.version !== SNAPSHOT_VERSION) bad(...)`. `SNAPSHOT_VERSION` is 3.

**Version 2 was current for one day.** docs/TODO/156 took it to 2 on
2026-08-15, and docs/TODO/160 took it to 3 the same day. So a save written
between those two commits is refused, and a save written before 156 is version 1
and is refused as well.

**The refusal is silent, and that is the worst part of it.** `readSave`
(`src/game/storage.ts:157`) checks `SAVE_RECORD_VERSION`, which is 1 and did not
move, so a version 2 record IS on the shelf and IS listed. The snapshot's
version is not read until `Persistence.restore` (`src/game/persistence.ts:177`)
calls the door. So the save appears, the player picks it, and it throws.

**Exactly one field separates version 2 from version 3.** docs/TODO/160 added
`commander.atonement` and nothing else to the shape. Every other change it made
was a rule.

**The commander is already repaired on one path, and it is not the path that
refuses.** `repairCommander` (`src/game/storage.ts:492`) spreads
`{ ...newCommander(), ...stored }`, so a shelf commander with no `atonement`
already arrives with 0. Its own doc says *"IT IS NOT A SAVE MIGRATION"*, and it
is right: the field it fixes is not the one the door reads.

**The parse boundary states the rule this plan changes.**
`src/game/snapshot.ts:226` says the parser *"checks what has invariants"* and
that *"Nothing is copied and nothing is repaired — an invalid snapshot is old
junk, refused whole"*. An OLD snapshot and an INVALID one are different things,
and the sentence does not yet separate them.

## What the triage found that the instruction did not say

**The field cannot simply be left absent.** `Persistence.restore` does
`structuredClone(snap.commander)` straight into `s.commander`. An absent
`atonement` therefore reaches `recordWorkedOff` as `undefined`, and
`undefined + 1` is `NaN`. A ledger at NaN never reaches `KILLS_PER_RUNG`, so
that commander could never work a record off again, and nothing would say so.
The migration must WRITE the field, not merely permit its absence.

> **Correction, 2026-08-16 (docs/TODO/167).** The two sentences above are wrong
> about which way the fault runs. `NaN < KILLS_PER_RUNG` is false, not true, so
> the rule skips the "part paid" branch and takes a whole rung on the FIRST
> pirate kill. It then writes `atonement: 0`, so the ledger heals itself, and
> `LawActions.lowerLegal` queues `recordVerdict` to announce the rung.
> Measured: `recordWorkedOff(FUGITIVE, undefined)` returns
> `{ legalStatus: 1, atonement: 0 }`. **The conclusion still holds.** The
> migration must write the field, and a gift of four kills is as wrong as a
> silent loss.

**A newer version must still be refused, and one gate already says so.**
`test/snapshot-parse.test.ts:96` poisons a real snapshot with `version + 1` and
demands a refusal. A migration that climbs from known older versions leaves that
true. A migration that merely relaxed the comparison would not.

**The deletion sweep depends on the version check.** The same file deletes every
top-level key of a real snapshot and demands a refusal. Deleting `version`
leaves `undefined`, so the migration must match a version EXACTLY and never
treat an absent one as old.

**One assertion written yesterday encodes the refusal, and it is mine.**
`test/atonement.test.ts` asserts that a snapshot at `SNAPSHOT_VERSION - 1` is
refused, with the reason that a default of 0 *"would silently take four pirates
back off them"*. That reasoning is now overruled: a save that will not load
costs a career, and four pirate kills cost a few minutes. The assertion is
rewritten to the new truth rather than deleted, so the file still says what
happens to a version 2 save.

## What to do

ONE milestone, and therefore one commit.

### M1 — the door raises an old snapshot instead of refusing it

**A table, in `src/game/snapshot.ts`, directly under `SNAPSHOT_VERSION`.** That
constant's doc already lists what each version ADDED. The list of how to climb
each step belongs beside it, so the two cannot drift.

```
interface Migration { readonly from: number; readonly up: (s: ...) => void }
const MIGRATIONS: readonly Migration[] = [ { from: 2, up: ... } ];
```

**`migrateSnapshot(raw)` climbs the chain.** While a migration's `from` equals
the snapshot's current version, it runs and stamps the version one higher. Each
step raises the version by exactly one, so the loop cannot spin.

- It matches the version by STRICT EQUALITY against a number. An absent
  version, a string `"2"`, or a version 4 matches nothing and falls through to
  the check that already refuses it.
- It works on a COPY, and only when it has work to do. A version 3 snapshot is
  not cloned at all, so the common path costs nothing, and a refused snapshot
  leaves the caller's bytes exactly as they were.

**The v2 step writes `commander.atonement = 0`,** and writes it rather than
defaulting it, for the NaN reason above. It writes it only when the field is
absent, so a hand-edited file that already carries one keeps it.

**`parseSnapshot` calls it first**, before the version check. It stays THE door:
one place where untrusted bytes become a `WorldSnapshot`, and now one place
where an old one is raised on the way through.

**Version 1 is NOT migrated in this milestone**, and the reason is under Open
questions rather than settled here.

**The parse-boundary header is repaired in the same commit.** It currently says
that nothing is repaired. It must now separate an OLD snapshot, which is raised,
from an INVALID one, which is still refused whole.

## Verification

The gates always run: `npm run check`.

Beyond them, tiered to the change. This touches the save format and no game
rule, so no probe answers it.

1. **`test/snapshot-migrate.test.ts`**, a new file, is the gate. It builds a
   version 2 snapshot by taking a REAL captured one and removing what version 3
   added — never by hand-writing a fixture, which would rot the day the shape
   moves:
   - a version 2 snapshot parses, and comes back stamped 3;
   - `commander.atonement` is 0 on the far side;
   - EVERY other field is byte-identical to the version 3 snapshot it was made
     from, so the migration is proved to touch two fields and no others;
   - the caller's own bytes are unchanged by the call;
   - a version 2 snapshot restored into a live Game gives a commander whose
     ledger WORKS — five pirate kills move the rung — which is the NaN the
     triage found, asserted as behaviour;
   - a version 2 commander that already carries an `atonement` keeps it;
   - version 1, version 4, version 0, `"2"` and an absent version are all still
     refused.
2. **Prove the gate can fail.** Restore the strict version check, and count the
   failures. Then restore the migration and make its `up` a no-op, and count
   them again. The door and the field must fail separately.
3. **`test/snapshot-parse.test.ts` must be untouched and still pass.** It is the
   gate that says a newer version and a missing key are refused. If this item
   needs to edit that file, the migration is too wide.

Not run: the probes and `npm run campaign`. No rule, price or flight number
moves.

## Decisions already made

- **A stored save is raised rather than refused** (Chris, 2026-08-16): *"We
  should migrate snapshot v2 to v3."* This overrules docs/TODO/160's recorded
  reasoning, which chose the refusal.

## Open questions

**One, and it is Chris's.** Version 1 saves — anything written before
docs/TODO/156 landed on 2026-08-15 — are still refused. The step is one entry in
the same table.

- **For migrating it:** the delta is `occupant` and `grace` on a canister, and
  both have a correct value for an object that predates them — `''` and `0`,
  which is what a plain canister carries today. 156 chose `''` precisely
  because it is INERT: `offenceFor('')` is Clean, so a reader that does not know
  gets a harmless answer.
- **Against:** a capsule already drifting in a version 1 save would become a
  capsule whose occupant is unknown, so shooting it would cost nothing. 156's
  plan called that *"guessing would decide a commander's record for them"*.
- **The scope of the loss is small and bounded:** it is the drifting objects in
  one saved moment, and only the capsules among them.

The machinery lands either way. Adding version 1 is one table entry and one
test block.

## Watch out for

- The migration must not be reachable from `capture()`. A captured snapshot is
  current by construction, and a migration that ran on it would hide a bump
  somebody forgot.
- `repairCommander` in `storage.ts` is NOT the place for this, and its own doc
  says why. It repairs a record's contents on the way off the shelf; the door
  raises a world's version. Two rules, two homes.
- `test/atonement.test.ts` asserts the OLD refusal. Rewrite that assertion to
  the new behaviour in the same commit, or the gate contradicts the code.

## Outcome — landed 2026-08-16

M1 landed. `npm run check` passes: **4,686 assertions, 0 failed**.

**Both gates were proved able to fail, and they fail separately.** Taking
`migrateSnapshot` back out of the door turns **3 assertions** red. Leaving the
door alone and emptying the v2 step's `up` turns **2** red — the raised ledger,
and the flown commander that proves it is a number.

### What the work found that the plan did not have

**`parseSnapshot` returned `raw`, not the object it had validated.** The last
line was `return raw as WorldSnapshot`. For a current snapshot the two are the
same object, so nothing had ever noticed. With a migration they are not: the
door validated the raised COPY and handed back the version 2 original, so the
first run of the gate reported a save that still said version 2. The line reads
`s` now, and says why.

**The first gate died instead of failing.** Proving that it could fail is what
found it: with the door restored to a strict check, `parseSnapshot` threw out of
a bare call, the process ended, and the run reported nothing and counted
nothing. Every raise in the file goes through a `raise()` helper now that turns
a refusal into `null`. **A gate that cannot report its own failure is not a
gate**, and only the break-it step can find that.

**`MIGRATIONS` needed a line in `test/constants.test.ts`'s `OUTSIDE` list.** The
gate that keeps game-rule constants in `src/constants/` saw a new top-level
table. It is not a value: it is the CODE that climbs each version, and
`src/constants/` may hold no behaviour. It joins `SNAPSHOT_VERSION` in the group
that already argues a version must sit beside the shape it versions.

**`src/game/snapshot.ts` crossed the size ceiling, at 456 lines.** The seam was
already drawn in the file, as a `// --- the parse boundary ---` banner. The door
is `src/game/snapshot-parse.ts` now, 157 lines against 311 left behind, and the
split is a real division of responsibility rather than a line count: one file
says what a snapshot IS — the shape, the version, the table that climbs it, and
the codec — and the other says what makes one trustworthy. `test/snapshot-parse.ts`
already carried the door's name.

**One promise in the Verification section had to be qualified.** It said
`test/snapshot-parse.test.ts` must be untouched. It changed by one line: the
import of `parseSnapshot` follows the function to its new file. **No assertion
in it moved**, which is the claim that was worth making, and the edit is forced
by the size gate rather than by the migration.

**Four files import `parseSnapshot`** — `persistence.ts` and three test files —
and each gained one import line. `persistence.ts`'s own THE DOOR comment names
the new home and the raise.
