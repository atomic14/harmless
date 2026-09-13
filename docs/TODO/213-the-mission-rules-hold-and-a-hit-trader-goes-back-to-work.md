# 213 — The mission rules hold, and a hit trader goes back to work

**Kind:** defect · **Severity:** high · **Size:** medium · **Depends on:**
nothing · **Blocks:** 214 · **GitHub:** none

## Where we are

Two reviews of the missions landed on 2026-09-12 and 2026-09-13.
[`docs/MISSIONS-REVIEW.md`](../MISSIONS-REVIEW.md) reads the machine and its
data. [`docs/MISSIONS-FLIGHT-REVIEW.md`](../MISSIONS-FLIGHT-REVIEW.md)
flies every kind of job in a real headless game. The machine is sound. The
rules around it do not hold. Chris read both on 2026-09-13 and said *"let's
fix the broken parts"*. This plan is the broken parts. 214 is what he asked
for next: surprises.

The probes under [`docs/reviews/missions-2026-09-12/`](../reviews/missions-2026-09-12/)
measured each fault, and each milestone below says which probe block shows
it. The findings, by the number the reviews gave them:

| review | finding | what is wrong |
| --- | --- | --- |
| flight 2 | the escort | a trader hit once flees for ever. The escort course rams its charge. It follows a charge into the planet |
| machine 4 | `fled` | the escort and scan verbs ignore it. A scan subject wrecked by nobody is ignored too |
| machine 2 | the cap | no side job sets `cap`, so each is offered one time per career |
| machine 3 | the goods | a smuggling run pays and leaves the narcotics aboard |
| machine 1 | the galaxy | an arc is offered in every galaxy at its seed index |
| flight 3 | the scoops | the Lave arc and two side jobs need scoops a new commander has not got |
| flight 1 | the warning | TARGET ARMOUR HALVES LASER FIRE is said on every hunt |
| machine 5 | the hint | the side-job count silences the patron's dock messages |
| machine 6 | the save | a live mission on a ghost id throws on dock and on abandon |
| machine 7 | the journal | it holds no galaxy, so the log misnames a world after a jump |
| machine 8 | standing | a local patron's key is the world where the branch settled |
| machine 9 | the restore | a restored mission ship takes the pirate row |
| machine 10 | the placement | a branch that cannot place its next leg drops the settlement |
| machine 12 | the comments | six say what the code no longer does |

## What to do

Five milestones. Each is one commit.

### M1 — the flight: a hit trader goes back to work, and the escort ends

- **`fleeing` clears.** A trader that took no hit for `TRADER_CALM_SECONDS`
  and has no live attacker goes back to its working life. A new clock on
  the ship counts the seconds since the last hit. `npc-trader.ts` reads it
  at the top of the fleeing branch.
- **The escort and scan verbs answer `fled`** as `targetEscaped`. The scan
  verb answers `escortLost` as `targetDestroyed`, as the hunt and the escort
  already do.
- **The escort course cannot ram its charge.** Inside three standoffs of the
  charge the approach speed is capped at the charge's speed plus
  `COURSE_ESCORT_CLOSING`.
- **A course refuses a target below the planet's clearance.** The mission
  arrival ends with a reason, and the console says THE TARGET IS TOO NEAR
  THE PLANET. `CourseStep` gains `why`, and `endCourse` says it in place of
  the course's usual word.

### M2 — the data: a side job comes back, the goods leave, the arcs stay home

- **A side job with no `cap` repeats without limit**, after
  `MISSION_REOFFER_DAYS`. The model comment and `canAccept` change together.
- **A smuggling run unloads.** The smuggle verb's success carries `unload`.
  The machine emits an `unload` effect. The bridge takes the tonnes out of
  the hold, and no more than are aboard.
- **Every arc is gated to galaxy 1.** The five arcs set `offer.galaxy`. The
  lint refuses a world patron whose skeleton has no galaxy gate. The lead
  relocation in `leaveGalaxy` goes, with `leadWorldIn` and its tests. A lead
  keeps its galaxy, and the LEADS row already says IN ANOTHER GALAXY.
- **A scoop job needs scoops before it is offered.** `Gate.scoops` and
  `CommanderFacts.scoops`. The Lave arc, `side-recover` and `side-rescue`
  set it. The gate is outside the dossier hash, so no dossier changes.

### M3 — the words: the warning and the hint

- **The gun warning speaks for a target that halves a hit**, which is the
  Constrictor's `playerLaserMultiplier`, and for no other.
- **A side-job count does not silence a lead.** `hail` passes only an arc's
  hail as `hailed`, so the one-jump message and the reminder come through
  behind the count.

### M4 — the record: the save, the journal, the standing, the restore

- **The loader drops a ghost.** `repairMissionState` drops a live mission
  or a lead whose skeleton or leg the code no longer ships, and the loader
  says one line about it.
- **The journal holds a galaxy.** `JournalEntry.galaxy`, written by every
  push. `storyPages` names a world through the entry's own galaxy, from a
  memo of generated galaxies. An entry with no galaxy reads as galaxy 1.
- **The lead announcement names the right world.** The `lead` effect carries
  the galaxy, and the bridge names the world through that galaxy's systems.
- **A local patron's standing is keyed by the origin.** `patronId` reads
  `acceptedAt` for a local patron.
- **A restored mission ship takes its leg's role.** `missionShipSpec` reads
  the role through `verbJob`.
- **A branch that cannot place its next leg still settles.** It falls back
  to `anywhere`, and the lint measures a handover from every world, as it
  measures a band.

