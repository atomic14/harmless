# 154 — The comments in src/ are not in Simplified Technical English

**Kind:** refactor · **Severity:** low · **Size:** large · **Depends on:** 153 ·
**Blocks:** nothing · **Source:** Chris, 2026-08-14: *"Are they in ASD-STE100?"*

## Where we are

They are not. I measured all 242 files of `src/` that carry comments, against
three rules that a machine can count.

| rule | breaches |
| --- | ---: |
| a descriptive sentence is 25 words or fewer | **1,376** of 12,174 sentences (11%) |
| an `-ing` word is a technical noun only | **2,774** words |
| no perfect tense and no compound auxiliary | **151** sentences |

The longest comment sentence in `game.ts` is 46 words. Three of the plainest
breaches read like this:

> "It costs what dying costs because it lands where dying lands."
> "It SAYS SO rather than doing nothing."
> "…there is nothing to gain by quitting that flying home would not have paid
> better."

## The incremental policy does not work, and this month is the proof

`CLAUDE.md` sets the current rule:

> It also covers every new or changed comment in `src/`, so that surface converts
> as you edit the files.

docs/TODO/141 swept `src/constants/` in one pass on 2026-08-12. Everything else
was left to convert as it was edited. **Compare the two halves:**

| population | long sentences | `-ing` words per 100 sentences |
| --- | ---: | ---: |
| `src/constants/` — swept by 141 | **3%** | **9.6** |
| the rest of `src/` — incremental | 13% | 25.9 |
| the three files docs/TODO/150 wrote this month | **14%** | **30.2** |

The third row is the finding. Those files were written under the incremental
rule, by an author who had read it, during the month it applied. They are
**worse than the tree they were added to**.

**A sweep converts a surface. An incremental rule does not.** The evidence says
so at both ends of the same table.

## Why the incremental rule fails

**Nothing measures it.** `CLAUDE.md` says the house style has no gate, and names
the date it said so. A rule with no measurement is a preference.

**A comment is written once and read many times.** The author is deep in the
code and writes the sentence that fits the thought. Nobody returns to it, because
returning to it is nobody's task.

**The rules are countable, so the excuse is thin.** Sentence length, `-ing`
words and tense are all machine-checkable. That is the second half of this item.

## What to do

### M1 — the checker

`tools/ste.mjs`, and it is the deliverable that makes the rest possible. It
reads the comments of a file and reports three counts:

1. every sentence over the cap — 20 words for an instruction, 25 for descriptive
   text;
2. every `-ing` word that is not on the technical-noun list;
3. every perfect tense and every compound auxiliary.

It must skip what the style never touches: a code identifier, a string literal,
a command, an API name, an exact error string, and anything quoted from a person.
**A quotation rewritten is falsified**, and that is the rule most likely to be
broken by a tool that cannot see quotation marks.

It reports. **It does not gate yet.** M4 decides that.

**M1 landed on 2026-08-14.** It is three files rather than one: `tools/ste.mjs`
is the parent, `tools/ste-read.mjs` decides what is measured, and
`tools/ste-rules.mjs` holds the three rules. `tools/ste.test.mjs` is 57
assertions and is in `npm run check`. The checker itself is NOT in
`npm run check`, which is M4's decision to make. `npm run check` passes at 4,530
assertions, unchanged.

**The tree measures at 20% long sentences, 2,345 `-ing` words and 309 tense
breaches, over 10,013 sentences in 247 files.** Seven generated files are
skipped, because a hand edit to a generated comment is lost at the next
generation.

**The plan's central claim survives the better measurement, and the gap is
wider than the plan said:**

| population | long sentences | `-ing` per 100 sentences |
| --- | ---: | ---: |
| `src/constants/` — swept by 141 | **6%** | **6.3** |
| the rest of `src/` — incremental | **24%** | **29.6** |
| the five files 150 wrote this month | **23%** | **32.7** |

**Eight things came out of M1 that the plan did not have.**

1. **The checker's numbers are about double the plan's at both ends.** The plan
   measured 11% of 12,174 sentences. The checker says 20% of 10,013. The two
   tools split sentences differently, and the plan's tool was a throwaway that
   nobody kept, so the two counts cannot be reconciled. **The ratio is what the
   argument rests on, and it did not weaken: 4 to 1, where the plan had 4.3 to
   1.**
