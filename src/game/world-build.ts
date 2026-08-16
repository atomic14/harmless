// Build the sky, and fill it.
//
// Split out of `game.ts` by docs/TODO/150 M2. Three modules own the rules:
//
//   - `spawning.ts` places the ships;
//   - `population.ts` decides how many, and of what;
//   - `blueprint-set.ts` decides which of the 23 released rosters a system
//     flies.
//
// This file is the WIRING that spends all three. It also carries the two
// consequences a new sky has: the arrival record that `jettisonCargo` later
// reads, and the announcements.
//
// ONE RESPONSIBILITY: what is in the sky when you get there. Four faces of that
// one question live here:
//
//   1. the scene, built;
//   2. the roster, chosen;
//   3. the drop into witch-space;
//   4. a system filled, on a launch or on an arrival.
//
// THE ORDER INSIDE `enterWitchspace` IS LOAD-BEARING, and it travels with it:
// the flag, then the set, then the world built with it. The build reads the
// set. A build before the choice would fly the previous system's roster into
// limbo.

import * as THREE from 'three';
import { blueprintRandomBits, blueprintSetFor } from './blueprint-set.ts';
import { specsForSet } from './set-roster.ts';
import { constrictorLurksHere, missionBlueprintOverride } from './missions.ts';
import { planPopulation } from './population.ts';
import { markOf, pirateThreat } from './threat.ts';
import { spawnPopulation } from './spawning.ts';
import { random, randomDirection } from './rng.ts';
import type { NpcShip } from './npc.ts';
import type { NpcRole } from './ship-roles.ts';
import type { NpcSpec } from './ship-specs.ts';
import type { StarSystem } from '../galaxy/galaxy.ts';
import type { GameState } from './state.ts';
import {
  THARGOID_AMBUSH_MIN, THARGOID_AMBUSH_EXTRA_CHANCE, THARGOID_AMBUSH_RANGE,
  THARGOID_AMBUSH_RANGE_SPAN, WITCHSPACE_ENTRY_SPEED,
} from '../constants/witchspace.ts';
import { THARGON_REDEPLOY } from '../constants/encounters.ts';

/**
 * What a new sky has to reach back to the Game for.
 *
 * FIVE, and every one is a thing the orchestrator owns rather than a rule:
 *
 *   1. the console;
 *   2. and 3. the two pieces of cockpit furniture that react to a new system;
 *   4. the sound;
 *   5. which system we stand in.
 *
 * No rule sits behind this interface. That is what makes this file portable
 * while `game.ts` is not.
 */
export interface WorldBuildHost {
  showMessage(text: string, seconds: number): void;
  /** the HUD's system readout — a new sky means a new name on it */
  setSystem(sys: StarSystem): void;
  /** the launch/arrival tunnel effect */
  startTunnel(seconds: number): void;
  hyperspaceSound(): void;
  system(): StarSystem;
}

export class WorldBuild {
  private readonly state: GameState;
  private readonly host: WorldBuildHost;

  constructor(state: GameState, host: WorldBuildHost) {
    this.state = state;
    this.host = host;
  }

  /** @internal — driven by src/game/game.ts, which delegates to it. */
  buildWorld(): void {
    this.state.world.build(this.host.system(), specsForSet(this.state.session.blueprintSet || null));
    this.host.setSystem(this.host.system());
  }

  /**
   * Which of the 23 released blueprint sets this system flies, drawn once.
   *
   * ONE DRAW, AT ARRIVAL, AND THEN IT IS STATE. Bits 2-3 of the source's number
   * are a coin it flipped on entry, and invariant 11 puts all world chance on
   * the one seeded stream. So the draw happens here, right after
   * `arriveInSystem` seeded that stream from where and when you are. The letter
   * is kept in `session`, where a save carries it (invariant 12).
   *
   * HARMLESS CHOOSES ON ARRIVAL ONLY. The released game also reloaded on a
   * launch from a station. The difference is that Harmless does not tear the
   * system down when you dock. The world you launch into is the world you
   * docked out of, ships and all. So there is no second entry to choose at. A
   * roster that changed while the sky did not would be a worse answer than the
   * faithful one.
   *
   * An override the mission raises WHILE YOU ARE DOCKED therefore takes effect
   * at the next arrival. The courier orders come at a dock. The system you stand
   * in does not restock its sky because you accepted them.
   *
   * THE OVERRIDE IS NAMED HERE AND DECIDED IN TWO PLACES. `blueprint-set.ts`
   * takes one and never works one out, `missions.ts` owns the two mission
   * stages, and witch-space is the Game's own flag. Limbo is asked first,
   * because a mis-jump on the hunting leg is still limbo — the Constrictor waits
   * in a system, and this is not one.
   */
  chooseBlueprintSet(): void {
    const override = this.state.session.witchspace
      ? 'thargoid' as const : missionBlueprintOverride(this.state.commander);
    // NO DRAW BEHIND AN OVERRIDE. `blueprintSetFor` does not consult the number
    // while one is in force, so nothing reads the 0 below. A draw made to fill
    // it would spend the seeded stream on a value nothing reads. It would also
    // move the Thargoid ambush that `enterWitchspace` rolls two lines below.
    const bits = override === null ? blueprintRandomBits(random()) : 0;
    this.state.session.blueprintSet = blueprintSetFor(
      this.host.system(), this.state.commander.galaxy, bits, override);
  }

