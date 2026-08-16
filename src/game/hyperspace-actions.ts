// Leaving a system, and arriving in one.
//
// The ORCHESTRATION half of the jump, split out of `game.ts` by docs/TODO/150
// M4. `hyperspace.ts` next door owns the RULES, and states them in its own
// opening; this holds what the Game does with them: starting the countdown,
// spending the days, dropping the ship at the witchpoint, crossing to the next
// galaxy, and the tow when a mis-jump leaves you stranded.
//
// ONE RESPONSIBILITY: what a jump does to the world. Five ways in and out of a
// system, and every one of them ends at `arriveInSystem`.
//
// THE TOW IS THE JUMP GONE WRONG, which is why the distress beacon is here
// rather than beside the contracts. A beacon is only legal in witch-space, and
// `completeRescue` pays the days, decays the record and arrives — the same
// three steps as `completeHyperspace`, at a different price.
//
// A GALAXY'S HISTORY IS ARRIVAL-SHAPED TOO. `loadOrWarmGalaxy` runs at a boot
// and at a respawn, `galacticJump` warms a galaxy no save describes, and both
// draw the seed the same way. The seam is one rule, so it has one home.

import * as THREE from 'three';
import { COMMODITIES, type StarSystem } from '../galaxy/galaxy.ts';
import { LivingGalaxy, prewarm } from '../galaxy/living.ts';
import {
  checkJump, resolveJump, refusalMessage,
  checkGalacticJump, resolveGalacticJump, galacticRefusalMessage,
} from './hyperspace.ts';
import { afterDecay } from './character.ts';
import { freshTimers } from './encounters.ts';
import { randomDirection, rngState, seedWorld } from './rng.ts';
import type { WorldBuild } from './world-build.ts';
import type { GameState } from './state.ts';
import { COUNTDOWN, WITCHSPACE_ESCAPE_COST } from '../constants/jump.ts';
import { WITCHPOINT_RADII } from '../constants/planet.ts';

/**
 * What a jump has to reach back to the Game for.
 *
 * Nothing here is a rule. Four of them are the machine — the console, the
 * cockpit tunnel and the two sounds a jump makes — and the other three are
 * facts only the orchestrator holds: where we are standing, where the nose
 * points, and whether this is the simulator rather than the sky.
 *
 * THE SIMULATOR IS A ROOM AT THE STATION, not a place you can leave. It is a
 * question about the Game rather than about the commander, so the child asks
 * rather than reads.
 */
export interface HyperspaceHost {
  showMessage(text: string, seconds: number): void;
  /** a deed moved the Character score — see game/character.ts */
  markCharacter(before: number, after: number): void;
  /** the system we are standing in */
  system(): StarSystem;
  /** point the ship down a direction — the arrival faces the witchpoint in */
  lookAlong(dir: THREE.Vector3): void;
  /** the launch/arrival tunnel effect */
  startTunnel(seconds: number): void;
  inSimulator(): boolean;
  refused(): void;
  countdownSound(seconds: number): void;
  hyperspaceSound(): void;
  distressBeaconSound(): void;
}

export class HyperspaceActions {
  private readonly state: GameState;
  /** the sky the arrival builds — a collaborator, because four calls reach it */
  private readonly world: WorldBuild;
  private readonly host: HyperspaceHost;
  /** scratch, so an arrival does not allocate a vector to face the witchpoint */
  private readonly scratch = new THREE.Vector3();

  constructor(state: GameState, world: WorldBuild, host: HyperspaceHost) {
    this.state = state;
    this.world = world;
    this.host = host;
  }