2. **552 lines in one file failed `npm run sizes`**, which is the same event 155
   M2 recorded. The split into a parent and two children is the answer that gate
   asks for, and each file is now under 240 lines.
3. **A real defect was found by mutating the tool, and it is the path mask.**
   The greedy form of it swallowed the full stop that ends a sentence, so
   "…swept `src/constants/`. Do not re-sweep it." was read as one sentence and
   reported as a breach of the cap. It merged 51 sentences across `src/`.
4. **Two assertions were vacuous when first written.** One claimed that a name
   in backticks counts as one word, over a name that was one word either way.
   The other claimed that "e.g." does not end a sentence, where a second rule
   already stopped the split. Two more turned up on the second sweep. **All 25
   mutations now fail the test.**
5. **Nineteen of the 59 technical nouns named nothing in the tree.** They were
   guesses, and `--nouns` found them on the first run. It prints a count and one
   example for each entry, so the list is a review surface in the same way that
   `tools/sizes.mjs` keeps one.
6. **The `-ing` test is the word and not its role, and that is a known miss.**
   `damping` is a noun in "the damping term" and a verb in "nothing damping it".
   So the count is a FLOOR on the verb forms rather than an estimate. Five
   entries came out where reading showed the verb use to be the common one.
7. **A ranking by share is unstable over a short file.** Three long sentences
   out of five is 60%, and it is twenty minutes of work. `--work` sorts by the
   count of breaches, and it names a different ten files.
8. **The tense count needed one rule the plan did not name: one chain is one
   breach.** "may have been caused by" holds two of the three forbidden shapes,
   and reporting it twice would say the sentence has two faults to fix.

### M2 — the pass over the worst files

Take the files the checker ranks worst. Convert them. Measure again.

**M1 replaced the ranking this section carried.** The list below came from the
throwaway measurement. The checker's own ranking is `npm run ste`, and M2 works
from that. **Read both orders**, because they name different files:

`npm run ste` — the worst by SHARE, which says which file reads worst:

```
60%  game/screens/typed-name.ts (5)    50%  viewer/gallery-main.ts (4)
53%  game/threat-lock.ts (17)          48%  game/screens/save-naming.ts (21)
52%  game/docking-sticks.ts (48)       45%  game/pitch-roll-steer.ts (60)
50%  game/dock-path.ts (80)            44%  game/extend-arc.ts (16)
50%  galaxy/price-divergence.ts (8)    44%  game/screens/new-commander.ts (16)
```

`npm run ste -- --work` — the worst by COUNT, which says where the job is:

```
87  ai-training/scenario.ts     31  ai-training/observation.ts
82  game/npc.ts                 30  game/world-step.ts
52  game/game.ts                29  game/combat-sim-scenarios.ts
40  game/dock-path.ts           27  game/bindings.ts
34  game/storage.ts             27  game/pitch-roll-steer.ts
```

The number in brackets is the count of sentences in the file. **A share over
five sentences is noise**, which is why the second order exists.

**Report the cost per file.** M2 is where the size of the whole job becomes
known, and the plan does not predict it.

**M2 landed on 2026-08-14, over the ten worst by share.** Both counts below come
from the same checker, over the same ten files, before and after.

| | sentences | over cap | `-ing` | tense |
| --- | ---: | ---: | ---: | ---: |
| before | 285 | **130 (46%)** | **161** | **19** |
| after | 547 | **0** | **2** | **0** |

**THE COST IS 53 LINES ACROSS TEN FILES**, which is 535 insertions against 482
deletions. The sentence count nearly doubled, at 1.92 times. The line count rose
by 11%. **A long sentence splits into two or three short ones of the same
words**, so the conversion buys its caps with punctuation rather than with cuts.

**Nothing was dropped, and that is checked rather than asserted.** Every number
in the comments of all ten files survives, at the same count, measured by a walk
of the prose before and after. `npm run check` passes at 4,530 assertions,
unchanged, so no rule moved.

**The tree went from 1,983 long sentences to 1,853.** Those ten files held 6.6%
of the whole job, so M3 is about fourteen more passes of this size.

**Six things came out of M2 that the plan did not have.**

