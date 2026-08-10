# TODO — active plans

Only executable, unfinished plans live at this level. `QUEUE.json` is their
execution order; the human index below must agree with it.

GitHub is the public inbox and is not mirrored here. When an issue becomes an
accepted plan, the plan links back to it. Historical detail stays out of the
active context:

- [completed/](completed/README.md) — landed work;
- [research/](research/README.md) — optional neural-training research;
- [retired/](retired/README.md) — superseded, rejected or consolidated plans.

## Execution queue

Four plans. In order; `QUEUE.json` agrees. One came out of the GitHub inbox on
2026-08-10 and one out of the first real flight the same day — once 121's test
mode and 124's quit key made one possible. The other two came from Chris reading
what 122 and 123 had just shipped: who is supposed to FIND these keys, and does
bribing a policeman touch your Character? It does; nothing says so.

121 landed before them: ⇧T at the station is the door onto `GameState.cheat`,
twenty levers are behind it — fuel, missiles, credits, legal status, Character
and a fit-out that takes equipment OFF, which no shop in the game can — and the
jump stops asking about fuel. 124 gave the cockpit a way out: P then Q gives up
a flight and puts you back at the station autosave you launched from.

The GitHub inbox is empty of untriaged work: **#22** is the only plan below with
one, labelled `planned` with its disposition on the issue. #18 closed with 121,
#20 with 122, **#21 with 123**. 126, 128 and 129 have no issue — one came out of
a flight, the other two out of what that flight's fixes still do not tell a
pilot.

**That flight found six things.** Two were bugs and are fixed (`1067e87`):
jettisoned cargo landed inside your own scoop reach, so pressing Y dumped a
tonne and collected it again one frame later; and every note of the docking
waltz decayed to silence across its own length, so the theme played as blips.
One was already planned and has now landed (bribing a Viper is 123). One was a
finding recorded on 122 and landed with it: being scanned makes you an Offender,
police hunt Fugitives, so the Viper that scanned you carried on patrolling with
nothing on the console to say why. The remaining two are 126 and 127 below —
and 128 and 129 are above both, because the keys those fixes added are still
unadvertised at the moment they matter, and what pressing one costs your name is
still invisible after it is paid.

122 and 123 landed before these two. A patrol closing on a dirty hold now says
**POLICE PATROL CLOSING** for the 1,800 units before it can read you, and the
scan that follows says what it cost — the record, and who comes for one —
instead of leaving the world to shrug. **O** dumps a tonne of the illegal cargo
specifically, which the ordinary dump key could not reach without throwing the
whole run overboard first, and **L** offers the man money instead: the scan does
not happen, or a Viper already shooting breaks off, and neither touches your
record while both cost your name. He can also refuse and report you, less often
the worse your name already is.

1. [ ] [128 — the cockpit never says what to press](128-the-cockpit-never-says-what-to-press.md)
   · no issue — asked by Chris · feature, medium. `POLICE PATROL CLOSING` names
   a problem and no answer: the keys that deal with it are in the `?` guide, the
   manual and the README, which are three places you are not looking while a
   Viper closes on your narcotics. A prompt line of its own says what a key can
   do about what is happening right now, priced — `L PAY 141.0 Cr` — for every
   moment a key is the answer. It carries a `Command`, never a letter: the
   label comes from the binding table, which also fixes the two messages that
   hand-write one today (`world-step.ts:550`, `game.ts:611`) and lie the moment
   anything is rebound. First, at Chris's call: a feature nothing points at is a
   feature nobody finds. **M1 landed** (`3537e4a`): the closing patrol's two
   answers, priced from the functions the keys actually charge. M2 (the other
   five moments, and the prompt naming the name as well as the money) and M3
   (the scan that bans a hard-coded key in a message) remain.
2. [ ] [129 — your name changes and nothing says so](129-your-name-changes-in-silence.md)
   · no issue — asked by Chris · feature, small. Seven deeds move `disrepute`
   and the only surface for the result is the word on the status screen, so a
   pilot crosses Honest → Dubious → Dodgy in silence and a bribe's real price is
   invisible at the moment it is paid. `characterName` already names the rung;
   M1 says it when it changes, queued behind the line that caused it the way
   122's verdict is, and says it on the way DOWN too — the decay has never had
   any feedback at all. M2 is the `DISREPUTE_BRIBE` value, and it is
   deliberately empty until Chris has flown it: make it visible before retuning
   it.
3. [ ] [127 — the survivor is handed over without asking](127-the-survivor-is-handed-over-without-asking.md)
   · **#22** · feature, medium. You scoop someone out of a capsule and docking files them
   with station medical in the same breath as resetting your shields — no
   choice, no payment, no consequence. Chris: force the choice, and let it be a
   dirty one. M1 is the prompt and the decent answer; M2 sells them at the
   station's own Slaves price or takes a bribe to let them go, priced against
   the Character ladder 96 built; M3 is the law's half. Ahead of 126 because it
   is the one that gives that ladder something to say. #22 and the flight asked
   for it separately and differ: the issue wants two options and says the legal
   status must move, the flight added a third option and did not — so between
   them the law's half is decided rather than deferred.
4. [ ] [126 — the docking computer turns the ship without flying it](126-the-docking-computer-flies-by-fiat.md)
   · no issue — found in flight · bug, medium. It writes `player.quaternion` through a shortest-arc slerp
   instead of producing a `FlightDemand`, so it pivots about an axis no stick
   can produce, never writes the rates the HUD reads, and obeys its own turn
   limit rather than the hull's. Two file headers already claim otherwise.
   `pitch-roll-steer.ts` is the vocabulary it never used. Last because docking
   is the hardest thing in the game and this aid must still thread the
   letterbox — the fix has to be measured, not asserted.

96 landed before all of these: the Character label drives the world now, but
`DISREPUTE_HEAT`, `COURTESY_RATE` and `HERMIT_FAVOUR` are unflown starting
values. 121's CHARACTER lever is the cockpit that settles them; 123 gave the
ladder its first thing to decide — how often a policeman takes your money — and
127 is the first deed worth spending it on.

**A playtest is coming** (Chris, 2026-08-10), and two of the plans above are
waiting on it rather than on an argument: 129 M2 is the `DISREPUTE_BRIBE` value,
and the three numbers 96 left unflown are the same flight's business. Nothing in
the character system should be retuned before somebody has seen it work — which
is what 129 M1 is for.

## Backlog

Not executable yet. In priority order; promoting the head is what makes the
next execution item, once it has a plan doc.

- [ ] 118 — The bloom and the pixel-ratio clamp are still written out twice
      — `(0.55, 0.5, 0.15)` and `min(devicePixelRatio, 2)` are byte-identical
      in `engine/render-stack.ts` and `viewer/stage.ts` (the clamp again in
      `encyclopaedia/chart.ts`). docs/TODO/93 tried to take these and backed
      out: their home is `src/constants/`, and putting them there makes the
      catalogue's duplicate-value policy demand `@rule` ids on nineteen
      unrelated constants across ten modules, because 0.5 and 2 are popular
      numbers. That policy call is the actual work and it is not a colour
      question. Needs a plan doc before it is executable.
