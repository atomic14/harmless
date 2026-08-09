# 102 — Two things still try to load the retired brains, and one is a live page

> Completed plan. Archived from the active queue.

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

**Further leftovers found during the fix (Claude, 2026-08-09) — listed, not
fixed, per the rule above. None crashes a live page; all are tools whose
defaults still name the deleted brains:**

- `train/evaluate.ts:41-43` — `SHIPPED_PIRATE`/`SHIPPED_PACK`/
  `SHIPPED_DEFEND` name the three deleted weight files. `tryLoad` skips a
  missing file, so the tool runs, but its own framing ("the tool scores the
  shipped three") is stale: with the bundle empty it scores nothing trained
  by default.
- `train/defence-probe.ts:214` — the no-argument default probes
  `jameson-defend-g2`, which is deleted; the try/catch prints "could not be
  probed" and the run produces an empty table.
- `train/jameson-autopilot.js` — a console script whose stated job is flying
  the retired `jameson-defend` policy on the player's ship; nothing loadable
  backs it.
- `test/playtest.js:6` — the header still says combat is "flown by the
  trained defence policy"; `policyKit().defendBrain` is null now.

## Decisions taken in implementation (Claude, 2026-08-09)

- **The Episode can stage `pursuit` now.** "Rows fly the code pilots" above
  requires the viewer to show `pursuit` — the fight every player actually
  meets — and the training `Episode` could not express it (the fact TODO 98
  recorded). Rather than a second implementation in the viewer, the pursuit
  pirate's whole frame (hold-six/slash switch included) moved into the public
  `NpcShip.pursuitFly()`, called by `update()` and by a new
  `{ kind: 'pursuit' }` pirate controller — one home, two callers. The
  human-shape gate still flies `update()` (its header says why that remains
  the right fixture), and `train/survivability.ts` deliberately keeps its
  scripted attackers so its recorded rows stay comparable.
- **The defence's flights stay un-stageable in an episode**, honestly: the
  armed trader's defensive run and the co-pilot live behind `NpcShip.update`
  / `scripted-co-pilot.ts`, which the episode's `PlayerShip` target cannot
  drive. The viewer's header states the proxy instead — the trader's half IS
  the attack run the `scripted` rows fly; the co-pilot's half IS the pursuit
  the shipped rows fly.
- **The `evades` row is a research hook, not a default** — `DEFEND_BRAIN`
  (survivability's existing convention) names a candidate; with nothing named
  the table prints the retirement note where the row would be.
- **What the smoke gate covers, exactly:** every live page's entry module
  touches the DOM at import (both viewer pages call `createStage()`,
  `src/main.ts` builds a browser shell, `manual.ts` and
  `encyclopaedia/main.ts` write into the document), so entry modules cannot
  be imported under node without a DOM/WebGL fake this repo deliberately does
  not carry. The gate is instead: the viewer's stale-able content (the row
  table) is DOM-free in `viewer/scenarios.ts`, and
  `test/viewer-scenarios.test.ts` builds and flies every row headless and
  bans the viewer from importing `game/brains.ts` or weights. The play
  page's decision content already runs headless under the portability gate,
  and the encyclopaedia's entries are all rendered at build time by
  vite.config.ts. The thin DOM shells remain covered only by the flown
  browser check (docs/PROCESS.md).

## Verification

- `/viewer` renders and replays a matchup in a real browser (Claude flies
  the check per docs/PROCESS.md).
- The ram-probe runs (or its retired row says why not).
- The new smoke gate goes red when an entry module throws — break it once.
- `npm run build` green.

## Outcome

**Shipped 2026-08-09.** Both defects confirmed by running them before
fixing (the viewer threw at module scope on import; the ram-probe died on
`ENOENT attack-run.json` — a file that never existed, even before the
retirement). The viewer now shows what ships: rows built DOM-free in
`viewer/scenarios.ts`, the shipped `pursuit` pirate staged through the new
`{ kind: 'pursuit' }` Episode controller calling the same
`NpcShip.pursuitFly()` that `update()` calls — one home, two callers. The
`evades` probe row is a research hook behind `DEFEND_BRAIN`, retirement
note printed in its place. Gates: `test/viewer-scenarios.test.ts` flies
every row headless and bans brains imports; `test/probe-rows.test.ts` pins
both sides of the hook; each broken once and red.

Equivalence of the `npc.ts` extraction proven two ways: branch-for-branch
diff review, and the human-shape gate's printed rows identical to 98's
recorded baseline to every digit. Supervisor flew `/viewer` in Chrome:
loads clean (zero console errors), renders and replays the pursuit
matchup; the sim runs slowly only in background-throttled automated tabs.
Build 3278/0, elite-a 494/0, campaign green.

Four further leftovers found and listed under "Watch out for" above, now
queued as [103](103-the-train-tools-still-name-the-retired-brains.md).
