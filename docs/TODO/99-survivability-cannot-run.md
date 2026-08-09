# 99 — `npm run survivability` cannot run, and its header says a stale thing

**Kind:** tooling/truth · **Severity:** medium · **Size:** small
**Found during** 98's reconnaissance (2026-08-08).

## Where we are

Two defects in `train/survivability.ts`, both dating from the 2026-08-05
retirement of the trained line:

1. **It cannot run.** The defender defaults to loading `jameson-defend-g2`
   weights (`DEFEND_BRAIN`, `train/survivability.ts:72-75`) from
   `src/ai-training/brains/`, which ships empty. The README still offers
   `npm run survivability` as "the bot answer to 'can I survive a gang?'" —
   an offer that currently throws.
2. **Its header says the wrong thing.** `:67-70` claims the scripted attack
   run is "what a player meets"; since the `pursuit` pilot shipped, what a
   player meets is `pursuit`, and the scripted run is the A/B control
   (CLAUDE.md and `brain-names.ts` are the rule's homes).

## What to do

- Make the tool run again with no arguments: the defender should default to
  something that exists — the scripted co-pilot (the defence the game
  actually sells) is the honest default; `DEFEND_BRAIN` stays as the
  override for research candidates.
- Fix the header's claim: the attackers fly the training world's scripted
  run because `Episode` cannot fly `pursuit` (see 98's plan doc) — say
  that, and say what the tool is therefore evidence of and what it is not.
- If 98 has landed first, cite its fixture as the measurement of what
  actually ships, and this tool as the gang-survival floor it always was.

## Decisions already made

- (2026-08-09, settled with the supervising session during implementation)
  Defaulting the defender to the scripted co-pilot proved inexpressible
  without src/ changes: `Episode`'s trader controllers are
  `policy | scripted | runner | holding | weaving`
  (`src/ai-training/scenario.ts:118-153`), and both shipped defence paths —
  the combat computer's co-pilot and the armed trader's defensive attack
  run — live behind update paths the `Episode` does not drive, the same
  limitation as `pursuit` on the pirate side. So the no-argument default is
  the training world's scripted ARMED TRADER in the commander's hull, and
  the header says what that makes the tool: a gang-survival floor in the
  training world, both sides stand-ins — not the shipped fight. Do not
  reopen by extending `Episode`; the rule below stands.

## Watch out for

- Do not "fix" this by making `Episode` fly `pursuit` — that is a real
  design change and belongs to its own item if ever wanted.
- The tool's numbers are floors, not feel (its own header says so — keep
  that part).

## Verification

- `npm run survivability` with no env vars completes and prints its table.
- The header contains no claim `brain-names.ts` contradicts.
- `npm run build` green.

## Outcome

(recorded when the cycle closes)
