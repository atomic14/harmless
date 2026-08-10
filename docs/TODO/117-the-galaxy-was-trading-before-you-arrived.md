# 117 — The galaxy was trading before you arrived

**Kind:** feature / simulation · **Severity:** medium · **Size:** medium
**Depends on:** 114/115 landed the overlays that make this visible. Best done
after 116, which is the live bug.
**GitHub:** none — asked for by Chris in session, 2026-08-10: "just because our
commander is new doesn't mean the universe did not exist".

## Why

A new commander opens the galactic chart and sees nothing moving. Not because
the overlay is broken — because it is telling the truth: `LivingGalaxy.day` is
0, `convoys` is empty, no system has drifted a credit, and the 256 worlds that
are supposed to have been trading for centuries have in fact been trading for
no time at all. The simulation starts when the player does.

Measured across 8 seeds on galaxy 1, warming the galaxy by N days before the
commander's first launch:

| days | lanes drawn | red rings | Lave danger | Lave max price drift | `save()` size |
|---|---|---|---|---|---|
| **0** (today) | 0 | 0 | 0.000 | 0% | ~0 kB |
| 15 | 39 | 1.6 | 0.033 (max 0.11) | 9.3% | 59 kB |
| **30** | 38 | 3.6 | 0.022 (max 0.11) | 9.0% | 73 kB |
| 60 | 35 | 9.1 | 0.074 (**max 0.37**) | 11.2% | 74 kB |
| 120 | 38 | 13.0 | 0.018 (max 0.12) | 8.8% | 74 kB |
| 365 | 38 | 15.6 | 0.025 (max 0.18) | 8.7% | 74 kB |

The network is fully formed by ~30 days and does not grow after it; what keeps
growing is accumulated danger. That is the shape of the decision.

## Decisions already made

- Chris: pre-fill the simulation, so a new commander inherits a galaxy with a
  history.

## Open questions — answered here

- **How many days? THIRTY.** Enough for the whole trade network (38 lanes) and
  three or four hotspots to notice, with Lave itself never near the ring
  threshold (max 0.11 against 0.4 across eight seeds). Sixty puts one seed's
  Lave at 0.37 — a starting world flagged as pirate-infested on a fresh save is
  a bad first impression and the reason not to go further. Beyond 30 the only
  thing that changes is more danger, so it buys nothing the player can use.
- **Which RNG stream?** A DERIVED one (`makeRng`), never the world stream.
  Determinism per seed is required (invariant 11), but consuming the world
  stream at boot would shift every draw after it and move the seeded pins in
  `test/game.test.ts` for no benefit. The warm-up's seed is derived from the
  world seed so one seed still means one starting galaxy.
- **Where does it run?** At the point a CAREER begins with no saved
  `galaxyState` — not inside `freshState()`. `freshState` is what every test
  and the campaign harness build, and warming it silently would change dozens
  of fixtures that have nothing to do with this. An explicit `prewarm(living,
  systems, seed)` called by the Game's new-career path (and by
  `test/campaign.ts`, deliberately) keeps the act visible.
- **Does it need saving?** It saves itself: the warmed deltas go into
  `commander.galaxyState` at the first checkpoint like any other drift, so a
  reload resumes the same galaxy rather than re-warming to a different one.
  Warming must therefore happen ONLY when there is no state to load — the three
  construction sites are `state.ts:169` (fresh), `persistence.ts:188` (restore,
  never) and `game.ts:957` (boot-with-commander, which then `load()`s).

## What to do

1. **`PREWARM_DAYS = 30` in `constants/living-galaxy.ts`**, beside the decay
   rates and the two overlay thresholds, with the table above as its rationale.
   Constants process applies (`constants:find`, `generate:constants`,
   `constants:check`; a shared value needs `@rule` ids on both sides).
2. **A `prewarm` seam.** One small exported function beside `LivingGalaxy` (or
   in `galaxy/living.ts` itself) that advances a fresh galaxy by
   `PREWARM_DAYS` on a derived stream. It must be the only place the number is
   spent, so the Game and the campaign cannot disagree about what "a new
   galaxy" means.
