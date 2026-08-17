# 185 — A contract kind declares only the fields it uses

**Kind:** architecture · **Severity:** low · **Size:** small · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** none

## Where we are

**Chris asked on 2026-08-17 whether docs/TODO/182's pattern helps elsewhere.**
A survey measured 205 branches on a type tag, across 51 files. It then read the
candidates, because docs/TODO/177 showed what a count without reading is worth.

**The answer for the pattern was no, and `Contract` was the one thing the survey
found on the way.** It is a different defect, and it takes a different fix.

### The record says one thing and means five

`game/commander.ts` declares seven fields. Three of them change meaning with the
tag, or mean nothing at all:

```ts
export interface Contract {
  kind: 'cargo' | 'bounty' | 'courier' | 'passenger' | 'smuggle';
  destination: number;
  commodity: number; // cargo and smuggling runs only
  qty: number;
  reward: number;
  deadlineDay: number;
  progress: number; // bounty kills so far
}
```

**The comments are the specification, and the compiler cannot read a comment.**
`commodity` is meaningless on a courier run. `progress` is meaningless on
everything but a bounty. `qty` is tonnes, or kills, or heads.

**A courier contract carries a `commodity` today.** `contract-offers.ts` writes
one, because the type demands a number. Nothing reads it. A reader of the type
cannot tell that from a reader of the code.

### What the tag reaches

Measured on 2026-08-17. Twenty sites in six files, and the four unambiguous
kinds are what the count reads:

| sites | file | what it asks |
| --- | --- | --- |
| 7 | `game/contract-offers.ts` | which job to build, and how it reads |
| 6 | `game/contracts.ts` | what loading costs, and what settling pays |
| 3 | `game/commander.ts` | the berths, and what the hold owes |
| 2 | `ui/screens.ts` | the colour, and the progress count |
| 1 | `game/docked.ts` | whether a sale marks the record |
| 1 | `game/combat-wreck.ts` | whether a kill counts toward a bounty |

**`'cargo'` is three different tags in this tree.** A contract kind, a canister
kind and a shot kind all use the word. So the count above reads `bounty`,
`courier`, `passenger` and `smuggle` only.

### The save format does not stand in the way

**`snapshot-parse.ts` never validates a contract.** It validates the commander's
hull, galaxy and system index, then it stops. `Persistence.restore` clones the
commander straight in.

**So a union is a compile-time change with no runtime effect.** No migration is
needed, and `SNAPSHOT_VERSION` stays at 3.

**A RENAME IS A DIFFERENT MATTER, and M2 is where that is decided.** A field
name is written into the saved JSON. To rename `qty` breaks every existing save,
and it needs a migration entry.

## What to do

Two milestones. The second one may land nothing, and that is a real outcome.

### M1 — the union

`game/commander.ts` declares a discriminated union in `Contract`'s place. Each
kind carries the fields it uses, and no others.

The shape, with the field names unchanged:

```ts
interface ContractBase {
  destination: number;
  qty: number;
  reward: number;
  deadlineDay: number;
}
export type Contract =
  | (ContractBase & { kind: 'cargo' | 'smuggle'; commodity: number })
  | (ContractBase & { kind: 'bounty'; progress: number })
  | (ContractBase & { kind: 'courier' })
  | (ContractBase & { kind: 'passenger' });
```

**THE HOUSE ALREADY USES THIS SHAPE.** `CombatEvent`, `ContractEvent` and
`TraderControl` are each a union on `kind`. This makes the contract read like
its neighbours.

**`qty` STAYS ON THE BASE, and it stays as one name.** It is on every kind, so
it is not the union's business. M2 asks whether the NAME is.

**Every call site the compiler reddens is the point.** A site that reads
`k.commodity` without narrowing on `kind` is a site that could read a courier's.
Narrow it, or prove that the kind is already known.

### M2 — measure the rename, then decide

**`qty` MEANS TONNES, KILLS OR HEADS.** That breaks CLAUDE.md's "one word, one
meaning" rule, and the rule is the reason to look.

Measure three things, then recommend:

1. how many sites read `qty`, and how many already know the kind;
2. what a migration entry costs, against the pattern `MIGRATIONS` sets;
3. whether an old save that carries `qty` can be read without a version bump.

