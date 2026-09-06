# 190 — One machine runs every mission, and a failure never blocks the next

**Kind:** feature · **Severity:** low · **Size:** large · **Depends on:**
nothing · **Blocks:** proposed follow-up items 191, 192 and 193 · **GitHub:** none

## Where we are

### Project context

HARMLESS is a browser space game built with TypeScript, Vite and three.js.
It is an unofficial, non-commercial tribute to Elite (1984).
The player controls a ship, travels between star systems, docks at stations,
trades goods and fights other ships.

A **commander** is the player's saved character and career.
A **system** is a location in a galaxy that the player can visit.
This plan also calls that location a **world**.
Galaxy 1 contains 256 systems. Each system has an index in the generated list.
Lave is the starting world. A **seed** is the input that lets a generator
produce the same galaxy or random sequence again.

A **jump** moves the ship between systems and uses fuel.
A **mis-jump** interrupts that travel and leaves the ship in **witch-space**,
a separate encounter area. Thargoids are hostile alien ships that can attack
there. **Docking** means arrival inside a station, where the player can trade
and receive mission instructions.

The game stores simulation data separately from its visual display.
Tests can run game rules without the browser or three.js display.
In this plan, the **mission controller** is the proposed code that updates
mission progress in response to game events.

### Requested change

Chris asked for more missions on 2026-09-06. The new missions do not need to
follow the original game's story or require travel between galaxies.

Generate the mission content offline in batches. Commit the generated files to
the repository. The game remains a static site with no application server.
It must also run without a browser interface for tests. A model that runs in
the browser remains a possible future addition.

### The existing mission

`src/game/missions.ts` controls the Navy's Constrictor mission through five
numbered stages. The saved state contains the stage number and a target system
index. The Navy has no named contact or portrait.

Destruction of the Constrictor advances the mission and pays a bounty.
The courier stage increases the probability of a mis-jump. Delivery pays a
second reward and ends the mission. The mission does not repeat during that
commander's career.

The current stage transitions are:

| Saved stage | Meaning | Event and result |
| --- | --- | --- |
| 0 | Mission not started | Dock in galaxy 1 with at least sixteen kills. Select a hunt target and enter stage 1. |
| 1 | Hunt the Constrictor | Destroy the marked target. Pay 2,500 credits, clear the target and enter stage 2. |
| 2 | Report the destruction | Dock at any station. Select a delivery target and enter stage 3. |
| 3 | Carry the plans | Dock at the delivery target. Pay 1,500 credits, clear the target and enter stage 4. |
| 4 | Mission finished | No further mission transitions occur. |

The current offer starts automatically at docking. The new controller requires explicit player acceptance for every offer, including
the Constrictor. Rejection or delay does not start the mission.

`stepMissionAtDock` handles stages 0, 2 and 3.
`constrictorDestroyed` handles the target's destruction in stage 1.
Both functions are in `src/game/missions.ts`.
The current functions change `commander.mission` directly and apply payments.
The new controller instead returns state and effects for the caller to apply.

Target selection excludes the current system. The hunt target must be 3.0 to
8.0 light years away. The delivery target must be 5.0 to 9.0 light years away.
These are chart distances, not counts of jumps. The selection uses
`distanceTenths` from `src/galaxy/navigation.ts` and one random draw.
If no candidate exists, the current stage remains unchanged.
`src/constants/missions.ts` defines these ranges, the kill threshold and payments.

The hunt also shows a weapon warning when the fitted laser is unsuitable.
`constrictorWarning` calculates damage from the existing combat rules.
Preserve this warning during the conversion.

The following files depend on the current mission implementation.
All paths in this document start at the repository root.


- `src/game/hyperspace.ts` passes the stage number to `witchspaceChance` in
  `src/galaxy/navigation.ts`, which selects the mis-jump probability.
- `src/game/world-build.ts` requests the mission's changes to the ship blueprint selection.
- `src/game/spawning.ts` marks the target ship with `isMissionTarget`.
- `src/game/combat-wreck.ts` checks that marker when a ship is destroyed.
- `src/game/persistence.ts` reads that marker on load to restore the
  Constrictor's hull design.
- `src/game/orders.ts` requests the current mission objective for the amber instruction
  line and the charts.
- `test/campaign.ts` records the leg at which the commander reaches sixteen
  kills. It does not run the mission machine.

Replace these dependencies with an interface that supports several missions.

### Files needed for implementation

