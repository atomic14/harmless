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

**The fifth M3 pass landed on 2026-08-15**, over `game/station.ts`,
`game/ship-specs.ts`, `game/screens/test-mode.ts` and `game/contracts.ts`: 304
sentences with **91 over the cap (30%)** and 14 perfect tenses, down to 481 with
one over and none of either fault. The cost is 53 lines. **The tree is at 1,355
long sentences, which is 12%.**

**30% is the worst starting share of any M3 pass**, and these are four ordinary
game files rather than a trainer or a report. The rate is the tree's own: the
files at the top of `--work` were the big ones, and the files below them are
just as far from the style.

**The value test cut one comment.** `station.ts` opened its dock with *"whatever
flew us in, we're down: drop the autopilot and cut the music"* over the two
lines that do exactly that. It named no reason and no consequence. Everything
else in the four earns its place: an absence explained so nobody re-adds it, a
measured figure, a defect that a comment stops somebody from re-creating.

### Where the full sweep stands

**M3 is a full sweep of `src/`, and it is more than one sitting.** The table
below is the state after the twelfth pass on 2026-08-16. **`npm run ste -- --work`
is the resume point** — it names the file to take next, in the order that clears
the most breaches per pass.

| | long sentences | share | `-ing` per 100 | tense |
| --- | ---: | ---: | ---: | ---: |
| when the checker was written | 1,988 | 20% | 23.4 | 309 |
| at the head of M3 | 1,842 | 18% | 21.0 | 265 |
| after the seventh pass | 1,297 | 11% | 16.1 | 184 |
| after the eighth pass | 1,211 | 10% | 15.3 | 168 |
| after the ninth pass | 1,139 | 9% | 14.9 | 153 |
| after the tenth pass | 1,071 | 9% | 14.4 | 137 |
| after the eleventh pass | 1,010 | 8% | 13.9 | 127 |
| **now** | **952** | **8%** | **13.2** | **121** |

**THE TREE IS UNDER 10%.** It was 20% when the checker was written.
`src/constants/`, the surface docs/TODO/141 swept in one pass, reads at 6% by
the same tool. So the gap that this item's whole argument rests on has closed
from 4 to 1 down to about 1.3 to 1.

**Forty-four files are converted, and each one measured 0% on the day.** They
held 934 of the tree's long sentences, and every one of the five worst
directories still has files in it. The `-ing` words and every tense breach that
remain in a converted file are recorded above and below as deliberate.

### The eighth pass

**It landed on 2026-08-16**, over the four files at the head of `--work` plus one
repair.

| | sentences | over cap | `-ing` | tense |
| --- | ---: | ---: | ---: | ---: |
| before | 435 | **83 (19%)** | 110 | **16** |
| after | 610 | **0** | 58 | **0** |

The four are `game/combat-sim.ts`, `game/law-actions.ts`, `game/docking.ts` and
`game/elite-a/combat-math.ts`. The fifth is `game/character.ts`, and it is a
repair rather than a pass.

**The cost is 41 lines**, at 364 insertions against 323 deletions. The sentence
count rose by 1.40 times, which is below M2's 1.92. **Nothing was dropped**: a
walk of every number in the prose of all five files, before and after, reports
126 numbers and 0 lost.

**Four things came out of the eighth pass that the plan did not have.**

1. **docs/TODO/162 DID NOT REGRESS THE FILES IT TOUCHED**, and that is the
   opposite of the seventh pass's finding. 162 rewrote prose in fourteen files
   for a vocabulary rule, and it was measured against the commit before it:
   `law.ts` went 20 long sentences to 18, `constants/character.ts` 5 to 3, and
   every other file it edited was unchanged. **The tree went 1,297 to 1,294.**
   - **One file did regress, by one sentence.** `game/character.ts` went 3 to 4,
     because 162 added two paragraphs to `characterVerdict`. This pass repairs
     it, which is why the five files above are four plus one.
   - **So the seventh pass's claim needs its scope stated.** An intention does
     not HOLD a converted file. It does not follow that every milestone makes one
     worse. What 158 did to `npc.ts` was five new sentences in new prose; what
     162 did was rewrite existing sentences, and a rewrite tends toward the cap
     rather than away from it.