**Land no rename without that measurement.** docs/TODO/183 M3 and 184 both
measured and refused a step the plan named. This may be the third.

## Decisions already made

- **Chris chose this item on 2026-08-17**, from a survey that recommended
  against docs/TODO/182's pattern here. He asked for the union.
- **A union rather than a behaviour object.** The branches are per-kind rules
  over a saved record, not behaviour a class owns. `Contract` is data.
- **No rule and no value changes.** This item changes a type.
- **`SNAPSHOT_VERSION` stays at 3 in M1.** No saved byte moves.

## Open questions

None that block M1. M2 exists to answer its own.

## Watch out for

- **`'cargo'` IS THREE TAGS.** A contract kind, a canister kind (`cargo.ts`) and
  a shot kind (`shot.ts`) share the word. A search that does not disambiguate
  reads all three.
- **Ten test files build a contract literal.** A literal that omits a field the
  union demands fails to compile, and a literal that carries a field the union
  forbids fails too. Both are the gate working.
- **`contract-offers.ts` writes `commodity: 0` on a courier today.** The union
  forbids that field. Deleting the write is the change, and nothing reads it.
- **`ui/screens.ts` reads `o.job.progress` for a bounty.** It already tests the
  kind on the same line, so it should narrow with no edit.
- **An excess property survives a JSON round trip.** An old save carries
  `commodity` on a courier. TypeScript never sees it, and no code reads it. That
  is correct, and no cleanup is needed.

## Verification

The gates always run: `npm run check`.

**The tier table puts this at "a change that moves no value"**, so the evidence
is that nothing moved:

- `npm run campaign` byte-identical at two sizes, because contracts are what it
  measures;
- `npm run roster-probe` and `npm run dock-traffic`, which fly the station;
- the nine combat probes are not needed. No contract reaches a flight model.

Take the baseline before M1.

**A GATE IS NOT OBVIOUSLY NEEDED HERE, AND THAT IS WORTH STATING.** The compiler
holds the claim. A test that asserts "a courier has no commodity" would assert
the type against itself, which CLAUDE.md forbids.

**So the gate is the one thing the compiler cannot hold**: that a saved contract
from before this item still loads. Write a fixture that parses a snapshot whose
courier carries `commodity`, and check that the run works.

**Prove it able to fail.**

## Outcome

### M1 — the union

`Contract` is a union of four members over a `ContractBase` of four fields. The
campaign is byte-identical at two sizes, and so are `roster-probe` and
`dock-traffic`. No saved byte moved.

**THE COMPILER FOUND 35 SITES, AND EVERY ONE WAS A REAL DEFECT OR A REAL
IMPRECISION.** Eight in `src/`, and 27 in `test/`.

**`contract-offers.ts` WROTE FIVE DEAD FIELDS.** A courier, a passenger job and
a bounty each carried `commodity: 0`. Four of the five kinds carried
`progress: 0`. Nothing read any of them.

**`ConsignmentContract` IS WHAT THE PLAN DID NOT HAVE.** Three rules in
`contracts.ts` read a `commodity`, and each one is reachable only for a cargo or
a smuggling run. The plan said to narrow at each site. An alias says it one time
in a signature, and `billShortfall` plus two `ContractEvent` payloads take it.

**`reclaimedClause` GAINED A GUARD, AND THE GUARD IS NOT DEAD.** It read
`e.contract.commodity` under `reclaimed > 0`. That test is true only for a
consignment, and the compiler cannot know it. The tag test is what gives the
line a `commodity` to name.

**A TEST HELPER SAID "A JOB OF ANY KIND" AND BUILT ONE WRONG.**
`consigned-hold.test.ts` made a courier, a passenger job and a bounty by
overriding a cargo run's `kind`. Each result then carried a `commodity` that no
such job has. Two builders replace it.

**FOUR MORE TEST FILES HELD THE SAME PATTERN**, and each is now a builder per
kind. A builder refuses a `kind` override where the override crossed a member of
the union.