  /** @internal — driven by src/game/game.ts, which delegates to it. */
  startHyperspace(): void {
    // The simulator is a room at the station, not a place you can leave: the
    // exercise's StepHost refuses `completeHyperspace` anyway, so without this
    // the countdown would run and then silently do nothing.
    if (this.host.inSimulator()) {
      this.host.showMessage('HYPERSPACE IS OFFLINE IN THE SIMULATOR', 3);
      this.host.refused();
      return;
    }
    const check = checkJump(this.state.commander, this.state.systems, this.state.chart.targetIndex,
      this.state.session.witchspace, this.state.session.hyperCountdown >= 0,
      // JUMP ANYWHERE (docs/TODO/121): the flag goes IN, and the refusal stays
      // where it was decided. Nothing here reads the tank.
      this.state.cheat);
    if (!check.ok) {
      if (check.reason === 'alreadyJumping') return;
      this.host.showMessage(refusalMessage(check.reason, this.state.session.witchspace), 4);
      this.host.refused();
      return;
    }
    this.state.session.hyperCountdown = COUNTDOWN;
    this.host.showMessage(`HYPERSPACE IN ${COUNTDOWN}`, 1.2);
    this.host.countdownSound(COUNTDOWN);
  }

  /** @internal — driven by src/game/game.ts, whose step host reaches it. */
  completeHyperspace(): void {
    const target = this.state.chart.targetIndex!;
    const jump = resolveJump(this.state.commander, this.state.systems, target, this.state.session.witchspace);
    if (jump.misjump) {
      this.world.enterWitchspace(); // target retained for the escape jump
      return;
    }
    this.state.living.advance(jump.days, COMMODITIES.map((c) => c.gradient));
    // the galaxy forgets a little on the way — a jump is days of honest
    // distance, and falling back down a rung is the one piece of good news the
    // character system has, so it is said too (docs/TODO/129)
    const wasDisrepute = this.state.commander.disrepute ?? 0;
    this.state.commander.disrepute = afterDecay(wasDisrepute, jump.days);
    this.host.markCharacter(wasDisrepute, this.state.commander.disrepute);
    this.state.chart.targetIndex = null;
    this.arriveInSystem();
    this.host.showMessage(`ARRIVED: ${this.host.system().name.toUpperCase()}`, 4);
  }

  /** @internal — driven by src/game/game.ts, which delegates to it. */
  arriveInSystem(): void {
    // Seed the world from WHERE and WHEN you are, so a given save arriving in
    // a given system on a given day meets the same reception twice. Without
    // this the fixed timestep buys repeatable physics and nothing else.
    seedWorld(this.state.commander.galaxy * 0x9e3779b1
      ^ (this.state.commander.systemIndex << 8) ^ this.state.commander.day);
    this.state.session.witchspace = false; // any arrival leaves witch-space (incl. galactic jump)
    // Before the world is built, because the roster it is built with is this.
    this.world.chooseBlueprintSet();
    this.world.buildWorld();
    // Arrive at the witchpoint, well out — the classic long torus cruise in.
    // Bearing is biased to the station's side of the planet (~30° cone) so
    // the planet never blocks the run.
    const stationDir = this.state.world.station.position.clone().normalize();
    const dir = stationDir
      .add(randomDirection(new THREE.Vector3()).multiplyScalar(0.5))
      .normalize();
    this.state.player.position.copy(dir.multiplyScalar(this.state.world.planetRadius * WITCHPOINT_RADII));
    this.host.lookAlong(this.scratch.copy(this.state.player.position).negate());
    this.state.player.speed = 250;
    this.state.session.policeScanned = false;
    this.state.encounterTimers = freshTimers();
    this.world.populateSystem('arrival');
    this.host.hyperspaceSound();
    this.host.startTunnel(1.1);
  }

  /**
   * Stranded in witch-space without the fuel to jump clear: GalCop will come
   * for you, at a price — your cargo pays the salvage fee.
   *
   * @internal — driven by src/game/game.ts, which delegates to it.
   */
  sendDistressBeacon(): void {
    if (!this.state.session.witchspace) {
      this.host.showMessage('DISTRESS BEACON IS FOR EMERGENCIES ONLY', 3);
      this.host.refused();
      return;
    }
    if (this.state.session.beaconTimer >= 0) {
      this.host.showMessage('BEACON ALREADY BROADCASTING', 2);
      return;
    }
    this.state.session.beaconTimer = 20;
    this.host.showMessage('DISTRESS BEACON BROADCAST — HOLD ON, COMMANDER', 6);
    this.host.distressBeaconSound();
  }