| File | Current responsibility | Relevance to this change |
| --- | --- | --- |
| `src/game/commander.ts` | Defines `CommanderData`, the old `MissionState`, and new commander defaults | Replace the mission fields and defaults. |
| `src/game/station.ts` | Handles docking, mission announcements, market setup and saves | Send docking events to the controller before other random draws. |
| `src/game/npc-state.ts` | Defines state for non-player ships, called NPCs | Replace the boolean target marker with a mission tag. |
| `src/game/blueprint-set.ts` | Selects a set of ship designs and capabilities for encounters | Continue to accept mission overrides through the new interface. |
| `src/game/survivors.ts` | Resolves release or sale of rescued people | Preserve individual mission passenger identities. |
| `src/game/screens/survivors.ts` | Handles the survivor screen | Show ordinary survivors and mission passengers. |
| `src/game/screens/missions.ts` | Handles the MISSIONS screen | Show several missions and leads. |
| `src/game/screens/chart.ts` | Handles the navigation chart | Mark mission destinations and leads. |
| `src/game/screens/data.ts` | Handles the DATA ON system information screen | Show mission news about the selected world. |
| `src/game/snapshot.ts` | Defines saved world data and its version | Include new mission state and passenger records. |
| `src/game/snapshot-parse.ts` | Validates snapshots before the game loads them | Ignore any old `mission` value. Validate the new mission state when present. |
| `src/game/storage.ts` | Writes saves and restores commander data | Replace old mission defaults and preserve the new state. |
| `src/game/rng.ts` | Produces the game's repeatable random sequence | Preserve the order of random draws. |

A **blueprint set** is a group of ship designs and combat capabilities used for
encounters. A mission **override** replaces the normal choice of that set.
The Constrictor hunt selects the Constrictor override at its target system.
The courier stage selects the Thargoid override. Witch-space also selects the
Thargoid override independently of the mission.

A **snapshot** is a serializable record of the game world.
A **checkpoint** is a saved state that the game restores after death.
Mid-flight saves also contain ship state and the random generator state.
`SNAPSHOT_VERSION` identifies the saved data format.
This change adds no migration step and does not change the version.
A loader ignores the old `mission` value. It installs an empty mission state
in its place. Every save still loads. Only the mission progress is lost.

A **standing order** is an objective that remains relevant after its announcement.
The game shows one such instruction in amber and provides screens for its details.
The MISSIONS screen lists mission objectives. The charts show destinations.
The bulletin board lists station work. The DATA ON screen describes a selected
system. The planned LOG screen is new.

Invariant 16 in `docs/INVARIANTS.md` requires every standing order to remain
available on a screen. A temporary message alone does not satisfy that rule.
Screens that list orders must not omit one kind of order to show another.


### Existing content generation tools

Use the existing generation tools as examples for the mission content tools.
`tools/species-prompts.ts` creates a repeatable list of portrait requests from
a seed. `tools/generate-species.py` uses that list to produce 256 portraits.
`tools/generate-descriptions.ts` uses the batch API to write a paragraph for
each world.

Use automated checks to detect differences between committed content and its
source data. Follow the fallback behaviour in `src/galaxy/descriptions.ts`: when
an entry is absent, show the existing description instead.

### Mission design

A **patron** is the person who offers a mission. Each patron has a name,
portrait, home world, motive and speech style. Derive the patron from the
1984 galaxy seed, so Lave always has the same governor. The Navy contact is
the exception: this patron has no home world. Its portrait is optional.

A **skeleton** is a mission definition in TypeScript. A developer writes its
rules and tests. A **dossier** contains the mission's generated text and image
references. A model writes this content offline. The mission controller reads
rules only from the skeleton. If the dossier is absent, the screen shows a
plain description of the objective.

A **leg** is one stage of a mission. It specifies an action, a location and
possible next steps. The types call the action a **verb**. The supported verbs
are hunt, deliver, recover, rescue, ambush, smuggle, escort and scan.

| Verb | Player action |
| --- | --- |
| Hunt | Find and destroy a specified ship. |
| Deliver | Take plans or cargo to a specified station. |
| Recover | Collect a specified item in space. |
| Rescue | Collect a person from an escape pod and take them to a station. |
| Ambush | Encounter hostile ships as part of the mission. |
| Smuggle | Transport prohibited cargo. |
| Escort | Bring another ship into station range with no nearby enemy ships. It then continues to dock. |
| Scan | Observe a specified ship for the required duration. |

Each verb has a code module that evaluates events from the game.
A **branch** specifies which leg or final outcome follows an event.

An **anchor** specifies how the game selects mission locations:

- A local mission takes place at the patron's world or within one jump of it.
- A relative leg selects a target within a specified distance range from the
  player when the leg starts.
- A fixed mission uses a known location, such as a landmark or the location of
  a world event. The chart marks this location.

An **arc** is a main story mission with several legs. Each arc starts at a
fixed world selected from the seed. Its final leg takes place two to four
jumps from the next arc's start world. An automated check verifies this distance
through the network of possible jumps.

A **lead** names the next arc and its start world. The final success text names
the next patron. Both success and failure save the same lead. The failure
rules below define how the lead makes the next arc available.

Once the player qualifies for an arc, show information about its location:

- At any distance, list the lead on the MISSIONS screen and mark the chart.
- Within about five jumps, show a rumour on the bulletin board and news on the
  DATA ON screen.
- Within one jump, send a message from the patron when the player docks.
- At the start world, show the mission offer.

Show no more than one hint per docking.

Save a **journal** of the player's mission events and outcomes. A story renderer
uses the journal and dossiers to produce an account of the player's missions.
The commander's log displays this account in the game. A separate site page
presents the full mission tour.

### Galaxy measurements

