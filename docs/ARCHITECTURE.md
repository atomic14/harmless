# Architecture

**One world state. A pure step advances it. Rendering only reads it.** Keep each
file focused. Define each rule one time. `INVARIANTS.md` is the authority on the
rules. This file is a map.

## Core boundaries

- `src/game/game.ts` owns the entities and orchestrates each frame. A module
  decides and reports; the game applies the effect. For example, an NPC returns
  a fire event, a collision returns a pair, an encounter asks for a spawn, and a
  screen returns an outcome.
- `src/game/world-step.ts` holds the headless flight loop. `persistence.ts` holds
  persistence. `station.ts` holds the dock transition and the launch transition.
- `src/engine/shell.ts` is the platform seam. `browser-shell.ts` owns access to
  the browser and to the DOM. `render-stack.ts` is the only module that depends
  on the GPU. The controls read an input interface, not the browser. Two pointer
  seams cross the platform seam. `onScreenClick` is input. `onScreenMove` reports
  only: a screen may repaint what it describes, but it must never select or
  spend.
- The HUD is a read-only painter. `hud-model.ts` computes the frame model, and
  `hud.ts` renders it. A screen lives behind `ui/screen-host.ts`. It owns its own
  rendering, its own input and its own local state.
- `src/game/prompts.ts` decides what a key can do about the situation right now.
  It returns a `Command` and words. It never returns a letter. The edge looks the
  label up (`game.ts`, through `ui/key-help.ts`), which is how invariant 9
  reaches prose. A prompt is derived state, and the code saves nothing about it.
- The console is one line, so `SessionState.queued` is the line that waits for it
  (`session.ts`). Some consequences make sense only after their cause: what a
  scan cost your record, or what a deed cost your name. The console queues such a
  consequence; it does not say it at once. `tickMessage` promotes it when the
  console falls quiet, docked or in flight. A message event carries `queued`, so
  a pure module can ask for the same treatment. A deed gets this order: **what
  you did → what the sky did about it → where you now stand**. `Game.raiseLegal`
  says nothing over its own cause. It is the one home of what a moved record
  says (`recordVerdict`).

Laser fire, spawning and the hyperspace transition still stay in `game.ts`.

Two quirks are deliberate:

- Witch-space reuses a normal system scene. That scene moves its bodies to ±1e8.
- The tests measure docking in station-local space. They measure it against the
  slot on the station's −Z face, and against the roll alignment.

## World and ships

- `src/galaxy/galaxy.ts` generates the 1984 galaxy from seeds. No table ever
  stores it. `world/system-scene.ts` and the planet shader derive the system
  visuals from the same seed.
- `src/galaxy/living.ts` advances the off-screen trade in whole days. It stores
  only deltas: the convoys, the danger and a bounded price pressure.
  `populateSystem` turns each arrival record into a ship. Its `prewarm` gives
  `PREWARM_DAYS` of history to a galaxy that nobody saved yet, on a derived
  stream. A new career and a galactic jump therefore both arrive in an economy
  that already runs. Three read-only models decide what the charts draw over it:
  `danger-overlay.ts`, `trade-lanes.ts` and `price-divergence.ts`.
  `ui/screens.ts` paints only what those models return. `game/chart-overlay.ts`
  names the modes that `T` cycles through, and carries the result. The Game owns
  the current mode, so both charts show the same one.
- `src/galaxy/navigation.ts` owns the chart metric and the cost of one jump.
  `src/galaxy/route.ts` answers the same question for a journey of several
  jumps. It searches over edges of one full tank, because fuel costs money and
  no days. Both modules are pure, and the charts print what they return.
- A generator writes the released ship data under `src/game/elite-a/`. The
  lookup and the combat profiles enter through its catalogue. The hull lookup
  enters through `src/ships/registry.ts`.
- A ship definition uses the source convention, a +Z nose. `buildShip()` rotates
  it half a turn around Y, to face three.js forward (−Z). It does not mirror it.
- A ship combines wireframe `LineSegments` with a black mesh that carries a
  polygon offset. A logarithmic depth buffer disables that offset. Never enable
  one.

## Combat and pilots

- `src/game/npc.ts` owns the NPC behaviours. `brain-names.ts` is the source of
  truth for a pilot assignment. `brains.ts` imports no trained weights today.
