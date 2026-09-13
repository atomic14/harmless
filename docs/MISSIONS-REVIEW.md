# The mission machine is sound, and five rules around it do not hold

Review date: 12 September 2026. Source revision: `cb7785b`. Part one of two.
Part two, [`MISSIONS-FLIGHT-REVIEW.md`](MISSIONS-FLIGHT-REVIEW.md), reviews
how a job is flown, and whether it is fun.

The machine itself is in good shape. One pure step reads an event and returns
a new record with its effects. The bridge applies the effects one time, before
any save. The lint gate is proved able to fail. The suite passes 5,972 checks.

The faults sit around the machine, in the data and the wiring. Four are high
priority. An arc is offered in every galaxy at its seed index. A side job is
offered one time per career, and the rule says it comes back. A smuggling run
pays and leaves the goods aboard. The word `fled` reaches no leg that answers
it. No production code changed during this review.

## Scope and measurement

The review read every file under [`src/missions/`](../src/missions/). It read
the six game-side modules that feed the machine, the mission constants and the
skeletons. It read the mission tests and the plans 190, 192, 203 and 208.

Every claim below was checked against the code that runs. Ten claims were
also driven through the real machine with no game world, as
[`test/mission-machine.test.ts`](../test/mission-machine.test.ts) does. The
probe is [`reviews/missions-2026-09-12/probe.ts`](reviews/missions-2026-09-12/probe.ts),
and its output is [`results.txt`](reviews/missions-2026-09-12/results.txt)
beside it. A finding names its probe block in brackets.

## 1. High priority: an arc is offered in every galaxy at its seed index