The following measurements date from 2026-09-06. They use the network of jumps
in galaxy 1, with a full-tank range of 7.0 light years per jump.

| Measurement | Result |
| --- | --- |
| Worlds unreachable from Lave through a sequence of jumps | 0 |
| Minimum jumps from Lave to its most distant world | 21 |
| Largest minimum jump count between any two worlds | 24 |
| Worlds within three jumps of Lave | 33 |

Every world is reachable through this network. Thus, a lead cannot point to an
isolated world in galaxy 1. The intended tour has five arcs. Each arc moves
the player four to six jumps farther across the galaxy.

## What to do

Build the mission controller, data model and game screens. Convert the
Constrictor mission to the first skeleton. Use it to verify that the controller
can reproduce the existing mission behaviour.

The following work needs separate plans. Those plan documents do not exist yet.
The numbers 191–193 are proposed identifiers for them, not links to existing items.
Write each plan before implementation of its work starts. Each plan must define
its scope, dependencies, milestones and verification requirements.

Use these proposed scopes:

- **191:** Generate patrons and dossiers. Validate the generated content before
  the game displays it.
- **192:** Add the story arcs and further side missions. Check the jump distance
  between the end of each arc and the start of the next.
- **193:** Add the mission story page to the site.

### Data model

Keep mission rules, generated content and progress in these locations:

| Data | Source | Location |
| --- | --- | --- |
| Skeleton | A developer writes TypeScript | `src/missions/skeletons/` |
| Patron | A model uses facts about the world | Committed JSON |
| Dossier | A model uses a skeleton and a patron | Committed JSON |
| Mission state | The controller updates progress during play | The commander's save |

In the types below, `Gate` specifies the conditions for a mission offer.
`Placement` specifies how to select a leg's location. `Settlement` specifies
payment and other consequences of a branch. `Outcome` adds the lead that a
finished mission can provide.

A **flag** records a named story condition, such as possession of information.
Patron **standing** measures the player's relationship with one patron.
It is separate from combat rating, general reputation and legal status.
A side mission is an optional job outside the main story arcs.

Money uses integer tenths of a credit: `25000` means 2,500 credits.
`band.min` and `band.max` use tenths of a light year, like the existing ranges.
`handover.min` and `handover.max` instead count jumps between connected systems.
Deadlines use the commander's in-game day, not real time.
A commodity number refers to an entry in `COMMODITIES` in `src/galaxy/galaxy.ts`.

The code below specifies the proposed interface. It is not an existing module
that a developer can import. Some supporting types still need definitions in M1:

| Type | Meaning and implementation reference |
| --- | --- |
| `StarSystem` | Existing system data from `src/galaxy/galaxy.ts`. |
| `PatronRef` | New reference to the Navy or a world patron, as shown in the comment. |
| `ShipId` | Mission ship reference. Connect it to the existing ship definitions in `src/game/ship-specs.ts` and `src/game/ship-identity.ts`. |
| `ItemId` | New identifier for an item that a recovery mission requires. |
| `Deed` | Mission action that affects reputation. Connect its effect to the existing rules in `src/game/character.ts`. |
| `CommanderFacts` | Read-only facts needed by the controller, selected from `CommanderData`. Include location, day and facts used by offer conditions. |
| `WorldChange` | New description of a temporary world change for later missions. |
| `TaggedShip` | New spawn description that includes a ship reference and a unique mission tag. |

A **pure function** returns a result without changing its input state or the
outside world. `stepMissions` receives the random generator as an explicit
argument so tests can control its draws.
A **mission input** reports an event that already occurred.
A **mission effect** requests a consequence that the calling game code applies.