1. **The checker had two defects that only a conversion pass could find**, and
   both were in what it reads rather than in a rule. A quotation was deleted
   outright, so the fragment left behind started in the middle, and the full
   stop before it stopped ending a sentence — two sentences were then measured
   as one long one. A quotation is one placeholder word now. A doc tag was
   joined to the sentence above it, so the words after `@returns` were counted
   as part of the sentence before it. A doc tag opens a paragraph now. Both are
   proved able to fail.
2. **A real defect in the comments, and only a line-by-line read finds it.** Two
   comment blocks in `game/dock-path.ts` had run together. The second one
   explained `runIn`, and it had lost its opening, so it read as a fragment that
   began "Where the curve gives way to the straight run". Both blocks state the
   same 180-degree reversal, and they are two different causes of it, so both
   stay. The second names its subject now.
3. **The `-ing` rule bit harder than the caps did.** Ten files held 161 `-ing`
   words against 130 long sentences. A split fixes a long sentence in one move.
   A gerund has to be re-thought, because "a ship that is always rolling" and "a
   ship in a permanent roll" are not the same sentence.
4. **Two `-ing` words are left on purpose**, and both are the same phrase:
   *(Chris, flying it)*. `CLAUDE.md` excludes a record of what somebody decided.
   The tool cannot see that a parenthesis is an attribution, so this is a false
   positive that a reader has to hold.
5. **The size gate never fired.** The worry was that the conversion would push a
   file over 400 lines. It did not come close: the largest file grew by 21 lines.
6. **A file's share moves a long way on one sentence.** `price-divergence.ts`
   read 33% before, and 17% after eight of its nine breaches were gone, because
   one long sentence in twelve is still 8%. That is the same instability
   `--work` exists for, and it applies to the FINISHED file as well as to the
   ranking.

### M3 — the rest, in checker order

Nothing to decide. Work the ranking down.

**The first M3 pass landed on 2026-08-14**, over the three files at the head of
`--work`. They are the three biggest holdings of the job rather than the worst
by share.

| | sentences | over cap | `-ing` | tense |
| --- | ---: | ---: | ---: | ---: |
| before | 683 | **199 (29%)** | 213 | **26** |
| after | 1,038 | **0** | 118 | **0** |

`ai-training/scenario.ts` 293 → 443 sentences, `game/npc.ts` 307 → 459, and
`ai-training/observation.ts` 83 → 136. **The tree goes from 1,842 long sentences
to 1,643**, both measured with today's checker.

**The cost is 93 lines across three files**, at 748 insertions against 655
deletions. That is 31 lines a file, against M2's 5. The files are four to five
times the size, so the rate per breach is about the same.

**Nothing was dropped.** The numeric walk reports two changes and both are
measurement rather than loss. `docs/TODO/​123` used to wrap a line, so "123"
counted as a bare number; it is one reference on one line now, and the path mask
takes it. The slot table in `observation.ts` was re-spaced into columns, so the
checker stops reading it as a sentence. Every slot number is still in the file.

**The second M3 pass landed the same day**, over the next two by count:
`game/game.ts` and `game/storage.ts`.

| | sentences | over cap | `-ing` | tense |
| --- | ---: | ---: | ---: | ---: |
| before | 363 | **85 (23%)** | 87 | **14** |
| after | 505 | **0** | 50 | **0** |

The cost is 37 lines, at 312 insertions against 275 deletions. **The tree is at
1,558 long sentences, from 1,842 at the head of M3.** Nothing was dropped: the
numeric walk reports no loss on either file.

**The orchestrator's own header was the hardest paragraph in the two**, and it
is the reason: it is a list of nine children, and a list of nine reads as one
sentence unless it is broken up. It is four paragraphs now, and each one names a
group rather than the whole tree.

**The third M3 pass landed the same day, and it is the first with the value
test on.** `game/world-step.ts` and `game/bindings.ts`: 245 sentences with 57
over the cap and 12 perfect tenses, down to 347 with none of either. The cost is
21 lines. **The tree is at 1,501 long sentences.**

**THE VALUE TEST WAS RUN AS A MEASUREMENT RATHER THAN BY EYE**, and the headline
is that it finds very little.

1. **A comment that restates its own name: SIX in `src/`, and all six are
   section dividers.** A scan compared every one-line doc comment against the
   identifier below it. `--- selection ---` over `select()` is the whole
   population. **Not one comment in the tree is a bare restatement of its code.**
   That is the plan's own claim, now measured a second way.