**Evidence:** [`offers.ts:59`](../src/missions/offers.ts#L59),
[`offers.ts:71`](../src/missions/offers.ts#L71),
[`model.ts:183`](../src/missions/model.ts#L183),
[`lave.ts:29`](../src/missions/skeletons/arcs/lave.ts#L29). Probe [1].

A world patron is a seed slot, and a seed slot is an index. Every galaxy has
an index 7. `nearHome` compares the commander's index with that slot, and the
five arcs carry no `galaxy` gate. Only the Constrictor does. The comment on
`Gate.galaxy` says that a world patron is already in one galaxy. The code
does not hold that.

The probe stands the commander at index 7 of galaxy 2, which is Esrilees. The
offer list holds `arc-lave`. The hail says THE GOVERNOR OF LAVE HAS A JOB FOR
YOU. The patron reads THE COMPANY DIRECTOR OF ESRILEES. The dossier's pages
name Lave. The player reads three names for one person.

The same fault reaches the tour after a galactic jump. The machine moves each
lead to the tour world of the new galaxy, as
[`tour.ts`](../src/missions/tour.ts) intends. The arc that lead opens then
places its handover leg toward a seed index in the new galaxy. Its own lead
points at a seed index too. The probe accepts the relocated Rabedira arc
in galaxy 2. Its convoy leg lands four jumps from galaxy-2 index 100, which is
not a tour world. The tour holds for one arc and then drifts.

There are two ways out, and the choice is Chris's. The first gates every
world-patron skeleton to galaxy 1 and makes the lint refuse one without a
gate. The relocation on a galactic jump then has no arc to relocate, and the
comment on `tour.ts` about islands goes. The second gives `PatronRef.world` a
galaxy beside its slot. It then derives the hail, the pitch and the dossier
from the world rather than from a fixed name. The second is the larger change and
the one the tour's own comment asks for.

## 2. High priority: a side job is offered one time per career

**Evidence:** [`offers.ts:123`](../src/missions/offers.ts#L123),
[`model.ts:203`](../src/missions/model.ts#L203),
[`side.ts:22`](../src/missions/skeletons/side.ts#L22),
[`missions.ts:63`](../src/constants/missions.ts#L63). Probe [2].

`Skeleton.cap` is how many times a side job repeats, and absent means one
time. No side job sets it. So each of the eight side jobs can be taken one
time in a career. After that its row is gone from every board in the galaxy.

Failure rule 5 in plan 190 says a side mission comes back after a delay. The
doc comment on `MISSION_REOFFER_DAYS` says the same. It says that without
the delay one job reads as the only work in the galaxy. The probe
ends `side-recover` on day 10. The job is shut on day 11, on day 18 and on day
400.

The test that pins rule 5 uses a fixture with `cap: 3`
([`mission-offers.test.ts:102`](../test/mission-offers.test.ts#L102)). So the
mechanism is proved, and the shipped data is never held to the rule. A board
of two or three jobs, once each, empties in a few sessions.

**Recommended change:** decide what a side job's cap is, and set it in
`side.ts` or make absent mean no cap for a side job. Add one test over
`SIDE_JOBS` that ends each job and asks for it again after the delay.

## 3. High priority: a smuggling run pays and leaves the goods aboard

**Evidence:** [`model.ts:375`](../src/missions/model.ts#L375),
[`mission-bridge.ts:109`](../src/game/mission-bridge.ts#L109),
[`smuggle.ts:18`](../src/missions/verbs/smuggle.ts#L18). Probe [3].

The leg starts with a `cargo` effect, and the bridge puts three tonnes of
narcotics in the hold. A dock at the target with the tonnes still aboard
succeeds. The success settles a fee of 700 credits. No effect takes the
goods back out. The effect union has no unload, and the settlement asks for
none.

So the commander keeps the fee and the narcotics, and sells the narcotics at
the market they just landed at. The probe's success effects are a payment, a
deed and two lines. There is no cargo effect among them. The verb test checks
the payment and never reads the hold after it.

**Recommended change:** an `unload` effect, or a signed `cargo` effect, that
the smuggle leg's success branch emits. The bridge's arithmetic already
tolerates a negative count, but a named effect reads better than a sign.

## 4. High priority: the word `fled` reaches no leg that answers it

**Evidence:** [`world-step.ts:564`](../src/game/world-step.ts#L564),
[`npc.ts:793`](../src/game/npc.ts#L793),
[`trader-flight.ts:169`](../src/game/trader-flight.ts#L169),
[`escort.ts:15`](../src/missions/verbs/escort.ts#L15),
[`scan.ts:14`](../src/missions/verbs/scan.ts#L14),
[`hunt.ts:25`](../src/missions/verbs/hunt.ts#L25). Probe [4].

Plan 208 M3 says that the `fled` trigger has a sender at last. The world
sends `fled` or `escaped` when a tagged ship despawns. Only
`trader-flight.ts` sets `wantsDespawn`, and only a trader sets `fleeing`.
The guard at `npc.ts:793` names the role. A hunt's target is a pirate
([`spawning.ts:206`](../src/game/spawning.ts#L206)). A pirate never leaves
the system, so a hunt never hears `fled` or `escaped`. The three arcs'
`targetFled` branches and the side hunt's `targetEscaped` branch cannot be
reached in play.

The two verbs whose targets are traders ignore `fled`. An escort's charge that
a pirate hits runs for the edge of the system and jumps out. The world sends
`fled`. The escort verb answers `escaped`, `escortLost` and `destroyed`, and
returns null on `fled`. The leg stays live, the entity stays alive, and the
charge is spawned again on the next arrival. The console says nothing. The
same holds for a scan's subject that the player shoots. This is the commonest
way an escort is lost, and it is silent.

The test at [`mission-courses.test.ts:142`](../test/mission-courses.test.ts#L142)
sets `fleeing` on a pirate by hand. It proves the wiring from the flag to the
machine. It does not prove that the world can raise the flag on a hunt's
target, and the world cannot.

**Recommended change:** the escort and the scan verbs take `fled` as
`targetEscaped`, or as a branch of their own. Decide whether a hunted pirate
can ever leave, and remove the dead branches if it cannot. Add a lint rule:
every trigger a verb module can emit has a branch on the leg, or the skeleton
lists it as ignored.

## 5. Medium priority: the side-job count silences the patron's messages

**Evidence:** [`hail.ts:39`](../src/missions/hail.ts#L39),
[`hints.ts:114`](../src/missions/hints.ts#L114). Probe [5].

Plan 190 sets a ladder of hints for a far lead. Inside one jump, the patron
sends a message when the commander docks. After four idle docks, the patron
writes one more time. Both are one line, and a dock that makes an offer says
nothing else.

That rule was written when an offer was rare. Most worlds now carry two or
three side jobs, so most docks make an offer. `hail` passes
`offers.length > 0` as `hailed`, and `dockHint` returns null on it. The probe
docks at Leleer, one jump from Rabedira, with a lead to Rabedira saved. The
dock says THERE ARE 2 SIDE JOBS ON THE STATION BOARD and nothing else. With
the side jobs removed, the same dock says A MESSAGE FROM RABEDIRA. The fourth
idle dock behaves the same way.

The board rumour and the DATA ON line do not read `hailed`, so a far lead is
not invisible. The two dock messages are.

**Recommended change:** count only an arc's hail as `hailed`, so a side-job
count and a lead message can share one dock.

## 6. Medium priority: a save that names a ghost id stops the machine

**Evidence:** [`machine.ts:76`](../src/missions/machine.ts#L76),
[`lookups.ts:11`](../src/missions/lookups.ts#L11),
[`repair.ts:18`](../src/missions/repair.ts#L18). Probe [6].

`repairMissionState` checks that each field has its shape. It does not check
that a live mission names a skeleton the code ships, or a leg that skeleton
has. `skeletonOf` and `legOf` throw on a miss. The comment on each says that
the lint keeps a live mission from naming a ghost. The lint reads skeletons.
It never reads a save.

The probe loads a record with a live mission on `arc-ghost`. A dock throws.
An abandon throws, so the player cannot free the slot. A record on a real
arc with a leg named `old` throws the same way.

No shipped id changed since 7 September, so no present save is hit. The
next rename of a leg hits every player who holds that mission.

**Recommended change:** `repair.ts` drops a live mission or a lead whose
skeleton or leg is unknown, and the loader says one line about it.

## 7. Medium priority: the journal holds no galaxy

**Evidence:** [`model.ts:272`](../src/missions/model.ts#L272),
[`story.ts:43`](../src/missions/story.ts#L43),
[`log.ts:45`](../src/game/screens/log.ts#L45),
[`mission-bridge.ts:100`](../src/game/mission-bridge.ts#L100). Probe [7].

A journal entry records a world as an index. A lead records a galaxy beside
its index. The LOG screen renders every page with the systems of the galaxy
the commander is in. So after a galactic jump every earlier page names the
wrong worlds. The probe accepts the Lave arc in galaxy 1 and jumps. Rendered
with galaxy 1 the opening line says LAVE. Rendered with galaxy 2 it says
ESRILEES. The route map under the page draws the wrong chart for the same
reason.

The lead announcement on a galactic jump has the same root. The failed arc
offers its lead at the seed index. The bridge says ASK AT that index in the
new galaxy. The machine then moves the lead to the tour world. The probe
records a lead at world 11 and announces world 6.

**Recommended change:** a `galaxy` on `JournalEntry`, and a story that reads
it. The relocation in `leaveGalaxy` moves before the announcement, or the
announcement reads the relocated lead.

## 8. Low priority: a local patron's standing is keyed by the wrong world

**Evidence:** [`lookups.ts:21`](../src/missions/lookups.ts#L21),
[`machine.ts:323`](../src/missions/machine.ts#L323). Probe [8].

`patronId` names a local patron by the world the commander stands at when
the branch settles. A local patron is whoever runs the station the job was
taken at, and [`patrons.ts`](../src/missions/patrons.ts) reads the origin for
the name and the face. A delivery accepted at Tiraor and landed at Edzaon
credits `world-159`, which is Edzaon.

Nothing reads `standing` yet, so the fault is latent. The key is wrong from
the first write, and the first reader inherits it.

**Recommended change:** `patronId` reads `acceptedAt` for a local patron.

## 9. Low priority: a restored mission ship takes the pirate row

**Evidence:** [`mission-bridge.ts:141`](../src/game/mission-bridge.ts#L141),
[`persistence.ts:242`](../src/game/persistence.ts#L242). Probe [9].

`missionShipSpec` looks every tagged ship up under the pirate role. A
restore consults it first. An escort's charge and a scan's subject fly the
trader row. A Python and a Cobra Mk III have both rows, so a reload gives the
charge a pirate's energy and guns. A Boa, an Anaconda and a Transporter have
no pirate row, so they fall through to the trader lookup and come back right.
The spawn and the restore disagree for two of the five trader designs.

**Recommended change:** `missionShipSpec` reads the role through `verbJob`
on the live leg, as `spawning.ts` does.

## 10. Low priority: a branch that cannot place its next leg drops the settlement

**Evidence:** [`machine.ts:244`](../src/missions/machine.ts#L244),
[`lint.ts:25`](../src/missions/lint.ts#L25). Probe [10].

`takeBranch` returns before the settlement and the journal when the next
leg's placement finds no world. By then `react` marked the entity dead.
So a kill that cannot place its next leg pays nothing, writes nothing, and
leaves the leg live with no target to spawn. The Constrictor's hunt has no
deadline, so that mission would hold its slot for good.

The lint measures a `band` from every world and does not measure a
`handover`. The probe measures the four handovers from every world of galaxy
1, and each has a candidate. So the path is unreachable today. It opens when
an arc is accepted in another galaxy, which finding 1 allows.

**Recommended change:** the lint measures a handover from every world, as it
does a band. `takeBranch` settles and falls back to `anywhere` when a
placement fails, rather than return.

## 11. Low priority: model surface that nothing ships

**Evidence:** [`model.ts:25`](../src/missions/model.ts#L25),
[`model.ts:78`](../src/missions/model.ts#L78),
[`model.ts:102`](../src/missions/model.ts#L102),
[`model.ts:190`](../src/missions/model.ts#L190),
[`model.ts:333`](../src/missions/model.ts#L333).

The machine tests exercise each of these. No skeleton the game ships uses
them, and no game code sends them:

- the `misjumped` input, which nothing sends;
- the `entity` placement, and the `hull` and `lastWorld` fields on an
  entity, which nothing writes after the leg starts;
- the `cargo` field on a deliver verb, which the verb never reads;
- `Skeleton.anchor`, which nothing reads, and the `event` kind;
- the `choice` and `flag` triggers, `setFlags`, `flags`, `notFlags`,
  `excludes`, `minRating`, `legalStatus`, `withinJumps` and `legal`;
- a settlement's `override` and `spawn`, and the `changes` record they feed.

None of this is wrong. Each is a place the next fault can hide, and each
costs a reader time. The model header can say which parts a shipped skeleton
uses and which wait for a plan.

## 12. Low priority: comments that the code left behind

- [`missions.ts:4`](../src/constants/missions.ts#L4) names
  `game/missions.ts` as the machine that spends the constants. Plan 190 M2
  removed that file.
- [`queries.ts:36`](../src/missions/queries.ts#L36) says the lint does not
  see two overrides at one world. `overrideProblems` in `lint.ts` does.
- [`deliver.ts:5`](../src/missions/verbs/deliver.ts#L5) says a hold check
  arrives with 190 M4. It did not arrive.
- [`model.ts:25`](../src/missions/model.ts#L25) says an item table arrives
  with 190 M4. `ItemId` is a free string.
- [`model.ts:183`](../src/missions/model.ts#L183) says a world patron is
  already in one galaxy. Finding 1 shows that it is not.
- The comment on `MissionState.idleDocks` says docks since the journal last
  moved. `hail` counts docks since a dock last moved it. A kill in flight
  does not reset it.

## What holds

- **The machine is pure, and one call runs it.** `stepMissions` clones the
  record. The bridge installs the copy and applies the effects before any
  save. A reload cannot pay twice. The Constrictor runs end to end through
  the probe: bounty on the kill, orders at any station, fee at the courier
  world.
- **A settlement is paid one time.** The next leg's verb ignores a second
  input for the same kill. That is the whole duplicate-payment rule, and it
  is one comparison on a tag.
- **The lint is proved able to fail.** Seventeen fixtures each break one rule,
  and the gate names each fault.
- **Every verb is a job.** Eight verb modules, eight side jobs, five arcs
  and the Navy mission. The verbs decide and the machine resolves, which is
  invariant 15 one level down.
- **The offers, the hints and the words are their own files**, and each
  falls back to plain words when a dossier is absent.
- **Days reach the machine.** A jump and a witch-space rescue both send
  `dayPassed`, and days move nowhere else. A deadline cannot pass unseen.
- **A rescued passenger rides under the pod's tag.** The survivor screen
  opens for one. A deadline after the scoop hands the passenger over as an
  ordinary survivor.

## What the tests do not cover

- No test holds the shipped side jobs to failure rule 5. The re-offer test
  uses a fixture with a cap.
- No test proves that the world can send `fled` for a hunt's target. The one
  test sets the flag by hand on a pirate.
- No test offers an arc in a galaxy other than 1.
- No test reads the hold after a smuggling run succeeds.
- No test loads a save with an unknown skeleton or leg id.
- No test renders the log after a galactic jump.
- The lint has no rule that every trigger a verb can emit has a branch.

## Decisions to record, not defects

- A hunted ship wrecked by anybody pays the full bounty. `hunt.ts` records
  the decision. A pirate that kills the Krait earns the commander 800
  credits.
- An escort's fee needs no presence from the commander. The charge is safe
  when it reaches station range with no enemy near it, wherever the commander is.
- Every arrival says YOUR JOB AT X IS N JUMPS AWAY for every held job that is
  elsewhere. Three jobs give three lines behind ARRIVED.
- The hail says THERE ARE N SIDE JOBS ON THE STATION BOARD on every dock
  where any are open. It says so whether the commander read them or not.
