# 1. Plan

GitHub is the public inbox. It is not the queue. Triage each issue against three
things: the README, the product that ships today, and the code that runs today.
Record one disposition on the issue:

- **planned** — accepted, but not the current execution item;
- **needs information** or **needs investigation** — nobody understands the
  outcome well enough to plan it yet;
- **declined**, duplicate or already fixed — close the issue with the reason;
- **in progress** — an executable plan is the current queue item, and the work
  started.

An issue is evidence. It is not a specification. One issue can become several
milestones. Several issues can have one root. Some issues must produce no TODO
item at all. Do not copy the GitHub inbox into a local list.

Pick the next accepted outcome. Explore read-only, and explore frugally: use
targeted searches and open the specific files that the change touches. Do not
sweep a directory. The output is a numbered plan doc in `docs/TODO/`. It follows
the house shape (Kind/Severity/Size · Where we are · What to do · Decisions
already made · Open questions · Watch out for). It also has a **Verification**
section: the evidence that will show that the change works and plays right. Name
that evidence before the code exists, and tier it to the change (see step 3).
Split a milestone of more than about 40 tool-turns in the plan itself.

Answer each open question in the plan. A question left open is a decision that
you delegate. Chris's decisions land in "Decisions already made". Do not
relitigate them.

When a GitHub issue supplies the work, put `**GitHub:** #N` in the plan. When
that plan becomes the current queue item, do two things: label the issue
`in progress`, and add a comment that names the numbered TODO item. Mention a
partial overlap in the issue, but do not change the status of the issue for it.
Close the issue only after the promised outcome lands. Close it also when triage
decides not to pursue it.
