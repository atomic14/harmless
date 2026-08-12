# 140 — The day is the one cost nothing shows

**Kind:** feature · **Severity:** medium · **Size:** medium · **Depends on:**
nothing · **Blocks:** nothing · **GitHub:** #24 — *"It would be good to see the
elapsed days in the status area. This would help when delivering contracts —
maybe even when looking at the chart we could see an estimated travel days?"*

**M1, M2 and M3 landed 2026-08-12.** M4 is what is left.

## What M1 did

The three readouts the plan named, and nothing else. The COMMANDER screen says
`Elapsed: N days` between `Fuel:` and `Cash:`; the docked menu's second info
line ends `· DAY N`; and the flight topbar has a fourth span, `#day-display`,
between the system name and the credits, so the day ticks in front of the pilot
at the one moment it moves.

No arithmetic was added anywhere. `commander.day` was already correct, and the
whole of M1 is that four painters now read it.

Two things came out of it that the plan did not predict:

1. **`test/screen-capture.ts` exists**, which is the ~40-line recording
   `document` the plan asked for. `test/ui.test.ts` already carried a private
   copy of the same idea for its docked-menu scan; that copy is deleted and the
   scan uses the helper, so there is one home.
2. **The leak in the plan's "Watch out for" was already there, and it bit.**
   `test/ui.test.ts`'s screen-host block installed a `document` carrying only
   `querySelectorAll` and never took it away — harmless until M1's new test
   built a real `Game` two files later, which asked that object for
   `getElementById` and killed the whole suite on the first frame. The block
   restores what it found now, and a check holds it to that. Restoring the leak
   by hand still kills the suite, which is how that gate was proven.

### Where M1's rules are pinned

- `test/elapsed-day.test.ts` — the two docked screens carry the day, it is read
  rather than written out as a literal, and `Elapsed` sits between fuel and
  cash. Plus the topbar's markup, because a missing id becomes an inert sink
  that paints nowhere in silence.
- `test/hud-binding.test.ts` — the frame is handed `commander.day`, and a real
  jump on a headless `Game` moves it by exactly `daysForJump`. The trap is
  staged there rather than described: the living galaxy's day is driven 500 days
  apart from the commander's, and the topbar still reads the commander's.

All five gates were proven to fail by breaking the rule each protects.

## What M2 did

Both chart info lines give the days now. The galactic chart says
`REORTE · 4.4 LY · 4 DAYS · Poor Agricultural · Dictatorship · TL 6`. The
short-range chart puts the same term inside its distance span, after the light
years.

`galaxy/navigation.ts` gained `oneJumpDays(from, to, fuelTenths)`. It gives the
number, or null when one jump is not the answer. The two null cases are the two
the plan named: the system you stand in, and a system beyond the fuel aboard.
`ui/screens.ts` gained one private `daysTerm` function for the words. Both
painters call it, so the two charts cannot word the same cost differently.

The plan named two special cases. A third one exists, and a shipped galaxy
contains it. Galaxy 4 puts Riusbequ and Quzaarar on one chart point, and
galaxies 5 and 8 hold two such pairs each. A jump between such a pair costs
`JUMP_DAYS_BASE` alone, so the term must read `1 DAY` and not `1 DAYS`.

### Where M2's rules are pinned

`test/chart-days.test.ts` paints both charts through `test/screen-capture.ts`,
then reads the info line back. It holds five rules:

1. Every system on both charts gives the cost the distance says. The sweep uses
   five home systems and all 256 systems of galaxy 1.
2. The system you stand in gets no days term.
3. A system out of range gets no days term, and still says OUT OF RANGE.
4. The fuel aboard decides the range. A neighbour with a days term on exactly
   enough fuel loses the term one tenth of a light year short.
5. The singular case reads `1 DAY`.

The expected number comes from `daysForJump` and the distance. It does not come
from `oneJumpDays`, which is what the painter calls. So a constant put inside
`oneJumpDays` fails rule 1, and that break was run.

All five rules were proven to fail. Each break removed one rule from the code.

`test/screen-capture.ts` gained `captureById`, and `capture` is one line of it
now. A chart paints its canvas under one id and its info line under another, so
the M1 helper could not reach the words.

## What M3 did

Beyond the tank the info line now says `TIBEDIED · 18.1 LY · EST 16 DAYS,
4 JUMPS · Poor Industrial · Feudal · TL 9 · OUT OF RANGE`. M2 said nothing
there, because one jump's cost is a lie about a journey one jump cannot make.

