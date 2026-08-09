# Architecture

**One world state. A pure step advances it. Rendering only reads it.** Keep files
focused and define each rule once. `INVARIANTS.md` is authoritative for rules;
this file is a map.

## Core boundaries

- `src/game/game.ts` owns entities and orchestrates each frame. Modules decide
  and report; the game applies effects. For example, NPCs return fire events,
  collisions return pairs, encounters request spawns, and screens return
  outcomes.
- `src/game/world-step.ts` contains the headless flight loop. Persistence is in
  `persistence.ts`; docking and launch transitions are in `station.ts`.
- `src/engine/shell.ts` is the platform seam. `browser-shell.ts` owns browser and
  DOM access; `render-stack.ts` is the only GPU-dependent module. Controls read
  an input interface rather than the browser.
- The HUD is a read-only painter: `hud-model.ts` computes its frame model and
  `hud.ts` renders it. Screens live behind `ui/screen-host.ts` and own their own
  rendering, input and local state.

Laser fire, spawning and the hyperspace transition still remain in `game.ts`.

Two intentional quirks:

- Witch-space reuses a normal system scene with its bodies moved to ±1e8.
- Docking is tested in station-local space against the slot on its −Z face and
  its roll alignment.

## World and ships

- `src/galaxy/galaxy.ts` generates the 1984 galaxy from seeds; it is never stored
  as a table. `world/system-scene.ts` and the planet shader derive system visuals
  from the same seed.
- `src/galaxy/living.ts` advances off-screen trade in whole days and stores only
  deltas: convoys, danger and bounded price pressure. `populateSystem` turns
  arriving records into ships.
- Released ship data is generated under `src/game/elite-a/`; lookup and combat
  profiles enter through its catalogue. Hull lookup enters through
  `src/ships/registry.ts`.
- Ship definitions use the source convention, +Z nose. `buildShip()` rotates
  them half a turn around Y to face three.js forward (−Z); it does not mirror
  them.
- Ships combine wireframe `LineSegments` with a polygon-offset black mesh. A
  logarithmic depth buffer disables that offset and must not be enabled.

## Combat and pilots

- `src/game/npc.ts` owns NPC behaviours. `brain-names.ts` is the source of truth
  for pilot assignment; `brains.ts` currently imports no trained weights.
- `pursuit` flies shipped opposition. `attack-run` names defensive flying: the
  armed trader's three-phase run and the player's pure-pursuit combat computer.
  `scripted` is the A/B control that restores the plain attack run and disables
  defence.
- `src/ai-training/scenario.ts` builds episodes from real `NpcShip`, `PlayerShip`,
  gunnery, collision, RNG and fixed-step modules. Only fitness, observations,
  opponent pools and other training concerns belong to the trainer.
- `src/game/fire-resolution.ts` is the shared shot resolver used by the game and
  trainer. Presentation stays with the caller; shield selection lives once in
  `shield-face.ts`. `test/fire-resolution.test.ts` checks both callers agree.
- `src/game/threat.ts` computes pirate count, group tier and organisation from
  visible value and reputation. `ship-specs.ts` maps tiers to hulls. The campaign
  simulator calls the same rules.
- `src/game/contracts.ts` owns the bulletin board: what work a station offers,
  what accepting it costs the hold, what delivering it pays. `src/game/market.ts`
  owns what a station charges. Both are pure and shared with the campaign
  simulator (invariant 10).

## Conventions

- `src/constants/CATALOG.md` is generated from exported constants and their
  comments. Use `npm run constants:find` for discovery and `constants:check`
  before adding or changing a rule.
- Money is integer tenths of a credit; fuel is tenths of a light-year.
- Forward is −Z; pitch is local X, roll is local Z, and nose-up is +X.
- Chart distance is `4·sqrt(dx² + (dy/2)²)` in tenths of a light-year; chart Y
  is drawn at half scale.
- Saves are atomic single records owned by `storage.ts`. IDs distinguish named
  saves, dock checkpoints and the three-entry flight ring; see invariant 3 and
  `save-file.ts` for the key grammar.
- World randomness comes only from seeded `game/rng.ts`; training episodes must
  not interleave because each reseeds the world stream.
- Flight bindings live in `engine/keymap.ts`; command bindings and descriptions
  live in `controls.ts` and `command-help.ts`. `ui/key-help.ts` renders the help
  panel, manual and dock menu from those tables.
- Supported debug handles are `window.__game`, `window.__policyKit`,
  `state.brains.scripted` and `state.cheat`. They expose or alter explicit state;
  world logic does not read ambient globals.
