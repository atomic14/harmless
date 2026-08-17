# 181 — The saved shape of a ship leaves the ship

**Kind:** architecture · **Severity:** low · **Size:** small · **Depends on:**
docs/TODO/176 · **Blocks:** nothing · **GitHub:** none

## Where we are

Chris asked to work on `src/game/npc.ts` on 2026-08-17, and to do it in this
session rather than lose the measurements.

**It is the tree's one recorded debt**, at 1,468 lines. Three programmes cut it:
docs/TODO/150's era, docs/TODO/169 and docs/TODO/176.

### Four candidates, and every one is measured

| candidate | lines | what the measurement says |
| --- | --- | --- |
| `update` | 157 | it IS the file's stated responsibility (176 M1) |
| `brainFly`, `attack`, `pursue` | 220 | decision loops behind a 69-call seam (169 M3) |
| `constructor` | 113 | it writes 17 members, and 12 would cross a seam |
| `NpcState` and the types | 271 | ONE importer outside the file |

**The constructor was never measured before today.** It resolves the identity,
builds the fresh state, builds the hull over three role branches, and takes two
spawn rolls. A collaborator that built the hull would return twelve values for
the constructor to assign, because the fields are readonly.

### How the file is actually read

53 files import it. **29 take `type { NpcShip }` alone**, which TypeScript
erases. Three files in `src/` take a value, and they are the ones that construct
ships. **Exactly one importer wants a type WITHOUT the class**, and it is
`train/aim-fight.ts`.

**So there is no coupling argument for any cut.** Chris read that and chose to
take the size cut anyway.

### What can move, and what cannot

`NpcState` names no class. `PlayerRef` names nothing but `THREE`. Both can
leave.

**`FireEvent` and `WorldView` CANNOT.** Each one names `NpcShip`: `FireEvent`
carries `{ at: NpcShip }`, and `WorldView` carries `fleet: readonly NpcShip[]`.
Moving them would make the new file import the file it came out of. TypeScript
erases a type-only cycle, so it would compile. It would still be a child that
depends on its parent.

**The fresh-state literal can leave with `NpcState`.** It is 24 lines inside the
constructor, and it reaches `this.maxEnergy` and nothing else. So the factory
takes one argument.

## What to do

Two milestones.

### M1 — `game/npc-state.ts`

`NpcState`, `PlayerRef` and a `freshNpcState(maxEnergy)` factory. About 245
lines leave, and `npc.ts` goes to about 1,223.

**The per-field doc comments travel with their fields.** That is where
`CLAUDE.md` asks for them, and docs/TODO/169 M4 refused this cut partly on that
ground. Moving both together answers it: nothing is separated from its comment.

**Three importers are repointed**: `train/aim-fight.ts` for `NpcState`, and
`ai-training/scenario.ts` and `test/human-shape.test.ts` for `PlayerRef`.

**`FireEvent` and `WorldView` stay, and the new file's header says why.**

**`npc.ts` repairs its own header in the same commit** (`CLAUDE.md`,
docs/TODO/152), and its neighbours' comments are checked too. docs/TODO/179 is
the precedent: 176 M2 repaired the file it emptied and left five neighbours
naming the old home.

### M2 — the row stops saying DEBT

`tools/sizes.mjs` marks this file `DEBT`, which is a prefix on its reason
string. **A debt nobody can act on is a stale claim.** The row's own
"ONE CANDIDATE IS LEFT" paragraph points at `NpcState`, which M1 moves and which
had one importer.

The row states the four measurements and what would re-open it: a new
measurement, and never a line count.

**The file still needs a stated reason**, because it is over 400 lines. The
reason is that it is one ship, and its two halves reach the transform and the
scratch vectors 69 times.

## Decisions already made

- **Chris chose the move on 2026-08-17.** He was offered retiring the debt with
  no code change, and leaving the row as it is, and declined both.
- **`FireEvent` and `WorldView` stay.** A child that imports its parent is worse
  than a longer file.
- **No behaviour changes.** This item moves a type, a factory and 24 lines of
  literal. No value and no rule moves.

## Open questions

None.

## Watch out for

- **`snapshot.ts` walks `NpcState` GENERICALLY** and never names the type. So
  the save format follows the fields rather than an import, and a field added in
  the new file is still saved. `test/snapshot.test.ts` holds that.
- **`freshNpcState` must stay allocation-free per call in the same way.** It is
  called once per spawn rather than per frame, so it may allocate, and it
  already does.
- **The two spawn rolls stay in the constructor.** `docksHere` and `tumbleAxis`
  are drawn inside the literal and travel with it. `packOffset` and the tactic
  roll are taken after the hull exists, and they read `this.tacticHull`.
- **The seeded stream must not move.** `random()` is drawn inside the literal in
  a fixed order, and any reordering changes every seeded outcome (invariant 11).

## Verification

The gates always run: `npm run check`.

**The tier table puts this at "a rule that changes how a fight goes"**, because
`npc.ts` is the ship. **No value moves**, so the evidence is that nothing moved:

- `survivability`, `aim-probe`, `gap-probe` and `ram-probe` byte-identical;
- `npm run campaign` byte-identical at two sizes;
- the assertion count unchanged, except for M1's own gate.

Take the baseline before M1. **The seeded stream is the risk this evidence
covers.** A draw moved across a branch changes every seeded outcome, and a probe
is what says so.

**M1's gate**, in the shape docs/TODO/169 M2 and 176 M2 both used:

1. a source scan that `game/npc-state.ts` names no ship class, with a control;
2. a fixture that `freshNpcState` returns a state a snapshot can walk, driven
   through the real `serialiseState`.

**Prove each able to fail**, and each one alone.
