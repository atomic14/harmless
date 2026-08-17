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

To be written.
