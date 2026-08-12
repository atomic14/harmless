# Browser play trials

The measurements a bot cannot take. CLAUDE.md's rule is the whole reason this
file exists: **prefer a fight a human flew to a bot-flown measurement**. A bot
misleads in both directions. Straight flight flatters a brain fitted to
freighters, and the defence policy evades superbly but shoots badly.

Fly everything below at `npm run dev` → http://localhost:5173/play. Nothing here
needs a console. `T` at any station opens the combat trainer, and the trainer
exports the whole record as JSON (clipboard, file, and `window.__simLog`).

**Nothing here can reach your career.** The combat trainer flies a clone of the
commander. It restores the entry snapshot when you exit
(`game/combat-sim-safety.ts`). If you drop to a console and fly the game
yourself, call `useHarnessSaves()` FIRST. It moves the whole page into a scratch
namespace, one way. Neither your typing nor the autosave of the running game can
then compute a real save key. There is nothing to back up and nothing to restore,
which is the point. A backup and a restore were not enough, because the autosave
runs every 20 seconds, and a tab left open overwrote the restore. See
docs/INVARIANTS.md invariant 3.

---

## TODO 29 — the trial list

TODO 29 changed three things that a human can feel and a harness cannot judge.
Fly each section. Record the numbers that the trainer prints. Note whether the
fight was FUN, which outranks every figure in it.

### 1. Threat: pirates now bite

**What changed.** A combat role now flies the hardest released build of its hull
that the source ever filed under that job. Before, it flew the pack's recommended
default (`src/game/role-variants.ts`). The ships, the geometry and the names are
the same. The released build is different, and most of them have one more point
of laser power.

| you meet | it did | it does now |
| --- | --- | --- |
| Sidewinder | 9 a hit | **13** |
| Krait, Mamba, Gecko, Cobra Mk I, Bushmaster | 9 | **13** |
| pirate Cobra Mk III | 9 | **13** |
| Python | 13 | **17** |
| Fer-de-Lance | 17 | **21** |
| Viper (police) | 13 | **17** |
| Worm, Ophidian, Rattler, Iguana, Chameleon, Monitor, Thargoid | unchanged | |

Your front face is 255 shield points. The bank behind it is another 255.

**Fly:** `T` → a tier-0 scenario, then tier-1, then tier-2.

**Expect to see**
- a fore shield that visibly moves. Before this change, 57 pirate hits stripped
  one face. Now it takes about 39. The trainer's `poolsAtStart` and `poolsAtEnd`
  say exactly how much went.
- the same time-to-kill in the other direction. Nothing about your guns changed.
- **no Asp Mk II** as a pirate or as a bounty hunter. It is gone from those two
  rosters. The reason is in `ship-specs.ts`: every released Asp build does zero
  to every hull the commander can fly.

**Report:** the shield low-water mark, the damage by source, and whether the
fight felt threatening rather than merely longer.

### 2. Flight behaviour: attack runs, not a turret

**What changed.** Nothing yet, unless somebody promotes a brain. The candidates
exist, and they are one line away. CLAUDE.md: *a well-optimised pirate is a
turret that hangs in space and snipes, and evolution will find it.*

**Fly:** the same scenario twice, on the same seed. Swap the opposition in the
trainer's brain picker: `pirate-attack-g3` first, then a candidate.

**Watch for these, in this order of importance**
1. **Attack runs.** Does it come at you, pass, and come back? Or does it park at
   500 units and pivot?
2. **Overshoots.** A pirate that never overshoots aims; it does not fly.
3. **Weaving.** "Hard to hit" and "they never shoot" are the *same fact*, seen
   from the other cockpit. That is the balance, and it is meant to be tight.
4. Only then: how much of your shield it took.

The trainer reports the mean engagement range, the time on each other's six, and
the lined-up share. A brain with a HIGH lined-up share and a LOW on-six time is
the turret. Want the reverse.

### 3. Time-to-kill and hit readability

**Fly:** sparring, one opponent, and count.

**Expect:** every laser the Cobra Mk III can carry still breaks a cargo canister
in one hit. A kill must feel the same as before, because TODO 29 did not change
the outgoing direction.

**Report:** the shots to kill per hull, and whether a hit on you is legible. The
flash, the sound and the shield bar must agree about what just happened.

### 4. Warning cadence

**Expect:** CONDITION RED at 9,000 units. Expect the shield readout and the
energy readout to move in visible steps rather than a smooth crawl. A 13-point
hit on a 255-point face is 5%. Check that it reads.

### 5. Docking risk

**Unchanged, and worth a re-check, because the pools are the same object that
the scrape spends from.** A fluffed slot costs 230 of a 255-point face. Try one
deliberately bad approach on a full shield. Try another on a half shield.

**Expect:** the bad approach on a full shield is survivable and expensive. On a
half shield it reaches the hull.

### 6. Old and new hull encounters