- `pursuit` flies the shipped opposition. `attack-run` names the defensive
  flight logic: the armed trader's three-phase run, and the player's
  pure-pursuit combat computer. `scripted` is the A/B control. It restores the
  plain attack run and disables the defence.
- `src/ai-training/scenario.ts` builds each episode from the real modules:
  `NpcShip`, `PlayerShip`, gunnery, collision, RNG and the fixed step. Only the
  trainer's own concerns belong to the trainer — fitness, observations and
  opponent pools.
- `src/game/fire-resolution.ts` is the shared shot resolver. The game and the
  trainer both call it. Presentation stays with the caller. The shield selection
  lives one time, in `shield-face.ts`. `test/fire-resolution.test.ts` checks that
  both callers agree.
- `src/game/threat.ts` computes the pirate count, the group tier and the
  organisation from the visible value and the reputation. `ship-specs.ts` maps a
  tier to a hull. The campaign simulator calls the same rules.
- Which hulls a system can send is three modules, and each answers one part.
  `ship-roles.ts` says which designs a role may EVER fly, read off all 23
  released blueprint sets at once. That is permission. `blueprint-set.ts` says
  which one of those 23 sets a system flies, as a pure function of the system,
  the galaxy and two random bits. `set-roster.ts` says what that one set files
  under each job. That is selection. A design must pass permission and selection
  both. The set is drawn once on arrival, and it is saved state.
- `src/game/contract-offers.ts` owns what the bulletin board offers today, and
  how each job reads. `src/game/contracts.ts` owns the rest of a contract's
  life: what acceptance costs the hold, what a delivery pays, and what a failure
  costs. On a failure the freight goes back, and the contract bills you for the
  part that you cannot hand back. `src/game/market.ts` owns what a station
  charges. All three modules are pure, and the campaign simulator shares them
  (invariant 10). The place where the state lives splits a contract's
  consequences. Settlement applies the commander's disrepute, and it credits
  itself. The orchestrators apply the destination's regional heat from the
  `paid` event, one time each (invariant 15). Those orchestrators are
  `Game.applyContracts` and the campaign's settle site.
- `src/game/contract-eta.ts` owns what the CHARTS say about a job you hold: the
  worlds to mark, the words of the verdict, and whether the deadline still
  holds. It is pure, and it paints nothing. It takes the commander, not a day
  number, so a caller cannot measure a deadline from the living galaxy's day by
  mistake.
- `src/game/character.ts` owns the disrepute ladder. It owns what a score is
  CALLED, how a deed and a quiet week move it, and whether a move crossed a rung
  that the pilot must hear about. Every deed in the game asks it the same
  question, so no site is free to disagree about what a crossing is.
- `src/game/survivors.ts` owns what becomes of a person that you scoop out of a
  capsule. `screens/survivors.ts` forces that choice when you dock. The module
  is pure, like the two modules above: it clears the crew spaces and reports,
  and the orchestrator applies the heat and the record that a sale earns. It
  never touches `cargo`, because a rescued pilot is not stock.

## Conventions

- A generator writes `src/constants/CATALOG.md` from the exported constants and
  their comments. Use `npm run constants:find` to find a constant. Run
  `constants:check` before you add or change a rule.
- Money is integer tenths of a credit; fuel is tenths of a light-year.
- Forward is −Z. Pitch is local X. Roll is local Z. Nose-up is +X.
- Chart distance is `4·sqrt(dx² + (dy/2)²)`, in tenths of a light-year. The
  chart draws Y at half scale.
- A save is one atomic record, and `storage.ts` owns it. The ID separates a
  named save, a dock checkpoint and the three-entry flight ring. For the key
  grammar, see invariant 3 and `save-file.ts`.
- World randomness comes only from the seeded `game/rng.ts`. Two training
  episodes must never interleave, because each one reseeds the world stream.
- The flight bindings live in `engine/keymap.ts`. The command bindings and their
  descriptions live in `controls.ts` and `command-help.ts`. `ui/key-help.ts`
  renders the help panel, the manual and the dock menu from those tables.
- The supported debug handles are `window.__game`, `window.__policyKit`,
  `state.brains.scripted` and `state.cheat`. They expose or change explicit
  state. World logic does not read an ambient global.
