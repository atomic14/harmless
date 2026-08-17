# 180 — Thirteen game rules have no name

**Kind:** architecture · **Severity:** medium · **Size:** medium · **Depends
on:** nothing · **Blocks:** nothing · **GitHub:** none

## Where we are

Chris read docs/TODO/179's outcome on 2026-08-17 and asked one question: these
magic values should be using constants?

**Yes, for one of three kinds.** A measurement decided the scope, and he chose
it.

### What is actually there, measured

`src/` holds 769 non-trivial bare numeric literals outside `src/constants/`,
across 68 files. **Almost none of them should move**, and lumping them together
is how a tidy-up makes a codebase worse.

| kind | count | verdict |
| --- | --- | --- |
| a comparison threshold, such as `if (d < 7000)` | 24 | 13 are game rules |
| a tuning coefficient inside one formula | about 200 | stays |
| a data table or a cosmetic number | about 400 | stays |

**A tuning coefficient stays because naming it lies.** `game/threat.ts` fits one
curve out of `0.05`, `0.7`, `1.5` and ten more. A name like
`THREAT_CONTRABAND_WEIGHT` reads as a rule a shipyard could argue with, and it
is one shape fitted as a whole. `test/constants.test.ts` already states that
exclusion: values whose only meaning is local to one function are out of scope.

**A data table stays because it is data.** `game/ship-specs.ts` holds 121 of the
769, and it is the ship roster. `audio.ts` holds 129, and they are synthesiser
frequencies.

### The thirteen, and what each one decides

| site | value | the rule it holds |
| --- | --- | --- |
| `game/npc.ts:730` | 7,000 | how far an NPC chases another NPC |
| `game/npc.ts:747` | 6,000 | a fleeing armed trader turns on the commander |
| `game/npc.ts:762` | 6,000 | the same rule, on the trained defence branch |
| `game/npc.ts:819` | 200 | an ambling ship reached its waypoint |
| `game/trader-flight.ts:110` | 900 | an arriving trader starts trading |
| `game/trader-flight.ts:174` | 2,500 | a departing trader jumps out |
| `game/world-step.ts:772` | 900 | leave the hermit's door to reset the hail |
| `game/world-step.ts:773` | 900 | the same door, from inside |
| `game/world-step.ts:776` | 320 | close enough to trade with the hermit |
| `game/world-step.ts:776` | 40 | slow enough to trade with the hermit |
| `game/world-step.ts:790` | 6,000 | the generation ship is close enough to see |
| `hud/hud-model.ts:99` | 4,500 | a ship is near enough to mark |
| `hud/hud-model.ts:153` | 3,000 | the station is near enough for the dock aid |

**TWO VALUES MEAN TWO THINGS EACH.** 6,000 is both the turn-and-fight range and
the generation ship's sighting range. 900 is both a trader's arrival and the
hermit's door. Each pair needs a distinct `@rule` id, and `constants:check`
fails until it has one.

### None of the thirteen already has a home

`npm run constants:find` was run for each, as `CLAUDE.md` requires.
**`GENERATION_SHIP_RANGE` is 14,000 and `HERMIT_SCATTER` is 14,000, and neither
is one of these.** Both are spawn PLACEMENT: where the ship is put. The two
sites above are how close the commander must get.

### The existing programme cannot see any of this

`test/constants.test.ts` and docs/TODO/90 scan for a `const UPPER_CASE`
DECLARATION outside `src/constants/`. The file says so, and it names the
narrowing on purpose. **A bare literal in an expression has no declaration**, so
it is invisible to the gate that exists for exactly this failure.

### One finding the measurement exposed

`game/world-step.ts:774` says `ROCK HERMIT — SLOW TO 20 AND CLOSE TO TRADE`, and
line 776 tests `player.speed < 40`. **The string and the rule disagree.**

**A player can check neither.** `hud.ts` paints speed as a bar, at
`speedFrac * 100%`, and no numeric speed reaches the screen anywhere.

## What to do

Two milestones. M1 names the rules. M2 stops the class growing back.

### M1 — thirteen constants, and one string that agrees with its rule

Each constant carries the rationale beside it, which is `CLAUDE.md`'s rule.
**Run `npm run constants:find` before each name**, and query the name, two
synonyms and the value.

**The two collisions take `@rule` ids.** `constants:check` refuses an
unexplained repeat, and that refusal is the feature.

**`npm run generate:constants` runs before the gates**, because a doc comment in
`src/constants/` is `CATALOG.md`'s `Purpose` column.

**The hermit's line interpolates its own rule.** `SLOW TO ${...}` rather than a
number typed beside a different number. That is a player-facing string, so the
outcome records what it now says.

### M2 — a gate on a bare threshold, with an allowlist

Scan `src/` for a comparison against a bare number of 50 or more. **Eleven of
the 24 are not game rules.** Each one is named on an allowlist with its reason.
That is the shape `test/constants.test.ts`, `tools/sizes.mjs` and
`test/ai.test.ts` all use, and the allowlist is the review surface.

The eleven are a training internal, and the 1984 galaxy's own 256 and 127. They
are also two ring buffer caps, a loop bound, minutes in an hour, and an index
bound.