**Fly:** the trainer's hull picker, with at least one of each —
- an original-roster hull: Sidewinder, Krait, Mamba, Gecko, Cobra Mk III
- one that TODO 25 brought in: Bushmaster, Rattler, Iguana, Chameleon, Monitor,
  Ophidian, Cobra Mk I, Ghavial
- the Constrictor (see below)

**Expect:** every one of them renders with exact geometry, and with a target
radius that matches what you can hit. A hull whose ring sight does not match its
silhouette is a geometry bug, not a balance bug.

### 7. The Navy mission's signposting

**What changed.** The Constrictor is untouched. Its source-exact armour halves
your hit before its own defence subtracts, so a **beam laser does exactly zero**.
Only the military laser kills it in a reasonable time. What is new is that the
Navy now tells you. It tells you in the docking transmission and on the mission
line, and it names the gun you have fitted:

> NAVY: TARGET ARMOUR HALVES LASER FIRE — YOUR BEAM LASER SCORES 0 A HIT, A
> MILITARY LASER 3

It says nothing at all once you carry the military laser.

**Fly:** reach the briefing (16 kills, galaxy 1) with a beam laser fitted. Read
the message. Then fit a military laser (6,000 Cr, TL10+; 79% of galaxy 1 is
within one jump of a system that sells it). Check that the line goes away.

**Report:** whether the warning arrives in time to act on, and whether it is
legible in the message queue at the moment you dock.

---

## TODO 30 — what the phase's acceptance list adds

TODO 29's list above covers the threat, the flight, the time-to-kill, the
warnings, the docking, the old and new hulls, and the Navy signposting. TODO 30
closes the whole Elite-A phase. Its acceptance list names five things that the
list above does not. Fly these as well.

### 8. Every fitted laser against every KIND of target

The outgoing direction, exhaustively. The oracle proves the arithmetic and the
live suite proves that the game runs it. Neither can tell you whether it READS.

**Fly:** with a **pulse** laser, then a **beam** laser, then a **military**
laser. The trainer's fit-out override gives you all three free. Fly each one
against one of each target below:

| target | what to expect |
| --- | --- |
| a weak hull (Sidewinder, Worm) | dies fast; the shots-to-kill should feel like the trainer's count |
| an armoured hull (Python, Anaconda) | visibly tougher, and the difference is its own defence rather than more hit points |
| a regenerating hull | leave one alone for a minute and come back: an ordinary AI ship recovers one point a second, so a long fight is a fight it is healing through |
| the **Constrictor** | a beam laser does **exactly zero**. That is the released rule, and the Navy now says so before you take the job |
| a **station** (Coriolis, Dodo, rock hermit) | sparks and nothing else — and GalCop notices |

**Report:** whether a laser that does nothing reads as "immune" rather than as a
bug. Report also whether the ring sight agrees with what actually connected.

### 9. Armed and unarmed NPCs, on both faces

**Fly:** take hits from ahead. Then take hits deliberately from astern.

**Expect:** the fore bar for the first, and the aft bar for the second. Expect
the energy bank to move only once the facing shield is flat. An **unarmed**
trader must never take a point off you at all. The Shuttle, the Shuttle Mk II,
the Transporter, the trader Anaconda and the trader Dragon all fly released
builds whose laser bits are zero. That is the source's answer, not a missing
feature. A trader **Adder** does 9 a hit, so pick the right one to test with.

### 10. Cargo, rocks, missiles and the two stations

**Fly:** shoot a cargo canister with every laser, one hit each. Shoot an escape
capsule. Blast an asteroid. Take a missile without an answer to it. Dock at a
Coriolis, and dock at a Dodo.

**Expect:** a canister breaks in one hit. A missile that you do not E.C.M.
flattens the shield it hits, almost exactly. The Dodo's slot is upright, like the
Coriolis's slot, and you hold the same roll to fly it.

### 11. Save and restore, mid-fight

**The one that matters most,** because it is invisible when it goes wrong.

**Fly:** get into a real fight. Let the world autosave, which takes 20 seconds.
Reload the tab. Carry on.

**Expect:** the same ships, on the same hulls, with the same energy, in the same
places. This section hunts one failure: a ship that comes back the right SHAPE
but the wrong BUILD. The hull would look identical, and it would take a different
number of hits to kill.

### 12. HUD, warnings, scanner labels and the report

**Expect** four things. The shield readout and the energy readout move in visible
steps; a 13-point hit on a 255-point face is 5%. CONDITION RED arrives at 9,000
units. The scanner labels name the recovered hulls correctly, so a Bushmaster
says Bushmaster. The trainer's exported JSON names each opponent's `designId`
and `profileId` beside its hull name, so the record still says what was flown.

---

## What to send back

Send the trainer's JSON export. Add one sentence per section on whether it was
fun. Paste the records into a training-log entry. `docs/TRAINING-LOG.md`'s rule
is that an entry is appended and never edited. A trial that contradicts an
earlier one is therefore the record at work, not a problem.
