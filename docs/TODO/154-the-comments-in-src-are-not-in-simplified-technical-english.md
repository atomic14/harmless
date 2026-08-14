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

### M2 — the pass over the worst files

Take the files the checker ranks worst. Convert them. Measure again.

The ten worst by share of long sentences, as at 2026-08-14:

```
33%  game/extend-arc.ts        27%  hud/hud-model.ts        25%  game/pitch-roll-steer.ts
30%  game/dock-path.ts         26%  ships/elite-a-hulls.ts  25%  game/screens/save-naming.ts
28%  game/docking-sticks.ts    26%  game/autopilot.ts       25%  galaxy/descriptions.ts
                                                            25%  engine/inert-dom.ts
```

**Report the cost per file.** M2 is where the size of the whole job becomes
known, and the plan does not predict it.

### M3 — the rest, in checker order

Nothing to decide. Work the ranking down.

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
