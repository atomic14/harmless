# CLAUDE.md — working on HARMLESS

HARMLESS is an unofficial, non-commercial browser tribute to Elite (1984),
built with TypeScript, Vite and three.js. Preserve that framing and the
MIT/fan-project notice.

## Sources of truth

- Running code wins when documentation disagrees.
- `docs/INVARIANTS.md` lists rules that must not break. Its numbers are cited by
  the code: never renumber them; append new ones.
- `docs/ARCHITECTURE.md` maps the system; `docs/TODO/README.md` indexes active
  plans. Open `completed/`, `research/` or `retired/` only for a specific
  historical decision. `docs/PROCESS.md` defines delivery.

## Working rules

- Diagnose from the code that runs before editing. Fix the cause, not a plausible
  symptom.
- Correctness beats speed, but context is finite. Read the affected files, use
  targeted tests while working, run the full gates once at the end, and hand off
  at a clear checkpoint.
- Report only what you measured or ran. State failures and uncertainty plainly.
- Give every rule one home. Delete duplicates instead of keeping copies in sync.
- Before adding or changing a constant, use `src/constants/CATALOG.md` as the
  index: run
  `npm run constants:find -- "<query>"` for its proposed name, at least two
  conceptual synonyms, and its value instead of loading the whole directory.
  Read the likely owner and matches; document the rule, add distinct `@rule`
  IDs when equal values must stay independent. After adding, changing, or
  removing constants, run `npm run generate:constants`, then
  `npm run constants:check`.
- Put a constant's rationale beside it. Record meaningful alternatives where the
  next maintainer will look.

## Design direction

One world state; a fixed, seeded step advances it; rendering only reads it.

- Training uses the real game rules, never copied physics or combat logic.
- Modules decide and return events; orchestrators apply consequences.
- Behaviour-changing data is saved state, not an ambient global.
- Platform access stays behind `engine/shell.ts` so the game runs headlessly.
- `game/brain-names.ts` owns pilot assignments. Shipped pilots are currently
  hand-written; no trained weights are loaded.

## Validation

- New behaviour needs a test; rule changes update the test that pins the rule.
- Prove a new gate can fail by temporarily breaking the protected rule.
- Assert behaviour, not an implementation against itself.
- Before a sampled number drives a decision, check at two sample sizes.
- Keep lint and tests in the build path.

## Style

- Prefer small, single-purpose files. Exceed the size ceiling only with a stated
  reason; never delete useful content merely to fit it.
- Maintain module headers that state each file's purpose.
- Commit by milestone, explaining what changed and why.
