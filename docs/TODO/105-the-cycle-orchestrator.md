# 105 — The cycle orchestrator: a deterministic script runs the loop

**Kind:** tooling/process · **Severity:** high · **Size:** medium
**Source:** third-party usage audit, 2026-08-09. Chris adopted its design.
docs/PROCESS.md already states the operating model this script enforces.

## Where we are

The closed loop worked — six cycles landed on 2026-08-09 — but the
supervisor session accumulated 200k+ of history and agents reread giant
contexts to make single tool calls; the day hit the usage limit three
times. The fix the audit proposed: a deterministic script owns the workflow
state machine, and Claude sessions become short-lived workers.

## What to do

A script (`tools/cycle.ts` or similar, node-runnable like the repo's other
tools) that drives one TODO item through:

1. **Prepare** (deterministic): resolve TODO path, branch/worktree,
   starting commit, milestone list, allowed scope, targeted tests. One
   compact agent call only if the TODO needs interpreting into milestones —
   structured JSON back.
2. **Implement**: launch a fresh `claude` session (headless CLI) with ONLY
   the plan doc path, milestone, branch, acceptance criteria, constraints
   (no subagents; targeted tests; commit; stop at milestone; report <500
   words; tool-turn cap).
3. **Deterministic completion checks** (no model): new commit exists; tree
   clean; branch based on expected commit; required files/tests exist;
   targeted tests pass; no out-of-scope files changed. Failures become the
   rework brief.
4. **Verify**: a fresh read-only session receiving only the acceptance
   criteria, `git diff <base>...HEAD`, and test summary; returns
   `PASS | REWORK | BLOCKED` with findings JSON.
5. **Rework loop**: fresh fixer per round, findings-only brief; **hard cap
   two rounds** — a surviving finding stops as BLOCKED for Chris.
6. **Accept and advance**: record the accepted commit in external run
   state (a file under `docs/TODO/` or `.cycle/`), next milestone from that
   commit; after the last milestone, one whole-TODO review + the full gate
   tier, then merge before selecting another item.

## Watch out for

- The script is the durable orchestrator; git + the plan doc are the
  memory. No workflow state in any chat history.
- Respect PROCESS.md's tiers — the script picks the gate tier from what
  the diff touches, not "all gates always".
- The flown browser check stays a human-triggerable step the script can
  request but not perform.

## Verification

- One real TODO item driven end to end by the script (103 is a good
  candidate: small, mechanical, low-risk).
- Each deterministic check demonstrated failing (wrong base commit,
  out-of-scope file, failing targeted test) and producing a usable brief.
- The retry cap demonstrated: a forced surviving finding stops as BLOCKED.

## Outcome

(recorded when the cycle closes)
