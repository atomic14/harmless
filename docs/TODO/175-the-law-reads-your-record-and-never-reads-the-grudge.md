# 175 — The law reads your record and never reads the grudge

**Kind:** defect · **Severity:** medium · **Size:** medium · **Depends on:**
docs/TODO/173 · **Blocks:** nothing · **GitHub:** none

## Where we are

Two ships can attack a commander for two different reasons, and the game only
ever explains one of them.

**The RECORD is the first reason.** `lawTakesInterest` (game/law.ts) says police
hunt Fugitives and bounty hunters take an interest in Offenders. It reads the
legal status and nothing else.

**The GRUDGE is the second.** `isHostileToPlayer` (game/hostility.ts) also
returns true for a police ship or a hunter with `provokedByPlayer` set. That
flag is personal to one ship, and the record has nothing to do with it.

Both came out of the docs/TODO/173 investigation on 2026-08-17. Neither was in
scope there, and both are recorded in that item's outcome.

### The verdict names the record's pursuer, not the ship shooting at you

`recordVerdict` is assembled from `lawTakesInterest`, which is what stops it
promising a fight the rules will not deliver. Measured at Offender, it says
`LEGAL STATUS: OFFENDER — BOUNTY HUNTERS WILL ATTACK YOU`.

**That sentence is true about the record and silent about the sky.** A police
Viper the commander grazed is on her, and the line names bounty hunters. That is
the confusion in GitHub #35's own words: *"the police started attacking me."*

**docs/TODO/173 M1 already answers the player's question once.** The console now
says `POLICE SHIP HIT — AND NOW HE IS COMING FOR YOU` on the frame the grudge
starts. So a commander who reads her console is told. **The gap is everything
after that frame**, when she asks the console again and the record answers for a
ship it never read.

### The grudge has no exit a player would find

Measured on 2026-08-17: after sixty seconds of flight the flag still holds. With
the legal record put back to Clean by hand, `isHostileToPlayer` still answers
true.

**Three exits exist and none of them is discoverable.** A bribe buys one ship
out of one fight (`bribePolice`). Killing it works, and it costs a Fugitive-grade
offence. Docking ends it, because a launch respawns the sky.

**The fine is not an exit, and that is the sharp edge.** A commander pays at the
station and reads `YOUR LEGAL STATUS IS CLEAN AGAIN`. She launches into the same
system. A Viper that the launch did not respawn still shoots at her. Every other consequence
in this game can be worked off or paid off.

### What docs/TODO/158 decided, and what it did not

158 made the truce end for a commander who shoots first, `on provokedByPlayer`.
Its reason is exact: *"a station that hid a Fugitive from the law would be the
one place in the galaxy a record stopped costing anything"*, and a commander who
shoots inside the truce must not get a free firing position.

**That argument is about the TRUCE, and not about the flag's lifetime.** 158
never asked how a grudge ends. Nothing in its record decides this item either
way. **So this is a question, and Chris has to answer it.**

## What to do

Three milestones. M1 measures, M2 is the console, M3 is the rule and it waits.

### M1 — measure what a grudge actually costs a career

Fly the real game and answer four questions:

1. how long a provoked Viper stays on a commander who runs;
2. whether it follows her to the station slot;
3. whether it is still there after a dock and a launch, in the same system;
4. how many Vipers a single stray shot puts on her, after
   `callStationDefence` fires.

**The fourth is the one that decides the severity.** `launchStationDefence` sets
`provokedByPlayer` on every Viper it launches. So one graze may buy a fleet
rather than an enemy, and each of those carries its own permanent grudge.

**Report the numbers before either remedy is written.** A rule changed on a
resemblance is what docs/TODO/173's own record warns about.

### M2 — the console answers for the sky, not only for the record

Give a commander a way to ask "who is on me, and why?" and get a true answer.

**The condition light already knows.** `hostilesNear` (game/hostility.ts) reads
the same rule that decides who shoots. So the fact is in the tree, and nothing
says it in words.

**Do NOT widen `recordVerdict`.** It is the one home of what a moved RECORD
says, and it is assembled from `lawTakesInterest` on purpose. A verdict that
also read the sky would be two rules in one sentence, and it would go stale the
moment the sky changed. **A second line is the honest shape**, said by whichever
rule owns "who is in this fight".

**Chris's console standard governs the words**, from 2026-08-16: *"2-3 lines
maximum on the console. More text as needed in the main UI"*, and *"if this was
the first time I saw this string — would I know what it meant."*

### M3 — an exit for the grudge, and it needs Chris first

**This milestone does not start until the Open questions below are answered.**
It changes a shipped rule about who shoots at the player.

The shape, once the answer is in: `provokedByPlayer` gains a way down that a
player can find. `payFine` is the obvious candidate, because it is the choice
the game already offers and already announces.

**Whatever the answer, keep one home.** `isHostileToPlayer` is the single rule
that six surfaces read (docs/TODO/158). An exit written anywhere else would give
the scanner blip and the ship two different opinions.

## Decisions already made

- **Chris asked for both halves on 2026-08-17**, in the list of small items that
  came out of docs/TODO/173.
- **`recordVerdict` is not widened.** It stays the one home of what a moved
  record says.
- **The truce still ends for a commander who shoots first.** docs/TODO/158
  decided that, and this item does not reopen it.
- **The offence for shooting a policeman on purpose stays.** docs/TODO/173
  decided that.

## Open questions

**Both are Chris's, and M3 waits on them.** M1 and M2 do not.

