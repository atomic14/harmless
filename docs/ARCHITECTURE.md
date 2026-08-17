# Architecture

**One world state. A pure step advances it. Rendering only reads it.** Keep each
file focused. Define each rule one time. `INVARIANTS.md` is the authority on the
rules. This file is a map.

## Core boundaries

- `src/game/game.ts` is the orchestrator. It owns which mode the game is in. It
  hands each frame to the child that answers for that mode. It owns nothing
  else. A module decides and reports; an orchestrator applies the effect. For
  example, an NPC returns a fire event, a collision returns a pair, an encounter
  asks for a spawn, and a screen returns an outcome.
- `src/game/world.ts` owns the entities. One place holds the ships, the cargo,
  the effects and the system's scenery. A module that needs the sky takes a
  `World`. The spawn is there, and `Game.spawnNpc` only forwards to it.
- `src/game/world-step.ts` holds the headless flight loop. `persistence.ts` holds
  persistence. `station.ts` holds the dock transition and the launch transition.
  `snapshot.ts` says what a saved world IS. `snapshot-parse.ts` is the door that
  untrusted bytes come through.
- `src/engine/shell.ts` is the platform seam. `browser-shell.ts` owns access to
  the browser and to the DOM. `render-stack.ts` is the only module that depends
  on the GPU. The controls read an input interface, not the browser. Two pointer
  seams cross the platform seam. `onScreenClick` is input. `onScreenMove` reports
  only: a screen may repaint what it describes, but it must never select or
  spend.
- The HUD is a read-only painter, and it is three files. `hud/hud-model.ts`
  works out where a marker goes. `hud-binding.ts` turns the state into a
  dashboard. `hud.ts` paints one. A screen lives behind `ui/screen-host.ts`, and
  it reaches the page through `ui/screen-shell.ts`. A screen owns its own
  rendering, its own input and its own local state.
- `src/game/prompts.ts` decides what a key can do about the situation right now.
  It returns a `Command` and words. It never returns a letter. `cockpit-view.ts`
  looks the label up, through `ui/key-help.ts`. That is how invariant 9 reaches
  prose. A prompt is derived state, and the code saves nothing about it.
- The console is one line, so `SessionState.queued` is the line that waits for it
  (`session.ts`). Some consequences make sense only after their cause: what a
  scan cost your legal record, or what a deed cost your reputation. The console
  queues such a consequence; it does not say it at once. `tickMessage` promotes
  it when the console falls quiet, docked or in flight. A message event carries
  `queued`, so a pure module can ask for the same treatment. A deed gets this
  order: **what you did → what the sky did about it → where you now stand**.
  `law.ts`'s `recordVerdict` is the one home of what a moved record says. Two
  rules in `law-actions.ts` reach it. One raises a record. The other works one
  off. `law.ts`'s `harmVerdict` is the one home of the FIRST half, for a shot
  that lands on a ship the law protects. `combat.ts` asks it on the frame the
  ship turns against the commander, so it speaks once per ship
  (docs/TODO/173).

### The orchestrator's children

**Two halves split what a commander does.** Neither half reaches into the other.

- `docked.ts` — what she does once the ship stops. The arrival, the menu, the
  market, the outfitters and the board are here.
- `flight.ts` — what she does in the sky. That is one slice of time advanced,
  and who is at the controls for it. It has two children of its own:
  - `flight-weapons.ts` — what the ship spends, and what it takes. Laser fire is
    here.
  - `flight-instruments.ts` — the switches that change who flies the ship.

A step that ends in a dock, a jump, a tow or a death reports that end to
`game.ts`. The orchestrator then decides what the game becomes.

**Seven more children each hold one subject**, beside the rules that each one
spends:

- `world-build.ts` — what is in the sky when you arrive.
- `cockpit-view.ts` — what the cockpit shows about the world.
- `law-actions.ts` — what the law does to a commander. It applies a record.
- `hyperspace-actions.ts` — how a commander leaves a system, and how she arrives
  in one. The jump is here.
- `career.ts` — what a career keeps when a flight ends.
- `persistence.ts` — the world written down, and put back.
- `ui/screen-host.ts` — the screen stack.