### M5 — the lint and the comments

- **Every trigger a verb can emit has a branch, or the leg names it under
  `ignores`.** A table in `verbs/registry.ts` says what each verb emits.
  The shipped legs that ignore a trigger say so: a side hunt and the
  Constrictor ignore `targetFled`, because a pirate cannot leave a system
  today. 214 revisits that.
- **The six stale comments go.** They are the machine that spends the
  mission constants, and the override conflict the lint does see. They are
  the hold check and the item table that never arrived. They are the world
  patron in one galaxy, and the idle-dock count.

## Decisions already made

- **Fix the broken parts first** (Chris, 2026-09-13).
- **Surprises are 214, not this plan** (Chris, 2026-09-13: *"there should be
  surprises"*).
- **The verb decides, and the machine applies** (invariant 15, one level
  down). No fix here moves a rule out of its home.
- **A branch change needs a dossier regeneration.** The dossier hash covers
  the legs, the verbs, the branches and the pitch. A gate, a spawn and an
  `ignores` list are outside it. So this plan adds no branch to a shipped
  skeleton.

## Open questions

Three questions the review put to Chris, answered here by the review's own
recommendation. Each is one line to change if he decides otherwise.

- **Does the tour play in other galaxies?** No. The names, the patrons and
  the dossiers are galaxy 1's.
- **How many times does a side job repeat?** Without limit, a week apart.
  Eight jobs per career is a short game.
- **Does the tour open with a scoop?** It waits for the scoops. A gate is
  one line, and a new first leg is a regeneration.

## Watch out for

- **A new constant follows `CLAUDE.md`'s rule.** Run `constants:find` for
  the name, two synonyms and the value. Then `generate:constants` and
  `constants:check`.
- **The seeded stream.** No fix here draws from it.
- **`NpcState` is walked generically into a snapshot.** A new clock on the
  ship is saved for free, and a restore from an old save reads it as
  absent. Give it a default.
- **The dossier `--check`.** Run it after M2 and M5 to prove the hash did
  not move.
- **`test/tour.test.ts` pins the relocation.** M2 removes those checks with
  the code, and keeps the checks on `arcStarts`.

## Verification

The gates always run: `npm run check`.

The tier: a rule that changes how a mission and a fight go. The two review
probes run again after M5, and their new output is committed as
`results-after.txt` and `flight-results-after.txt` beside the old.

Evidence, one per fault:

- A real-game test puts a commander on the escort, hits the charge, and
  sees it go back to its working life after the calm. The escort finishes.
- A real-game test flies the escort approach with the sky empty and sees
  the fore shield stay full.
- A course-pilot test hands the mission arrival a target inside the
  clearance and reads the refusal.
- The verb tests send `fled` to the escort and the scan, and `escortLost`
  to the scan.
- The offer test ends each shipped side job and asks for it again a week
  on.
- The verb test reads the hold after a smuggling run succeeds.
- The offer test stands a commander at galaxy 2's index 7 and sees no arc.
- The lint test breaks a fixture one more way per new rule, and the gate
  names each fault.
- The bridge test restores a Python escort and reads the trader row.
- The story test renders a galaxy-1 journal against galaxy 2 and reads the
  right names.
- The loader test loads a live mission on a ghost id and sees it dropped.

## What the milestones found

### M1

- **The escort finishes eight of eight.** The flight probe ran again after
  the milestone. Before it, four escorts of eight finished, three stalled
  and one crashed. After it, all eight finish, in 488 to 525 seconds, and
  the ship ends with shields 249 and 255.
- **The calm is one clock on the ship**, `calm`, the seconds since the last
  hit. `takeDamage` resets it and `tickClocks` runs it, beside
  `underFire`. The snapshot walks `NpcState` generically, so a save carries
  it and an old save reads it as 0. `TRADER_CALM_SECONDS` is twenty, and it
  lives beside `UNDER_FIRE_SECONDS` under `@rule trader.calmSeconds`.
- **A course that ends for a reason is not done.** `endCourse` used to add
  every ended course to `coursesDone`, which takes it off the list for the
  visit. A refusal now leaves it on the list, so the pilot can pick the job
  again once the charge climbs out of the planet.
- **Ninety seconds beside the charge cost no shield**, and the ship never
  came inside a quarter of the standoff. The real-game test holds both.
- **`constants/course.ts` crossed the size ceiling by three lines.** The
  four numbers a mission's course spends left it for
  `constants/mission-course.ts`: the scan standoff, the escort standoff,
  the escort closing speed and the police clearance. Their rule ids stay
  under `course.`, and each says `@domain mission-course`.
- The suite gains 13 checks, to 5,984.

### M2

- **The dossier hash did not move.** A gate and a spawn list are outside
  it, as the plan said, and `generate:dossiers --check` passes with every
  skeleton changed.
- **The lead announcement moved here from M4.** Without the relocation, a
  lead an arc offers on a galactic jump was recorded in the galaxy she
  arrived in, at a seed index there. `offerLead` reads the galaxy from the
  next arc's gate, and the bridge names the world through that galaxy.
- **Two tests pinned the old rules by accident.** `test/arcs.test.ts` said
  the first arc opens with no gate. `test/station.test.ts` pinned the dock's
  hail lines with the Lave arc among them. The first is rewritten. The second
  fits scoops, because the offers are not its subject.
- **The review probe needed the new fact.** `probe.ts` builds its own
  commander facts, and it gained `scoops` so the after-run can read the
  same blocks.
- The suite has 6,001 checks.
