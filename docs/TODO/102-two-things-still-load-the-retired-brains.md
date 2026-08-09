# 102 — Two things still try to load the retired brains, and one is a live page

**Kind:** bug · **Severity:** high (the viewer is a linked page) · **Size:** small
**Found during** 100's call-chain tracing (2026-08-09). Not yet investigated
beyond the two sites below — verify before fixing, per CLAUDE.md.

## Where we are

The 2026-08-05 brain retirement left two callers loading what no longer
exists:

1. **`src/viewer/main.ts:48-57`** calls `shipped()` at module scope, which
   throws when `defenceBrain()` is null — which is always, today. If
   confirmed, the `/viewer` page (linked from the README and the docs) has
   been broken since the retirement, and nothing went red: no test loads
   the viewer entry.
2. **`train/ram-probe.ts:82-89`** — `defencePilot()` would try to load
   `attack-run.json`, which does not exist; the probe's `evades` row would
   crash if exercised.

## What to do

- Confirm both by running them (open `/viewer` headless or via the dev
  server; run the ram-probe row). Say what actually happens.
- Fix the viewer so the page works with no trained brains: rows fly the
  code pilots (`pursuit`, `attack-run`, `scripted`) — which is what the
  README says the viewer shows today.
- Fix or honestly retire the ram-probe `evades` row (TODO 66 built the
  probe; keep its three-behaviour table truthful).
- Add the missing gate: something must go red the next time a live page's
  entry module throws at import. A smoke test that imports each entry
  point headless may be enough — say what is feasible.

## Watch out for

- The viewer's fix must not resurrect trained-brain loading; `brains.ts`
  stays an empty socket (test asserts it).
- This is the second retirement leftover found by accident (99 was the
  first). If the fix reveals a third caller, list it here rather than
  fixing it quietly.

## Verification

- `/viewer` renders and replays a matchup in a real browser (Claude flies
  the check per docs/PROCESS.md).
- The ram-probe runs (or its retired row says why not).
- The new smoke gate goes red when an entry module throws — break it once.
- `npm run build` green.

## Outcome

(recorded when the cycle closes)
