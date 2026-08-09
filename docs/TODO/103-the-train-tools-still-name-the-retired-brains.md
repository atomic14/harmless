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

## Verification

- Each tool's no-argument run works or states the retirement; no claim
  contradicts `brain-names.ts`.
- `npm run build` green.

## Outcome

(recorded when the cycle closes)
