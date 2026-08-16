# 165 — A citation that names nothing

**Kind:** defect · **Severity:** medium · **Size:** small · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** none — found by the sweep of
2026-08-16

## Where we are

**The repository cites a plan document 1,096 times.** The form is
`docs/TODO/<number>`, and the citations name 99 distinct plans. That is the most
common cross-reference in the tree, ahead of the invariant number.

**Three of those numbers resolve to nothing.** No file under `docs/TODO/`,
`completed/`, `research/` or `retired/` carries them.

### 68 — deleted, and cited from `src/`

docs/TODO/68 was 127 lines, and its slug is `a-vocabulary-of-tactics`. Commit
6045fcd deleted it on 2026-08-09, from the active directory. Seven live
citations point at it, and one is production source:

| file | line |
| --- | ---: |
| `src/game/break-off.ts` | 140 |
| `test/break-off.test.ts` | 275 |
| `test/npc.test.ts` | 352 |
| `test/selection.test.ts` | 119 |
| `test/tactic-choice.test.ts` | 5, 103 |
| `test/tactics.test.ts` | 6 |

`break-off.ts:140` reads: *"TWO WORDS SINCE docs/TODO/68: the tactic, then the
leg."* A reader who wants to know why the readout says two words has nowhere to
go.

### 81 — one number, two plans, both gone

Number 81 carried `81-live-picker-cannot-name-attack-run.md` and
`81-two-rows-both-say-they-are-what-ships.md`. Both are gone.
`test/brain-names.test.ts:110` still cites the number, and so does
`docs/TODO/completed/87-three-checks-that-restate-their-own-implementation.md`
on line 105.

### 147 — never committed at all

Git holds no `docs/TODO/147-*` file in any commit. The number is still recorded
as landed. `docs/TODO/README.md:587` says: *"**147** — the station header takes
as many lines as it has orders."*

**And a later plan leans on it.**
`docs/TODO/completed/162-one-word-that-means-five-things.md` cites it twice. Line
140 reads: *"docs/TODO/147 settled that a station header takes as many lines as
it has orders."* Line 306 names it beside 157 as the pair that already removed a
constraint.

So 162 rests a decision on an argument that no reader can open.

**`docs/PROCESS.md` step 4 already forbids this.** Item 4 of "Land" says: move
the plan document to `docs/TODO/completed/`, and add its line to
`docs/TODO/completed/README.md`. The three failures above are three ways to skip
that step.

**The index and the archive agree with each other**, which is why nobody saw it.
`completed/README.md` lists exactly the numbers on disk. A number that never
reached either one is invisible to both.

**This is docs/TODO/151's defect in a second form.** 151 found 31 comments that
said *"@internal — driven by test/playtest.js"* when that file called eleven of
them. It built `tools/internal-claims.mjs`, and `npm run check` runs it. That
gate holds ONE comment form. The plan citation is the other form, and it is used
far more often.

## What to do

Two milestones. Write the gate first, because it says how big the repair is.

### M1 — a gate over the plan citation

`tools/plan-claims.mjs`, in the shape of `tools/internal-claims.mjs`. It reads
`src/`, `test/`, `tools/`, `train/` and `docs/`. For each `docs/TODO/<number>` it
finds, it asks whether a plan document carries that number, in any of the four
directories.

Report the number, the files that cite it, and exit 1 on any that resolves to
nothing.

**Match the number and not the slug.** A plan document is renamed by its own
milestones, and a citation names the number alone. `internal-claims.mjs` matches
a path, because a path is what that comment form carries. This form carries a
number.

**Read a comment run whole, as `internal-claims.mjs` does.** A citation wraps
across two lines of a doc comment. 151 recorded that a line-at-a-time first
draft found 22 of 28 paths and dropped six in silence.

**Skip `.claude/worktrees/` and `.cycle/`.** Both are gitignored scratch. A
stale worktree holds a full copy of the tree, and it cites numbers that its own
branch archived.

Add it to `npm run check`.

### M2 — the three numbers

Each of the three needs a different answer, and only Chris can settle 147.

1. **68 and 81 are recoverable.** Both are in git history. Restore each file
   into `docs/TODO/completed/`, and add its line to `completed/README.md`.
2. **147 is not recoverable.** No commit holds it. See the open question below.

## Verification

The gates always run: `npm run check`. The tier table puts a tool and a
documentation change at "nothing more".

**Prove the gate can fail**, in the three shapes that actually occurred:

1. Cite a plan number that no file carries, from a comment in `src/`, and watch
   the gate go red. **Do not write that citation into this document.** The gate
   reads `docs/`, so a broken example here is a broken citation there.
2. Move one restored plan document out of `completed/`, and watch it go red.
3. Split a real citation across two lines of one comment, and confirm that the
   gate still finds it. That is the failure 151 records, and a gate that misses
   it is worse than none.

**Then report the count**, as `claims:check` does: the number of citations, the
number of distinct plans, and zero unresolved.

## Decisions already made

- **The gate matches the number, not the file name.** See M1.
- **The archive is the remedy for 68 and 81.** Git holds both, so nothing is
  rewritten from memory.

## Open questions

- **What replaces 147?** The plan document does not exist and cannot be
  recovered. Three answers are possible, and the choice is Chris's.
  1. Write the record from what survives. `docs/TODO/README.md:587` holds a
     paragraph, and 162 holds the two claims that cite it. That is enough for a
     short outcome-only document, and it is honest if it says so at the top.
  2. Rewrite the two citations in 162 to name the RULE rather than the plan.
     162 would then say what the station header does, and cite nothing.
  3. Leave 147 out, and give the gate a short allowlist that names it.
  **Recommendation: 1.** A number the index records as landed needs a file. An
  outcome-only record that states its own provenance loses nothing, and it keeps
  162's two citations true.