```ts
interface Skeleton {
  id: string;
  kind: 'arc' | 'side' | 'event';
  anchor: 'local' | 'relative' | 'fixed';
  patron: PatronRef;                // { kind: 'navy' } | { kind: 'world'; seedSlot: number }
  offer: Gate;
  legs: Leg[];                      // legs[0] starts when the player accepts
  complete: Outcome;
  fail: Outcome;
  excludes?: string[];
  cap?: number;                     // how many times a side job repeats
}

interface Leg {
  id: string;
  verb: Verb;
  place: Placement;
  deadlineDays?: number;
  next: Branch[];                   // use the first branch whose trigger matches
}

type Verb =
  | { kind: 'hunt'; ship: ShipId; canEscape: boolean }
  | { kind: 'deliver'; cargo?: { commodity: number; tonnes: number } }
  | { kind: 'recover'; item: ItemId }
  | { kind: 'rescue' }
  | { kind: 'ambush' }
  | { kind: 'smuggle'; commodity: number; tonnes: number }
  | { kind: 'escort'; ship: ShipId }
  | { kind: 'scan'; ship: ShipId; seconds: number };

type Placement =
  | { kind: 'here' }
  | { kind: 'band'; min: number; max: number }
  | { kind: 'world'; seedSlot: number }
  | { kind: 'entity'; tag: string }
  | { kind: 'handover'; toward: string; min: number; max: number };

type Branch = {
  on: Trigger;
  to: string | 'complete' | 'fail';
  settle?: Settlement;             // paid once when this branch is taken
};
type Trigger =
  | 'success' | 'failed' | 'targetEscaped' | 'targetDestroyed' | 'targetFled'
  | 'deadlinePassed'
  | { flag: string } | { survivor: 'landed' | 'sold' } | { choice: string };

interface Gate {
  minKills?: number;
  minRating?: number;
  legalStatus?: 'clean' | 'any';
  flags?: string[];
  notFlags?: string[];
  done?: string[];
  withinJumps?: number;
}

interface Settlement {
  pay: number;                      // tenths of a credit
  deed?: Deed;
  legal?: number;
  setFlags?: string[];
  standing?: number;                // change in the player's standing with this patron
}

interface Outcome extends Settlement {
  lead?: string;                    // grants access to the next skeleton
}

interface Patron {
  id: string;
  world: number | 'navy';
  name: string;
  role: string;
  species: string;
  voice: string;
  portrait: string;                 // image path; '' uses the world's portrait
}

interface Dossier {
  skeleton: string;
  hash: string;
  title: string;
  briefing: string[];               // pages, with {TARGET} {PATRON} {HERE} slots
  legs: Record<string, { arrive: string; success: string; fail: string }>;
  lead: string;
  rumour: { far: string; near: string };
  news: string;
  images: { target?: string; place?: string };
  story: {
    opening: string;
    closing: { complete: string; fail: string };
    legs: Record<string, Record<string, string>>;   // by outcome, with {WORLD} {DAY}
  };
}

interface MissionState {
  live: LiveMission[];              // cap 3
  leads: Lead[];
  done: Record<string, 'complete' | 'fail'>;
  flags: string[];
  standing: Record<string, number>;
  entities: Record<string, EntityState>;
  passengers: MissionPassenger[];
  journal: JournalEntry[];
}

interface LiveMission {
  skeleton: string;
  leg: string;
  target: number | null;
  tag: string | null;
  progress: number;
  deadlineDay: number | null;
}

interface Lead { skeleton: string; galaxy: number; world: number; sinceDay: number }
interface JournalEntry {
  skeleton: string; leg: string; outcome: string; day: number; world: number;
}
interface EntityState { ship: ShipId; hull: number; lastWorld: number; alive: boolean }
interface MissionPassenger {
  tag: string;                      // same identifier for the pod and its passenger
  mission: string;                  // the owning live mission's skeleton
}

type MissionInput =
  | { kind: 'docked' }
  | { kind: 'arrived' }
  | { kind: 'misjumped' }
  | { kind: 'dayPassed'; days: number }
  | { kind: 'destroyed'; tag: string }
  | { kind: 'escaped'; tag: string }
  | { kind: 'fled'; tag: string }
  | { kind: 'scooped'; tag: string }
  | { kind: 'scanned'; tag: string }
  | { kind: 'policeScan' }
  | { kind: 'escortLost'; tag: string }
  | { kind: 'escortSafe'; tag: string }
  | { kind: 'survivor'; tag: string; fate: 'landed' | 'sold' }
  | { kind: 'choice'; id: string }
  | { kind: 'accept'; skeleton: string }
  | { kind: 'abandon'; skeleton: string }
  | { kind: 'galaxyChanged'; from: number; to: number };

type MissionEffect =
  | { kind: 'say'; text: string; command?: 'openMissions' }
  | { kind: 'later'; text: string }
  | { kind: 'pay'; tenths: number }
  | { kind: 'deed'; deed: Deed }
  | { kind: 'legal'; delta: number }
  | { kind: 'lead'; skeleton: string; galaxy: number; world: number }
  | { kind: 'worldOverride'; world: number; until: number; change: WorldChange }
  | { kind: 'standingSpawn'; world: number; until: number; ships: TaggedShip[] };

function stepMissions(
  state: MissionState, input: MissionInput,
  ctx: { commander: CommanderFacts; systems: readonly StarSystem[]; rng: () => number },
): { state: MissionState; effects: MissionEffect[] };
```

### Event processing

For example, the game destroys a ship whose mission tag is `constrictor-1`.
The wreck resolver sends `{ kind: 'destroyed', tag: 'constrictor-1' }` to the
controller. The controller finds the matching active mission and evaluates its
hunt verb. The matching branch advances the mission to the report leg.
The controller returns updated state and a payment effect for 25,000 tenths.
The caller installs the state, applies the payment, and displays any message.
A second input for the same destroyed target must not pay again.

Use the same sequence for docking, collection and the other listed inputs.
Keep screen rendering outside the controller so the same tests can run without
a browser.

### Queries from the game world

On arrival, the game queries the controller for these values:

- The ships and items to create, with their mission identifiers, called tags.
- The mission's change to ship blueprint selection, if any.
- Whether the courier stage increases the mis-jump probability.

These queries do not change state. A ship's mission tag replaces the existing
boolean target marker.

### Payments and other branch effects

Apply a branch's settlement once, when its event changes the current leg.
If the branch ends the mission, also apply the skeleton's final outcome.
The two payments add together.

