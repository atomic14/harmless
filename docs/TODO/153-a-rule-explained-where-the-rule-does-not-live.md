# 153 — A rule explained where the rule does not live

**Kind:** refactor · **Severity:** low · **Size:** medium · **Depends on:** 150 ·
**Blocks:** 154 · **Source:** Chris, 2026-08-14: *"Comments should help explain
the code - but they are only needed if the code is not self explanatory."*

## Where we are

`src/game/game.ts` holds 797 comment lines against 984 lines of code. The review
that produced this item measured where that prose sits.

**It is not restatement.** I searched every doc comment for one that only repeats
the member name. In 2,020 lines there is **one**. The comments say something.

**The problem is what some of them say.** Thirty-three members carry six or more
doc lines, and hold 286 comment lines between them. The worst ratios:

| member | doc lines | code lines |
| --- | ---: | ---: |
| `keyPrompts` | 7 | 1 |
| `endExercise` | 6 | 1 |
| `abandonFlight` | 15 | 5 |
| `jettisonContraband` | 11 | 4 |
| `pausedHint` | 10 | 4 |
| `markName` | 10 | 4 |

A high ratio is a symptom and not the defect. `keyPrompts` is 7 lines on 1, and
every line earns its place: it says why the delegate exists and which two tests
read it. **The defect is a rule of the GAME explained beside code that only
delegates.**

## Two examples, and they are the whole item

`jettisonCargo` is four lines of code. It forwards to `law-actions.ts`, which
forwards to `jettison.ts`. Its comment is:

> Dump a tonne over the side. Pirates came for cargo, not for you — give them
> enough of it and the opportunists break off and go collect, which turns "I
> can't win this fight" into a decision rather than a death. Organised gangs want
> considerably more convincing.

That is a rule about how pirates behave. **It is true with this method deleted.**
`jettison.ts` owns the rule. A reader who wants to change how much cargo buys a
pirate off will open `jettison.ts`, and will not find it there.

`abandonFlight` is five lines of code and fifteen of comment. The first paragraph
explains the ORDER of two calls, and that is code explanation of the best kind.
The second paragraph argues why the feature is offered to every pilot. That is a
design argument, and it survives the code.

## The test

**Delete the code in your head. Is the sentence still true?**

- **Still true** — it is about a rule. Move it to the module that owns the rule.
- **No longer true** — it is about this code. It stays.

The test is cheap, it needs no measurement, and it gives the same answer to two
readers. That matters more than a line-count threshold, which gives the wrong
answer on `keyPrompts` and the right answer on `jettisonCargo` by luck.

## What to do

### M1 — `game.ts` and the three children docs/TODO/150 produced

Walk the thirty-three members. Apply the test to each paragraph, not to each
comment: `abandonFlight` shows that one comment can hold both kinds.

Move a rule paragraph to the module that owns the rule. Leave a pointer only
where the caller needs one to be correct.

**Report the counts.** How many paragraphs moved, how many stayed, and how many
were already in the right place. The plan does not predict them.

### M2 — re-assessed after M1

**Do not fix the scope here.** M1 measures whether the test is usable at scale
and what it costs per member. docs/TODO/150 M2 and M3 both proved that a plan
which names its next target before it measures picks the wrong one.

What M1 has to answer:

1. Does a moved paragraph find a real home, or does the rule module already say
   it in its own words? A duplicate is deleted rather than moved.
2. Does the receiving file cross the 400-line detector? Prose that arrives is
   still prose that counts.
3. Is the tree-wide pass worth it? 242 files carry comments. `game.ts` may be
   the outlier that provoked the item rather than the general case.

## Decisions already made

- **A comment explains the code; the code should be self-explanatory where it
  can be** (Chris, 2026-08-14).
- **This item MOVES prose. It does not cut prose.** docs/TODO/148 recorded the
  failure mode: `controls.ts` was trimmed six times across three items and split
  zero times, and every cut deleted reasoning that had just been judged worth
  writing. Exactly one bare restatement exists in `game.ts`. **This item is not a
  licence to trim.**
- **Every comment travels with the code it explains** (docs/TODO/148 and 149).
  This item is the same rule, applied to a comment whose code is elsewhere.
- **`CLAUDE.md` forbids the removal of useful content to fit a ceiling.** A
  paragraph moved to its rule module is not removed. A paragraph deleted as a
  duplicate is removed for a different reason, and that reason must be stated
  each time.

## Open questions, and the answers

**1. Does this shrink `game.ts`?** Probably, and that is not the point. The
review measured that `game.ts` cannot reach its 300-line target by extraction
alone. Prose that moves to its rule module makes both files more correct. A
smaller `game.ts` is a side effect and is not the test of success.

**2. Why does this depend on docs/TODO/150?** Because 150 keeps moving members
out of `game.ts`, and a comment travels with its code. A paragraph judged here
and moved there twice is wasted work.

**3. Why does this block docs/TODO/154?** Because 154 rewrites every comment in
`src/` into Simplified Technical English. A paragraph rewritten in one file and
then moved to another is rewritten twice. Move first. Rewrite once.

**4. Is the game-design prose worth keeping at all?** Yes. It is the reason a
rule has the value it has, and `CLAUDE.md` asks for exactly that beside a
constant. The question this item answers is WHERE, and never WHETHER.

## Watch out for

- **A paragraph can be about both.** `abandonFlight` holds one of each. Split
  the paragraph. Do not judge the comment as a unit.
- **A rule module may be portable where `game.ts` is platform.** Prose carries no
  import, so a move cannot break `npm run portability`. Run it anyway; the module
  graph does not move but the claim should be checked rather than assumed.
- **`src/constants/` has a generator.** A doc comment there is the `Purpose`
  column of `CATALOG.md`. Run `npm run generate:constants` BEFORE the gates if a
  paragraph lands in that directory (docs/PROCESS.md, step 3).
- **`test/damage-paths.test.ts` reads a table out of a doc.** Check that no test
  reads a comment you intend to move.

## Verification

**The gates always run:** `npm run check`. This item moves prose and changes no
rule, so docs/PROCESS.md's tier table asks for nothing more — with the
`src/constants/` exception named above.

**A refactor's gate is that nothing needed a new test.** No assertion count may
move.

**The numbers that say it worked:** every comment line that existed before still
exists somewhere afterwards, counted; and for each paragraph that moved, the
receiving file is the one that owns the rule.