2. **A sentence said twice: 54 pairs, and most of them are correct.** A doc
   repeated on a host interface and its implementation is one rule seen from two
   sides. A constant's doc beside the module that spends it is what `CLAUDE.md`
   asks for. The `Erasable-TypeScript only` line is a convention.
3. **SEVEN pairs are a rule with two homes INSIDE ONE FILE**, and that is the
   shape worth cutting. Two of them were fixed in this pass, and **both are in
   files this very item already converted**:
   - `pitch-roll-steer.ts` stated the quarter-turn fold rule in `rollOnto` and
     again in `rollErrorTo`. `rollErrorTo` does the fold, so it is the home, and
     `rollOnto` is a pointer now.
   - `dock-path.ts` explained the path's own start at the call site and again in
     `project()`. `project()` computes it. The call site keeps only the BLEND,
     which is its own decision.
   - Five more are recorded and not yet cut: `combat-sim-report.ts`,
     `elite-a/combat-math.ts`, `hyperspace.ts`, `hyperspace-actions.ts` and
     `game.ts` each say one sentence twice.

**So the value test's yield is 11 lines, against 21 added by the conversion.**
The comments in this tree earn their place. What they do not do is read in
Simplified Technical English, which is what the rest of the item is for.

**The fourth M3 pass landed on 2026-08-15**, over the two combat-simulator
files. `game/combat-sim-scenarios.ts` and `game/combat-sim-report.ts`: 408
sentences with 56 over the cap and **24 perfect tenses**, down to 514 with none
of either. The cost is 18 lines. **The tree is at 1,445 long sentences**, which
is 13%.

**Those 24 tenses are the most in any pass so far**, and the reason is the
subject. A report describes what a fight DID, so its prose reaches for the
perfect: *"what the ramp has turned on"*, *"hits they have landed"*, *"an
opponent has left the sky"*. The simple past says the same thing in one word
fewer.

**The value test found one duplicate in these two, and it stays.**
`combat-sim-report.ts` documents `accuracy` twice, once on the live strip's
shape and once on the finished record's. They are two different types, and a
field's own doc comment is how a type documents itself. A pointer would be worse
than the repetition.

**`src/constants/docking-computer.ts` is now the worst file left by count**, at
26 long sentences over 151. **This pass did NOT touch it**, because the plan
records the decision *"`src/constants/` is done. Do not re-sweep it."* That
decision was taken against the throwaway tool's 3%. The checker puts the
directory at 6% and this one file at 17%, so it is an outlier inside a swept
surface rather than a swept file. **The decision is Chris's to revisit, and this
item will not take it silently.**

**Four things came out of the first pass that the plan did not have.**

1. **A fifth exclusion was needed, and it is a table in COLUMNS.** Several
   headers in `src/` lay an inventory out with spaces rather than pipes. Read as
   prose, `game/scenario.ts`'s damage-path table is one 38-word sentence that
   nobody can rewrite. A run of three spaces inside a line is a column gap, and
   prose never has one, so the test is the gap rather than the subject. It is
   proved able to fail.
2. **The `-ing` count is now the surviving number, and that is Chris's call**
   (2026-08-14: *"We only need to fix -ing where we have to"*). The three files
   went 213 → 118, and every one of those came out of a sentence that was split
   for its cap anyway. Nothing was contorted to remove a gerund.
3. **A cap fixes in one move; a gerund has to be re-thought.** M2 said this and
   this pass is the evidence at four times the size. The caps went to zero in
   three files. The `-ing` count fell by 45%, all of it as a side effect.
4. **A slot table with two-space columns is still read as prose.** The checker's
   gap test needs three. The table in `observation.ts` was re-spaced rather than
   exempted, because the wider gap states the column structure that was there by
   accident. That is the one place in this pass where the tool changed the
   source's layout.

### M4 — the gate, and the decision it needs

Two questions, and M3's numbers answer them:

1. **Does the checker gate `npm run check`, or report only?** A gate ends the
   drift. A gate also fails a build for a sentence of 26 words, which is a cost.
2. **If it gates, is it diff-scoped or whole-tree?** `constants:check` is
   diff-scoped, and docs/TODO/141 recorded what that let through: an export sat
   undocumented until somebody edited its file.