3. **Call it where a career starts** and nowhere else, per the seam above.
4. **Fix the galactic jump while pre-warming makes it matter.**
   `galacticJump` (`game.ts:1308-1321`) replaces `state.systems` with the new
   galaxy's but keeps the SAME `LivingGalaxy` — so galaxy 2's system 7
   inherits galaxy 1's Lave danger, price pressure and in-flight convoys, and
   every convoy in the list now points at systems that are not the ones it
   departed. Today that is a quiet wrong; after pre-warming it is a loud one,
   because the deltas are substantial from the first minute. Rebuild and warm
   the living galaxy on a galactic jump, on a stream derived from the new
   galaxy's number so the eighth galaxy is not the first one again.
5. **Update the save-size reasoning.** `MAX_NAMED_SAVES`'s doc argues from "a
   snapshot is ~10 kB against megabytes of localStorage". A warmed galaxy makes
   it ~85 kB, so 20 named saves plus the flight ring is ~2 MB of a typical 5 MB
   budget. Re-state the rationale with the real number, and say whether 20 is
   still the right cap. Do NOT round the pressures to shrink it: `save()`
   explains that rounding quantises the simulation so a reload lands on a
   nearby galaxy rather than the same one.
6. **Tests.**
   - A new career's galaxy has a trade network and a history: lanes drawn > 20,
     at least one system over `DANGER_VISIBLE`, and prices drifted at more than
     half the systems. At two seeds, per the house sampling rule.
   - **Lave is still safe to start in**: `danger(7)` under `DANGER_VISIBLE`
     across several seeds — the check that fails if `PREWARM_DAYS` is raised
     too far, which is the actual risk this number carries.
   - **Deterministic**: the same world seed gives the same warmed galaxy, twice.
   - **The world stream is untouched** — a control that fails if the warm-up is
     moved onto `random()`: a seeded Game's first N draws are identical with
     and without the warm-up.
   - A restored save is NOT re-warmed (its day is the saved day, not 30 more).
   - A galactic jump lands in a galaxy whose deltas are its own: the new
     galaxy's convoys all name systems in it, and its day starts at the warm-up
     rather than carrying the old one.

## What is NOT in scope

- Any change to `advance()` itself. This spends the existing simulation, it
  does not alter it.
- The overlays. They will simply have something to draw.
- Warming galaxies the player has not visited.

## Watch out for

- **THIS IS A SIMULATION CHANGE — the first in this run of work.** Starting
  conditions move for every career, so `npm run campaign` MUST be re-run and
  the trader, privateer and bounty-hunter medians compared before and after,
  at two sample sizes. A pre-warmed galaxy means prices are already off
  baseline on leg one and pirate hotspots exist before the player has flown
  anywhere: the economy items measured against the campaign (110, 112, 113)
  are all quoted against a cold galaxy, so their numbers move under this.
  If the medians shift more than a few percent, say so and decide whether 30
  days is still right — do not quietly rebaseline.
- **Save size, on every autosave.** The flight ring writes three of these a
  minute. Check the store does not start refusing writes on a long career.
- **`test/campaign.ts` builds its own `LivingGalaxy`** (`campaign.ts:163`) and
  must be updated deliberately, or the harness measures a colder galaxy than
  the game ships.
- **Determinism gates** (`test/galaxy.test.ts:106-110`,
  `test/game.test.ts:130-148`) pin seeded runs. The derived stream is what
  keeps them still true; if they move, the warm-up is on the wrong stream.

## Acceptance

- A brand-new commander opens the galactic chart, presses `T`, and sees a trade
  network and a few hotspots — the galaxy has a past.
- Lave is safe to start in, on every seed tested.
- The same seed gives the same starting galaxy; a reload does not re-warm.
- A galactic jump arrives in a galaxy whose own economy is running.
- `npm run campaign` re-run and its numbers reported against the cold-galaxy
  baseline, at two sample sizes.
- Full gates: `npm test`, `npm run lint`, `npm run constants:check`.

## Verify

Measured 2026-08-10 with a scratch harness: the table above, 8 seeds
(`makeRng(1..8)`) on galaxy 1, lanes via `busyLanes`, rings via `danger() >
0.4`, size via `JSON.stringify(living.save()).length`. Read: the three
`new LivingGalaxy` sites (`state.ts:169`, `persistence.ts:188`,
`game.ts:957`), `galacticJump` keeping the old living galaxy
(`game.ts:1308-1321`), `makeRng` as an independent stream (`rng.ts:56`), and
`save()`'s note on why pressures are not rounded.