  /**
   * Witch-space: mis-jump limbo. We reuse the system scene but banish the
   * planet, station and sun beyond reach — just stars, and Thargoids.
   *
   * The set is chosen again here, and it is the released override. Limbo flies
   * one of the two blueprint files that carry Thargoids. The tech level of the
   * system the mis-jump left you in picks between them. A mis-jump does not move
   * `commander.systemIndex`: the target is retained for the escape jump, and for
   * nothing else.
   */
  /** @internal — driven by src/game/game.ts, which delegates to it. */
  enterWitchspace(): void {
    this.state.session.witchspace = true;
    // The flag first, then the set, then the world that is built with it.
    this.chooseBlueprintSet();
    this.buildWorld();
    this.state.world.banishScenery();
    this.state.player.position.set(0, 0, 0);
    this.state.player.speed = WITCHSPACE_ENTRY_SPEED;
    const n = THARGOID_AMBUSH_MIN + (random() < THARGOID_AMBUSH_EXTRA_CHANCE ? 1 : 0);
    for (let i = 0; i < n; i++) {
      this.state.world.spawn('thargoid',
        randomDirection(new THREE.Vector3())
          .multiplyScalar(THARGOID_AMBUSH_RANGE + random() * THARGOID_AMBUSH_RANGE_SPAN), i);
    }
    this.state.encounterTimers.thargon = THARGON_REDEPLOY;
    this.host.hyperspaceSound();
    this.host.startTunnel(1.1);
    this.host.showMessage('WITCH-SPACE — THARGOID AMBUSH', 6);
  }

  /** @internal — driven by src/game/game.ts, which delegates to it. */
  spawnNpc(role: NpcRole, position: THREE.Vector3, seed: number, spec?: NpcSpec): NpcShip {
    return this.state.world.spawn(role, position, seed, spec);
  }

  /**
   * Station space is policed, so a launch meets legitimate traffic only. An
   * arrival from hyperspace drops pirates along the corridor to the station.
   *
   * The rules are in population.ts, and the placement is in spawning.ts. This
   * is the wiring, plus the consequences: the arrival record that jettisonCargo
   * later reads, and the two announcements.
   */
  populateSystem(situation: 'launch' | 'arrival'): void {
    const sys = this.host.system();
    const plan = planPopulation(
      sys, situation,
      this.state.living.imminentArrivals(sys.index).length,
      // Pirates are businesses. Lawlessness and the galaxy's own traffic set
      // how many are out here. What you visibly carry sets who they are, and
      // whether they took the trouble to organise.
      situation === 'arrival'
        ? pirateThreat(sys, this.state.living.danger(sys.index),
          markOf(this.state.commander, this.state.living.notoriety(sys.index)))
        : null,
    );

    const constrictorHere = situation === 'arrival' && constrictorLurksHere(this.state.commander);

    const built = spawnPopulation(
      this.state.world, plan, sys, this.state.player.position, constrictorHere, situation);

    if (plan.threat) {
      this.state.lastThreat = plan.threat;
      this.state.session.jettisonedValue = 0;
      this.state.session.arrivalCargoValue = markOf(this.state.commander).cargoValue;
      // The carrot half of a bad name (docs/TODO/96): somebody out there
      // recognised it and called the reception off. Said aloud, because a
      // reception that never forms is otherwise indistinguishable from a quiet
      // system and the player would never learn the rule.
      if (plan.threat.passed) {
        this.host.showMessage('PIRATE CHANNEL: "LEAVE THAT ONE"', 4);
      }
    }
    if (built.generationShip) this.state.session.genShipSeen = false;
    if (built.missionTarget) {
      this.host.showMessage('SCANNER: UNREGISTERED PROTOTYPE DETECTED', 5);
    }
  }
}
