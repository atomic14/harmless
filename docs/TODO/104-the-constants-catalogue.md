# 104 — The constants catalogue, and a mechanical duplicate check

**Kind:** tooling/architecture · **Severity:** high (it gates every future
cycle's cost) · **Size:** medium
**Source:** third-party usage audit, 2026-08-09. Chris adopted its design.

## Where we are

CLAUDE.md required every agent to read all of `src/constants/` (~58 files,
~118KB) before starting — expensive, and it still relied on the agent's
memory to catch a semantic duplicate. The interim rule (searches + owning
file, recorded in the report) is in CLAUDE.md now; this item builds the
durable replacement.

## What to do

1. **A generated `src/constants/CATALOG.md`** — one row per exported
   constant: domain, symbol, literal/expression, first sentence of its doc
   comment, source `file:line`. Generated from the TypeScript AST and the
   existing comments; never hand-edited (the generator is the home). Wire it
   into the existing generate/check pattern (`npm run generate:*` /
   `npm run check` already exist — follow their shape) so a stale catalogue
   fails the build the way a stale elite-a catalogue does.
2. **`npm run constants:find -- "<query>"`** — searches names, doc
   comments, file purposes and values; the tool an agent runs with the
   proposed name, two synonyms, and the value before adding anything.
3. **`npm run constants:check`** — inspects the git diff: newly added
   exported constants; exact or normalised expressions already present
   elsewhere (fail); identical numeric/string values elsewhere (warn — 0, 1
   and common distances legitimately recur); constants added outside the
   likely owning domain; missing doc comment; stale catalogue.
4. **`@rule` identifiers for cross-cutting rules** — a doc-comment tag
   (`@rule combat.attackRun.breakRange`) with a test asserting each id has
   exactly one owner. Seed it on the handful of rules the repo has already
   burned on (the BRAIN_RATE_RAMP / RATE_RAMP pair CLAUDE.md warns about is
   the worked example: same value, two DIFFERENT rules, so two ids).
5. **Update CLAUDE.md's constants rule** to the catalogue-first wording it
   already anticipates, and drop the interim-search sentence.

## Watch out for

- The catalogue must come from source only — a hand-maintained row is a
  second home for the constant it describes.
- `test/constants.test.ts` already gates the directory; extend rather than
  duplicate it.
- Values that must never be fused despite being equal (RATE_RAMP pair) are
  the test of the design: the check must not flag them as duplicates once
  their `@rule` ids differ.

## Verification

- Catalogue regenerates byte-identically from a clean tree; a hand edit to
  it fails `npm run constants:check`; a deliberately duplicated expression
  fails; the RATE_RAMP pair passes. Break each gate once.
- `npm run build` green; the catalogue lands in the build's check path.

## Outcome

(recorded when the cycle closes)
