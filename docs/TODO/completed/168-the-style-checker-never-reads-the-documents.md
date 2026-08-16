# 168 — The style checker never reads the documents

**Kind:** gap · **Severity:** medium · **Size:** medium · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** none — found by the sweep of
2026-08-16

## Where we are

**`CLAUDE.md` states the scope of the house prose style, and it names ten
markdown documents.** They are `CLAUDE.md` itself, the three rule documents in
`docs/`, and the six reference documents beside them:

| in scope | file |
| --- | --- |
| rule | `CLAUDE.md` |
| rule | `docs/INVARIANTS.md` |
| rule | `docs/PROCESS.md` |
| rule | `docs/ARCHITECTURE.md` |
| reference | `docs/AI-TRAINING.md` |
| reference | `docs/BROWSER-TRIALS.md` |
| reference | `docs/COMBAT-SIM.md` |
| reference | `docs/DAMAGE-PATHS.md` |
| reference | `docs/ELITE-A.md` |
| reference | `docs/JAMESON-TRIALS.md` |

It also names each TODO item, and every new or changed comment in `src/`.

**`npm run ste:check` reads the last of those and none of the rest.**
`tools/ste-read.mjs` walks characters and extracts COMMENTS from source. A
markdown file holds no comment, so the tool finds nothing in one. Pointed at the
four rule documents it reports:

```
0 files · 0 sentences · 0 over cap (—) · 0 over 25 (—) · 0 -ing (—/100) · 0 tense
```

**`CLAUDE.md` states the limit honestly**: *"A gate checks part of it, over
`src/` only."* So this is a gap rather than a false claim.

**docs/TODO/154 already proved what an ungated surface does.** Two measurements
are in its record:

1. `src/constants/`, which docs/TODO/141 swept in one pass, read at 7% of
   sentences over cap. The rest of `src/`, left to convert as each file was
   edited, read at 24%.
2. `game/npc.ts` reached 0% on 2026-08-14. docs/TODO/158 put five long sentences
   into it on 2026-08-15, and nothing said so.

154's own conclusion is the argument for this item: **a sweep converts a
surface; an intention does not.**

**docs/TODO/141 swept the ten documents above in one pass**, on 2026-08-12.
Nothing measured them since. They are in exactly the position `src/` was in
between 141 and 154.

## What the sweep found that it could not measure

**A trial reader over markdown produced a number, and that number is not
trustworthy.** It joined the items of a bulleted list into one sentence, so it
counted a whole list as a single 43-word breach. The real drift is lower than it
reported, and by an unknown amount.

**That is the finding rather than a footnote.** docs/TODO/154 recorded the same
shape: *"the harder half of the checker is `tools/ste-read.mjs`, which decides
what is measured."* For markdown the reader is harder still, and it must be
built before any number is quoted. **Do not open this item with a drift figure.
Build the reader, then measure.**

## What to do

Three milestones, in this order. The reader comes first, and a number comes
after it.

### M1 — a reader for markdown

`tools/ste-read-md.mjs`, beside the reader that exists. It turns a markdown file
into prose, and it must leave out everything the style never touches.

It drops:

1. **a fenced code block** — code is out of scope;
2. **inline code** — an API name, a command and a config key each carry their
   exact wording;
3. **a table row** — `docs/DAMAGE-PATHS.md`'s 25-row inventory is read by
   `test/damage-paths.test.ts`, and docs/TODO/141 left it untouched for that
   reason;
4. **a block quotation** — a quotation rewritten is falsified.

**A HEADING IS READ, AND THAT REVERSES THIS ITEM'S FIRST DRAFT.** The draft
dropped a heading, and said *"a heading is a label rather than a sentence"*.
Chris rejected that on 2026-08-16, and the evidence is in M2 below. The plan
titles are the worst-drifted prose in the repository, and a dropped heading
would exempt them for good.

A heading takes the title rules in `CLAUDE.md` rather than the sentence caps. A
cap over 20 words never fires on a title, so the caps would report a clean
surface that is not clean.

**A list item is its own sentence.** That is the rule the trial reader got
wrong, and it is the one that decides whether the number means anything. A
bullet ends at its own line break, whether or not it carries a full stop.

**A link keeps its text and loses its target.** The words are prose. The URL is
not.

