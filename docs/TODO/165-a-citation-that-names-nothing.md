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

`docs/TODO/68-a-vocabulary-of-tactics.md` was 127 lines. Commit 6045fcd deleted
it on 2026-08-09. Seven live citations point at it, and one is production
source:

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

1. Cite `docs/TODO/999` from a comment in `src/`, and watch the gate go red.
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
