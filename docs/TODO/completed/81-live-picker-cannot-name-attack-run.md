# 81 — The live-brain picker is dead code

**Kind:** architecture / truth · **Severity:** low · **Size:** small

## Where we are

The career-wide live-brain picker was removed from the combat-trainer UI, but
its model remains exported from `game/brain-names.ts` and is exercised only by
tests: `SELECTIONS`, `LIVE_BRAIN_IDS`, `liveBrainSelection`, `liveBrainId` and
`selectionForBrain`.

That dead model is internally false. It offers `attack-run`, whose selection is
the same empty object as `AS_SHIPPED`; selecting it changes nothing and reads
back as “as shipped”. The old TODO described stale trained-policy copy which no
longer exists. The remaining defect is an unused API and tests that preserve it.

This is one concrete finding relevant to GitHub #7, not a claim that #7's broad
unused-export sweep is fully captured.

## What to do

- Delete the unused live-picker list and round-trip mapping.
- Delete or rewrite tests that exist only to preserve that removed UI.
- Keep the rules that still ship: `BrainSelection`, `SHIPPED_BRAINS`, pilot
  assignment, names/character text and the simulator's current pilot choices.
- Search for each removed export after the edit; no production replacement is
  needed unless a real caller exists.

## Watch out for

- `BrainSelection` is saved game state and still drives the scripted A/B.
- `SIM_BRAINS` and `PIRATE_CHOICES` are live trainer choices; they are not the
  deleted career-wide picker.
- Do not turn this bounded deletion into the repository-wide cleanup proposed
  by #7.

## Verification

- Targeted brain-name and co-pilot tests pass after deleting dead assertions.
- `rg` finds no remaining reference to the removed API.
- `npm run build` passes; no gameplay output should change.

## Outcome

**Landed on 2026-08-16, inside docs/TODO/165, on Chris's call.** The plan above
is restored exactly as it was written on 2026-08-09. It was deleted rather than
archived, so the number it is cited by named nothing for a week. 165 is the gate
that found that. Chris then chose to act on the plan rather than shelve it.

**Everything the plan reported was still true, seven days later.**
`LIVE_BRAIN_IDS`, `liveBrainSelection` and `liveBrainId` had no caller in `src/`
at all. Only tests kept them alive.

**Four members are gone**, and they are the plan's first bullet: `LiveBrainId`,
`LIVE_BRAIN_IDS`, `liveBrainSelection` and `liveBrainId`.

**`selectionForBrain` STAYS, and the plan is wrong to list it.**
`src/game/combat-sim.ts:923` calls it, so it is a live rule rather than dead
model. `SELECTIONS`, the table it reads, stays with it.

**One test PINNED the defect rather than caught it.**
`test/brain-names.test.ts` asserted that exactly one id failed to round-trip,
and named `attack-run` as that one. So the collision the plan is about had a
check holding it steady. That is what a deleted feature leaves behind, and it
is the clearest thing this item found.

**Six checks went, and one live rule survived them.** *Every selection the game
can be put in flies the policy the report names* is the rule the six sat on top
of. It builds its list from `selectionForBrain` now, in one place that two
blocks share, rather than from a picker that no longer exists.

**Four other test files named the deleted members**, and none of the four is
about the picker:

1. `test/ai.test.ts` used the list to enumerate the code pilots. It reads the
   `BRAINS` table now, which is what the list came off.
2. `test/scripted-co-pilot.test.ts` asked whether the picker offered
   `attack-run`. It asks whether a selection can name it.
3. `test/constants.test.ts` named `LIVE_BRAIN_IDS` in an exemption list.
4. `test/combat-sim-compare.test.ts` handed the combat-simulator screen
   `liveBrain` and `selectLiveBrain`. **Neither property is on that context
   type.** They are the removed UI's own two fields, and the test was the last
   thing carrying them.

**TWO SENTINELS AND THEIR TABLE ARE THE SAME DEFECT, AND THEY ARE REPORTED
RATHER THAN DELETED.** `AS_SHIPPED`, `AS_THE_GAME_FLIES` and `SENTINEL_NAMES`
are read by `brainName`'s fallback alone. Every live caller hands `brainName` a
`BrainId`, which is a `BrainName`, so that fallback answers nobody. The exercise
picker is a second surface and this item did not measure it. The house rule is
`tools/internal-claims.mjs`'s own: report a member with no caller, and do not
delete it in the same pass.

**`npm run check` passes at 4,715 assertions, down 6.** Five picker checks went
from one block and two came back in their place. One more went from inside a
loop of three deleted flags, which is the other three. No game rule moved.
