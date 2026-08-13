# Process

How an issue becomes landed work. `CLAUDE.md` owns the working rules that apply
inside every step. This file owns the order of the steps, and what each one must
produce.

## 1. Plan

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

## 2. Implement

One plan doc is one unit of work. One milestone is one commit. Work the
milestones in the order the plan gives them.

`CLAUDE.md`'s Working rules govern everything inside a milestone. This file does
not restate them.

Two things belong to the plan doc rather than to the commit message alone:

1. **What the plan did not have.** A milestone almost always finds something the
   plan did not predict. Write it into the plan doc. The commit message is read
   once; the plan doc is what the next reader opens.
2. **A milestone that turns out to be wrong.** Stop at the boundary. State what
   the evidence says. A decision to change the scope is Chris's, and it lands in
   "Decisions already made".

## 3. Verify

**The gates always run**, and they are `npm run check`. That one command is the
lint, the suite, the size ceilings, `constants:check`, `palette:check` and the
three generator drift checks. `npm run prebuild` runs it, so a build cannot skip
it.

**A gate has no warning level.** It passes or it fails. `constants:check` used to
print warnings and exit 0, which made "zero warnings" a standard nobody held: the
count was visible only to whoever had run the tool before their own change
(Chris, 2026-08-13: *"warnings should be errors - we should not allow warnings to
build up"*). Both of its warnings are errors now, and the level is gone from the
type so a new check cannot quietly reintroduce one.

A fatal check must be answerable in the source. Both of those are: `@rule` gives
two equal values separate identities, and `@domain` records that a person argued
a constant's owner against the token heuristic that guessed otherwise.

**The tiers are what runs BEYOND the gates**, and the plan names them before the
code exists:

| the change touches | also run |
| --- | --- |
| prose, comments or a plan doc | nothing more |
| prose in `src/constants/` | `npm run generate:constants` FIRST |
| the released ship or combat data | `npm run elite-a` |
| a rule that changes how a fight goes | the probe that owns the subsystem |
| the economy, or a career-long balance | `npm run campaign`, at two sizes |

The second row catches the case that looks like the first one. A doc comment in
`src/constants/` is the `Purpose` column of `CATALOG.md`, so an edit to the prose
alone still leaves the catalogue stale, and `constants:check` fails. Regenerate
before the gates, not after them.

`npm run elite-a` is a fast named subset, and it is deliberately NOT part of
`npm run check`, because `npm test` already runs every assertion inside it
(docs/ELITE-A.md). The probes are the measurement a balance change answers to:
`survivability`, `flight-probe`, `aim-probe`, `ram-probe`, `gap-probe`,
`defence-probe`, `dock-probe` and `dock-traffic`.

`CLAUDE.md`'s Validation rules apply here and are not restated: a new gate must
be proved able to fail, and a sampled number must be checked at two sample
sizes. Step 1's Verification section is where you promise both.

## 4. Land

Five pieces of bookkeeping. The first four keep the active context small. The
fifth keeps the public inbox true.

1. Record the outcome in the plan doc: what landed, what the measurements say,
   and what the work found that the plan did not have.
2. Remove the number from `docs/TODO/QUEUE.json`.
3. Remove the entry from the queue in `docs/TODO/README.md`. Add what landed to
   the dated section below it.
4. Move the plan doc to `docs/TODO/completed/`, and add its line to
   `docs/TODO/completed/README.md`.
5. Close the GitHub issue. Then **remove its disposition label**.

### The disposition label is the queue's state, not the issue's history

Step 1 puts one of four labels on an issue: `planned`, `in progress`,
`needs information` or `needs investigation`. Each one describes where the QUEUE
holds the item. A closed issue is in no queue, so the label stops being true the
moment the item lands.

Nothing took those labels down until 2026-08-13. Thirteen closed issues carried
one, as far back as #7, and two of them still said `in progress`. That is not
untidiness. `in progress` on a closed issue is false, and a `planned` that never
comes off cannot answer "what is planned?", which is the only question the label
exists for.

`bug` and `enhancement` are different, and they stay. They say what the issue
WAS, and that does not stop being true.

`QUEUE.json` and the human index must agree afterwards. Commit by milestone;
`CLAUDE.md` owns what a commit message must say.

## The human channel

**The playtest reports; it does not block** (Chris, 2026-08-11: *"do not block
things on my playtest, use sensible default values"*). Chris flies the live game
when he likes. What he finds becomes a GitHub issue, and an issue enters triage
at step 1. It does not enter the queue directly.

His verdict is still the only answer to the questions no probe reaches — whether
a fight is FUN, and whether a consequence reads as a mechanic rather than as a
bug. When his judgement and a bot-flown number disagree, the number is the thing
that is wrong. To fix the measurement is then a feature like any other.
