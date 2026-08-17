# 174 — The record holds five defects that nothing schedules

**Kind:** defect · **Severity:** low · **Size:** small · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** none

## Where we are

Five landed items each reported a defect and each declined to fix it. Every one
of the five was the right call at the time. A milestone that widens its own
scope stops being reviewable. `tools/internal-claims.mjs` states the rule for
one of them. It reads: report a member with no caller, and do not delete it in
the same pass.

**Nothing schedules the second pass.** So the five sat in the index. Chris asked
for them on 2026-08-17.

**All five were verified against the tree that day.** Each line below is a read
of the code that runs, and not a copy of the record.

### 1. The novella says `name` and means the ladder

`novella.html:313` says *"attempts on your name"*. It means the disrepute
ladder, which docs/TODO/162 renamed to reputation for the player. docs/TODO/171
scoped its prose rule to the word `reputation`, so **no rule reads `name` on a
page at all**.

### 2. `HERMIT_SCATTER`'s comment states the wrong multiple

`src/constants/spawn-placement.ts:84` says the hermit sits at *"2.5x the
asteroid field's nominal radius"*. `ASTEROID_SCATTER` is 5,000 and
`HERMIT_SCATTER` is 14,000. That is 2.8. docs/TODO/170 found it and moved
neither number.

### 3. A second element still carries GitHub #29's defect

`src/style.css:630` reads `#screen .hints span { white-space: nowrap; }`.
docs/TODO/157 fixed exactly this on `#message`, where a line wider than the
window hung off both edges. docs/TODO/162 found the second element and left it.

**This one needs a measurement before it needs a fix.** A hint is short, and the
element is inside a screen rather than centred on `left: 50%`. The defect is not
proved until a hint is shown to overflow a window a player would use.

### 4. `approach` is exported and nothing outside reads it

`src/game/npc.ts:1533` exports `approach`. A tree-wide search finds no reader
outside that file. `test/prompts.test.ts:228` uses the same word for a local
helper of its own, which is what makes a careless search say otherwise.

### 5. Three members answer a picker that was deleted

`src/game/brain-names.ts` holds `AS_SHIPPED` (line 42), `AS_THE_GAME_FLIES`
(line 43) and `SENTINEL_NAMES` (line 100). `brainName`'s fallback at line 111 is
the only reader. docs/TODO/81 deleted the live-brain picker and reported these
three rather than deleting them.

**The claim to check is that no live caller reaches that fallback.**
docs/TODO/81 stated it and did not measure it. Two tests name the members:
`test/brain-names.test.ts:118` in a comment, and `test/constants.test.ts:269` in
an allowlist.

## What to do

Three milestones. The order puts the two that need no judgement first.

### M1 — the two wrong words

Fix the novella line and the `HERMIT_SCATTER` comment.

**The novella keeps Chris's voice.** It is a player-facing page, and `CLAUDE.md`
excludes those from the house prose style. This changes one word for
correctness, and nothing else on the page.

**The comment takes the measured multiple.** Write 2.8, and state the two
constants it comes from. Neither number moves: docs/TODO/170 decided that.

Run `npm run generate:constants` before the gates, because a doc comment in
`src/constants/` is the catalogue's `Purpose` column.

### M2 — the two members with no reader

Drop the `export` from `approach`. Delete the three members in
`brain-names.ts`, and take their two test references with them.

**MEASURE THE FALLBACK FIRST, and stop if it is reachable.** Ask which values
every live caller of `brainName` can pass. If any of them can be a sentinel, the
members are live and this milestone reports that instead. docs/TODO/81's claim
has no measurement behind it.

**`test/constants.test.ts:269`'s allowlist is the tell.** A deleted export that
stays on an allowlist is the same defect as a stale claim. Take the names out.

### M3 — the hint that may not overflow

Measure `#screen .hints span` in a browser, on the narrowest window a player is
likely to use. Read the element's width against its container's.

