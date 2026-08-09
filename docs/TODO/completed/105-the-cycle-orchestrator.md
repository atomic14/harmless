# 105 — The cycle orchestrator: a deterministic script runs the loop

> Completed plan. Archived from the active queue.

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

## Completion (2026-08-09)

Built and reworked once after an audit review of the prototype found its
guarantees were prompts, not enforcement. Now mechanical: closed tool lists
per role (verifier is Read/Grep/Glob + permission-mode plan, diff embedded
so it needs no Bash), no session persistence, per-worker dollar caps,
milestones with `[scope:]`/`[tests:]` tags enforced by the deterministic
checks, gate tiers derived from the diff per PROCESS.md, rounds consumed
only by fixers that ran to completion, interrupted runs resuming at the
checks. `tools/cycle-lib.ts` + `tools/cycle.ts`; `test/cycle.test.ts`
drives the machine against a fake claude in a throwaway repo (happy path,
scope-only violation refused — mutation-proven after the first scenario
failed to isolate it — rework-to-acceptance, BLOCKED at the cap).

**Rework 2 (same day):** the audit reviewed the prototype and specified the
full controller; built as specified — queue-driven (`docs/TODO/QUEUE.json`,
validated), `next`/`status`/`flown`/`abort` commands, structured
preparation (checked-in `cycle-manifest` fence or one read-only planner,
hard validation, doc-checksummed), mechanical worker safety (acceptEdits
with allow/deny Bash families, never bypassPermissions; verifier
Read/Grep/Glob + plan mode + JSON schema), oversized diffs BLOCKED not
truncated, effective tier = max(declared, inferred floor), gameplay stops
at `awaiting_flown`, whole-item final verification with capped fixers,
deterministic landing (closer confined to docs/TODO/, checkbox + queue
updates, ff-merge, push failure resumable as `landed_local`), atomic
resumable state, worker death never consumes a round, run-wide caps. 43
machine tests against a fake claude; suite 3336/0. 103 carries the first
checked-in manifest.

**Live shakedown complete:** TODO 103 ran through the orchestrator end to end.
Its state reached `complete`; implementation, two verification passes, the
closer, index update, queue update, and fast-forward landing all completed.

## Outcome

Completed 2026-08-09. Commits `d8455ea`, `08ca6da`, and `91cc729` are the live
103 shakedown: implementation, recorded outcome, and deterministic landing.
The durable state records one implementer, two verifiers, one closer, no
surviving finding, and no error. The 43 machine scenarios cover the success,
scope-failure, retry, blocking, resume, queue, and landing paths; the later
oversized-generated-file fix is `3c67fda`.