### M2 — the measurement, and the sweep it asks for

Run the reader over the ten documents. Report the same three counts
`tools/ste.mjs` reports: sentences over cap, compound tenses, and `-ing` words.

**Count the titles separately, because they are the worst surface and the caps
miss them.** The measurement of 2026-08-16 walked 162 plan titles:

| rule | count | detector |
| --- | ---: | --- |
| passive voice | 16 | precise |
| a bare noun phrase, with no verb | about 31 | rough |

**The rough count is rough on purpose, and the plan says so rather than quoting
a clean number.** An imperative title is correct STE, so a detector that only
looks for a finite verb reports `Add stable ship and combat-profile identities`
as a fault. It is not one. Build the detector, then quote a number, which is
the rule this item already states for the markdown reader.

**Chris named the cause on 2026-08-16, and it is the reason this item grew a
title rule:** *"this is not the house convention — this is something that you
have been doing and we've been trying to correct by mandating ASD-STE100."*
Every plan title was written by an agent. So an agent that reads the archive for
the convention finds its own habit, and calls it a rule. That is docs/TODO/165's
finding again: **the index and the archive agreed with each other, and neither
one checked.**

**Then convert what it finds.** Split a long sentence. Never drop a fact, a
condition or a scope qualifier to meet a cap.

**`docs/ARCHITECTURE.md` is rewritten by docs/TODO/166.** Run that item first, or
this milestone converts prose that 166 replaces.

### M3 — the gate

Extend `npm run ste:check` to the ten documents, whole-file, as docs/TODO/154 M4
did for `src/`. Whole-file rather than diff-scoped, for the same three reasons
154 recorded. It costs the same on a surface at zero. It lets less through. It
needs no diff base.

**It holds the same two rules over prose**: the sentence caps and the tense. The
`-ing` count reports and never gates.

**It holds two more over a title**, and they are the rules `CLAUDE.md` states:
the active voice, and a subject with a verb. A title that hides a term the
document defines is a third fault, and it is not countable. Leave it to a
reader.

**An active TODO item is in scope. The archive is not.** `CLAUDE.md` puts each
TODO item in scope. It also excludes *"a record of what somebody decided or
measured"*. That exclusion is the plan archive under `docs/TODO/completed/`,
`research/` and `retired/`. So the gate reads `docs/TODO/*.md` at the top level
and stops there.

**The archive's titles are REPORTED and never gated**, in the shape `ste.mjs`
uses for its `-ing` count. A landed plan is a record, so its title is not
rewritten. A number a person can read is what stops the drift going unmeasured
again.

**A RENAME IS SAFE, AND THAT IS WHY THE ACTIVE TITLES CAN BE GATED.**
`tools/plan-claims.mjs` matches the plan NUMBER rather than the slug, because a
plan document is renamed by its own milestones (docs/TODO/165).

## Verification

The gates always run: `npm run check`. The tier table puts prose at "nothing
more".

**M1 needs fixtures, as `tools/ste.test.mjs` has them.** Write a markdown
fixture that holds one of each thing the reader must drop, plus one bulleted
list. Assert the sentence count the reader gets from it. That fixture is what
stops the trial reader's mistake from coming back.

**M3 must be proved able to fail**, in both rules and on the new surface:

1. Put a 30-word instruction into `docs/PROCESS.md`, and watch the gate go red.
2. Put a compound tense into `docs/INVARIANTS.md`, and watch it go red.
3. Put a long sentence inside a fenced code block, and confirm that the gate
   stays green. That is the reader working, and it is the assertion that matters
   most.

Remove all three afterwards.

**Report the counts before and after M2**, so the outcome states what the sweep
moved.

## What landed, on 2026-08-16

**All three milestones landed in a day, in the order M1, M2, M3.**

**The number came after the reader, and the plan was right to insist.** The
trial reader's figure is not in this record, because it counted a whole list as
one 43-word breach. The real measurement, over the ten documents plus the index
and the two active plans: **174 sentences over the cap and 35 in a compound
tense, of 2,559.** It is **0 and 0 now, of 2,905**.

**The ten documents held 48 of those breaches. The index held 150.** 144 of the
index's 150 were in the dated sections, which report what landed.

**CHRIS ANSWERED TWO SCOPE QUESTIONS, AND THE MEASUREMENT IS WHAT ASKED THEM.**

