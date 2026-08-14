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

**M1 landed on 2026-08-14, and it inverts the item's premise.** `npm run check`
passes at 4,530 assertions. The comment lines in the ten files went from 1,653
to **1,655** — nothing was cut, which is the point.

### The counts the plan asked for

| what the test said | count |
| --- | ---: |
| a rule paragraph with no home, MOVED to the module that owns the rule | **0** |
| a rule paragraph that DUPLICATES what the owning module already says | **9** |
| about this code, stayed | everything else |

**Nine for nine. Not one rule was homeless.** Every rule paragraph beside a
handler turned out to be a second copy of prose the rules module already
carried, usually in better words. So the defect is not "explained where the rule
does not live". It is **explained twice, once where it lives and once where it
is spent** — which is the one-rule-one-home failure this codebase is organised
against, wearing a different face.

The nine, each replaced by a pointer to the owner:

1. `jettisonCargo` — the pirate paragraph. `jettison.ts` opens with it.
2. `jettisonContraband` — the price-table ordering. `jettison.ts` again.
3. `generateContractOffers` — "deliberately generous". `contract-offers.ts`
   says it on the function itself.
4. `loadOrWarmGalaxy` — warming only where there is nothing to load.
   `prewarm`'s own doc in `galaxy/living.ts`.
5. `markName` — only a crossing speaks. `characterVerdict`'s doc says it.
6. `massLocked` — "anything close enough to hold the torus drive down",
   **word for word** from `world-step.ts`.
7. `placeOf` — "where a sound happened, as the cockpit hears it", word for word
   from `audio.ts`.
8. `bribePolice`'s per-ship note — `PATROL_PRICE` in `constants/law.ts` owns it.
9. `hyperspace-actions.ts`'s header quoted `hyperspace.ts`'s opening sentence
   back at it. My own, from docs/TODO/150 M4.

### The plan's central example was wrong on the facts

It said of `jettisonCargo`: *"`jettison.ts` owns the rule. A reader who wants to
change how much cargo buys a pirate off will open `jettison.ts`, and will not
find it there."* **They will.** That file's opening states the rule and its
second paragraph states the appetite that scales with what you arrived carrying.
The paragraph in `game.ts` was never homeless; it was the copy.

### The test needed a second half, and a machine can apply it

"Delete the code in your head — is the sentence still true?" separates a rule
from code explanation, and it is as cheap as the plan promised. **It does not
say what to do next**, and the answer turned out to be "delete the copy" rather
than "move it" every time. The second half is: **then open the module that owns
the rule and look.**

That half is mechanical, so it was measured rather than eyeballed. A word-bag
comparison of every comment sentence in the ten files against every comment
sentence elsewhere in `src/` found **27 echoes above 60% overlap**, and reading
them sorted the true duplicates from the false positives in one pass. **The
false positives are the interesting half**: most are a SEAM stated from both
sides — `blueprint-set.ts` says "I do not draw the dice, my caller does", and
`world-build.ts` says "I am the caller and here is where I draw". Each is only
true from its own side, so both stay. After the nine fixes the count is 24, and
those 24 were read and left.

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

**M2 answered all three by measurement on 2026-08-14, and the answer to the
third is NO. The item closes with M1.**

1. **The rule module already said it, nine times out of nine.** Nothing moved,
   so nothing arrived anywhere.
2. **No file crossed the detector**, because no prose changed file.
3. **The tree-wide pass is not worth it, and would fight `CLAUDE.md`.** The
   detector was run over all of `src/`: **6,171 comment sentences, 175 pairs
   above 80% overlap** once per-file boilerplate is excluded. Sorted:

| what the pairs are | count |
| --- | ---: |
| a constant and the module that spends it | 32 |
| two generated files sharing a header | 69 |
| everything else | 74 |

**The 32 are the house rule, not a defect.** `CLAUDE.md` says *"Put a
constant's rationale beside it"*, so a constant restating its rule beside the
number is exactly what this repository asks for. A sweep would delete the thing
the rules require. The 69 are generated headers and are not edited by hand. Of
the 74 left, the sample read was mostly SEAM pairs again — two sites each naming
their own half — plus shared `@param` lines and shared citations of `CLAUDE.md`.

**`game.ts` was the outlier the item suspected**, and the reason is structural:
an orchestrator's handlers sit beside rules they SPEND, so the temptation to
restate the rule is at its highest exactly there. Elsewhere a file states its
own subject and the echo is a coincidence of vocabulary.

**The detector is not made a gate.** At a 33% hit rate inside the orchestrator
family and far lower outside it, a gate would fail the build on prose that is
correct, and the constants rule guarantees a permanent floor of false positives.
It is recorded here as a tool to re-run when a large extraction lands, which is
when handlers move next to rules and the copies get made.

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
