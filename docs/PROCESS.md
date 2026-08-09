# PROCESS — how a change gets made

The loop is: **plan → an agent builds it → verify → land**, and it is closed:
Claude runs it end to end. Chris's involvement is optional at the front (he
joins planning when he wants to shape a feature) and pull-based at the back
(he plays the live site when he feels like it, and anything that feels wrong
becomes an issue, which re-enters the loop). Nothing in the cycle waits on
him.

**One feature in flight at a time.** Most changes here touch the same combat,
threat and save code, so parallel features would collide in the merge and
confound the verification. Features queue; the queue is `docs/TODO/` plus the
open [GitHub issues](https://github.com/atomic14/harmless/issues).

## 1. Plan

Pick the next piece of work from the queue. Explore the code read-only,
establish what is actually there, decide the design. The output is a numbered
plan doc in `docs/TODO/`, in the shape the existing entries use
(Kind/Severity/Size · Where we are · What to do · Decisions already made ·
Open questions · Watch out for), plus one section this process requires:

- **Verification** — the evidence that will show the change works *and plays
  right*, named before the code exists. Which gates, which measurements, at
  what sizes, and — for anything that changes how a fight or an encounter
  feels — which seeded trainer A/B, which campaign rows, and what Claude
  should fly in the browser and judge it against. Writing this first is what
  stops the evidence being chosen to flatter the finished code.

Chris can join this step to set direction; when he does, his decisions land
in "Decisions already made" so they are not relitigated downstream. When he
doesn't, Claude decides and the doc says so.

## 2. Implement — a background agent

One plan doc is one handoff, on its own branch or worktree — and **one agent
at a time, full stop** (Chris, 2026-08-09): no parallel builders even on
disjoint files, and no scouts running beside a build. Work the supervising
session can do inline — reconnaissance, review, landing — it does inline. The agent's
definition of done is mechanical:

- CLAUDE.md followed in full — read `src/constants/` before starting, one
  home per rule, module headers maintained.
- New code comes with tests, and every new gate is deliberately broken once
  to prove it goes red.
- `npm run build` (lint + tests), `npm run elite-a` and `npm run campaign`
  all green; `test/playtest.js` run when gameplay is touched.
- A code-review pass over the diff before it is offered up.
- Commit per milestone, message saying what changed and why.

The supervising session watches progress but does not improvise: a question
the plan doc does not answer is settled in the plan doc first, so the
reasoning is recorded where the next person will look.

## 3. Verify

Correctness is the machine gates above. Feel is evidence, gathered per the
plan doc's Verification section and recorded in it:

- **Seeded A/B in the combat trainer** — the same fight flown against the old
  and new build, differenced. The trainer refuses to difference two records
  that are not one fight flown twice; that discipline is the method.
- **The campaign at two sizes** — a balance number decides nothing until it
  gives the same answer at both (CLAUDE.md: read the set, not the sample).
- **Claude flies it** — in the real browser, against the criteria the plan
  doc stated. Good for whether an encounter reads right and paces right;
  weaker on split-second dogfight feel, and the doc should say which kind of
  judgement it is leaning on.
- **The human-shape bands** — where a recorded human fight has pinned the
  shape of a good fight (docs/TRAINING-LOG.md: pirates rarely lined up, and
  landed most of the shots they took), that shape is asserted as a band.
  A change that wins every measurement by turning the fight into a turret
  goes red here. These bands are the standing defence against the failure
  this project has already met twice.

The known limit, stated once: every bot-flown measurement in this project's
history was shaped by the bot, and Claude flying is a better proxy than a
script but is still not Chris's hands. The bands and the issue channel are
the mitigation, not a proof. A verification that fails is a finding, not an
obstacle — it goes back to step 2 with the evidence attached.

## 4. Land

Merge to main; Cloudflare deploys from it (a commit that fails lint or tests
fails the deploy build instead of shipping). The plan doc gets its outcome
and the `docs/TODO/README.md` index is updated. A change that retunes the
core fight is flagged in the outcome, so Chris knows what to try next time he
plays.

## The human channel

Not a gate. Chris plays the live game when he likes and files an issue when
something feels wrong; the issue enters the queue like any other. His
verdicts are also the calibration data for the proxies above — when his
judgement and the bands disagree, the bands are wrong, and fixing them is a
feature like any other.