**The allowlist guards itself in both directions.** An entry naming a site that
no longer holds a bare threshold fails, so the list cannot become a place to
hide. docs/TODO/165 is the precedent.

## Decisions already made

- **Chris chose the scope on 2026-08-17**: the thirteen rule thresholds, plus a
  gate. He was offered the thirteen with no gate, and all 305 literals in
  `src/game/`, and declined both.
- **A tuning coefficient and a data table stay.** The measurement above is the
  argument.
- **The value of every one of the thirteen is unchanged.** This item names
  numbers. It does not tune them.

## Open questions

None that block. The hermit's line is a player-facing string, and the outcome
reports the words rather than deciding them alone.

## Watch out for

- **`constants:check`'s owner heuristic decides the home**, and it fails on a
  file it thinks is wrong. Argue the right one first, and use `@domain` only
  when the heuristic names the wrong home.
- **`src/constants/` imports nothing outside itself.** It is a leaf, and
  `test/constants.test.ts` holds that.
- **The gate's floor of 50 is a choice, not a truth.** State it in the tool.
  Then say what it lets through. A threshold below 50 is usually a count, an
  index or an angle.
- **`npm run campaign` and the probes must not move.** No value changes, so any
  movement is a mistake rather than a result.
- **Two sites share one rule.** `npc.ts:747` and `npc.ts:762` are the same
  turn-and-fight range on two branches. One constant, two uses.

## Verification

The gates always run: `npm run check`, with `npm run generate:constants` before
them.

**The tier table puts this at "a rule that changes how a fight goes"**, because
`npc.ts`'s two ranges decide who shoots. **No value moves**, so the evidence is
that nothing moved:

- `npm run survivability`, `aim-probe` and `gap-probe` byte-identical;
- `npm run campaign` byte-identical at two sizes;
- the assertion count unchanged, except where M2 adds its own.

Take the baseline before M1.

**M2's gate must be proved able to fail**, and each way alone:

1. a new bare threshold in a rule file reddens it;
2. an allowlist entry whose site no longer holds one reddens it;
3. the scan pointed at a directory with no thresholds leaves the rule green and
   reddens its control.

## Outcome

### M1 — thirteen constants, and a hermit line that agrees with its rule

Thirteen rules have names. **No value moved**, and the evidence is that nothing
moved: `survivability`, `aim-probe` and `gap-probe` are byte-identical, and
`npm run campaign` is byte-identical at both sizes.

**THE PLAN'S ARITHMETIC WAS OFF BY ONE.** It said eleven of the 24 are not game
rules. Twelve are. The thirteenth constant is `HERMIT_DOCK_SPEED = 40`, and the
scan's floor of 50 never counted it. It was found by reading the site, not by
the scan.

**THE CHECKER ASKED FOR SEVENTEEN MORE `@rule` IDS.** Every one of the thirteen
collided with a value already in the tree, and `constants:check` refuses an
unexplained repeat. `SCANNER_RANGE`, `PIRATE_HUNT_RANGE`, `HUNTER_RANGE`,
`ASSIST_FADE_START`, `DOCKED_BACKDROP_DISTANCE`, `STATION_TRUCE`,
`MASS_LOCK_SHIP` and nine more gained one. The tree went 87 rule ids to 114.
docs/TODO/160 and docs/TODO/173 both record the same situation.

**Two constants had no doc comment at all**, and the checker will not take an id
without one. `ASSIST_FADE_START` and `DISREPUTE_MURDER` have one now.

**A NAME WAS WRONG AND READING THE CODE FIXED IT.** The 4,500 was called
`MARKER_RANGE` in the plan. Its site is `shipIdUnderView`, which writes the
console's ship-ID line, and `TARGET_BRACKET_RANGE` at 5,000 already owns the
bracket. It is `SHIP_ID_RANGE`, and its doc comment now states the three HUD
ranges that sit within 1,500 of each other.

**`npm run constants:find` did not surface `TARGET_BRACKET_RANGE`**, because the
query was poor. The site did. Read the function before naming its number.

**The hermit's line interpolates its rule**, and reads
`ROCK HERMIT — SLOW TO 40 AND CLOSE TO TRADE`. It said 20 beside a rule of 40.

### M2 — a gate on a bare threshold

`test/bare-thresholds.test.ts` is 4 assertions. The scan reads 12 thresholds and
every one is on the allowlist with the kind of number it is.

**THE FIRST DRAFT WENT GREEN BY READING NOTHING, AND THE CONTROL CAUGHT IT.** It
stripped comments and strings with four regular expressions. A TRAILING comment
holding one backtick survived the line-comment pass. It then unbalanced the
template-literal pass, which swallowed the rest of `galaxy/galaxy.ts`. That
included the `i < 256` the gate exists to see. It walks characters now, which is
`tools/ste-read.mjs`'s own reason.

**The control is what reported it.** Claim 4 names a threshold the scan must
find, so a reader that reads nothing cannot pass.

**Proved able to fail three ways, and each one alone.** A new bare threshold in
`npc.ts` reddens claim 1. A stale allowlist entry reddens claim 2. The scan
pointed at `src/constants/` reddens claims 2, 3 and 4 together, which is the
vacuous-reader case.

4,845 assertions became 4,849.