**ONE ASSERTION DIED, AND IT WAS RIGHT TO.** `contract-offers.test.ts` counted
passenger jobs that carried goods, and asserted the count was 0. The union has
no `commodity` on a passenger job, so the count could only ever be 0. A test
that cannot fail asserts the implementation against itself (CLAUDE.md). The
claim is stronger for being the compiler's.

**`combat.test.ts` HELD TWO BOUNTY JOBS AS LITERALS CAST `as never`**, and read
`.progress` off `Contract`. They are typed locals now, and the cast is gone.

**`test/contract-union.test.ts` IS 8 ASSERTIONS IN TWO PARTS.** It holds the one
claim the compiler cannot see. A save written before this item still loads, and
it still settles for what it always paid. **Proved able to fail two ways.** A parse
that rejects an excess field refuses the old save. A parse that drops `reward`
reddens the second claim alone.

**THE SIZE GATE WENT RED, AND IT FOUND A DUPLICATE RULE.** `commander.ts` grew
357 lines to 401, and the ceiling is 400. CLAUDE.md forbids a trim to fit. What
the look found was a real duplicate: the doc comment and
`test/contract-union.test.ts` both argued why no saved byte moved. The test
holds the claim, so the test is its home. The file is 397.

**A SPLIT CANDIDATE CAME OUT OF THAT, AND IT IS NOT THIS ITEM'S.**
`commander.ts` says it describes "who you are, what you are carrying, and how
you rank". A job on a bulletin board is none of those. `Contract` may belong in
a file of its own, beside `contracts.ts` and `contract-offers.ts`. That is 29
importers, so it needs its own item.

4,907 assertions became 4,915.

### M2 — the rename is refused, on three measurements

**THE ANSWER IS NO, AND IT IS THE THIRD REFUSAL IN A ROW.** docs/TODO/183 M3
and 184 both measured a step their own plan named, then declined it. This is
that shape again.

**1. EVERY SITE ALREADY KNOWS THE KIND.** 18 sites in `src/` read a contract's
`qty`. Measured on 2026-08-17, and read rather than counted:

| sites | file | what narrows it |
| --- | --- | --- |
| 8 | `game/contracts.ts` | a tag test on the branch above each one |
| 4 | `game/contract-offers.ts` | one line per kind, each behind its own tag |
| 2 | `game/combat-wreck.ts` | inside the bounty branch |
| 2 | `game/commander.ts` | `k.kind === 'passenger'`, and the consignment pair |
| 1 | `game/docked.ts` | inside `e.contract.kind === 'smuggle'` |
| 1 | `ui/screens.ts` | the same line tests for a bounty |

**Not one site reads `qty` off an unnarrowed `Contract`.** So a reader always
has the kind in view, and the rename would clarify nothing at any point of use.
`k.qty * PASSENGER_BERTH_TONNES` inside a passenger branch needs no lookup.

**2. THE MIGRATION LADDER HAS ONLY EVER ADDED A FIELD.** `snapshot.ts` states
its own bound: a step "fills in what a version did not have. It never repairs a
field that version was supposed to carry." A rename is neither of those. It
MOVES a field that every version carried, and it would be the first step of that
kind.

**3. AN OLD SAVE CANNOT BE READ WITHOUT A VERSION BUMP.** `qty` is written into
the JSON, and `Persistence.restore` clones the commander straight in. A reader
of `tonnes` would get `undefined`. That failure is silent. It is the exact one
docs/TODO/160 recorded for `atonement`. `undefined + 1` is `NaN`, and `NaN < x`
is false. So a rule takes the wrong branch, and it says nothing.

**THE TRADE IS A CAREER AGAINST A NAME.** Chris's rule of 2026-08-16 stands at
the top of `MIGRATIONS`: **a save that will not load costs a career.** The
rename buys no clarity at any of 18 sites. It costs `SNAPSHOT_VERSION` 4, a new
kind of migration step, and a second pass over ten test files.

**`qty` STAYS.** Its doc comment on `ContractBase` names all three meanings, and
that comment is the whole remedy the sites need.

### What M2 did land

**A STALE DOC COMMENT, FOUND BY READING FOR THE MEASUREMENT.**
`consignedTonnes` said a bounty and a courier run carry nothing "and their
`commodity` field is unread". They have no such field since M1. The comment now
says that the tag test is the type's.