For the Constrictor, set payment in both final outcomes to zero.
The hunt branch pays `CONSTRICTOR_BOUNTY` when the target is destroyed.
The delivery branch pays `COURIER_PAYMENT` when the player docks at the target.
A recovery after failure can use a separate delivery leg with a lower payment.
The verb module determines success. The skeleton specifies the payment.

Apply the new mission state and its effects as one game operation.
Save only after both operations finish. A duplicate target event must not pay
for the previous leg again. A reload must not repeat a payment.
Test these rules in the controller and through its integration with the game.

### Identity of rescued passengers

When the player collects a mission passenger, copy the pod's tag into
`MissionState.passengers`. Record the mission that the passenger belongs to.
Use unique tags across active missions and repeated jobs.

Keep ordinary survivors in the existing `commander.survivors` count.
Keep mission passengers in the separate passenger list. The survivor screen
shows both groups. It must not count a mission passenger as an ordinary survivor.

When the player releases or sells selected passengers, remove their records.
Send a survivor event with each passenger's tag and fate.
Only that passenger's mission can advance in response to the event.
Preserve the records through saves, reloads and checkpoint restores.

When a mission ends, remove its association with any passengers still aboard.
Transfer each remaining passenger to the ordinary survivor count once.

### Inputs reserved for later missions

The model includes `dayPassed`, `choice`, `policeScan` and `fled` inputs.
It also includes `worldOverride` and `standingSpawn` effects.
The Constrictor conversion does not require these additions. M4 connects the
inputs that its new verbs require, including `policeScan`.

A skeleton does not need to use every input or effect. These types allow later
missions to add a skeleton, a dossier and at most one new verb module.

### Failure rules

Chris specified on 2026-09-06 that failure must not prevent the next mission.
His example is a rescue mission in which the player accidentally destroys a
scientist's escape pod. Before its destruction, the scientist transmits the
plans to the player's ship. The player can still deliver the plans, but the
payment is lower.

Apply these five rules:

1. Give every leg a failure branch. It must lead to a recovery leg or the
   arc's failure outcome. Test every skeleton for a missing failure branch.
2. Implement a recovery leg with the same types as any other leg.
   In the scientist example, `targetDestroyed` changes the rescue leg to a
   delivery leg.
3. Give success and failure the same lead when success provides one.
   A saved lead makes the next arc available at its start world, regardless
   of normal offer conditions or exclusions. The limit of three active
   missions still applies. Keep the lead until space is available.
   Remove the lead when the player accepts its mission. Do not restart an
   active or finished arc. Reject a lead if the preceding arc excludes its
   target or requires that target to finish first. Test these conflicts.
   Test access to the next offer after both success and failure.
   Include failure without any flags that success would set.
4. Change the player's standing with the patron after failure.
   Record the failure in the journal. Show it in the story.
   These consequences and any lower payment must not prevent the next arc.
5. Offer a side mission again after a delay. Do not offer a finished arc again.
   Use its lead to direct the player to the next arc.

Player death does not count as mission failure. Restore the checkpoint state
and resume the mission from that state.

### Acceptance and abandonment

Every offer requires acceptance, including the Constrictor offer after sixteen kills.
Do not create an active mission or select its first leg until acceptance.
An offer that the player ignores does not count as failure.

Provide an abandon action for each active mission on the MISSIONS screen.
Abandonment applies the mission's final failure outcome and frees its active slot.
It does not start a recovery leg. Preserve the next story lead under the same
rules as any other failure. Record abandonment as the reason in the journal.
Apply payments and cleanup once, even if the abandon input repeats.

### Travel to another galaxy

Warn the player before a galaxy jump that active missions will fail.
`galacticJump` in `src/game/hyperspace-actions.ts` fires on one key press today.
Add a confirmation in the shape of the new-commander one in
`src/game/bindings.ts`. It swallows every other key until the player answers.
Show it only when a mission is active. A jump with no active mission needs no
confirmation. If the player cancels the jump, leave the mission state unchanged.
After the jump succeeds, end each active mission with its final failure outcome.
Record galaxy departure as the reason. Free the active slots and remove mission
associations with ships or passengers under the normal cleanup rules.

Preserve the next story leads, including leads already saved before departure.
Select reachable start worlds for them in the destination galaxy.
Save each lead's galaxy and world together. A system index alone does not
identify a location across galaxies. Preserve completed arc records so relocation
does not restart an arc that the player already finished.

The future arc plan must define repeatable placement of these replacement starts
and their patron contacts. This is an exception to each arc's normal fixed start.
Test reachability from the arrival world in the destination galaxy.
Galaxy 1's connectivity measurements do not prove reachability in another galaxy.

### Escort completion

An escort succeeds when its ship is alive, within range of the destination
station, and has no enemy ships nearby. Evaluate these conditions together.
If enemies remain nearby, keep the mission active until the area is clear.
Send `escortSafe` with the escorted ship's tag when all conditions are true.
Only that ship's escort mission can complete from the event.