  /** @internal — driven by src/game/game.ts, whose step host reaches it. */
  completeRescue(): void {
    const c = this.state.commander;
    const salvage = c.cargo.reduce((s, q) => s + q, 0);
    c.cargo = c.cargo.map(() => 0);
    // enough for one jump clear, which is what the escape costs — the same
    // number the step's stranded hint is offered below.
    c.fuel = Math.max(c.fuel, WITCHSPACE_ESCAPE_COST);
    this.state.session.beaconTimer = -1;
    // dumped at the nearest system to where the mis-jump left us
    const target = this.state.chart.targetIndex ?? c.systemIndex;
    c.systemIndex = target;
    c.day += 3; // the tow takes a while
    this.state.living.advance(3, COMMODITIES.map((cm) => cm.gradient));
    const wasDisrepute = c.disrepute ?? 0;
    c.disrepute = afterDecay(wasDisrepute, 3);
    this.host.markCharacter(wasDisrepute, c.disrepute);
    this.state.chart.targetIndex = null;
    this.state.session.witchspace = false;
    this.arriveInSystem();
    this.host.showMessage(
      salvage > 0
        ? `RESCUED — ${salvage}t OF CARGO TAKEN AS SALVAGE`
        : 'RESCUED — NOTHING ABOARD WORTH TAKING',
      6);
  }

  /**
   * One-shot jump to the next galaxy; lands at the nearest system to our coords.
   *
   * @internal — driven by src/game/game.ts, which delegates to it.
   */
  galacticJump(): void {
    const may = checkGalacticJump(this.state.commander, this.host.inSimulator());
    if (!may.ok) {
      this.host.showMessage(galacticRefusalMessage(may.reason), 3);
      this.host.refused();
      return;
    }
    const jump = resolveGalacticJump(this.state.commander, this.host.system());
    this.state.systems = jump.systems;
    // A NEW GALAXY BRINGS ITS OWN ECONOMY (docs/TODO/117). Keeping the old
    // `LivingGalaxy` across the jump left galaxy 2's system 7 wearing galaxy
    // 1's Lave danger and price pressure, and every convoy in the list flying
    // between two systems it had never departed or been bound for. The state is
    // per-galaxy, so it is rebuilt with the systems it describes — and warmed,
    // because a galaxy arrived at has no more been standing still than the one
    // left behind. The saved deltas describe the galaxy just left, so they are
    // not reloaded here; the next checkpoint writes these over them.
    this.state.living = new LivingGalaxy(this.state.systems);
    prewarm(this.state.living, this.freshGalaxySeed());
    this.state.chart.targetIndex = null;
    this.arriveInSystem();
    this.host.showMessage(
      `GALAXY ${jump.galaxy} — ${this.host.system().name.toUpperCase()}`, 5);
  }

  /**
   * The living galaxy this career inherits: the saved one, or — for a career
   * that has none — a warmed one (docs/TODO/117).
   *
   * WARMING ONLY WHERE THERE IS NOTHING TO LOAD, and `prewarm`'s own doc in
   * galaxy/living.ts says why — it is paid once, and the deltas are ordinary
   * saved state from the first checkpoint on (docs/TODO/153).
   *
   * What is this file's to say is WHICH SITES warm: this one, at a boot and a
   * respawn, and `galacticJump` above, which arrives in a galaxy no save
   * describes. Same seam, same seed rule, no state to consult.
   *
   * @internal — driven by src/game/game.ts. A boot and a respawn both reach it.
   */
  loadOrWarmGalaxy(): void {
    if (this.state.commander.galaxyState) {
      this.state.living.load(this.state.commander.galaxyState);
      return;
    }
    prewarm(this.state.living, this.freshGalaxySeed());
  }

  /**
   * The seed a galaxy's history is drawn on: the world's, salted by which
   * galaxy it is — the same mixing `arriveInSystem` seeds arrivals with.
   *
   * The salt is what stops the eighth galaxy being the first one again after a
   * galactic jump. The world's stream is READ here and never drawn from — the
   * history runs on `prewarm`'s own derived stream — so the seeded pins
   * downstream of a boot are exactly where they were.
   */
  private freshGalaxySeed(): number {
    return rngState().seed ^ (this.state.commander.galaxy * 0x9e3779b1);
  }
}
