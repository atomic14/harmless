# 159 — The lane that only exists at the station

**Kind:** defect · **Severity:** medium · **Size:** medium · **Depends on:**
158 · **Blocks:** nothing · **GitHub:** #31 — *"Flying from the space station to
the sun — I don't think I encountered any NPC ships. We should come across some
people."*

**Deep space** in this plan means anywhere further from the station than the
system's own traffic reaches. The plan measures that distance rather than
assuming it.

## Where we are

Every claim below is read off the code that runs, or is arithmetic over
constants that the plan quotes.

**The sun is a real destination.** `SUN_SCOOP_RANGE` is 80,000 and
`SCOOP_RATE` is 5 (`src/constants/sun.ts`), so fuel scooping is a supported
activity with its own instrument (`SUNSKIM_COMPASS_RANGE`,
`src/constants/console.ts:41`). `stepShipSystems` (`src/game/world-step.ts:561`)
runs the cabin temperature and the scoop off the distance to the sun.

**The run is long.** The sun sits 320,000 units from the system origin
(`src/world/system-scene.ts:41`). The station sits at 2.4 planet radii, which is
10,800 to 15,600 units from the same origin (`system-scene.ts:45`, `:65`). So the
station is roughly 300,000 to 315,000 units from the sun, and the scoop band
begins 80,000 short of it. The commander flies about 220,000 to 235,000 units
before anything happens. At the torus drive's 3,200 units a second
(`src/constants/torus.ts`), that is about 70 seconds.

**Everything the system holds is parked at the station.** The widest thing
`spawnPopulation` places is the rock hermit at `HERMIT_SCATTER`, which is 7,000
to 21,000 units from the station (`src/constants/spawn-placement.ts:58`). A
trader that warps in later lands at `TRADER_ARRIVAL_RANGE`, 22,000 units from
the station (`src/game/spawning.ts:354`). Nothing is placed further out.

**So more than nine tenths of the run is empty by construction.** The commander
leaves the last object behind after about 22,000 units and flies the remaining
200,000 alone.

**One spawn is anchored to the commander, and it is gated shut.** `stepEncounters`
(`src/game/encounters.ts:89`) warps a pirate wave in beside the player, and only
when `government <= LAWLESS_GOVERNMENT` (3) and the commander is far from the
station. Half the government ladder is above that line. In a system of
government 4 or higher, NOTHING is ever placed near the commander. That is the
whole of it.

## What the triage found that the issue did not report