`src/galaxy/route.ts` is the new module and it holds one function.
`routeEstimate(systems, from, to)` gives days and jumps, or null. It is a
Dijkstra over full-tank edges, with a linear scan for the next system instead of
a heap. It draws no path and names no waypoint, so the pilot still chooses every
jump.

Cheapest in days first, then in jumps. The second key is not decoration: two
routes of the same length in days are not the same offer, because each jump is
another chance of a mis-jump. The tie-break has to be in the choice of the next
system as well as in the relaxation. A system settled on the wrong side of a tie
keeps its jump count for good.

The painter's `daysTerm` owns the words for both charts, as M2 left it. It asks
`oneJumpDays` first and `routeEstimate` second, so a jump the pilot can make now
is still priced as a certainty.

### Three things the plan did not have

1. **The map is much sparser than the estimate.** The plan predicted about 15
   neighbours per system and under 4,000 directed edges. Galaxy 1 has 843
   undirected edges and 6.6 neighbours per system. A search costs 0.17–0.23 ms,
   and `ChartScreen.redraw` runs on a change rather than on a frame, so the cost
   is invisible.
2. **Some destinations have no route, and shipped galaxies hold them.** No
   system in galaxy 8 is within a full tank of Oresrati; the nearest is Biered at
   8.2 LY. Galaxy 7 splits into a mainland of 229 systems and an island of 27.
   Galaxies 3, 4 and 6 each strand a small group as well. Galaxies 1 and 5 are
   whole. So `null` is an answer about the map, and both charts print no term
   for it.
3. **The numbers are bigger than the deadline half will like.** Sori is the
   costliest destination from Lave at 89 days over 21 jumps, and the furthest,
   Ribilebi at 98.3 LY, is 81 days over 19 jumps. A contract deadline is a few
   tens of days, so M4's verdict will read `TOO FAR` across most of the chart.
   That is the honest answer and not a defect.

### Where M3's rules are pinned

`test/route.test.ts` verifies the ANSWER rather than the algorithm. A second
shortest-path search written in the test would be the same idea twice, and two
copies of one idea agree on one wrong answer. So it applies the standard
certificate for a shortest path, over every system of galaxy 1 and galaxy 5,
from two homes in each:

1. **No edge improves it.** For every pair within a full tank,
   `days[to] <= days[from] + daysForJump`. A cheaper route would contain an edge
   that fails this. The same rule catches a priced system next to an
   unreachable one.
2. **Every answer is a real route.** Each system's cost is exactly its cost
   through some neighbour. Each leg costs at least one day, so those steps walk
   strictly downwards and end at the home system's zero. The jump count is
   checked against the same neighbours.

Four more rules sit beside it: a system one jump away costs exactly
`daysForJump` and one jump; the two stranded cases above give null in both
directions; a journey costs the same both ways; and the journey to where you
stand is 0 days and 0 jumps.

Six breaks were run and each was caught. A relaxation that never improves, an
answer one day too high, an edge budget of half a tank, a direction leak, and a
zero in place of null all failed the two certificate rules. **A lost tie-break
on jumps is caught by the symmetry check alone**, because the certificate reads
the search's own answers and they stay self-consistent in one direction.

`test/chart-days.test.ts` changed where the rule changed. M2's rule 3 said an
out-of-range system gets no days term; it now gets an estimate instead, and the
256-system sweep holds every one of them to it. Rule 4 gained the singular case:
one tenth of a light year short of a neighbour, the chart estimates `1 JUMP`,
because the pilot buys the fuel at the bay. A new rule says the estimate is the
same on an empty tank as on a full one. Three breaks were run: a painter that
estimates nothing, a plural that is never chosen, and an estimate priced on the
fuel aboard.

## Where we are

A jump spends three things: fuel, money and days. The chart prices two of them
and never names the third.

`commander.day` is the elapsed day count (`src/game/commander.ts:152`). It
starts at 0. Only two events move it. A jump adds `daysForJump(tenths)`
(`src/game/hyperspace.ts:107`), which is 1 day plus 1 day per 2.0 light years,
rounded up (`src/constants/jump.ts`). A mis-jump tow adds 3
(`src/game/game.ts:1544`). Nothing else in the game ages the commander — a
trade, a fight, a dock and a launch are all free.

The number is on screen in three places, and a pilot consults none of them at
the moment of the decision:

- the saves screen, one column per row (`src/ui/screens.ts:454`);
- the bulletin board keyline, plus days left per contract
  (`src/ui/screens.ts:1273`, `1296`);
- the docked menu, for the first accepted contract only
  (`src/game/station.ts:294`).

