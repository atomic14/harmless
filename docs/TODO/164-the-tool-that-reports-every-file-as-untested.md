# 164 — The tool that reports every file as untested

**Kind:** defect · **Severity:** high · **Size:** small · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** none — found by the sweep of
2026-08-16

## Where we are

**`npm run coverage` prints a false report, and it prints it with confidence.**
The current output says that 259 of 260 files never ran:

```
least covered:
   98.3%  undefined

overall 98.3% of executed bytes, 1 of 260 files touched

NEVER EXECUTED (259) — the list that matters:
```

The list holds `src/constants/law.ts`, `src/game/world-step.ts` and every other
file the suite drives thousands of times.

**One line causes all of it.** `tools/coverage.mjs:34` reads:

```
const rel = s.url.split('/elite-web/')[1];
```

The checkout directory is `harmless`. So the split misses, every path becomes
`undefined`, and the map collapses to one key. That one key is the `undefined`
row at the top. Every real file then falls into the "never executed" list,
because `files.has(p)` cannot match a path that was never stored.

**The tool's own header says which half matters.** It reads: *"The number that
matters is not the percentage, it is the LIST at the bottom: files no test
touches at all."* That list is now 100% false. A tool that names every file as
untested is worse than no tool, because a reader cannot act on it.

**Measured, with the path corrected in a copy.** The real picture is:

```
overall 98.3% of executed bytes, 247 of 259 files touched
NEVER EXECUTED (12)
```

The twelve are the browser entry points and one types-only file:
`encyclopaedia/chart.ts`, `encyclopaedia/main.ts`, `engine/browser-shell.ts`,
`game/elite-a/types.ts`, `game/sounds.ts`, `main.ts`, `manual.ts`,
`viewer/gallery-main.ts`, `viewer/gallery.ts`, `viewer/main.ts`,
`viewer/stage.ts` and `world/corona-texture.ts`.

The least covered files that are NOT browser-bound are the finding the tool
exists to produce:

| file | covered |
| --- | ---: |
| `src/engine/keymap.ts` | 80.5% |
| `src/game/game-handles.ts` | 82.9% |
| `src/game/flight-instruments.ts` | 84.7% |
| `src/engine/input.ts` | 85.7% |
| `src/game/screens/chart.ts` | 89.3% |

**The chart row is a real defect, and docs/TODO/163 is it.** That is the
evidence that the list works when the tool runs.

**Nothing could catch this.** `npm run coverage` is not in `npm run check`, and
the tool exits 0 while it reports nonsense.

## The second thing no gate reads

**`tmp-jump.ts` sits in the repository root, and git tracks it.** It went in with
commit 46828fb, which is the docking-path work of docs/TODO/136. Nothing imports
it.

**`tsconfig.json` includes `src`, `train`, `test` and `tools`.** The root is not
on that list, so `npm run lint` never reads the file. `tools/sizes.mjs` and
`npm run ste:check` read `src/`, so they never read it either.

**It no longer compiles.** Compiled on its own it fails:

```
tmp-jump.ts(13,64): error TS2554: Expected 5 arguments, but got 6.
```

`dockPath` took a sixth parameter away, and the scratch file rotted in silence.

**It shares one root with the coverage tool.** Both are surfaces that
`npm run check` never looks at. A path written down one time and never checked
again is the defect in both halves.

## What to do

Two milestones.

### M1 — the coverage tool finds its own checkout

Replace the hard-coded directory name with the process's own root:

```
const ROOT = process.cwd();
...
const rel = s.url.split(ROOT + '/')[1];
if (!rel) continue;
```

`process.cwd()` rather than a name, because the tool already runs from the
repository root. `npm run coverage` guarantees that, and `test/run.ts` on line 21
needs it too. The `continue` drops a coverage record from outside the checkout,
which is what the `undefined` key used to collect.

**Do NOT rename anything that says `elite-web` elsewhere.** `elite-web-` is the
live save namespace (`src/game/storage.ts:55`), and `elite-web-harness-` is the
harness one. A rename orphans every save on every player's shelf. Chris pinned
that on 2026-07-28, in commit e2a60b1: *"Point at the new repo, and pin down what
must NOT be renamed."* This item touches one filesystem path in one tool.

### M2 — the scratch file goes

Delete `tmp-jump.ts`. Nothing imports it, and it does not compile.

Add `tmp-*.ts` to `.gitignore`, under the "local scratch" heading that already
holds `*.local`. That stops the next one.

## Verification

The gates always run: `npm run check`. The tier table puts a tool change at
"nothing more".

**M1 is proved by its own output.** Run `npm run coverage` and read three
things:

1. the "least covered" rows name real files rather than `undefined`;
2. the touched count is 247 of 259 rather than 1 of 260;
3. the "never executed" list holds 12 files rather than 259.

**M1 also gains a gate**, because an output nobody asserts is what rotted here.
Add a self-check to the tool: exit 1 when the touched count is under half of the
files found. A tool that measures nothing then says so, rather than printing a
tidy table.

Prove that gate can fail: put `/elite-web/` back and watch the tool exit 1.

**M2 is proved by `npm run lint`.** Add the repository root to `tsconfig.json`'s
`include`, and confirm that `tmp-jump.ts` fails the lint BEFORE you delete it.
That step is what shows the hole was real. Then delete the file, and decide
whether the root stays on the include list.

## Decisions already made

- **The measurement is worth keeping.** The tool found `station.ts` and
  `screens/trade.ts` when it was new, and it finds `screens/chart.ts` now.

## Open questions

- **Should `npm run coverage` join `npm run check`?** It runs the whole suite a
  second time under `NODE_V8_COVERAGE`, so it roughly doubles the gate's cost.
  The argument for is that this defect lived for weeks. The argument against is
  that the self-check in M1 answers the same worry for nothing. **Answer: no.**
  Add the self-check, and leave the tool outside the gate.
- **Does the repository root belong in `tsconfig.json`'s `include`?** M2's
  verification adds it for one step. **Answer: leave it out.** A root that is
  linted invites a second scratch file. The `.gitignore` entry is the cheaper
  guard.

## Watch out for

- **`process.cwd()` is not the same as the script's own directory.** A caller who
  runs the tool from a subdirectory gets an empty list rather than a wrong one.
  The self-check in M1's verification catches that case too.
- **The 12 untouched files are not all gaps.** `game/sounds.ts` exports types
  only, so it can never execute. `game/elite-a/types.ts` is the same. Say so in
  the outcome, or the next reader files them as work.