As an implementation default, use the existing docking computer range for
station range. `DOCK_COMPUTER_RANGE` in `src/constants/docking-computer.ts` is
currently 3,500 world units from the station centre.
For the initial nearby-enemy check, use the same radius around the escorted ship.
Count living ships hostile to the escorted ship or the player, regardless of
whether they currently fire. These range choices are implementation defaults,
not additional decisions from Chris.

Pay the escort reward when these conditions first hold.
Keep the escorted ship in the world after mission completion.
Let its normal docking behaviour continue so the player can watch it dock.
Do not require the player to dock or wait for that docking to finish.
Later damage or destruction does not reverse the completed mission or its payment.

### M1 — Data model, controller and Constrictor conversion

1. Put the types in `src/missions/model.ts`.
   Put the pure `stepMissions` function in `src/missions/machine.ts`.
   Put one module per verb in `src/missions/verbs/`.
   Add a registry that selects the module for each verb.
   Implement hunt, deliver and ambush for the Constrictor mission.
2. Add `src/missions/skeletons/constrictor.ts` as the first skeleton.
   Represent the hunt, report, courier run with ambush, delivery and finished
   state. Require sixteen kills for the initial offer.
   Pay 25,000 tenths of a credit when the player destroys the target.
   Pay 15,000 tenths when the player docks at the delivery destination.
   Use the existing constants for these amounts. Set final outcome payments
   to zero.
3. Add `src/missions/state.ts` to create an empty `MissionState`, including
   its journal. Add it to `CommanderData` as `missions`, beside the old
   `mission` field. The old field and its readers stay until M2 step 7, so
   `npm run check` passes at the end of M1.
4. Add `test/mission-machine.test.ts` with a sequence of Constrictor inputs.
   Import each new test file from `test/run.ts` so `npm test` executes it.
   Use `test/harness.ts` for assertions and `test/fixtures.ts` for shared data.
   Run it without a game world. Check payments, target selection, journal
   entries and effects. Update `test/missions.test.ts` and the other callers
   to use the new interface. Preserve the existing numerical assertions.
5. Add `test/mission-skeletons.test.ts` to inspect every skeleton.
   Check that every leg can reach success or failure.
   Check that every leg has a failure branch.
   Check that both final outcomes provide the same lead when success provides one.
   Check that each distance range contains a candidate from every world in galaxy 1.
   Check that each lead names an existing arc without a conflicting prerequisite
   or exclusion. Test access to the next offer after both final outcomes.

#### M1 outcome (2026-09-06)

M1 landed as planned, with these additions that the plan did not have:

- `Placement` gains `anywhere`. The Constrictor's report leg ends at any
  station, as the 1984 mission did, and no listed placement said that.
- `Leg` gains `line`, `override` and `carryingPlans`. The standing order, the
  blueprint override and the raised mis-jump chance were stage numbers in the
  old machine. Each is now a fact on the leg it belongs to, and `queries.ts`
  reads them for M2.
- `Settlement` gains `say`, and `Skeleton` gains `hail`. The console lines the
  old machine spoke are on the branch that earns them.
- `Gate` gains `galaxy`. The Navy briefs in galaxy 1 only, and no listed
  condition said so.
- The machine saves a lead into `MissionState.leads` itself, and it also
  returns the `lead` effect. M3 step 2 needs no second writer.
- The machine handles `abandon` and `dayPassed` already. The MISSIONS screen
  control for abandonment is still M3.
- A `destroyed` input marks the tagged entity dead. `missionSpawns` then never
  spawns it again. The entity is deleted when its mission ends.
- `ratingRung` joins `game/rating.ts`, so `Gate.minRating` compares rungs.
- Twelve constants that equal 3 gained a rule id, as docs/TODO/188 M2 did for
  the value 2, because `constants:check` refuses a repeated value without one.
- The ambush verb is written and tested on a fixture. The Constrictor's
  courier leg is a deliver leg with the Thargoid override and `carryingPlans`,
  because the 1984 courier run had no separate encounter stage.
- The report leg has a standing order of its own. Stage 2 printed nothing.
- The `Contract` union left `commander.ts` for `src/game/contract-record.ts`.
  The new `missions` field and its doc pushed `commander.ts` to 412 lines, and
  the size gate wants a split, not a trim. Nineteen importers repoint.
- `test/missions.test.ts` still drives the old machine, because the old
  machine still runs the game. M2 step 7 converts or deletes it.

Two temporary faults proved the gates. A removed failure branch failed
`test/mission-skeletons.test.ts`. A branch that settled without a move failed
the duplicate-payment check in `test/mission-machine.test.ts`.

### M2 — Integration with the game world

1. Replace `NpcState.isMissionTarget` with `missionTag: string | null`.
   Send a tagged `destroyed` input from the wreck resolver.
   Send a tagged `escaped` input when the target escapes.
2. Update `src/game/world-build.ts` to query mission spawns and changes to blueprint
   selection. Replace the stage parameter of `witchspaceChance` in
   `src/galaxy/navigation.ts` with `carryingPlans`. False selects 9%; true
   selects 22%. Update `resolveJump` in `src/game/hyperspace.ts` to query the
   controller for that flag.
   Keep the existing `resolveJump` parameter `forced` separate.
   That parameter guarantees a mis-jump without a random draw.
   A normal courier jump still uses a random draw.
   A normal escape from witch-space does not use a random draw.