It is absent from the two screens the issue names:

- **the COMMANDER status screen** prints the system, the target, legal status,
  Character, fuel, cash, missiles, equipment, cargo, kills and rating —
  and no day (`renderStatus`, `src/ui/screens.ts:604`);
- **both charts** print light years and never days. The galactic chart's info
  line is `src/ui/screens.ts:920`. The short-range chart's is
  `src/ui/screens.ts:1081`. `daysForJump` already exists one import away, in
  `src/galaxy/navigation.ts:119`.

So a player who holds a contract due on day 34 stands on the chart, reads
`4.7 LY`, and cannot answer the only question they have.

### Why the deadline half needs more than one subtraction

`CONTRACT_RANGE` is `MAX_FUEL` (`src/constants/contracts.ts:20`), so a board
only offers destinations within one full tank **of the station that offered
them**. That guarantee dies the moment the commander moves or burns fuel. The
destination then needs two or more jumps, and no route search exists anywhere in
the codebase. I checked `galaxy/` and `game/screens/chart.ts`: `navigation.ts`
measures one hop and stops.

### One trap, found while reading

`ChartOverlays.day` is **not** the commander's day. It is the living galaxy's
day (`src/game/game.ts:267`), and the galaxy catches up by at most 60 days per
load (`src/game/game.ts:589`). A save left alone for a long time has
`living.day < commander.day` permanently. Trade-lane arrivals are stated against
`overlays.day` and must stay that way. Deadlines are the commander's clock, and
both chart painters already receive `c: CommanderData`, so nothing new must be
plumbed to get the right one.

## What to do

### M1 — put the day where the pilot already looks — **LANDED**

Three painters, one number, no new arithmetic.

1. **Status screen** (`renderStatus`, `src/ui/screens.ts:604`). Add
   `Elapsed: N days` between `Fuel:` and `Cash:`. That position is the
   argument: fuel and days are what a jump spends, and cash is what a market
   spends.
2. **Docked menu** (`renderDockedMenu`, `src/ui/screens.ts:85`). Add `DAY N` to
   the second info line, beside credits, fuel and missiles.
3. **Flight topbar.** `play.html:18` holds three spans: `#system-name`,
   `#credits-display`, `#condition`. Add a fourth, `#day-display`. Add `day` to
   `HudState` (`src/hud/hud.ts:58`). Set it in `hud-binding.ts` beside
   `credits` (line 191). Paint it in `Hud.update` beside the other two
   (`src/hud/hud.ts:274`).

The flight readout is the one that pays for itself: the jump happens in flight,
so the day ticks in front of the pilot at the moment it changes.

### M2 — the chart says what a jump costs in days — **LANDED**

Both info lines gain a days term: `LAVE · 4.7 LY · 3 DAYS · Rich Industrial
· Democracy · TL 8`.

The value is `daysForJump(distanceTenths(current, near))`. Two cases are not
that value:

- **the system you are in.** `daysForJump(0)` returns 1, because the base day is
  the jump itself. A system you are already in costs no days, so print no days
  term there.
- **a system out of fuel range.** One jump cannot reach it, so one jump's cost
  is a lie. M2 prints no days term. M3 replaces it with a real estimate.

### M3 — an estimate for anywhere, over more than one jump — **LANDED**

A new pure module, `src/galaxy/route.ts`. Dijkstra over the 256 systems. An
edge joins two systems within `MAX_FUEL`; its weight is `daysForJump` of that
edge. It returns days and hops, or `null` when the target is unreachable.

The graph uses a **full tank**, not the fuel aboard. Fuel costs money and buys
at a station; it costs no days. So a full tank is the honest edge length, and
the estimate does not degrade because the pilot is running low.

Cost is small. A 7.0 light-year radius covers about 6% of the chart, so a
system has roughly 15 neighbours and the whole graph is under 4,000 directed
edges. It runs once per cursor move.

The word ESTIMATE is earned, and the plan states why: `MISJUMP_CHANCE` is 0.09
(`src/constants/jump.ts:48`), and a mis-jump costs the 3-day tow. Over a
four-jump route the chance of at least one mis-jump is about 31%.

### M4 — the chart answers the contract question

1. **A marker.** Draw a destination you owe a contract to, on both charts, in
   amber. It joins the danger ring as a fact that is always on rather than an
   overlay `T` cycles — 111's one-picture rule governs the `T` overlays, and a
   commitment you accepted is a warning, not a view.
