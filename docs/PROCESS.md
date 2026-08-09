# PROCESS — how a change gets made

The loop is: **plan → an agent builds it → verify → land**, and it is closed:
Claude runs it end to end. Chris's involvement is optional at the front (he
joins planning when he wants to shape a feature) and pull-based at the back
(he plays the live site when he feels like it; anything wrong becomes an
issue and re-enters the loop). Nothing in the cycle waits on him.

**One feature in flight at a time, one agent at a time** (Chris, 2026-08-09):
no parallel builders even on disjoint files, no scouts beside a build. The
queue is `docs/TODO/` plus the open GitHub issues.

**Sessions are disposable workers; git and the TODO doc are the memory**
(audit, 2026-08-09). Workflow state lives in commits, plan docs and the
queue index — never in a long chat history. A session that grows past
~100k context stops at the next clean point, writes a checkpoint (commit
hash, remaining work, failures, exact next command — a few lines in the
TODO doc's Outcome-in-progress or the queue index) and hands off. Never
resume a 200k+ history to do new work.

## 1. Plan

Pick the next queue item. Explore read-only and frugally: targeted searches
and the specific files the change touches, not directory sweeps. The output
is a numbered plan doc in `docs/TODO/` in the house shape (Kind/Severity/
Size · Where we are · What to do · Decisions already made · Open questions ·
Watch out for) plus **Verification** — the evidence that will show the
change works and plays right, named before the code exists, TIERED to the
change (see step 3). Milestones over ~40 tool-turns of work get split in
the plan itself.

Answer open questions in the plan; one left open is a decision delegated.
Chris's decisions land in "Decisions already made" and are not relitigated.

## 2. Implement — one fresh agent per milestone

One plan doc is one handoff; a plan with several milestones hands each to a
FRESH agent that receives only: the plan doc, the branch/worktree, the
starting commit, the milestone's acceptance criteria, and constraints. The
agent:

- follows CLAUDE.md (constants discipline included — see its rule);
- **spawns no subagents, ever** — review is the supervisor's, not the
  builder's;
- uses TARGETED tests while working (`node --experimental-strip-types` on
  the affected test file), not the full build per edit;
- runs the milestone's tier of gates once, at the end;
- commits per milestone with a message saying what changed and why;
- stops at the milestone boundary or at ~40-50 tool turns, whichever comes
  first, with a checkpoint;
- reports back in **under 500 words** — evidence and detail go in the plan
  doc and commit messages, not the chat.

## 3. Verify — tiered, then land

**Tiers.** Docs/comments-only: lint. Tooling or test-side: build (lint +
suite) once. Anything touching `src/`: build + `elite-a`. Anything that can
change gameplay or balance: the above + campaign + the flown check. The
human-shape bands run inside `npm test`, so every tier from build up
already answers "did the fight keep its shape?".

**Review.** Inline supervisor review of the diff, or ONE fresh reviewer
given only the narrow diff and acceptance criteria — never both, and a
reviewer spawns no children. Two rework rounds per milestone at most; a
finding that survives both stops the cycle as BLOCKED for Chris.

**Flown checks** happen in a disposable browser context: DOM/console/
network assertions first, at most one or two screenshots, nothing carried
back into an implementation context.

**Feel evidence** for gameplay changes, per the plan doc: seeded trainer
A/Bs (one fight flown twice), the campaign read at two sizes, the bands,
and a flown check judged against stated criteria. The known limit, stated
once: bot-flown proxies are not Chris's hands; the bands and the issue
channel are the mitigation. A failed verification is a finding — back to
step 2 with the evidence.

## 4. Land

The supervisor merges to main (Cloudflare deploys from it), records the
Outcome in the plan doc — call chains, baselines, ledgers, deviations —
updates the queue index, pushes, and removes the worktree. A change that
retunes the core fight is flagged in the outcome so Chris knows what to
try next time he plays.

## The human channel

Not a gate. Chris plays the live game when he likes and files issues; they
enter the queue like any other. His verdicts calibrate the proxies — when
his judgement and the bands disagree, the bands are wrong, and fixing them
is a feature like any other.
