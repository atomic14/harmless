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

(recorded when the cycle closes)