2. **A verdict on the info line.** When the cursor's system is a contract
   destination, add `DUE IN 6 DAYS · 3 DAYS AWAY`. Paint it red when the
   estimate exceeds the days left, and when the days left are already zero or
   fewer.
3. **The wording is a pure function** in a new `src/game/contract-eta.ts`, not a
   template literal inside the painter. That is what makes it testable — see
   Verification.

Days left is `k.deadlineDay - c.day`, which is what the board and the docked
menu already compute (`src/ui/screens.ts:1273`, `src/game/station.ts:299`).
Days away is M3's estimate.

## Decisions already made

- **Chris, 2026-08-12, on scope.** All three readouts, including the flight
  HUD; the chart shows travel days AND a deadline verdict; and this item goes to
  the head of the queue, ahead of 139 M3 and 138.
- **The topbar takes a fourth span.** `#topbar` is a flexbox with
  `justify-content: space-between` (`src/style.css:69`), so a fourth child
  spreads without a CSS change. The fallback, if it reads badly in flight, is to
  pair the day with the system name in the existing left span: both facts change
  only at a jump.
- **The route is a number, not a picture.** M3 reports days and hops. It draws
  no path and lists no waypoints. The pilot still chooses every jump, so the
  estimate stays an estimate rather than an autopilot.
- **Deadlines read `commander.day`. Lane arrivals keep `overlays.day`.** See the
  trap above.

## Open questions

None. The three that would have been open are answered above: the topbar
layout, the full-tank edge rule, and whether the route draws itself.

## Watch out for

- **`daysForJump(0)` is 1, not 0.** The system under the crosshair is the one
  the cursor rests on most.
- **The two day fields.** `living.day` and `commander.day` are both in scope in
  the chart painters. A deadline computed from the wrong one is correct for
  months of play and then silently wrong on an old save.
- **A test-only `document` leaks.** `test/run.ts` imports every test file into
  one Node process, and the painters branch on `typeof document === 'undefined'`
  (`src/ui/screens.ts:64`, `src/engine/inert-dom.ts:67`). A capture helper must
  restore the global in the same synchronous block that sets it.
- **Chart legibility.** The galactic chart already carries a fuel ellipse,
  lanes, 256 dots, price tells, danger rings, a crosshair, a target ring and a
  cursor. The contract marker is the ninth thing. If it does not read, it is the
  first thing cut.
- **`describeSystem` is already long** (`src/galaxy/galaxy.ts:125`): name, tech
  level, economy and government. That is why the day gets its own span and not
  that string.

## Verification

Tiered to the change. M1 adds a field to three painters; M2, M3 and M4 add
arithmetic, and arithmetic gets tests.

**M1.**
- `test/hud-binding.test.ts` gains a check that `HudState.day` equals
  `commander.day`, and that it moves by `daysForJump` after a real jump on a
  headless `Game` — the pattern `test/character-line.test.ts` uses.
- Prove the gate fails: pin the bound field to a constant and watch it go red.
- The HUD is a dumb painter and nothing reads its writes back
  (`src/engine/inert-dom.ts`), so the painted string is confirmed by flight, not
  by a test.
- New: `test/screen-capture.ts`, a ~15-line recording `document` stub, so
  `renderStatus` and `renderDockedMenu` can be rendered and their HTML asserted
  to carry the day. It restores the global immediately. Every later screen test
  can use it.

**M2.** A test that the info line's days term equals `daysForJump` for a sample
of systems, that the current system carries no days term, and that an
out-of-range system carries none either.

**M3.** `test/route.test.ts`:
- a route's days equal the sum of its legs' `daysForJump`;
- no cheaper route exists, checked by brute force over 2-leg alternatives;
- a one-jump target returns exactly `daysForJump`;
- an unreachable target returns `null`;
- the answer does not change when the tank is empty, which is the full-tank rule
  above.
- Two sample sizes, per CLAUDE.md: the check runs over galaxy 1 and galaxy 5.

**M4.** `test/contract-eta.test.ts` asserts the verdict as a function: a
comfortable deadline, a deadline the estimate misses by one day, a deadline
already passed, and a destination in the system you are standing in.

**Gates.** `npm run lint`, `npm test`, `npm run constants:check`. No new
constant is expected; `MAX_FUEL`, `CONTRACT_RANGE`, `JUMP_DAYS_BASE` and
`TENTHS_PER_JUMP_DAY` all exist and are all owned. If one is needed after all,
`npm run constants:find` runs first.

**Flight.** Chris flies it and confirms two things a probe cannot: that the
fourth topbar span reads well, and that the contract marker does not crowd the
chart.