**Fix it only if it overflows.** docs/TODO/157's own record says the words were
not touched and the rule was written to the measurement. A `nowrap` that never
overflows is a rule doing no harm, and to change it on a resemblance is to fix a
symptom.

**Report the measurement either way.** A defect that turns out not to exist is
worth writing down once, so nobody schedules it a third time.

## Decisions already made

- **Chris asked for all five on 2026-08-17.** Each was reported by a landed item
  and declined at the time.
- **`HERMIT_SCATTER` and `ASTEROID_SCATTER` do not move.** docs/TODO/170 decided
  that, and this item corrects the sentence rather than the number.
- **The novella is Chris's writing.** One word changes. The page keeps its
  voice, and the house prose style does not reach it.

## Open questions

None. M3 carries a measurement rather than a question, and its plan says what
each outcome means.

## Watch out for

- **`npm run claims:check` and `npm run constants:check`.** M1 edits a doc
  comment in `src/constants/`. Regenerate the catalogue BEFORE the gates.
- **`test/constants.test.ts`.** It holds an export allowlist that M2 shortens,
  and a count of exports that M2 moves.
- **`docs/TODO/completed/81-live-picker-cannot-name-attack-run.md`.** It records
  what was reported and why. Do not rewrite it. Add a dated note if M2's
  measurement contradicts it, which is docs/TODO/167's precedent.
- **The novella is not in `src/`.** `npm run ste:check` never reads it, so no
  gate will catch a mistake in M1's edit.

## Verification

The gates always run: `npm run check`.

The tier table puts M1 and M2 at "nothing more", and M1 at
`npm run generate:constants` first. **No probe is involved in either**, because
no rule of the world changes.

M3 needs a browser, and its evidence is the measured width. That is the same
evidence docs/TODO/157 used, and `test/console-plate.test.ts` is the precedent
for holding a stylesheet claim in the suite.

**A test for each deletion, and each one able to fail alone.**

1. A source scan holds that `approach` is not exported. Break it by putting the
   keyword back.
2. A scan holds that the three `brain-names.ts` members are gone. Break it by
   putting one back.
3. `test/constants.test.ts`'s export count moves by exactly the number deleted.

**The two word fixes need no new test.** `npm run constants:check` already reads
the doc comment, and the novella has no gate at all. State that plainly in the
outcome rather than implying cover that does not exist.

## Outcome

All three milestones landed on 2026-08-17. Four of the five defects were real
and are fixed. The fifth does not exist, and the measurement is written down.

### M1 — the two wrong words

**The novella line moved, and the plan's line number was stale.** It is
`novella.html:315` rather than 313. The word `name` is `reputation` now.

**The paragraph already used the right word two lines up.** It opens
*"Commanders of established reputation"*, so the sentence contradicted itself
across one clause. The page keeps Chris's voice. Nothing else on it moved.

**`HERMIT_SCATTER`'s comment takes the measured multiple.** 14,000 against
`ASTEROID_SCATTER`'s 5,000 is 2.8, and the sentence said 2.5.

**IT ALSO NAMES THE CONSTANT, AND THE PLAN DID NOT ASK FOR THAT.**
docs/TODO/170 gave an arrival a second rock anchor, so *"the asteroid field's
nominal radius"* had two readings. The hermit and `ASTEROID_SCATTER` both anchor
to the station (`game/spawning.ts`). `ASTEROID_LANE_SCATTER` does not.

`npm run generate:constants` ran first. 390 exports, 87 rule ids.

### M2 — the two members with no reader

**THE FALLBACK IS MEASURED, AND docs/TODO/81'S CLAIM HOLDS.** No live caller of
`brainName` can pass a sentinel. There are two callers:

1. `ui/screens-trainer.ts` prints `ExerciseSetup.coPilot`. `combat-sim.ts` sets
   that field from `defenceBrainNameFor`, which returns a `BrainName`.
