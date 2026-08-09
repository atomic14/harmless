# 1. Plan

GitHub is the public inbox, not the queue. Triage each issue against the README,
the product that currently ships and the code that actually runs. Record one
disposition on the issue:

- **planned** — accepted, but not the current execution item;
- **needs information** or **needs investigation** — the outcome is not yet
  understood well enough to plan;
- **declined**, duplicate or already fixed — close it with the reason;
- **in progress** — an executable plan is the current queue item and work has
  started.

An issue is evidence, not a specification. One issue may become several
milestones; several issues may have one root; some should produce no TODO at
all. Do not copy the GitHub inbox into a local list.

Pick the next accepted outcome. Explore read-only and frugally: targeted
searches and the specific files the change touches, not directory sweeps. The
output is a numbered plan doc in `docs/TODO/` in the house shape
(Kind/Severity/Size · Where we are · What to do · Decisions already made · Open
questions · Watch out for) plus **Verification** — the evidence that will show
the change works and plays right, named before the code exists, tiered to the
change (see step 3). Milestones over ~40 tool-turns of work get split in the
plan itself.

Answer open questions in the plan; one left open is a decision delegated.
Chris's decisions land in "Decisions already made" and are not relitigated.

When a GitHub issue supplies the work, put `**GitHub:** #N` in the plan. When
that plan becomes the current queue item, label the issue `in progress` and add
a comment naming the numbered TODO. Partial overlap is mentioned in the issue
but does not change its status. Close the issue only when the promised outcome
has landed, or when triage decides not to pursue it.