**Prove that any gate can fail.** Write a 30-word sentence. Confirm the failure.
Remove it.

## Decisions already made

- **The house style is ASD-STE100 Simplified Technical English**, and `CLAUDE.md`
  owns the rule table. This item does not restate it and does not amend it.
- **Length is not terseness.** `CLAUDE.md` is explicit: the caps are per
  sentence and never per document. **Split a sentence. Never drop a fact, a
  condition or a scope qualifier to meet a cap.**
- **The exclusions stand.** Code, an exact command or error string, anything
  quoted from a person, a record of what somebody decided or measured,
  `README.md`'s opening, and the player-facing pages are all untouched.
- **`src/constants/` is done.** 141 swept it and it measures at 3%. Do not
  re-sweep it.
- **A COMMENT THAT ADDS NOTHING IS DROPPED** (Chris, 2026-08-14: *"let's make
  sure the comments add value - if not we drop them"*). A pass asks two
  questions of each comment now, and the value question comes first. Delete a
  comment that restates the code, that repeats a rule which lives somewhere
  else, or that is no longer true. Convert what is left.
  - **This does NOT contradict `tools/sizes.mjs`**, and the difference is the
    reason for the cut. That gate forbids a cut made to reach a LINE COUNT:
    *"a shorter comment is not a smaller file"*. This is a cut made because the
    sentence says nothing. A reason, a measurement and a decision all stay,
    however long the file is.
  - **A rule with a home elsewhere becomes a POINTER rather than a deletion**,
    which is docs/TODO/153's answer to the same shape.
- **The `-ing` rule is fixed only where a rewrite needs it** (Chris, 2026-08-14:
  *"We only need to fix -ing where we have to"*). The caps and the tense are what
  a pass converts. An `-ing` word that falls out of a split sentence goes with
  it. No sentence is contorted to remove a gerund, and the checker keeps
  reporting the count.

## Open questions, and the answers

**1. Why does this depend on docs/TODO/153?** Because 153 moves paragraphs to
the modules that own their rules. A paragraph rewritten here and moved there is
rewritten twice. Move first. Rewrite once.

**2. Why not gate at M1 and let the build force the work?** Because that fails
every build until the whole tree converts. The checker reports first, the pass
converts, and the gate closes the door behind it.

**3. Is 11% actually bad?** It is the measure of a rule nobody can follow by
intention. The swept directory sits at 3%, so 3% is what "converted" looks like
here rather than a hypothetical zero. Some breaches are correct: a quotation is
never rewritten.

**4. Does this touch `docs/`?** No. 141 converted the four rule docs and the six
reference docs. This item is `src/` alone, which is what 141 deliberately left.

## Watch out for

- **A quotation is not yours to fix.** `game.ts` and the plan archive quote
  Chris directly. The checker will flag those sentences and every one of them is
  a false positive.
- **A record of what happened is excluded.** `CLAUDE.md` holds the plan archive,
  `DEVLOG.md` and `TRAINING-LOG.md` out of the style. A comment that reports a
  measurement is the same kind of text, and the exclusion should be argued rather
  than assumed.
- **`src/constants/` doc comments feed `CATALOG.md`.** They are already
  converted, so this item should not touch them. If one is touched, run
  `npm run generate:constants` BEFORE the gates.
- **`test/damage-paths.test.ts` reads a table out of a doc.** docs/TODO/141 met
  this and left that table unedited. Check for a test that reads a comment before
  you rewrite one.
- **The `-ing` count includes false positives.** `binding`, `rendering`,
  `docking`, `training` and `spawning` are technical nouns here and are correct.
  The checker's noun list is the part to get right, and it is the part that
  decides whether the number means anything.

## Verification

**The gates always run:** `npm run check`. This item changes comments, so
docs/PROCESS.md's tier table asks for nothing more.

**A refactor's gate is that nothing needed a new test.** No assertion count may
move, and no rule may change.

**Any new gate must be proved able to fail.** M4 states how.

**The numbers that say it worked:** the three counts fall toward the 3% that
`src/constants/` already reaches, measured per milestone by the M1 checker; and
no fact, condition or scope qualifier is lost, which is checked by the reader
rather than by the tool.