3. Send the `docked` input from `src/game/station.ts`.
   Apply the returned effects. Preserve the current announcement behaviour,
   with a link to the MISSIONS screen. The initial announcement is a temporary
   Navy transmission message. Queue any weapon warning after that message so
   it does not replace the announcement in the same frame.
4. Update `src/game/orders.ts` to read the active mission list.
   Provide a standing order for each active mission.
   Use these orders for the amber instruction line, charts and MISSIONS screen.
5. Leave the mission column in `test/campaign.ts` as it is. It records the
   leg at which the commander reaches sixteen kills, and that fact does not
   change. The campaign does not run the mission machine.
6. Connect the galaxy-jump confirmation and the `galaxyChanged` input in
   `src/game/hyperspace-actions.ts`. Test cancelled and successful jumps.
   Test active mission failure and relocation of existing and new leads.
7. Update `src/game/persistence.ts`. When a saved ship has a mission tag, look
   up that tag in `MissionState.entities`. That entry names the ship design.
   Then delete the old `mission` field, the old state type and every reader of
   them. Run `npm run check`.

### M3 — Offers, leads and hints

1. Add `src/missions/offers.ts` to select station offers on docking.
   Use offer conditions, the seed, commander facts and the current day.
   Limit active missions to three. Apply the lead access rules above.
   Test a full mission list, removal of one mission, and acceptance of a
   retained lead. Add acceptance and abandonment controls to the MISSIONS screen.
   Test that an ignored offer never starts a mission.
   Test that abandonment frees a slot and preserves the next lead.
2. Save the lead when the controller returns a `lead` effect.
   Add a LEADS section to the MISSIONS screen.
   Add a distinct chart marker for leads.
3. Add `src/missions/hints.ts` to select one hint per docking.
   Use the distance rules in the design section.
   Send one further patron message after several docks without mission progress.
4. Test leads against invariant 16 in `docs/INVARIANTS.md`.
   Each lead must appear on a screen. A hint must not replace an active
   mission's standing order on the amber instruction line.

### M4 — Remaining mission actions

1. Add recover, rescue, smuggle, escort and scan modules.
   Test each module with a sequence of inputs.
2. Specify which inputs each verb handles.
   Connect the game events for `scooped`, `survivor`, `policeScan`, `escortLost`
   and `scanned`. Add the tagged `escortSafe` event under the escort rules above.
   Preserve passenger tags from collection through release or
   sale. Update survivor state, the survivor screen and save handling together.
   Test two active rescue missions with ordinary survivors aboard.
   Release or sale must advance only the missions for the selected passengers.
   Repeat the test after save and reload.
3. Write one side mission skeleton for each verb so the player can use every
   verb in the game. Show plain objective text until the work proposed for item 191 supplies dossiers.

### M5 — Commander's log

1. Add `src/missions/story.ts` to produce story pages from the journal and
   dossiers. Replace text placeholders with values from the journal entry.
2. Add a pure function in `src/missions/route-map.ts` to draw an SVG chart.
   Use the system data and a list of visited worlds.
3. Add a LOG screen with the story, patron portrait and travelled route.
   Design the renderer for reuse by the site work proposed for item 193.

## Decisions already made

Chris made the following decisions on 2026-09-06:

- Expand the missions with generated text, images and structured content.
  The new missions need not follow the original game or require a galaxy jump.
- Keep the game server-free. Delete the old mission state format. An old save
  loads with its mission progress discarded. A model in the browser remains a
  future option.
- Let each mission specify a local, relative or fixed anchor.
  A patron stays at its home world. Local missions stay within one jump.
- Place the end of each arc near the next arc's start.
  Use a distance of two to four jumps. Provide location hints for distant players.
- Let the player reach the next mission after failure.
  Apply the five failure rules in this plan.
- Provide a commander's log in the game and a mission story page on the site.

The design also separates mission rules from generated fiction.
A developer writes the rules in TypeScript. A model writes text and image
content. Generated content cannot change mission rules.

Chris also confirmed these decisions during review:

- The player can abandon a mission. Abandonment counts as failure, frees an
  active slot, and preserves the next story lead.
- Every mission requires acceptance, including the Constrictor.
- A galaxy jump warns the player, fails active missions, and makes the next
  story leads available in the destination galaxy.
- An escort completes when its ship reaches station range without nearby enemies.
  The ship still docks, but the player does not need to wait for it.

## Open questions

Use these answers unless Chris changes them:

- **How many missions can be active?** Three. A single active mission would
  delay access to other leads. The existing board already offers several contracts.
- **Can generated text invent facts about a target world?** No.
  The plan for proposed item 191 must require validation of dossier text, including placeholders.
  A relative leg uses the target's existing world description for those facts.
- **What does the first release include?** The converted Constrictor and one
  side mission skeleton per verb. The story arcs belong to proposed item 192.