1. **Should a paid fine call off a Viper the commander provoked?** The case for:
   every other consequence has a way out, and a fine that leaves you hunted
   reads as a bug. The case against: a bribe already buys one ship out of one
   fight, at a price. A fine that did the same makes the bribe pointless.
2. **Should a grudge fade on its own?** The case for: a commander who breaks off
   and runs paid for the shot with the running. The case against: it makes a stray shot free if
   you simply fly away, and the sky then forgets faster than the player does.

**A third answer is "leave it".** M1's numbers may show that the grudge already
ends quickly enough in practice, in which case M2's line is the whole fix.

## Watch out for

- **`test/bribe-flight.test.ts`.** It pins the bribe as the exit that works. Any
  second exit must not weaken those assertions.
- **`test/station-truce.test.ts` and `test/hostility.test.ts`.** Both pin
  `isHostileToPlayer` directly, and M3 changes what it reads.
- **The scanner, the threat arrow, the condition light, the combat computer and
  the bribe key.** Six surfaces read one rule, and docs/TODO/158's whole point
  is that all six must agree.
- **`SNAPSHOT_VERSION`.** `provokedByPlayer` is saved NPC state. A field that
  gains a timer needs the `Object.assign`-onto-defaults argument that
  docs/TODO/173 M2 used, or a migration.

## Verification

The gates always run: `npm run check`.

**M1 is a measurement and lands no code.** Its output is numbers in this
document.

The tier table puts M2 at "nothing more". It puts M3 at "a rule that changes how
a fight goes", so M3 runs the probe that owns the subsystem.
**`defence-probe` is NOT that probe**, and docs/TODO/173 proved it: it loads no
trained weights and cannot fly the shipped defence. `survivability` and
`dock-traffic` are the two that fly a real fight, and both must be reported.

**A test file for each of M2 and M3**, driving the real `Game` under node, as
`test/lawful-hit.test.ts` does. The claims to hold:

1. a commander with a clean record and one provoked Viper is told who is on her;
2. ...and told it in words that name the ship rather than the record;
3. `recordVerdict` is unchanged, asserted directly, so M2 cannot drift into it;
4. whatever exit M3 adds, the six surfaces still give one answer;
5. ...and the bribe still buys exactly one ship out of one fight.

**Prove each gate able to fail, and each one alone.** For M2, delete the line.
For M3, remove the exit and watch only the exit's own claims redden.

## Outcome

### M1 — what a grudge actually costs

Flown through the real `Game` under node, on 2026-08-17. The probe was a
throwaway, and it landed no code.

**Q1 — THE FLAG NEVER ENDS, AND SHE OUTRUNS IT ANYWAY.** `provokedByPlayer`
still holds after 300 seconds of flight. The ship is alive, and it is still in
the fleet. Nothing despawns it. With the legal record forced back to Clean by
hand, `isHostileToPlayer` still answers true.

**At full throttle the range opens from 767 units to 112,065 over those 300
seconds.** So the grudge is permanent in the flag, and it belongs to a ship that
cannot catch her.

**Q2 — THE TRUCE DOES NOT COVER A PROVOKED SHIP, AND THAT IS 158's DECISION AT
WORK.** The measurement uses HUNTERS, because `truceHolds` covers pirates and
hunters alone. A police Viper would show nothing about this line.

| units off the port | unprovoked hunter | provoked hunter |
| --- | --- | --- |
| 0 | not hostile | hostile |
| 1,000 | not hostile | hostile |
| 3,000 | not hostile | hostile |
| 6,999 | not hostile | hostile |
| 7,001 | hostile | hostile |
| 12,000 | hostile | hostile |

**The control flips at exactly `STATION_TRUCE`**, which is 7,000. So the rule
under test is isolated, and the bypass is the one line that reads the flag. **A
provoked police Viper is hostile at the port for a second reason as well**, and
the police were never inside the truce.

**Q3 — A DOCK CLEARS IT, AND THIS PLAN'S "SHARP EDGE" IS FALSE.**
`Station.dock` calls `world.clearNpcs()` with no condition on it. Measured: one
ship in the sky before the dock and none after. The launch built nine fresh
ships, and not one of them carried a grudge.

**The fine works, and it was measured in the same flight.** It said
`FINE PAID: 25.0 Cr — YOUR LEGAL STATUS IS CLEAN AGAIN`. **So no Viper can
survive a dock**, and the case this plan built around `payFine` does not exist.
The plan contradicted itself: it listed the dock as an exit four paragraphs
earlier.

**THE SHARP EDGE IS REAL, AND IT HAS A DIFFERENT SHAPE.** A record also comes
down in flight, at five pirate kills (docs/TODO/160). That commander never
docked, so the sky is the sky she provoked. Q1 measured her case: the record
reads Clean and the ship still shoots.

**Q4 — ONE STRAY SHOT BUYS TWO TO THREE ENEMIES.** Measured over 40 seeds, with
the commander 4,000 units off the station and one laser hit on a policeman:

- the station launch adds 1 or 2 Vipers, at a mean of 1.48;
- 2 or 3 ships carry the grudge afterwards, at a mean of 2.48;
- every one of those ships is hostile.

Twenty-one seeds gave 2 and nineteen gave 3.

**SO THE SEVERITY IS LOWER THAN THIS PLAN ASSUMED, AND THE THIRD ANSWER IS
LIVE.** The Open questions offer "leave it" as a third answer. Two measured
facts support it, and the plan had neither. She outruns the ship. Any dock
clears the sky.

**What is left is narrow, and it is one case.** A commander who works her record
off in flight, and who does not dock, keeps every grudge she earned. The console
never tells her why.