2. **THE FOUR FILES SPLIT INTO TWO SHAPES, and the ranking cannot see it.**
   `combat-sim.ts` reads at 11% over 184 sentences. The other three read at 22%
   to 28% over 67 to 85. The `--work` order put all four within two breaches of
   each other, and it was right to: the JOB is the same size. What differs is how
   the file reads, and only `--work` finds the big quiet file.
3. **A VERTICAL LIST IS THE ANSWER MORE OFTEN THAN A SPLIT IS.** Four of this
   pass's worst sentences were a list written as prose: the six refused
   `StepHost` members and what each one reaches, five things the oracle does not
   decide, four measured speed caps, and fourteen frame rates. `CLAUDE.md` asks
   for a list at three or more items, and each of these was over five. A list
   also survives the next edit, where a split sentence can be rejoined.
4. **`elite-a/combat-math.ts` holds 72 numbers in its prose**, which is more than
   the other four together. It is the pack's own arithmetic written out, so the
   numeric walk matters more there than anywhere else this item has swept. All 72
   survive.

### The ninth pass

**It landed on 2026-08-16**, over the next four by count: `game/threat.ts`,
`game/law.ts`, `hud/hud.ts` and `game/commander.ts`.

| | sentences | over cap | `-ing` | tense |
| --- | ---: | ---: | ---: | ---: |
| before | 339 | **72 (21%)** | 90 | **15** |
| after | 464 | **0** | 61 | **0** |

**The cost is 28 lines**, at 268 insertions against 240 deletions. **Nothing was
dropped**: the numeric walk reports 95 numbers across the four files and 0 lost.

**Three things came out of the ninth pass that the plan did not have.**

1. **THREE OF THESE FOUR ARE FILES docs/TODO/162 REWROTE, AND IT LEFT THEM AT
   21% OVER THE CAP.** `threat.ts`, `law.ts` and `commander.ts` all took
   vocabulary edits a few hours earlier, by an author holding this item's own
   rule. **A rewrite for one rule is not a conversion.** That is the eighth
   pass's finding stated from the other side, and it is the sharpest evidence
   the item has for why a SWEEP is the unit of work.
2. **THE CHECKER READS A SENTENCE THAT STARTS WITH A PATH AS A CONTINUATION.**
   A split of the form `…at. npc.ts owns the hulls` is still measured as one
   sentence, because the full stop inside `npc.ts` defeats the split. It cost
   two rewrites in `threat.ts` before the cause was clear. **The workaround is
   to not start a sentence with a path**, which reads better anyway. The checker
   is not amended: it is a false NEGATIVE risk in the other direction, and the
   tool's own mask is the part docs/TODO/154 M1 recorded as the delicate one.
3. **A FULL STE PASS DOES NOT PRODUCE A MODULE HEADER.** The backlog says
   `hud/hud.ts` has none, and after this pass it still has none: the file opens
   with ten imports, and the two-line comment below them names the console's
   parts rather than the file's one responsibility or its neighbours. The
   checker measures sentences, so a file can read perfectly and still not say
   what it is. **The backlog entry stands untouched**, and the same is true of
   `game/npc.ts`, which the first M3 pass converted.

### The tenth pass

**It landed on 2026-08-16**, over the next four by count:
`ai-training/policy.ts`, `game/market.ts`, `game/persistence.ts` and
`game/save-file.ts`.

| | sentences | over cap | `-ing` | tense |
| --- | ---: | ---: | ---: | ---: |
| before | 261 | **68 (26%)** | 86 | **16** |
| after | 397 | **0** | 38 | **0** |

**The cost is 37 lines**, at 287 insertions against 250 deletions. **Nothing was
dropped**: the numeric walk reports 93 numbers across the four files and 0 lost.

