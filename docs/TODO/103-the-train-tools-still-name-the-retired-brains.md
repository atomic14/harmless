# 103 — The train tools still name the retired brains

**Kind:** tooling/truth · **Severity:** low · **Size:** small
**Found during** 102 (2026-08-09); the four sites are listed with detail in
[102's "Watch out for"](102-two-things-still-load-the-retired-brains.md).
None crashes a live page; all are research tools whose defaults or framing
still name the brains deleted on 2026-08-05.

## What to do

Work through 102's list — `train/evaluate.ts` (scores nothing trained by
default while claiming to score "the shipped three"), `train/defence-probe.ts`
(no-arg default probes a deleted brain, prints an empty table),
`train/jameson-autopilot.js` (whole script flies a retired policy),
`test/playtest.js:6` (header claims trained-policy combat) — and for each:
make the no-argument run either work honestly or say plainly why not, in the
pattern 99 and 102 set. Retiring a tool outright is a fine answer if nothing
loadable backs it; record what went and why.

## Cycle manifest

```json cycle-manifest
{
  "version": 1,
  "todo": 103,
  "declaredTier": "tooling",
  "milestones": [
    {
      "id": "truth",
      "title": "Every train tool's no-argument run works honestly or states the retirement",
      "acceptance": [
        "train/evaluate.ts no-arg run states plainly that nothing trained loads (or is retired outright with the reason recorded)",
        "train/defence-probe.ts no-arg run prints a useful table or the retirement note, never an empty table",
        "train/jameson-autopilot.js is retired or its header says nothing loadable backs it",
        "test/playtest.js's header no longer claims trained-policy combat",
        "no claim in any touched file contradicts src/game/brain-names.ts"
      ],
      "scope": ["train/", "test/playtest.js"],
      "tests": []
    }
  ]
}
```

## Verification

- Each tool's no-argument run works or states the retirement; no claim
  contradicts `brain-names.ts`.
- `npm run build` green.

## Found during the fix (2026-08-09)

- `train/evaluate.ts`'s no-arg run did not merely mislead — it CRASHED:
  the tail called `printPlayerHullSweep('pirate-attack-g3')`, and
  `profile-sweep.ts`'s `load()` has no catch, so the run died on ENOENT
  after printing the tournament. The hull sweep now runs only per loadable
  `pirate-attack` candidate.
- Nothing was retired. `train/jameson-autopilot.js` was kept (not deleted)
  because `docs/JAMESON-TRIALS.md` references it and sits outside this
  milestone's allowed paths; its header now states nothing loadable backs
  it. Both console harnesses (`jameson-autopilot.js`, `test/playtest.js`)
  would have thrown on their first combat hand-off — `kit.act(null, …)`
  reads `brain.weights` — so their combat entries now gate on
  `kit.defendBrain` and the scripts genuinely fly unarmed, as their
  headers now say.

## Outcome

(recorded when the cycle closes)
