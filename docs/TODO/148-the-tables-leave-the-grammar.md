# 148 — The tables leave the grammar

**Kind:** refactor · **Severity:** low · **Size:** small · **Depends on:** 146 ·
**Blocks:** nothing · **Source:** Chris, 2026-08-14: *"What are the rules around
file size. We seem to focus on trimming instead of splitting."*

## Where we are

He is right, and `CLAUDE.md:88` is the rule that was broken:

> Prefer small files with one purpose each. Exceed the size ceiling only with a
> stated reason. **Never delete useful content only to fit that ceiling.**

`src/game/controls.ts` was trimmed **six times across three items** to stay under
400 lines, and split **zero** times. Measured live during the work:

| item | what happened |
| --- | --- |
| 144 M6 | 403 → cut a comment → 398 |
| 145 M2 | 406 → 403 → 402 → 401 → moved a rule out → 397 |
| 146 | 419 → cut → 409 → added to `ALLOWED` |

Every one of those cuts deleted reasoning that had just been judged worth
writing. One of the moves was right on its own merits — the click-path rule
belongs beside `dockedMenuHtml`, which builds the row — but it was found by
hunting for lines rather than by asking where the rule lived.

**The `ALLOWED` entry added at the end of 146 is the thing to undo.** It argued
that splitting would make the code worse. That argument was made by somebody who
did not want to do the work, and it does not survive contact with the file.

## What the file actually is

408 lines, and it is two things:

| lines | what |
| --- | --- |
| ~148 | **the grammar** — `Command`, `ControlMode`, `Binding`, `CommandInput`, and the scan that reads a table |
| ~210 | **the data** — `GLOBAL_BINDINGS`, `FLIGHT_BINDINGS`, `NOT_IN_THE_SIMULATOR`, `WHILE_PAUSED`, `BINDINGS` |

The data is what grows. Three items in a row added a command and pushed the file
over; none of them touched the scan.

**The precedent is already in the codebase.** `command-help.ts` was split out of
this file and welded back by `Record<Command, CommandHelp>`: what a command DOES
in words lives apart from which key asks for it. This is the same move for the
third face — which command each MODE offers, and on what key.

## What to do

### M1 — `src/game/bindings.ts` takes the tables

Move, unchanged: `GLOBAL_BINDINGS`, `FLIGHT_BINDINGS`, `NOT_IN_THE_SIMULATOR`,
`WHILE_PAUSED`, `BINDINGS`. Every doc comment travels with its table. **Nothing
is reworded to fit anything.**

`WHILE_PAUSED` goes with them rather than staying with the grammar, and the
reason is the file's new purpose: *which commands a mode offers*. A paused
cockpit is a mode in all but name, and `NOT_IN_THE_SIMULATOR` — its sibling in
shape — has to go, because the simulator table is built from it.

### M2 — `controls.ts` keeps the grammar

`Command`, `ControlMode`, `Binding`, `CommandInput`, `fires`, `scan`,
`globalCommands`, `commandsFor`. It imports `BINDINGS` and `GLOBAL_BINDINGS`
from `bindings.ts` at RUNTIME; `bindings.ts` imports only TYPES back, which
TypeScript erases (`tools/portability.mjs` says so in as many words). So there is
no runtime cycle.

Both headers get rewritten to say what their file is now, and the three
load-bearing rules stay with the scan that enforces them — with `bindings.ts`
naming the one that binds it: a shifted entry sits above its plain twin.

### M3 — the importers, and the two gates that name the file

Fourteen files import from `controls.ts`. Only those taking `BINDINGS`,
`GLOBAL_BINDINGS`, `NOT_IN_THE_SIMULATOR` or `WHILE_PAUSED` change.

Two gates name `game/controls.ts` by path and must follow:

1. `test/constants.test.ts` whitelists its five table exports — that entry moves
   to `game/bindings.ts` whole.
2. `tools/sizes.mjs` — **the `ALLOWED` entry is deleted**, not moved. That is the
   point of the item.

## Decisions already made

- **Split it** (Chris, 2026-08-14).
- **No prose is cut to make either file fit.** If a file is still over after the
  split, it earns an `ALLOWED` entry honestly. Neither should be.
- **CLAUDE.md is Chris's** — he is reviewing the wording himself.

## Open questions, and the answers

**1. Why not split the `Command` union out instead?** It is the vocabulary the
scan and the tables both speak. Moving it makes adding a command touch three
files rather than two, and it sheds 57 lines against the data's 210.

**2. Why not move the scan out and leave the tables?** The scan is ~48 lines, so
`controls.ts` would sit at ~350 and cross again within two items. It would also
put the first-match rule in a different file from the tables whose ORDER is that
rule's whole point.

**3. Does the type-only import back count as a cycle?** No at runtime, which is
the only kind that bites. `tools/portability.mjs` states it: *"Type-only
declarations are intentionally absent: TypeScript erases them."*

## Watch out for

- **`npm run portability`** classifies by import graph. Neither file reaches for
  a browser, so both stay portable — but run it, because it is not in
  `npm run check`.
- **`test/constants.test.ts`** fails on an undocumented export in a file it
  scans. A new file with five exports needs its entry, or the gate fires.
- **The comments are the point.** A doc comment that arrives in the new file
  shortened is this item failing at the thing it exists to fix.

## Verification

**The gates always run**, and they are `npm run check`. This item moves code
between files and changes no rule, so docs/PROCESS.md's tier table asks for
nothing more. `npm run portability` runs too, because the module graph moved.

**The split must be provably behaviour-free**, which is what a refactor's gate
is:

1. Every existing key test passes untouched — `key-help`, `ui`, `menu-click`,
   `input`, `test-mode`, `combat-sim`, `quit`.
2. Both files come in under 400 lines with no `ALLOWED` entry.
3. The `ALLOWED` entry for `game/controls.ts` is gone.
4. `npm run sizes` reports one fewer file over the limit.

**No sampled number drives a decision here**, so the two-sample-size rule does
not apply.

## What landed

Not started.