Each child's own module header is the long form. This map says where a thing
lives, and it restates no rule.

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
  `ui/chart-galactic.ts` and `ui/chart-local.ts` paint the stars.
  `ui/chart-overlays.ts` paints the marks over them, and it paints only what
  those models return. `game/chart-overlay.ts` names the modes that `T` cycles
  through, and carries the result. The Game owns the current mode, so both
  charts show the same one.
- `src/galaxy/navigation.ts` owns the chart metric and the cost of one jump.
  `src/galaxy/route.ts` answers the same question for a journey of several
  jumps. It searches over edges of one full tank, because fuel costs money and
  no days. Both modules are pure, and the charts print what they return.
- `src/game/spawning.ts` places a system's traffic: the traders, the police, the
  rocks, the hermit and the reception that waits for you.
  `spawning-arena.ts` places a combat-training exercise instead. The two share
  the idea of a scatter, and they answer to different constants.
- A generator writes the released ship data under `src/game/elite-a/`. The
  lookup and the combat profiles enter through its catalogue. The hull lookup
  enters through `src/ships/registry.ts`.
- A ship definition uses the source convention, a +Z nose. `buildShip()` rotates
  it half a turn around Y, to face three.js forward (−Z). It does not mirror it.
- A ship combines wireframe `LineSegments` with a black mesh that carries a
  polygon offset. A logarithmic depth buffer disables that offset. Never enable
  one.

## Combat and pilots

- `src/game/npc.ts` owns the NPC behaviours. `hostility.ts` owns one rule over
  a fleet: it answers whether a ship attacks the commander, and it names no
  ship class (docs/TODO/169). `trader-flight.ts` owns a trader's working life:
  it arrives, it works the lane, then it docks or it leaves. It names no ship
  class either (docs/TODO/176). `flight-maths.ts` owns the nose, the thrust and
  the throttle rules that the ships, the trainer, the two spawners and the HUD's
  lead marker all share. `brain-names.ts` is the source of truth for a
  pilot assignment. `brains.ts` imports no trained weights today.
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
  both callers agree. `combat.ts` takes each ingredient separately, so a test can
  drive it. `combat-player.ts` is the assembly step that builds the player's own
  trigger out of one `GameState`.
- `src/game/threat.ts` computes the pirate count, the group tier and the
  organisation from the visible value and the reputation. `ship-specs.ts` maps a
  tier to a hull. The campaign simulator calls the same rules.
- Which hulls a system can send is three modules, and each answers one part.
  `ship-roles.ts` says which designs a role may EVER fly. That is permission.
  `blueprint-set.ts` says which one of the 23 released sets a system flies.
  `set-roster.ts` says what that one set files under each job. That is
  selection. A design must pass permission and selection both. The set is drawn
  once on arrival, and it is saved state. Two released overrides can answer in
  place of that number: the Navy mission raises one, and witch-space raises the
  other. `missions.ts` and `world-build.ts` name the override. Each of the three
  module headers holds the rule and the measurement behind it.
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
- `src/game/contract-eta.ts` owns what the CHARTS say about a job you hold.
  That is three things: the worlds to mark, the words of the verdict, and
  whether the deadline still holds. It is pure, and it paints nothing. It takes the commander, not a day
  number, so a caller cannot measure a deadline from the living galaxy's day by
  mistake.
- `src/game/orders.ts` lists everything a commander is under orders to do. The
  game has two kinds of standing order: a signed contract, and the Navy mission.
  This module asks both kinds the same question, so the menu line, the MISSIONS
  screen and the charts cannot hold three answers. Invariant 16 lives here. It
  restates no words: a contract reads through `contract-offers.ts`, and the
  mission through `missions.ts`.
- `src/game/character.ts` owns the disrepute ladder. It owns what a score is
  CALLED, and how a deed and a quiet week move it. It also owns whether a move
  crossed a rung that the pilot must hear about. Every deed in the game asks it
  the same
  question, so no site is free to disagree about what a crossing is.
- `src/game/survivors.ts` owns what becomes of a person that you scoop out of a
  capsule. `screens/survivors.ts` forces that choice when you dock. The module
  is pure, like the two modules above. It clears the crew spaces and reports.
  The orchestrator applies the heat and the record that a sale earns. It
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