## Watch out for

- **Do not renumber anything.** `CLAUDE.md` forbids it for an invariant, and the
  same reason holds here: 1,096 citations name these numbers.
- **A restored plan document is a RECORD.** The house prose style does not touch
  it (`CLAUDE.md`, under Prose). Restore the bytes. Do not convert them.
- **The gate must not read `docs/TODO/QUEUE.json`'s numbers as citations.** They
  are queue entries rather than references. Match the `docs/TODO/` prefix, which
  the JSON does not carry.
- **`test/ai.test.ts` scans source text for its own reasons.** Check that a new
  tool in `tools/` does not break one of its counts.

## What landed

**Both milestones landed on 2026-08-16.** `npm run check` passes at **4,715
assertions**, down 6, and every one of the 6 belongs to docs/TODO/81 below.
`constants:check` reports 387 exports and 76 rule ids, unchanged. No game rule
moved.

**`npm run plans:check` is the gate, and it is in `npm run check`.** It reports
**1,177 plan citations naming 106 plans of 151, 0 unresolved.**

**THE GATE FOUND MORE THAN THE PLAN DID, AND THAT IS THE POINT OF WRITING IT
FIRST.** The plan named three numbers. The gate found a fourth defect of a
different shape, and it came from a check the plan did not ask for.

**The extra check is the exact path.** Where a citation carries a whole file
name rather than a bare number, the file itself is checked.
`completed/90-one-home-for-every-constant.md` cited
`90-constants-survey.md` under `docs/TODO/`. The number resolves and the path does not:
that document moved into `completed/` and the citation beside it did not follow.

**That check has one false positive, and it is worth knowing.** It cannot tell a
citation from a sentence about where a file USED to be. This plan's own
paragraph about 68 named `68-a-vocabulary-of-tactics.md` under `docs/TODO/`, and meant the
active directory, before the deletion. The remedy is the item's own decision:
name the number, and put the location in words.

**THE GATE CANNOT BE DESCRIBED IN ITS OWN EXAMPLES, AND IT PROVED THAT TWICE.**
The first draft of this outcome named every broken citation it had just
repaired. The gate then went red on eight of them, across this document,
`docs/TODO/README.md` and the completed index. A prose file is read exactly like
a comment. **The remedy is the item's own decision, written down again**: name
the NUMBER when you mean a plan, and split the prefix off a file name when you
mean a path. `90-constants-survey.md` under `docs/TODO/` says the same thing and
cites nothing.

**THE GATE ALSO FAILED ON ITS OWN PLAN DOCUMENT.** Verification step 1 said to
cite a number that no file carries, and watch the gate go red. The gate reads `docs/`, so that
sentence WAS a broken citation. The step is reworded above, and the lesson is
general: a gate over prose is read by itself.

### The three numbers

**68 landed, and went to `completed/`.** `src/game/tactic-choice.ts` rolls a
tactic per ship, and `describeFlight` reads two words. The plan was deleted
rather than moved. Its index line says plainly that it is written from the plan
and from the code that runs, because the document carries no outcome.

**81 carried TWO plans, and the plan above did not know that.** They needed
different answers.

1. `81-two-rows-both-say-they-are-what-ships.md` is **superseded**, and it is in
   `retired/`. Its subject was `pirate-attack-g3`, whose row said *"THE FIGHT
   THE GAME SHIPS"* after that stopped being true. Neither the row nor the
   sentence is in `brain-names.ts` today. The defect went with the roster.
2. `81-live-picker-cannot-name-attack-run.md` was **never actioned**, and every
   word of it was still true. **Chris's call on 2026-08-16 was to fix it inside
   this item**, and it is in `completed/` with its outcome filled in. Both
   citing sites — `test/brain-names.test.ts` and `completed/87` — described it
   as an open defect, and one of them held it steady with an assertion.

**147 is allowlisted in the gate, on Chris's call.** The plan recommended a
reconstructed record. He chose the third answer instead: name the number in
`tools/plan-claims.mjs`, with the reason beside it. Nothing is reconstructed
from memory, and 162's two citations stay exactly as they were written.

**THE ALLOWLIST GUARDS ITSELF IN BOTH DIRECTIONS**, because an exception is the
same defect this item is about. A number that GAINS a document fails, because
the exception is then a lie. A number that nothing CITES fails too, because the
exception then hides nothing.

### The gate, proved able to fail

Four ways, and the plan asked for three:

1. a number no plan file carries, cited from `src/game/break-off.ts` — red,
   and the report names the file and the number;
2. one restored plan moved back out of `completed/` — red, on all 9 citations;
3. **a citation split across two lines of one comment — still found.** That is
   the failure docs/TODO/151 records, where a line-at-a-time reader dropped six
   of 28 paths in silence;
4. the allowlist, in both directions: an entry for 90, which has a document, and
   an entry for 913, which nothing cites. Both red, and each says which way it
   is wrong.

### What the gate reads, and what it does not

**It reads `src/`, `test/`, `tools/`, `train/`, `docs/`, `CLAUDE.md` and
`README.md`.** The plan named the five directories. The two root files are an
addition: `CLAUDE.md` carries the citations read at the top of every session. A
walk of the root would reach the gitignored scratch the plan warns about, so
the two are named one at a time.

**One citation in the archive carries a zero-width space on purpose**, to stop
that citation from wrapping a line. The reader strips zero-width characters, so
it resolves.

**`docs/TODO/QUEUE.json` is not read at all.** Its entries are bare numbers with
no prefix, and the gate matches the prefix. The file extension list excludes
`.json` as well, so the answer does not rest on one rule.
