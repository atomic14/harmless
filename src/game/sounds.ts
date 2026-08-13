// What a rule module asks to be HEARD — without knowing how a sound is made.
//
// The world step and the autopilots both reach moments that should make a
// noise, and neither may call `audio.ts` to do it: that import is a browser
// import, and it was the only thing left standing between the deepest module in
// the project and running under node. It survived at all because `audio.ts`
// swallows a constructor failure, which is a load-bearing accident rather than
// a seam.
//
// So they return a `SoundEvent` and the orchestrator plays it — the same
// "decides and reports" split as every other `apply*`.
//
// ONE type, included by both `StepEvent` and `AutopilotEvent`, so `game.ts` has
// ONE place that turns a sound event into a call. Two near-identical `beep`
// kinds applied in two switches would be a smaller copy of the problem this
// file exists to remove.
//
// The three-import rule holds: `import type * as THREE` is erased, so this file
// still costs a headless run nothing (docs/TODO/142). It is the form
// game/fire-resolution.ts already uses for the same reason.

import type * as THREE from 'three';

/** A sound `audio.ts` names for its occasion rather than its construction. */
export type SoundName =
  | 'laser'
  | 'hit'
  | 'damage'
  | 'explosion'
  | 'noMissiles'
  | 'noEnergy'
  | 'missileArmed'
  | 'missileUnarmed'
  | 'missileLocked'
  | 'missile'
  | 'ecm'
  | 'dock'
  | 'launch'
  | 'tunnel'
  | 'enemyLaser'
  | 'refused'
  | 'torusDropped'
  | 'lowEnergy'
  | 'survivorScooped'
  | 'cargoScooped'
  | 'trumbleAte'
  | 'generationShipFound'
  | 'contractPaid'
  | 'contractExpired'
  | 'contractAccepted'
  | 'dockingComputerEngaged'
  | 'combatComputerEngaged';

/** A sound a rule module asks for. `game.ts` is the only thing that plays one. */
export type SoundEvent =
  /**
   * The hyperspace countdown, `n` seconds to go.
   *
   * Named rather than beeped because the pitch was `700 + (5 - n) * 100`
   * computed inside the world step — audio design expressed as arithmetic in
   * the simulation. `audio.ts` owns the sweep now.
   */
  { kind: 'countdown'; n: number }
  /** the C64 tradition, synthesised — see audio.ts */
  | { kind: 'dockingMusic'; on: boolean }
  /**
   * A named sound, and where in the world it happened (docs/TODO/142).
   *
   * `at` is OPTIONAL, and the two states mean different things. A sound with a
   * place happened somewhere the pilot is not — a wreck, a bolt striking a
   * hull, a ship that opened fire. A sound without one is the cockpit's own,
   * and it plays as it always has.
   *
   * WHAT IT DOES WITH THE PLACE IS NOT DECIDED HERE. This says where; audio.ts
   * decides how loud and which ear, the same bargain `countdown` struck when the
   * pitch arithmetic left the world step. `enemyLaser` is why that split earns
   * its keep: it is placed and never attenuated, because the bolt it names is
   * only ever fired AT you and always ends on the hull.
   *
   * The vector must be one nothing else will move. `Combat.wreck` despawns the
   * ship two lines after it reports, so it clones.
   */
  | { kind: 'sound'; name: SoundName; at?: THREE.Vector3 };