1. **A section heading keeps the caps and loses the title rules.** `CLAUDE.md`
   said that a plan title, A HEADING and a commit subject each take the title
   rules. Measured, 73 of the 88 headings in the ten documents carry no verb, and
   `docs/PROCESS.md` mandates a plan shape whose own section names are noun
   phrases. So the sentence names the index label instead.
2. **The gate reads the whole index.** He chose to hold the file rather than to
   split its scope in two, so 144 record sentences were rewritten.

**`tools/titles.mjs` LANDED BEFORE THIS ITEM RAN, and it is what M2's title
count and M3's title rules asked for.** It reads 315 plan titles and index
labels, and it holds the two rules a title can break. So the title half of this
plan is already in `npm run check`, and M3 added no second home for that rule.

**A BLOCK QUOTATION IS READ, AND M1 SAID TO DROP IT.** The plan gave one reason:
this repository quotes a person in a block, and a quotation rewritten is
falsified. Measured, that is false. `docs/PROCESS.md` holds no block quotation at
all, and its four quotations of Chris are inline. The 95 block lines in the ten
documents are house prose: an AS BUILT note, a dated note and one rule statement.
A dropped block would take all of them out of the gate's reach.

**Two reader defects came out of the measurement**, and both were in the half
`tools/ste-read.mjs` already owned. A hash opens a sentence, so one paragraph of
the index read as one sentence of 112 words rather than sixteen short ones. And
a quotation of a whole sentence carries its full stop INSIDE the quotation
marks, so the mask took the terminator away.

**One false claim came out of the sweep**, which is docs/TODO/154's finding
again. `docs/COMBAT-SIM.md` said the machinery for a live career selection
exists in `brain-names.ts`, and it named `liveBrainSelection` and `liveBrainId`.
docs/TODO/81 deleted all four members on 2026-08-16.

**Proved able to fail five ways, and each one alone.** The plan asked for three:
a long instruction in `docs/PROCESS.md`, a compound tense in
`docs/INVARIANTS.md`, and the same long sentence inside a fenced code block,
which must stay GREEN. Two more are the reader and the list: the same sentence
in a table row stays green, and a document named in `DOCUMENTS` that is not
there reports the name and exits 1.

**`npm run check` passes at 4,739 assertions.** The gate reads 14,620 sentences
in 252 files and 2,905 in 13 documents.

**`README.md` stays out**, and the open question below is unchanged.

## Decisions already made

- **The reader comes before the number.** See "What the sweep found".
- **The gate holds two rules of the three.** The `-ing` count reports only, as it
  does over `src/` (docs/TODO/154 M4).
- **A heading is read rather than dropped** (Chris, 2026-08-16). See M1.
- **A title takes the title rules, and not the sentence caps.** A 20-word cap
  never fires on a title.
- **The archive's titles are counted and never gated.** A landed plan is a
  record. **`tools/titles.mjs` gates them instead**, and that landed before this
  item ran.
- **A section heading is a label** (Chris, 2026-08-16). See "What landed".
- **The gate reads the whole index** (Chris, 2026-08-16). See "What landed".

## Open questions

- **Does `README.md` join the list?** `CLAUDE.md` excludes its opening, which is
  Chris's own writing in the first person. The rest of the file is 28,000
  characters of prose. **Recommendation: leave it out of M3.** Decide it as its
  own item, with a rule for where the opening ends.
- **Do the player-facing pages ever join?** No. `CLAUDE.md` excludes the manual,
  `index.html`, the briefing and the novella, on Chris's call of 2026-08-12.
  This item does not re-open that.

## Watch out for

- **`docs/DEVLOG.md` and `docs/TRAINING-LOG.md` are records.** They are out of
  scope, and they must stay out. docs/TODO/141 recorded that both name
  `CLAUDE.md` six more times and are deliberately untouched.
- **A quotation inside a rule document is common.** `docs/PROCESS.md` quotes
  Chris four times, and `CLAUDE.md` quotes him twice. The reader must drop a
  block quotation, or the gate asks for a falsification.
- **`docs/DAMAGE-PATHS.md`'s table is load-bearing.** `test/damage-paths.test.ts`
  reads it. A reader that treats a table row as prose invites an edit that
  breaks a test.