**#30 and #31 share one root, and it is the amble.** The last branch of
`NpcShip.update` (`src/game/npc.ts:857`) draws an idle waypoint 800 to 3,300
units from the STATION, for every role except the trader. So a system's ships
converge on the station and stay there. That is why the doorstep is crowded
(GitHub #30) and why deep space is empty (this item). docs/TODO/158 fixes the
half of it that lets a hostile loiter over the port. This item fixes the half
that leaves the rest of the system unvisited.

**The trader clock keeps running, and it feeds the station.**
`spawnArrivingTrader` places its ship relative to `world.station.position`, and
`traderPhase: 'arriving'` steers it to the station. The clock strikes about
every 100 seconds (`TRADER_GAP`, `src/constants/encounters.ts`), so a trader
does appear during the sun run. The commander cannot see it, because it is
220,000 units behind them.

**`MAX_TRADERS` is 4, and it is counted over the whole sky.** So a trader placed
in deep space consumes one of the four the station lane may hold. A ship left
loose in deep space would therefore starve the lane it came from. Any deep-space
trader needs a way to leave.

**Meeting somebody drops the torus drive.** `MASS_LOCK_SHIP` is 4,500
(`src/constants/torus.ts`), and it reads any live ship that is not a rock. So an
encounter placed on the flight line costs the commander the drive for a few
seconds. That is a feature and not a hazard, and the plan says so below.

## What to do

Two milestones, and therefore two commits.

### M1 — the arrival lane exists where the commander is

**The rule decides the anchor; the placement stays where placement lives.**
`SpawnOrder`'s trader case gains a field:

```
{ kind: 'trader'; at: 'station' | 'commander' }
```

`stepEncounters` answers `'commander'` when `c.playerFarFromStation` holds, and
`'station'` otherwise. It is the SAME clock and the same cap. Nothing arrives
more often; what changes is where.

`playerFarFromStation` is already computed and already passed
(`src/game/world-step.ts:452`). It reads `STATION_TRUCE` after 158 lands, which
is why this item depends on 158. One distance answers both questions: inside it
the station's neighbourhood is quiet and busy, outside it the commander is on
their own.

**`spawnArrivingTrader` takes an origin.** It takes a range today. It takes a
centre and a range now, and `world-step.ts` hands it either the station or the
commander. The witch-flash stays where it is drawn, so an arrival still reads as
a ship FROM somewhere.

**A new constant, `DEEP_TRADER_RANGE` (12,000), in
`src/constants/spawn-placement.ts`.** It is smaller than
`TRADER_ARRIVAL_RANGE`, and the reason is the scanner. `SCANNER_RANGE` is 6,000,
and a commander under torus closes at 3,200 units a second, so a ship 12,000 out
is on the scanner inside two seconds and is passed inside four. A ship at 22,000
would be reached only if the commander held the same course for seven seconds.

**The ship is placed AHEAD**, inside a cone about the commander's own heading,
rather than in a random direction. A random direction puts two ships in three
behind the commander, where nobody sees them. The cone's half-angle is a second
constant, `DEEP_TRADER_CONE` (0.5 radians, about 29 degrees). At 12,000 units
that is a lateral offset of up to 5,700, so the pass clears `MASS_LOCK_SHIP`
about half the time and drops the drive the other half. Both outcomes are
correct: you see somebody, and sometimes you have to fly around them.

**The deep-space trader leaves.** It is spawned with `traderPhase: 'departing'`
rather than `'arriving'`. A ship 200,000 units from the station would otherwise
fly for a quarter of an hour to reach it, and would hold one of the four trader
slots the whole time. `departing` already ends in `wantsDespawn` with the
witch-flash (`src/game/npc.ts:940`), which is a ship that jumped out. That is
what a ship met in deep space is doing.

### M2 — the sky says who is out here

**One console line.** A deep-space arrival is the only traffic the commander
will meet on a long run, and today an arrival says nothing at all. The pirate
wave says `PIRATE SIGNATURES DETECTED` (`world-step.ts:464`); a lawful ship
passing deserves the same courtesy.

The line is pushed only for the `'commander'` anchor, because a station arrival
is one of many and the console is not a traffic report.

**It names no key**, so `test/key-prose.test.ts` stays quiet, and it is queued
rather than shouted, which is the rule `session.ts` already states.

## Verification

The gates always run: `npm run check`.

Beyond them, tiered to the change. This changes what a system holds, and it
changes no combat rule and no price, so:

1. **`test/deep-space-traffic.test.ts`**, a new file, is the gate. It asserts
   behaviour through the real `stepEncounters` and the real `Game`:
   - the trader order carries `at: 'station'` when the commander is near the
     station, and `at: 'commander'` when they are not;
   - the CONTROL — the clock and the cap are unchanged, so a fixed `rng` gives
     the same number of trader orders over 600 seconds either way;
   - a commander flown 200,000 units from the station meets at least one ship
     inside `SCANNER_RANGE` over one full trader gap, over 40 seeds;
   - the same flight before the change meets none, which is the measurement the
     issue reports;
   - a deep-space trader is `departing`, and it despawns rather than crossing
     the system;
   - the trader count never passes `MAX_TRADERS`, over 1,200 seconds of flight.
2. **Prove the gate can fail.** Force `at: 'station'` for every order, and count
   the failures. Then restore it and force `'arriving'`, and count the failures
   again. The anchor and the phase must fail separately.
3. **A measured sun run.** A test that flies the real distance, station to the
   scoop band, and counts the ships that come inside `SCANNER_RANGE`. The number
   must be at least one and it must be small. Report it in the outcome, at two
   sample sizes, because it is a sampled number that drives a decision
   (`CLAUDE.md`, Validation).
4. **`npm run roster-probe`**. It walks what a system files. This item files no
   new design, so the probe must be unchanged.

Not run: `npm run campaign`. It abstracts flight entirely, so no encounter rule
reaches it (docs/TODO/132). Not run: the combat probes. No fight rule moves.

## Decisions already made

- **Deep space must hold somebody** (Chris, 2026-08-15, GitHub #31): *"We
  should come across some people."*

## Open questions

None. Two were open at the start of the plan and are answered here:

- **What does the commander meet — traffic, or a threat?** Traffic. The words
  are *"some people"*, and the pirate wave is already a rule with its own
  government ladder and its own constants. To widen that ladder would be a
  balance change wearing this item's clothes. The lawless system stays the
  dangerous one.
- **How often?** No more often than now. The clock and the cap do not move; only
  the anchor does. That is what keeps a long run quiet enough to be a long run.

## Watch out for

- `MAX_TRADERS` is read in two files for two purposes. `encounters.ts` uses it
  as the cap on the clock; `population.ts` uses it as the ceiling on what a
  system holds. Do not join them.
- A `departing` trader must not be given a destination it cannot reach. Read
  `updateTrader` (`src/game/npc.ts:873`) before choosing the phase, and confirm
  that `departing` needs no station.
- The witch-flash is drawn at the spawn point. Placed 12,000 out it is beyond
  `SCANNER_RANGE` and may be invisible. That is acceptable, and it is worth
  recording in the outcome rather than fixing by moving the ship closer.
- `test/world.test.ts` already drives `stepEncounters` with a fixed `rng`.
  Extend that file's helpers rather than writing a second harness.