## Watch out for

- Update the seven dependent files listed above during M2.
  Also update the old mission records constructed in
  `test/blueprint-override.test.ts`, `test/contract-eta.test.ts` and
  `test/standing-orders.test.ts`. Update the marker set by hand in
  `test/ship-identity.test.ts` and `test/elite-a-live-combat.test.ts`.
- Every old save still loads. Two loaders read the mission. `parseSnapshot`
  in `src/game/snapshot-parse.ts` reads a world snapshot. `repairCommander`
  in `src/game/storage.ts` reads a commander record, and it spreads a stored
  `mission` over the defaults today. Make both loaders ignore an old
  `mission` value and install an empty `MissionState`. Change no version and
  add no migration step. An old stage-3 commander then loads with no missions
  and no stray fields. Test both loaders with an old mission value.
- The target draw moves from docking to acceptance. Today the Constrictor
  target draw is the first draw of a dock, before the market seed and the
  contract offers. Under the new rules the player accepts first, so the leg's
  target draw happens when the player accepts. Send the `docked` input first
  at docking, in the same place, with the game's random generator. Use the
  same generator when the player accepts. A random draw advances a shared
  sequence, so an extra draw changes later results. Test that a dock with no
  offer makes no mission draw. Test that acceptance draws once.
- Update `test/galaxy.test.ts` to call `witchspaceChance` with `carryingPlans`.
  Check the existing 9% and 22% probabilities.
  Distinguish those probabilities from the forced-jump control in jump tests.
- Preserve mission passenger tags in snapshots and checkpoints.
  The ordinary survivor count cannot store passenger identities.
- Represent the Navy case in `PatronRef`.
  Only this patron can omit a home world and portrait.
- Text that the player sees is exempt from the repository's prose style rules.
  It still requires content checks in `test/ladder-words.test.ts`.
  Use REPUTATION for general conduct, LEGAL STATUS for the criminal record,
  and RATING for combat rank. Apply those terms to every screen.
- Update module headers when responsibilities move out of `src/game/missions.ts`.
  Update `docs/ARCHITECTURE.md` in the same commit.

## Verification

Use the Node version required by `package.json` (currently 22.6.0 or later).
Run `npm ci` to install dependencies for a fresh checkout.
Run `npm run dev` to start the browser game during manual inspection.

Run `npm run check` after the changes.
This command runs TypeScript checks, tests, file size checks, documentation
checks and generated-file checks. The test runner is plain Node, without a
test framework. A new test file requires an import in `test/run.ts`.
The implementation changes mission spawns and selection of the mis-jump
probability. Run `npm run ambush-probe` after M2.
This probe runs simulated ambush encounters to detect changes in combat outcomes.
Run the following campaign sizes after M2 and again after M3:

```sh
npm run campaign -- 40 60
npm run campaign -- 200 60
```

The first argument is the number of simulated commanders.
The second is the number of travel legs per commander, not mission legs.
The campaign uses game rules to measure career and economic balance.
Compare both sample sizes before attributing a result to the mission changes.

Require the following evidence before the implementation is complete:

- The controller test reproduces the Constrictor's target rules and payments
  without a game world. Each payment occurs at the original event and occurs
  only once. A separate recovery path pays less.
  Integration tests repeat target events and reload after payment.
- Skeleton tests check valid branches, reachable final outcomes, target ranges
  and lead references. They reject conflicts between linked arcs.
  Offer tests show that failure without success flags still permits the next arc.
- Acceptance tests leave ignored offers inactive. Abandonment tests free a slot
  and preserve the next lead without duplicate effects.
- Galaxy travel tests leave missions unchanged after cancellation.
  Successful travel fails active missions and preserves reachable next leads.
  Save and reload preserve each relocated lead's galaxy and world.
- Escort tests check both sides of the station and enemy distance boundaries.
  Nearby friendly ships do not block success. Nearby enemies block it until clear.
  Completion pays once and leaves the ship able to finish docking.
  Later destruction does not reverse success or repeat payment.
- Rescue tests preserve passenger tags through collection, save, reload and
  checkpoint restore. One mission cannot handle another mission's passenger event.
- Jump tests check normal and courier probabilities.
  They count random draws for normal jumps, courier jumps, forced jumps and
  escapes from witch-space.
- `test/standing-orders.test.ts` checks invariant 16 for active missions and leads.
- The story test uses a journal with a selected branch.
  The output describes that branch and omits the alternative branch.

Temporarily introduce each fault below to prove that its test can detect it.
Restore the correct implementation after each check.

| Temporary fault | Required test failure |
| --- | --- |
| Remove a leg's failure branch | Missing failure branch |
| Remove the lead from a failure outcome | Different leads after success and failure |
| Require a success flag for the next arc, then disable lead access without that flag | Next offer unavailable after failure |
| Remove the passenger tag comparison | Incorrect progress in concurrent rescues |
| Pay the bounty again for a duplicate event | Duplicate payment |
| Use `carryingPlans` as the `forced` control | Incorrect jump result or random draw count |