2. `game/screens/combat-sim-setup.ts` prints the PIRATES FLY row. Its value
   walks `PIRATE_CHOICES`, whose two members are each a `BrainName`.

**The draft that holds the second value is never saved.** `SimDraft` lives in
one private field of the combat trainer screen. `freshDraft` seeds it, and
`step` and `endOf` keep it inside the array. The only `JSON.parse` in `src/` is
`save-transfer.ts`, and it reads a save rather than a report.

So `AS_SHIPPED`, `AS_THE_GAME_FLIES` and `SENTINEL_NAMES` are gone. `brainName`
is one lookup. `approach` lost its `export`, and gained the doc comment it never
had.

**A THIRD STALE CLAIM CAME OUT OF IT, AND THE PLAN DID NOT HAVE IT.** `BRAINS`'s
doc comment said the two pickers offer one sentinel each, and that their lines
live in `screens/combat-sim-notes.ts`. Both halves are false. `brainNote` reads
`brainCharacter` alone, so a sentinel had no line there at all. One picker is
left, and every value it offers is a pilot.

**`test/deleted-members.test.ts` is 10 assertions in two scans.** Each scan
carries a control, because a scan can go green on a pattern that matches
nothing. **Proved able to fail twice, and each one alone.** The `export` keyword
put back reddens one check. A sentinel put back reddens its own, and the
allowlist check beside it.

**The allowlist's own stale check is what demanded the edit**, and the scan went
233 constants outside the home to 230. That is exactly the number deleted.

4,799 assertions.

### M3 — the hint does not overflow

**THE DEFECT IS NOT THERE, AND THE RULE STAYS.** `#screen .hints span` was
measured in Chrome at three viewport widths. It never overflows its container.

| viewport | panel | hints container | longest hint | spare |
| --- | --- | --- | --- | --- |
| 1289 | 644.5 | 582.5 | 334 | 249 |
| 760 | 640 | 578 | 319 | 259 |
| 500 | 640 | 578 | 319 | 259 |

**`#screen` sets `min-width: 640px`, so 578 pixels is a floor rather than a
reading.** The container cannot get narrower, whatever the window does. The
longest hint in the tree is the compare screen's `THE OTHER RECORD (n IN THE
RING)`. It uses 55% of that floor.

**Every hint string in the five call sites was measured**, in the live container
at the real font. The three longest are that one, and the survivors screen's two
lines about the capsule.

**#29's geometry is absent here.** `#message` held one whole sentence in one
`nowrap` element, centred on `left: 50%`, with no width floor. A hint is a short
item, and `.hints` wraps normally BETWEEN items. The trainer's six hints take two
lines at the floor.

**AT 500 PIXELS THE PANEL HANGS OFF BOTH EDGES, AND EVERY ROW GOES WITH IT.**
That is `min-width: 640px`, and it is not this rule. It is reported here and not
scheduled.

**THE MEASUREMENT FOUND THE OPPOSITE DEFECT, AND THE PLAN DID NOT HAVE IT.** The
station menu's own key line is a bare `.keyline`. It carries no spans and no
`nowrap`, and it breaks `S COMMANDER FILE` across two lines. That is the exact
ugliness this rule prevents. **It is REPORTED rather than fixed**, because it is
a sixth defect and not one of the five. This item exists because five reports
went unscheduled, so it does not add a sixth silently.

**The record lives beside the rule in `src/style.css`**, and no gate holds it.
`tools/ste.mjs` walks `.ts`, `.js` and `.mjs` alone, so it never reads a
stylesheet comment.

**No new test.** The plan said to fix it only if it overflows. It does not.

### What has no gate

Two of this item's four fixes are unprotected, and that is stated rather than
implied. The novella has no gate at all. The `style.css` comment has none
either. `npm run constants:check` does read the `HERMIT_SCATTER` comment, and
`test/deleted-members.test.ts` holds both deletions.