**Three things came out of the tenth pass that the plan did not have.**

1. **THE `-ing` COUNT FELL BY 56%, WHICH IS THE LARGEST FALL OF ANY PASS**, and
   `ai-training/policy.ts` went 14 to 3. Nothing was contorted to reach it. The
   reason is the SUBJECT: these four files describe what a past decision cost,
   and that prose reaches for a gerund — *"sizing these by hand"*, *"looking the
   roster row up"*, *"going back to an earlier save"*. Each one becomes a plain
   verb in a split sentence, so the caps and the gerunds fall together. Chris's
   rule holds and is not amended (2026-08-14: *"We only need to fix -ing where
   we have to"*).
2. **THE PATH-AT-SENTENCE-START DEFECT COST TWO MORE REWRITES**, in
   `persistence.ts` this time. The ninth pass recorded it, and knowing it did
   not stop it: *"…no automatic write can address it. storage.ts owns the key
   shapes"* still measures as one 26-word sentence. **The finding is that a
   recorded false positive is not a defence.** Only a checker fix or a habit
   stops it, and the habit — never open a sentence with a path — is what these
   two rewrites adopted.
3. **`policy.ts` IS THE FIRST TRAINER FILE SINCE THE FIRST M3 PASS**, and it
   reads differently from a game file. Its prose is a laboratory notebook: five
   of its worst sentences are an incident report with a date, a count and a
   verdict in one breath. **Nothing was cut.** A measurement is a record, which
   `CLAUDE.md` excludes from the style — but the SENTENCE is still a sentence,
   and splitting it changes no fact. All 880 champions, the 25-float buffer and
   the 2026-08-05 date all survive.

### The eleventh pass

**It landed on 2026-08-16**, over `game/docked.ts`,
`game/screens/save-transfer.ts`, `game/cargo.ts` and `game/career.ts`.

| | sentences | over cap | `-ing` | tense |
| --- | ---: | ---: | ---: | ---: |
| before | 260 | **61 (23%)** | 75 | **10** |
| after | 375 | **0** | 36 | **0** |

**The cost is 20 lines**, at 217 insertions against 197 deletions. That is the
cheapest pass since the seventh, which cost nothing. **Nothing was dropped**:
the numeric walk reports 47 numbers and 0 lost.

**Two things came out of the eleventh pass that the plan did not have.**

1. **THE TREE IS AT 8%, AND `src/constants/` IS AT 6%.** The gap the item exists
   to close is now 1.3 to 1, from 4 to 1 when the checker was written. **The
   plan's own success criterion is nearly met** — "the three counts fall toward
   the 3% that `src/constants/` already reaches" — and it is worth saying that
   the target moved. The 3% came from the throwaway tool, and 6% is what the
   checker reads on the same directory.
2. **FOUR OF THIS PASS'S WORST SENTENCES WERE A LIST OF FOUR OR MORE ITEMS**,
   which is the eighth pass's finding a second time: `docked.ts`'s one
   responsibility, `save-transfer.ts`'s three pure functions, `cargo.ts`'s three
   commander rules, and `career.ts`'s four acts. **A list is now the first thing
   to try**, ahead of a split. It is also the change that survives the next
   edit, because an added item extends a list and lengthens a sentence.

**ONE OF THE TWENTY-THREE NO LONGER MEASURES 0%**, and it is `game/npc.ts` at
five long sentences. A later milestone put them there, and the seventh pass
records which one. A converted file is converted on the day, and nothing holds
it there. That is M4's question, now with a named example.

### The twelfth pass

**It landed on 2026-08-16**, over the next four by count: `game/systems.ts`,
`game/snapshot.ts`, `game/combat-computer.ts` and `game/combat.ts`.

| | sentences | over cap | `-ing` | tense |
| --- | ---: | ---: | ---: | ---: |
| before | 290 | **58 (20%)** | 79 | **7** |
| after | 442 | **0** | 8 | **0** |

**The cost is 67 lines**, which is the most expensive pass of the item. Six of
the pass's worst sentences became a vertical list, and a list is what costs the
lines. **Nothing was dropped**: the numeric walk reports 65 numbers across the
four files and 0 lost.

**Four things came out of the twelfth pass that the plan did not have.**

1. **THE SIZE GATE FIRED, AND THE CONVERSION IS WHAT FIRED IT.**
   `game/combat.ts` went 391 lines to 406 and crossed the 400 ceiling. That is
   the seventh pass's `flight.ts` case, but past the line rather than five short
   of it.
   - **The value test paid 2 or 3 lines, and the gate needed 7.** The one real
     duplicate inside the file was the `offence` rule, stated in the header and
     again on the event's own doc. `CLAUDE.md` forbids a cut of prose to reach a
     line count, so a trim to fit was not available.
   - **So the answer was the gate's own answer: a split.** It is the third time
     this item has met that gate, and the second time the answer was a new file.
2. **THE SEAM IS THE VOCABULARY RATHER THAN THE LOGIC**, and the argument is the
   import direction. `src/game/combat-events.ts` holds `CombatEvent` and the
   three helpers that build one, at 59 lines against 368 left behind. One module
   BUILDS a combat event and six READ one, so a module that merely applies an
   event had to import the module that resolves a hit. `combat-sim.ts` and
   `law-actions.ts` both did that and neither fires a gun. **`sounds.ts` already
   states the same argument for `SoundEvent`**, which is a member of the union.
3. **A STRANDED DOC BLOCK IN `combat-computer.ts`, AND ONLY A LINE-BY-LINE READ
   FINDS IT.** Three doc comments were stacked above `private readonly
   threatLock`. Two of them were `@param` blocks for `step`, which is declared
   BELOW the field. So the three documented parameters of `step` documented a
   `ThreatLock` instead, and no tool in the repository can see that. They are one
   block on `step` now.
4. **THE CHECKER MISSED TWO PERFECT TENSES, AND READING FOUND THEM.**
   `combat-computer.ts` held "had only ever been flown" and "which has always
   written". `tools/ste-rules.mjs` allows ONE adverb between the auxiliary and
   the participle, and its list is `not never already also still only just`.
   "only ever" is two of them, and "always" is on neither list. **The tool is
   not amended**: both shapes are rare, and a wider window buys false positives
   in a rule that is already the item's most delicate. The count is a FLOOR on
   the tense breaches, exactly as it is on the verb forms.

**THE `-ing` COUNT FELL BY 90%, WHICH IS THE LARGEST FALL OF ANY PASS**, from 79
to 8. Nothing was contorted to reach it, and Chris's rule is not amended
(2026-08-14: *"We only need to fix -ing where we have to"*). The reason is the
SUBJECT: these four files describe MECHANISM, and mechanism prose reaches for a
gerund as the subject of a sentence — *"guessing it afterwards"*, *"resolving a
shot"*, *"destroying a raider's pod"*. Each becomes a plain noun in a split
sentence. **The eight that remain are `fitting`, `facing` and `rescaling`**,
which are technical nouns here, plus `fit-anything`, which is a hyphenated
compound the tool reads as a word.

**The sixth pass was `src/constants/docking-computer.ts` and `game/gunnery.ts`**:
219 sentences with 47 over the cap and 5 perfect tenses, down to 288 with none
of either. `npm run generate:constants` ran before the gates, and
`constants:check` reports 380 exports and 59 rule ids, unchanged.

**The seventh pass landed on 2026-08-16**, over `src/music.ts`,
`game/break-off.ts` and `game/flight.ts`: 240 sentences with **63 over the cap
(26%)**, 95 `-ing` words and 10 tense breaches, down to 379 with none of the
caps and none of the tenses. **THE PASS COST NOTHING IN LINES**: 268 insertions
against 270 deletions, so the three files are two lines SHORTER than they were.
Every number in the prose of all three survives, at the same count, by a walk
before and after. `npm run check` passes at 4,686 assertions, unchanged.

**Five things came out of the seventh pass that the plan did not have.**

1. **THE TREE GREW BETWEEN THE SIXTH PASS AND THIS ONE, BY 51 LONG SENTENCES.**
   The table above read 1,309 after the sixth pass. The checker read 1,360 at
   the head of this one. The sixth pass had cleared 47, so four milestones put
   back more than one pass takes out.
   - **A CONVERTED FILE REGRESSED, AND `git blame` NAMES THE COMMIT.**
     `game/npc.ts` measured 0% on 2026-08-14, at the end of the first M3 pass.
     It holds five long sentences today. All five are lines 294, 299, 327, 342
     and 889, and `git blame` puts every one of them in commit `86fdd05` —
     docs/TODO/158 M1 and M2, written on 2026-08-15.
   - **This is the plan's central claim, measured a third way.** The first two
     measurements were populations: a swept directory against an unswept one,
     and the files docs/TODO/150 wrote. This one is a single file, converted to
     zero and then regressed by one later milestone. A sweep converts a
     surface. An intention does not hold one.
2. **`game/flight.ts` was 5 lines under the size ceiling**, at 395 of 400. The
   conversion adds lines at 11% in M2's measurement, so the file could not take
   this pass as an addition. It went the other way, and the value test is why.
3. **THREE SECTION DIVIDERS IN `flight.ts` NAMED NOTHING**, and dropping them is
   what paid for the conversion. `// --- the racks ---`, `// --- the ship's own
   instruments ---` and `// --- the guns ---` had no member under them:
   docs/TODO/155 M2 moved those members into `flight-weapons.ts` and
   `flight-instruments.ts`, and left the headings behind. A divider over nothing
   is a map of a file that no longer exists. `// --- the training simulator ---`
   still has members and stays.
4. **A LITERAL SAMPLE OF OUTPUT READS AS PROSE.** `break-off.ts` shows what the
   trainer's column prints — `RUN CLOSING 8.2s · RUN EXTENDING 6.9s · …` — as an
   indented line rather than in backticks. The checker counts `EXTENDING` and
   `EVADING` as two `-ing` breaches. It is an exact output string, which the
   style never touches, so both stay. This is a sixth false-positive shape, and
   it is the one the tool cannot see: an indented line of prose and an indented
   line of output look the same.
5. **`routing` is a technical noun that the list does not have.** It is left in
   `music.ts` and `flight.ts`, at one use each, and the list is NOT amended for
   it: `npm run ste -- --words` puts it far below the entries the audit already
   holds, and a two-use word does not earn a list entry that every later pass
   then trusts. Chris's rule stands — fix `-ing` only where a rewrite needs it.

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

**THE SEVENTH PASS SUPPLIES THE EVIDENCE FOR QUESTION 1.** `game/npc.ts` was
converted to 0% on 2026-08-14. docs/TODO/158 put five long sentences back into
it on 2026-08-15, and no gate said so. A diff-scoped gate would have caught
every one of those five, because docs/TODO/158 edited that file. That answers
question 2 as well, at least as a floor: diff-scoped is enough for the shape of
drift this item has actually measured.

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
- ~~**`src/constants/` is done.** 141 swept it and it measures at 3%. Do not
  re-sweep it.~~ **REVERSED on 2026-08-15** (Chris: *"Do the full sweep - we
  want good comments using our standard that help to understand the code"*).
  The 3% came from the throwaway tool. The checker puts the directory at 6% and
  `constants/docking-computer.ts` at 17%, so "done" was not true of every file
  in it. The sweep covers `src/constants/` too.
  - **Run `npm run generate:constants` BEFORE the gates** whenever a doc comment
    there changes. It is the `Purpose` column of `CATALOG.md` (docs/PROCESS.md).
- **M3 IS A FULL SWEEP, and it is more than one sitting.** The checker's
  `--work` order is the resume point, so a pass can stop anywhere and the next
  one starts at the top of the same list.
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
