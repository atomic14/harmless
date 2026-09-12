// The world step: one slice of time, with nothing on screen.
//
// The simulation phases that were private methods of game.ts, so the world can
// advance headless — the training scenarios fly these very pieces
// (src/ai-training/scenario.ts). Every `hud.showMessage` and `sfx.*` inside
// them is a RETURNED EVENT — the same pattern as combat.ts and ordnance.ts:
// *this decides and reports, the orchestrator applies*. The step draws nothing,
// makes no noise, reads no clock and touches no DOM. `npm test` steps it under
// node with no Hud at all.
//
// What is NOT here is the consequence that reaches outside the sky. A bounty
// paid, a legal status moved, the save written, the station menu opened, the
// run ended: those are the Game's. It asks for them through `StepHost` (below),
// which is a list of verbs rather than "the Game", so a test can implement it.
//
// The order of the phases is load-bearing. Ships move before they are
// separated. They are separated before they are billed. The player's systems
// recharge after everything that can damage them.
//
// So is the order of every `random()` draw. The world replays byte-identically
// from a seed, so a draw moved across a branch changes every seeded outcome
// (game/rng.ts).

import * as THREE from 'three';

import { COMMODITIES, type StarSystem } from '../galaxy/galaxy.ts';
import { HUD, rgb24 } from '../palette.ts';
import { rampFlightRate, type FlightDemand } from '../player.ts';
import { PLAYER_FLIGHT } from '../constants/player-flight.ts';
import { cargoCapacity, cargoTonnes } from './commander.ts';
import { MAX_FUEL } from '../constants/commander.ts';
import { carryingContraband, patrolReach } from './law.ts';
import {
  OFFENDER, SCAN_LINE_SECONDS, SCAN_WARN_REPEAT,
} from '../constants/law.ts';
import { afterDeed, characterVerdict } from './character.ts';
import { hermitRefuses } from './market.ts';
import {
  HERMIT_DOCK_RANGE, HERMIT_DOCK_SPEED, HERMIT_HAIL_RANGE,
} from '../constants/hermit-market.ts';
import { GENERATION_SIGHT_RANGE } from '../constants/population.ts';
import { CHARACTER_LINE_SECONDS, DISREPUTE_CAUGHT } from '../constants/character.ts';
import { queueMessage } from './session.ts';
import { playerVsNpcs, npcVsNpcs, npcsVsStation } from './collisions.ts';
import { assignNpcTargets } from './npc-targeting.ts';
import { shipArticle } from './targets.ts';
import { closePassLines } from './close-pass.ts';
import { stepEncounters } from './encounters.ts';
import { spawnArrivingTrader, spawnPassingTrader } from './spawning.ts';
import { STATION_TRUCE } from '../constants/law.ts';
import {
  PIRATE_WAVE_RANGE, PIRATE_WAVE_RANGE_SPAN, THARGON_DEPLOY_RANGE,
  TRADER_ARRIVAL_RANGE,
} from '../constants/spawn-placement.ts';
import {
  planDocking, dockingOutcome, type DockPlan, type DockingOutcome,
} from './docking.ts';
import { holdOnRails, railsAligned, railsReached, stopped } from './dock-rails.ts';
import { bankToTurn } from './pitch-roll-steer.ts';
import { slotNormal } from '../world/slot.ts';
import { dockingSticks } from './docking-sticks.ts';
import { NPC_HULL_BOX_MARGIN } from '../constants/docking.ts';
import { BOUNCE_STANDOFF } from '../constants/station.ts';
import { regenerate, updateCabinTemp, scoopFuel, energyLow } from './systems.ts';
import { SUN_KILL_DIST } from '../constants/sun.ts';
import { PLANET_CRASH_ALTITUDE } from '../constants/planet.ts';
import {
  TORUS_MULTIPLIER, MASS_LOCK_STATION, MASS_LOCK_PLANET_ALTITUDE, MASS_LOCK_SHIP,
} from '../constants/torus.ts';
import { stepTrumbles, trumbleMessage } from './trumbles.ts';
import { resolveNpcFire, type FireWorld } from './fire-resolution.ts';
import { npcImpactDamage, playerImpactDamage } from './impact-damage.ts';
import { IMPACT } from '../constants/impact.ts';
import type { PlayerPoolPoints } from './damage-units.ts';
import type { DamageSource } from './combat.ts';
import { dealToNpc, type DealtEvent } from './damage-dealt.ts';
import { viewDirection } from './views.ts';
import { Ordnance, ordnanceMessage, type OrdnanceOutcome } from './ordnance.ts';
import type { NpcShip, FireEvent, WorldView } from './npc.ts';
import { nearestNpc } from './hostility.ts';
import type { SoundEvent, SoundName } from './sounds.ts';
import { runMissions } from './mission-bridge.ts';
import { scanSecondsFor } from '../missions/queries.ts';
import { DOCK_COMPUTER_RANGE } from '../constants/docking-computer.ts';
import { ESCORT_ENEMY_ROLES, WATCH_CONE } from '../constants/missions.ts';
import { SCANNER_RANGE } from '../constants/console.ts';
import { random, randomInt, randomDirection } from './rng.ts';
import type { GameState } from './state.ts';
import { AUTOSAVE_INTERVAL } from '../constants/saves.ts';

/**
 * A warhead going off, as the 24-bit number the effects layer takes.
 *
 * The console's amber, reached rather than re-spelled. A detonation says the
 * same thing the target marker says, and is drawn in the same colour. It was
 * that value written out twice in this file (docs/TODO/93).
 *
 * The 0xff8866 a few lines below is NOT the palette. A hit on the player has
 * its own hotter tint, owned here and nowhere else. That is the line between
 * the two. A value that IS the phosphor reaches for it. A value that merely
 * looks like it stays put.
 */
const WARHEAD_FLASH = rgb24(HUD.amber);

/**
 * WHAT is close enough to hold the torus drive down, in the player's words,
 * or null for a clear sky (docs/TODO/209).
 *
 * The lock said only that it happened. Chris flew the trip in. He could not tell
 * that a neutral trader stopped the drive. So the lock names what
 * stopped it, and the console line carries the name.
 *
 * A free function over the state, so the flight keys and the step share one
 * rule and `window.__game.massLocked()` keeps working for the harnesses. The
 * three radii live together in constants/torus.ts, beside the drive they cut.
 */
export function massLockCause(state: GameState): string | null {
  const { player, world } = state;
  if (player.position.distanceTo(world.station.position) < MASS_LOCK_STATION) return 'THE STATION';
  if (player.position.distanceTo(world.planetPos) - world.planetRadius
      < MASS_LOCK_PLANET_ALTITUDE) return 'THE PLANET';
  // A ship comes with its article, because the message reads as a sentence.
  let nearest: { name: string; range: number } | null = null;
  for (const npc of world.npcs) {
    if (!npc.state.alive || npc.role === 'asteroid') continue;
    const range = npc.object.position.distanceTo(player.position);
    if (range >= MASS_LOCK_SHIP) continue;
    if (nearest === null || range < nearest.range) nearest = { name: shipArticle(npc), range };
  }
  return nearest?.name ?? null;
}

/** Is anything close enough to hold the torus drive down? */
export function massLocked(state: GameState): boolean {
  return massLockCause(state) !== null;
}

/**
 * What the step reports for the orchestrator to say out loud, or to count.
 *
 * A union, so it reads the same as CombatEvent and OrdnanceEvent. The Game says
 * the messages, plays the sounds and ignores the rest; a measuring caller does
 * the opposite.
 */
export type StepEvent =
  /** `queued` waits for the console rather than taking it — see session.ts */
  | { kind: 'message'; text: string; seconds: number; queued?: boolean }
  /**
   * Something should be heard. The same `SoundEvent` the autopilots return, so
   * there is ONE place in game.ts that turns a sound into a call — sounds.ts.
   */
  | SoundEvent
  /**
   * A ship pulled its trigger, and at what.
   *
   * The step is the only place that knows: `fire-resolution.ts` rolls the dice
   * and the host only ever hears about the HITS, through `applyPlayerDamage`.
   * Missed shots are the denominator of every accuracy figure the combat
   * simulator reports (combat-sim-report.ts).
   */
  | { kind: 'npcFired'; npc: NpcShip; weapon: 'laser' | 'missile'; atPlayer: boolean }
  /**
   * The commander landed something on a ship, and what it cost the ship.
   *
   * The mirror of `applyPlayerDamage`, reported rather than asked for because
   * it is a measurement, not a consequence: a kill still comes through
   * `destroyNpc` below. The step is the only place that knows —
   * `damage-dealt.ts` reads the target's bank either side of the hit. The
   * career drops it; an exercise credits it to `you.damageBySource`, without
   * which a kill by missile, ram or bomb reports zero damage dealt.
   */
  | DealtEvent;

const say = (text: string, seconds: number): StepEvent => ({ kind: 'message', text, seconds });
/**
 * An occasion that makes a noise. `audio.ts` decides what the noise is.
 *
 * The doc line here used to read "a tone, in hertz", which described a `beep`
 * helper that went away when every sound took a name. It is corrected rather
 * than moved: there is nothing left for it to describe.
 *
 * @param at where in the world it happened, for a sound that did not happen in
 * the cockpit (docs/TODO/142). Omit it and the sound plays as it always has.
 */
const heard = (name: SoundName, at?: THREE.Vector3): StepEvent =>
  ({ kind: 'sound', name, at });

/**
 * The consequences the step cannot own, and asks the orchestrator for.
 *
 * Every one reaches outside the sky: it pays a bounty, moves your legal status,
 * writes localStorage, opens a screen or ends the run. Not "the Game" but the
 * verbs the world step needs, small enough for a test to implement and stub.
 * Live-combat instrumentation is `Game.setCombatObserver`, not these methods.
 */
export interface StepHost {
  /** is the ship still flying? `Game.mode` is a screen-stack question */
  inFlight(): boolean;
  /**
   * The player took a hit — shields, hull, the damage flash, and maybe death.
   *
   * `damage` is finished `PlayerPoolPoints`. A laser already met the hull's
   * armour once (`gunnery.ts`), and everything else is a stated `IMPACT`
   * (`constants/impact.ts`). The unit is branded, so nothing else can be
   * passed.
   *
   * `source` is what did it. It is a static fact at each of the five calls
   * below, where downstream it can only be guessed from the number. See
   * `DamageSource`.
   */
  applyPlayerDamage(
    damage: PlayerPoolPoints, from: THREE.Vector3, source: DamageSource): void;
  /** a kill credited to the player: bounty, rating, contracts, the law */
  destroyNpc(npc: NpcShip): void;
  /** a ship out of the sky with no credit to anyone */
  wreckNpc(npc: NpcShip): void;
  /** pull the trigger in the current view */
  fireLaser(): void;
  /** an offence witnessed — which is what scrambles the station's Vipers */
  raiseLegal(level: number): void;
  /** the run ends */
  die(reason: string): void;
  /** we threaded the slot: the station takes over */
  dock(): void;
  /** the countdown reached zero */
  completeHyperspace(): void;
  /** the distress beacon was answered */
  completeRescue(): void;
  /** alongside a rock hermit, slow enough to trade */
  openHermitTrade(): void;
  /** write the world down */
  autoSave(): void;
}

/**
 * Who is flying, and whether the human has their hands on the controls.
 *
 * The demand is produced OUTSIDE the step — by a keyboard
 * (engine/flight-controls.ts), by the combat computer, or by a harness.
 * `handsOn` is a boolean rather than an `Input`: touching the controls drops
 * the docking computer.
 */
export interface PilotInput {
  demand: FlightDemand;
  handsOn: boolean;
}

/**
 * One slice of the world, advanced.
 *
 * Holds the state, the missiles and the host — and its own scratch vectors, so
 * stepping at 60Hz allocates nothing.
 */
/** What the console says about a dock that did not take (docs/TODO/207 M3). */
const SCRAPE_SAID: Partial<Record<DockingOutcome, string>> = {
  slotMiss: 'DOCKING FAILURE — MATCH THE SLOT ROTATION',
  tooFast: 'TOO FAST FOR THE SLOT — SLOW DOWN AND TRY AGAIN',
  hull: 'COLLISION',
};

export class WorldStep {
  private readonly state: GameState;
  private readonly ordnance: Ordnance;
  private readonly host: StepHost;
  /**
   * The sky a fired shot is resolved against — see `fire-resolution.ts`.
   *
   * It is built once, but it reads the STATE rather than a captured commander
   * or player. Both are replaced on a respawn and on a restore. A held
   * reference would resolve shots against a commander who no longer exists.
   */
  private readonly fire: FireWorld;

  private readonly tmp = new THREE.Vector3();
  /** the slot axis the computer's last turn points down — see `dockTrialStep` */
  private readonly dockAxis = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly tmpQ = new THREE.Quaternion();
  /** scratch for collisions.ts, so a per-frame call allocates nothing */
  private readonly scratch = { a: new THREE.Vector3(), b: new THREE.Vector3() };

  constructor(state: GameState, ordnance: Ordnance, host: StepHost) {
    this.state = state;
    this.ordnance = ordnance;
    this.host = host;
    this.fire = {
      target: {
        get hullId() { return state.commander.shipId; },
        get pos() { return state.player.position; },
        // The one thing the game adds that an episode has no use for. It is
        // which of the five sources it was, for the flash and the record.
        damage: (damage, from) => host.applyPlayerDamage(damage, from, 'laser'),
      },
      ordnance,
      wreck: (npc) => host.wreckNpc(npc),   // no player credit — see npcVsNpcs
    };
  }

  /**
   * One frame of flight, in five phases.
   *
   * Each phase is a method, so this reads as an order of operations rather than
   * a wall. THE ORDER IS LOAD-BEARING, and the header above is its one home.
   */
  step(dt: number, elapsed: number, pilot: PilotInput): StepEvent[] {
    const out: StepEvent[] = [];
    this.flyPlayer(dt, elapsed, pilot, out);
    this.stepNpcs(dt, out);
    this.stepProjectilesAndEffects(dt, out);
    if (this.stepShipSystems(dt, pilot.demand, out)) return out;  // died in the attempt
    this.checkHazards(out);
    return out;
  }

  /** Anything close enough to hold the torus drive down. */
  massLocked(): boolean { return massLocked(this.state); }

  /**
   * The player's own motion: one demand, applied.
   *
   * The docking computer still steers on top, because it asks for a HEADING
   * rather than a rate. It is the one pilot left outside the seam. The torus
   * adds its own translation.
   */
  private flyPlayer(dt: number, elapsed: number, pilot: PilotInput, out: StepEvent[]): void {
    const { player, session, world } = this.state;
    // WHOSE demand. The docking computer produces one now (docs/TODO/126). It
    // used to write the quaternion after the fact. So the demand is decided
    // before the ship flies, rather than applied on top of it. Where it hands
    // the ship back mid-frame, the pilot's own demand stands, as before.
    const dc = session.dcEngaged ? this.dockingComputerStep(dt, pilot, out)
      : session.dockTrial ? this.dockTrialStep(dt, pilot, out) : null;
    player.update(dt, dc ?? pilot.demand);
    // The rails correct the frame the ship just flew (docs/TODO/212).
    if (session.dockRails) holdOnRails(player, world.station, dt);

    // torus drive
    if (session.torusEngaged) {
      const cause = massLockCause(this.state);
      if (cause !== null) {
        session.torusEngaged = false;
        out.push(say(`TORUS DRIVE OFF — ${cause} IS TOO CLOSE`, 3));
        out.push(heard('torusDropped'));
      } else {
        // ONE LESS THAN THE MULTIPLIER. `player.update()` above already flew
        // the ship its ordinary `speed * dt` this frame. Total travel is
        // `TORUS_MULTIPLIER` times ordinary flight.
        player.position.addScaledVector(
          player.getForward(this.tmp), player.speed * (TORUS_MULTIPLIER - 1) * dt);
      }
    }

    world.update(dt, elapsed);
  }

  /**
   * One frame of the docking computer, as a `FlightDemand` — pitch, roll and
   * throttle, which `PlayerShip.update` flies exactly as it flies a pair of
   * hands.
   *
   * It steers and throttles only. `checkStation`'s slot and roll test still
   * decides the dock itself, as it does when you fly in by hand. The autopilot
   * has to genuinely thread the letterbox, and gets no dispensation.
   *
   * It used to write `player.quaternion` directly, through a shortest-arc slerp
   * toward a `lookAt` orientation. That is a turn about an axis no stick can
   * produce. It never wrote the rates the HUD reads, and it obeyed a turn limit
   * of its own rather than the hull's (docs/TODO/126).
   *
   * `dockingSticks` decides which way to move each stick. The CAPS and the RAMP
   * are the commander's own. The ramp reads the ship's current rates, so a save
   * taken mid-approach carries the manoeuvre rather than restarts it.
   *
   * @returns the demand, or null where it just handed the ship back.
   */
  private dockingComputerStep(
    dt: number, pilot: PilotInput, out: StepEvent[],
  ): FlightDemand | null {
    const { session } = this.state;
    if (pilot.handsOn) {
      session.dcEngaged = false;
      out.push({ kind: 'dockingMusic', on: false });
      out.push(say('MANUAL OVERRIDE', 2));
      return null;
    }
    return this.dockingDemand(dt, pilot, this.dockingPlan());
  }

  /** The approach the computer is flying this frame. */
  private dockingPlan(): DockPlan {
    const s = this.state;
    return planDocking(s.player.position, s.world.station, s.world.stationDockZ,
      s.player.maxSpeed, s.dockPlan);
  }

  /**
   * What the docking computer asks of the ship this frame: both sticks, and
   * the plan's own speed.
   *
   * The pilot's stretch shares it (docs/TODO/212). The computer lines the ship
   * up there too, and it hands over only when the ship is ON the axis.
   */
  private dockingDemand(dt: number, pilot: PilotInput, plan: DockPlan): FlightDemand {
    const { player } = this.state;
    const sticks = dockingSticks(player.quaternion, plan, player.rollRate);
    // Bang-bang on the throttle, with a deadband of one frame's thrust. A
    // demand can only ask for full ahead, full astern or coast, because that is
    // all a throttle IS (player.ts). So the plan's speed is held by a cut to
    // coast inside the last frame's worth of it, rather than by a gain.
    const gap = plan.speed - player.speed;
    const band = PLAYER_FLIGHT.accel * dt;
    return {
      pitchRate: rampFlightRate(
        player.pitchRate, sticks.pitch * PLAYER_FLIGHT.maxPitch, sticks.pitch !== 0, dt),
      rollRate: rampFlightRate(
        player.rollRate, sticks.roll * PLAYER_FLIGHT.maxRoll, sticks.roll !== 0, dt),
      throttle: gap > band ? 1 : gap < -band ? -1 : 0,
      // The trigger stays the pilot's: an autopilot has no business deciding to
      // shoot, and `stepShipSystems` reads the pilot's own demand for it anyway.
      fire: pilot.demand.fire,
      // ...and it must not sail past the plan's speed while accelerating to it.
      limits: { accel: PLAYER_FLIGHT.accel, maxSpeed: Math.max(1, plan.speed) },
    };
  }

  /**
   * One frame of the pilot's own stretch of the approach (docs/TODO/207, and
   * docs/TODO/212 for its shape).
   *
   * IT IS TWO STAGES. The computer lines the ship up first, with both sticks,
   * exactly as the docking computer does. Then the rails take the ship, and
   * the pilot plays the mini game: match the slot, and go in slowly.
   *
   * Chris asked for that on 2026-09-12: *"I'm wondering if we actually get
   * lined up by the computer and then hand off to a 'mini' docking game.
   * Something that is completely on rails."* One stick cannot hold a line and
   * match a spin at the same time. The rails hold the line, so the stick is
   * free for the spin.
   */
  private dockTrialStep(dt: number, pilot: PilotInput, out: StepEvent[]): FlightDemand {
    const { player, session, world } = this.state;
    const plan = this.dockingPlan();
    if (!session.dockRails) {
      if (!railsReached(plan)) return this.dockingDemand(dt, pilot, plan);
      // On the axis, and the computer stops the ship there. The pilot then
      // flies the whole run in (docs/TODO/212).
      if (!stopped(player.speed)) {
        return { ...this.dockingDemand(dt, pilot, plan), throttle: -1 };
      }
      // STOPPED IS NOT LINED UP. The brake used to end the line-up, and the
      // ship was still up to 69.7 degrees off the axis (Chris, 2026-09-12:
      // *"we jump to the on rails version before it's actually lined up"*).
      //
      // THE COMPUTER FLIES THIS LAST TURN, with both sticks, through the
      // commander's own envelope. The nose comes round at the rate the hull
      // turns. The HUD needles read it. Nothing moves the ship other than by
      // flying it.
      //
      // `bankToTurn` is the law, rather than `dockingSticks`. That one spends
      // the roll on the letterbox, and it pitches onto the heading. A pitch
      // alone cannot answer a sideways error from a stop. The slot has no claim
      // on the roll yet, because the pilot does not hold the ship.
      if (!railsAligned(player, world.station)) {
        const axis = slotNormal(world.station, this.dockAxis).multiplyScalar(-1);
        const cmd = bankToTurn(player.quaternion, axis, this.state.dockPlan.steer);
        return {
          pitchRate: rampFlightRate(
            player.pitchRate, cmd.pitch * PLAYER_FLIGHT.maxPitch, cmd.pitch !== 0, dt),
          rollRate: rampFlightRate(
            player.rollRate, cmd.roll * PLAYER_FLIGHT.maxRoll, cmd.roll !== 0, dt),
          throttle: 0,
          fire: pilot.demand.fire,
        };
      }
      // LINED UP. Now, and only now, the question of who takes it in.
      //
      // A fitted docking computer takes it, and this is the one place that
      // hand-over is decided (docs/TODO/212). `autopilot.ts`'s
      // `handOverToDock` still engages it from the pilot's own key. That one
      // resets the plan phase, which is right from cold. It would be wrong from
      // here, because the run latch is already earned and the ship is on the
      // axis.
      if (this.state.commander.equipment.dockingComputer) {
        session.dockTrial = false;
        session.dcEngaged = true;
        out.push(say('DOCKING COMPUTER ENGAGED', 2));
        out.push({ kind: 'sound', name: 'dockingComputerEngaged' });
        out.push({ kind: 'dockingMusic', on: true });
        return this.dockingDemand(dt, pilot, plan);
      }
      session.dockRails = true;
      out.push(say('THE SLOT IS YOURS — THRUST IN, AND MATCH ITS SPIN', 5));
    }
    // ON THE RAILS. The pitch is nobody's: `holdOnRails` owns the line. The
    // roll and the throttle are the pilot's, and they are the whole game.
    return {
      pitchRate: rampFlightRate(player.pitchRate, 0, false, dt),
      rollRate: pilot.demand.rollRate,
      throttle: pilot.demand.throttle,
      fire: pilot.demand.fire,
    };
  }


  /** Everyone else: decisions, despawns, collisions, and who else turns up. */
  private stepNpcs(dt: number, out: StepEvent[]): void {
    const s = this.state;
    const { world, player, session } = s;

    // ONE measurement, two readers. The truce (game/law.ts) asks whether a
    // pirate or a bounty hunter may engage at all. The spawner asks whether a
    // wave is worth a warp-in. Measured twice, the two could disagree about
    // the same frame.
    const playerToStation = player.position.distanceTo(world.station.position);

    // A neutral ship that comes close says so, one time (docs/TODO/209). The
    // mass lock only spoke with the torus drive running, and the drive is off
    // for most of a trip. The rule is `close-pass.ts`, and this pushes what it
    // decided (invariant 15).
    for (const line of closePassLines({
      npcs: world.npcs, playerPos: player.position,
      legalStatus: s.commander.legalStatus, playerToStation,
    })) out.push(say(line, 4));

    // periodic NPC-vs-NPC targeting: pirates prey on traders, the law hunts pirates
    session.npcTargetTimer -= dt;
    if (session.npcTargetTimer <= 0) {
      session.npcTargetTimer = 2;
      assignNpcTargets(world.npcs, player.position, s.commander.legalStatus);
    }

    // Snapshot. The despawns and destructions below rebuild world.npcs. The
    // fleet handed to update() must be the same for every ship in the frame,
    // rather than shrink underneath the loop.
    //
    // `missileInbound` is read here, ONCE, for the same reason. It is the
    // one-in-the-air cap. A read of the ordnance per ship would let the first
    // launcher in a frame silence the rest of the gang inside that frame.
    // `test/missile-cap.test.ts` pins it.
    const view: WorldView = {
      station: world.station,
      dockZ: world.stationDockZ,
      fleet: world.npcs,
      playerLegal: s.commander.legalStatus,
      brains: s.brains,
      missileInbound: this.ordnance.missileInbound,
      sunPos: world.sunPos,
      playerToStation,
    };
    for (const npc of [...world.npcs]) {
      const event = npc.update(dt, player, view);
      if (event) this.resolveNpcFire(npc, event, out);

      if (npc.state.wantsDespawn) {
        // A ship that JUMPED OUT gets the witch-flash. A ship that DOCKED gets
        // nothing: it flew into the slot, which emits no particles. A burst
        // here is indistinguishable from watching it blow up.
        if (!npc.state.docked) {
          world.effects.explosion(npc.object.position.clone(), 0x9adfff,
            { count: 10, speed: 120, duration: 0.7 });
        }
        world.despawn(npc);
        // A tagged ship that leaves is gone from its leg, and HOW it left
        // decides what the leg makes of it (docs/TODO/208 M3). A ship that
        // ran from the commander FLED. Any other one jumped out, and escaped.
        // Three arcs have a branch for a ship that flees, and nothing sent
        // that word until now. The machine says what each costs.
        if (npc.state.missionTag !== null && !npc.state.docked) {
          out.push(...runMissions(s.commander, {
            kind: npc.state.fleeing ? 'fled' : 'escaped', tag: npc.state.missionTag,
          }));
        }
        continue;
      }
    }

    this.stepMissionShips(dt, out);

    // Ships are solid. The geometry lives in collisions.ts, and what it costs
    // is decided here, because the price is not symmetric. The player's shields
    // absorb a ram. Two NPCs that bump must not credit the player. A bounce off
    // the station is free.
    //
    // A RAM costs each side its own stated number of its own points
    // (`IMPACT.ram`). Neither meets armour: armour is a laser's business. It
    // provokes nobody, because nothing here can say who flew into whom
    // (`PROVOKES` in damage-dealt.ts, docs/TODO/194).
    const ramEnergy = npcImpactDamage(IMPACT.ram);
    const ramPlayer = playerImpactDamage(IMPACT.ram);
    for (const npc of playerVsNpcs(
      player.position, (k) => { player.speed *= k; }, world.npcs, this.scratch)) {
      this.host.applyPlayerDamage(ramPlayer, npc.object.position, 'ram');
      out.push(say('COLLISION', 2));
      // Both halves of the same collision are reported: what it cost you
      // through the host, what it cost the ship through the event.
      const hit = dealToNpc(npc, ramEnergy, player.position, 'ram');
      out.push(hit.event);
      if (hit.destroyed) this.host.destroyNpc(npc);
    }

    const wrecked: NpcShip[] = [];
    for (const [a, b] of npcVsNpcs(world.npcs, this.scratch)) {
      const aPos = a.object.position.clone();
      if (a.takeDamage(ramEnergy, b.object.position, false)) wrecked.push(a);
      if (b.takeDamage(ramEnergy, aPos, false)) wrecked.push(b);
    }
    // wreckNpc, NOT destroyNpc — see npcVsNpcs
    for (const n of wrecked) this.host.wreckNpc(n);

    npcsVsStation(
      world.npcs, world.station, world.stationDockZ + NPC_HULL_BOX_MARGIN, this.scratch);

    // What turns up, and when: rules in encounters.ts, spawning here.
    const here = this.system();
    for (const order of stepEncounters(s.encounterTimers, dt, {
      witchspace: session.witchspace,
      productivity: here.productivity,
      government: here.government,
      traderCount: world.npcs.filter((n) => n.role === 'trader').length,
      activeThargons: world.npcs.filter((n) => n.state.alive && n.role === 'thargon').length,
      hasThargoidMother: world.npcs.some((n) => n.state.alive && n.role === 'thargoid'),
      playerFarFromStation: playerToStation > STATION_TRUCE,
    })) {
      if (order.kind === 'trader') {
        if (order.at === 'station') {
          spawnArrivingTrader(world, TRADER_ARRIVAL_RANGE);
        } else {
          // Deep space. The commander's nose is the cone's axis, and a hull's
          // nose is -Z (invariant 7).
          spawnPassingTrader(world, player.position,
            new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion));
          // Said only out here. A station arrival is one of many, and the
          // console is not a traffic report; this is the only ship a long run
          // will meet.
          out.push(say('TRADER SIGNATURE DETECTED', 3));
        }
      } else if (order.kind === 'pirateWave') {
        for (let i = 0; i < order.count; i++) {
          world.spawn('pirate',
            player.position.clone().add(randomDirection(new THREE.Vector3())
              .multiplyScalar(PIRATE_WAVE_RANGE + random() * PIRATE_WAVE_RANGE_SPAN)),
            i + randomInt(4));
        }
        out.push(say('PIRATE SIGNATURES DETECTED', 4));
      } else {
        const mother = world.npcs.find((n) => n.state.alive && n.role === 'thargoid')!;
        world.spawn('thargon',
          mother.object.position.clone().add(
            randomDirection(new THREE.Vector3()).multiplyScalar(THARGON_DEPLOY_RANGE)),
          randomInt(8));
      }
    }
  }

  /**
   * The two verdicts only the world can give (docs/TODO/190 M4).
   *
   * An ESCORT is safe when its ship is alive, inside `DOCK_COMPUTER_RANGE` of
   * the station, and no enemy is inside that same radius of it. All three at
   * once, and it is sent ONCE. `missionReported` latches, so a fight after
   * the fee cannot undo it. The ship goes on to dock as any trader does.
   *
   * A SCAN counts the seconds a tagged ship spends under the scanner lock,
   * and sends `scanned` when the leg's seconds are up, once.
   */
  private stepMissionShips(dt: number, out: StepEvent[]): void {
    const { world, commander, player, session } = this.state;
    const lock = this.ordnance.targetLock;
    // A scan counts while the subject is in view: inside WATCH_CONE of the
    // view's direction and inside scanner range (docs/TODO/203 M5). It used
    // to count only under the missile lock, which the briefing told the
    // player not to use.
    const viewDir = viewDirection(player.quaternion, session.view, this.tmp);
    const inView = (npc: NpcShip): boolean => {
      const to = this.tmp2.copy(npc.object.position).sub(player.position);
      const dist = to.length();
      return dist <= SCANNER_RANGE && viewDir.angleTo(to.normalize()) <= WATCH_CONE;
    };
    for (const npc of world.npcs) {
      const tag = npc.state.missionTag;
      if (tag === null || npc.state.missionReported || !npc.state.alive) continue;
      if (npc.role === 'trader') {
        const wanted = scanSecondsFor(commander.missions, tag);
        if (wanted !== null) {
          const before = Math.floor(npc.state.observed);
          if (lock === npc || inView(npc)) npc.state.observed += dt;
          // The count is said aloud once a second while it moves. So the
          // player knows the watch runs, and how much is left (docs/TODO/203
          // M4). It says nothing while the count stands still.
          const now = Math.floor(npc.state.observed);
          if (now > before && now < wanted) {
            out.push(say(`SCANNING THE ${npc.object.name.toUpperCase()}. ${now} OF ${wanted} SECONDS DONE.`, 1.5));
          }
          if (npc.state.observed >= wanted) {
            npc.state.missionReported = true;
            npc.state.tradeTimer = 0;   // watched; it may go about its business now (docs/TODO/203 M2)
            out.push(...runMissions(commander, { kind: 'scanned', tag }));
          }
          continue;
        }
        const at = npc.object.position;
        if (at.distanceTo(world.station.position) > DOCK_COMPUTER_RANGE) continue;
        const threatened = world.npcs.some((other) => other !== npc && other.state.alive
          && ESCORT_ENEMY_ROLES.includes(other.role) && other.object.position.distanceTo(at) <= DOCK_COMPUTER_RANGE);
        if (threatened) continue;
        npc.state.missionReported = true;
        out.push(...runMissions(commander, { kind: 'escortSafe', tag }));
      }
    }
  }

  /** Cargo, missiles, and the things that are only ever seen. */
  private stepProjectilesAndEffects(dt: number, out: StepEvent[]): void {
    const { world, player, commander } = this.state;
    // The field drifts them and says what we reached. What it is worth is ours
    // to decide, because it touches the hold, the legal status and damage.
    for (const { canister: c } of world.cargo.update(dt, player.position)) {
      if (!commander.equipment.scoops) {
        // The same accident either way — no scoops, so it breaks on the hull —
        // but it is named for what it was. Flying into one is not an offence;
        // SHOOTING a capsule is, and that is combat.ts's FUGITIVE branch.
        this.host.applyPlayerDamage(
          playerImpactDamage(IMPACT.canisterOnHull), c.object.position, 'cargo');
        out.push(say(
          c.kind === 'capsule' ? 'ESCAPE CAPSULE DESTROYED ON HULL'
            : c.kind === 'drone' ? 'THARGON DESTROYED ON HULL'
            : 'CANISTER DESTROYED ON HULL', 2));
      } else if (c.missionTag !== null) {
        // A MISSION'S THING, and the machine says what it was. It is a
        // canister that never enters the hold, or a pod whose passenger rides
        // under the pod's own tag (docs/TODO/190 M4).
        out.push(...runMissions(commander, { kind: 'scooped', tag: c.missionTag }));
        out.push(heard(c.kind === 'capsule' ? 'survivorScooped' : 'cargoScooped'));
      } else if (c.kind === 'capsule') {
        // A person, not stock. See CommanderData.survivors — a capsule is not
        // cargo commodity 3 (Slaves), which would make rescue read as smuggling.
        // Tested BEFORE the hold: a survivor rides in the crew spaces, so a full
        // hold is no reason to leave someone adrift (docs/TODO/108).
        commander.survivors += 1;
        out.push(say('SURVIVOR ABOARD', 4));
        out.push(heard('survivorScooped'));
      } else if (cargoTonnes(commander) >= cargoCapacity(commander)) {
        out.push(say(`HOLD FULL — ${c.kind === 'drone' ? 'THARGON' : 'CANISTER'} LOST`, 3));
      } else {
        // A canister and a dead drone alike: the drone carries `ALIEN_ITEMS`
        // as its commodity, so this branch never asks the kind (docs/TODO/196).
        commander.cargo[c.commodity] += 1;
        out.push(say(`SCOOPED 1t ${COMMODITIES[c.commodity].name.toUpperCase()}`, 3));
        out.push(heard('cargoScooped'));
      }
    }
    this.updateEncounters(out);

    this.applyOrdnance(dt, out);
    world.effects.update(dt);
  }

  /** Apply what the ordnance did. It reports; the consequences are ours. */
  private applyOrdnance(dt: number, out: StepEvent[]): void {
    const { world, player } = this.state;
    for (const e of this.ordnance.step(dt, player.position)) {
      if (e.kind === 'hitNpc') {
        // A warhead is a DAMAGE number (`IMPACT.warhead`), not "that ship is
        // gone": it destroys every released hull outright except the handful
        // whose banks are heavier than it. So the kill is conditional, and only
        // a kill pays a bounty.
        world.effects.explosion(e.at, 0xff8866);
        const hit = dealToNpc(e.npc, npcImpactDamage(IMPACT.warhead), e.at, 'missile');
        out.push(hit.event);
        if (hit.destroyed) {
          // no sound here: `destroyNpc` -> `Combat.wreck` plays the ship going up
          this.host.destroyNpc(e.npc);
        } else {
          out.push(heard('explosion', e.at.clone()));
        }
      } else if (e.kind === 'hitPlayer') {
        world.effects.explosion(e.at, 0xff8866);
        // Placed like any other, and it lands on the pilot's own hull. That is
        // the degenerate case the guard in `Game.placeOf` is for.
        out.push(heard('explosion', e.at.clone()));
        this.host.applyPlayerDamage(playerImpactDamage(IMPACT.warhead), e.at, 'missile');
      } else if (e.kind === 'ecmDefeated') {
        world.effects.explosion(e.at, WARHEAD_FLASH, { count: 12, duration: 0.8 });
        this.state.ecmDetectedTimer = 2;
        out.push(say('TARGET E.C.M. — MISSILE DESTROYED', 3));
        out.push(heard('ecm', e.at.clone()));
      } else {
        world.effects.explosion(e.at, WARHEAD_FLASH, { count: 12, duration: 0.8 });
      }
    }
  }

  /**
   * The commander's own ship: guns, recharge, heat, and the warnings that go
   * with them. @returns true if the frame ended in death.
   */
  private stepShipSystems(dt: number, demand: FlightDemand, out: StepEvent[]): boolean {
    const s = this.state;
    const { commander, session, sys, player, world } = s;
    // Laser and systems. The trigger came in with the rest of the demand, from
    // the hands, the combat computer, or both. It is pulled HERE, because this
    // is where the gun's heat and energy live.
    if (demand.fire) this.host.fireLaser();
    regenerate(sys, dt,
      { shipId: commander.shipId, energyUnit: commander.equipment.energyUnit });

    const sunDist = player.position.distanceTo(world.sunPos);
    if (updateCabinTemp(sys, dt, sunDist)) {
      this.host.die('CABIN TEMPERATURE CRITICAL');
      return true;
    }
    const scooped = scoopFuel(
      dt, sunDist, commander.equipment.scoops, commander.fuel, MAX_FUEL);
    if (scooped > 0) {
      commander.fuel += scooped;
      out.push(say('FUEL SCOOPING', 0.4));
    }

    // ...and NO NEW SAVE CAPTURES A COUNTDOWN (docs/TODO/116). Restore clears one
    // that is already on the shelf; this stops the ring writing another. The two
    // are not redundant — the clear fixes yesterday's saves, this keeps the shelf
    // clean for anything else that reads a snapshot.
    //
    // The timer is deliberately NOT rearmed when the write is skipped: it stays
    // due, so the first frame after the jump resolves writes immediately. Rearming
    // it would cost a whole interval per jump, and a commander who jumps often
    // would starve a ring that is only FLIGHT_RING slots deep.
    session.autoSaveTimer -= dt;
    if (session.autoSaveTimer <= 0 && session.hyperCountdown < 0) {
      session.autoSaveTimer = AUTOSAVE_INTERVAL;
      this.host.autoSave();
    }

    if (s.ecmDetectedTimer > 0) s.ecmDetectedTimer -= dt;
    this.updateTrumbles(dt, out);

    // The tow, once somebody calls for it.
    //
    // A repeating NO FUEL TO JUMP hint used to sit on the other side of this
    // branch. It is a cockpit prompt now (`game/prompts.ts`, docs/TODO/128). To
    // be stranded is a situation rather than an event, and the letter belonged
    // to the binding table rather than to a string in here.
    if (session.beaconTimer > 0) {
      session.beaconTimer -= dt;
      if (session.beaconTimer <= 0) this.host.completeRescue();
    }

    // The low-energy warning flashes on `energyLow` and nothing else. So the
    // console cannot be quiet at a bank the shields stopped recovering at.
    if (energyLow(sys.energy)) {
      session.energyLowTimer -= dt;
      if (session.energyLowTimer <= 0) {
        session.energyLowTimer = 1.2;
        out.push(say('ENERGY LOW', 0.6));
        out.push(heard('lowEnergy'));
      }
    }

    // The police scan for illegal cargo, and the telegraph that opens a window
    // before it. ONE block, because they are the same geometry: the nearest
    // live police ship, read at two ranges. The scan must win the frame it
    // fires on, rather than be announced as still to come.
    let copInBand = false;
    if (!session.policeScanned && !session.witchspace
      && carryingContraband(commander.cargo)) {
      const nearest = nearestNpc(world.npcs, player.position,
        (npc) => npc.role === 'police')?.distance ?? Infinity;
      // `patrolReach` (law.ts) owns both ranges, because the bribe key reads
      // the same window. An offer that disagreed with the warning that prompted
      // it would be a key that does nothing while the console says a cop is
      // there.
      const reach = patrolReach(nearest);
      if (reach === 'scan') {
        session.policeScanned = true;
        // A smuggle leg fails on the read, whatever the hold held.
        out.push(...runMissions(commander, { kind: 'policeScan' }));
        // ...which queues what the record now means, behind the line below
        // that explains it. Police hunt Fugitives, so the Viper that reads your
        // hold flies on. A conviction then looks from the cockpit exactly like
        // nothing at all. That verdict used to be written out here too, and it
        // is `raiseLegal`'s one job now (docs/TODO/130).
        this.host.raiseLegal(OFFENDER);
        // caught smuggling: the fine clears, but the reputation does not
        const was = commander.disrepute ?? 0;
        commander.disrepute = afterDeed(was, DISREPUTE_CAUGHT);
        out.push(say('POLICE SCAN: CONTRABAND DETECTED', SCAN_LINE_SECONDS));
        // ...and then what it cost your REPUTATION, if the same scan moved it onto a
        // new rung (docs/TODO/129).
        const verdict = characterVerdict(was, commander.disrepute);
        if (verdict) queueMessage(session, verdict, CHARACTER_LINE_SECONDS);
      } else {
        copInBand = reach === 'warn';
      }
    }
    if (copInBand) {
      session.scanWarnTimer -= dt;
      if (session.scanWarnTimer <= 0) {
        session.scanWarnTimer = SCAN_WARN_REPEAT;
        // half the period on the console and half off, the duty cycle ENERGY
        // LOW flashes at above — one rule, not a second constant
        out.push(say('POLICE PATROL CLOSING', SCAN_WARN_REPEAT / 2));
      }
    } else {
      // Out of the band, already scanned, in a jump, or a clean hold. It is
      // re-armed, so the next patrol to close is announced on the frame it
      // does. Otherwise the remains of a countdown announce it late.
      session.scanWarnTimer = 0;
    }

    // hyperspace countdown
    if (session.hyperCountdown >= 0) {
      const prev = Math.ceil(session.hyperCountdown);
      session.hyperCountdown -= dt;
      const now = Math.ceil(session.hyperCountdown);
      if (now !== prev && now > 0) {
        out.push(say(`HYPERSPACE IN ${now}`, 1.2));
        out.push({ kind: 'countdown', n: now });
      }
      if (session.hyperCountdown <= 0) {
        session.hyperCountdown = -1;
        this.host.completeHyperspace();
        return true;
      }
    }

    return !this.host.inFlight();
  }

  /** Trumbles breed and eat; heat drives them out. Rules in trumbles.ts. */
  private updateTrumbles(dt: number, out: StepEvent[]): void {
    const s = this.state;
    const r = stepTrumbles(s.commander, dt, s.sys.cabinTemp, s.session.trumbleTimer);
    s.session.trumbleTimer = r.timer;
    for (const e of r.events) {
      const secs = e.kind === 'purged' ? 5 : e.kind === 'fleeing' ? 1.5 : e.kind === 'ate' ? 4 : 2;
      out.push(say(trumbleMessage(e), secs));
      if (e.kind === 'ate') out.push(heard('trumbleAte'));
    }
  }

  /** Ground, sun and station — the ways a leg ends without a countdown. */
  private checkHazards(out: StepEvent[]): void {
    const { player, world } = this.state;
    const sunDist = player.position.distanceTo(world.sunPos);
    const altitude = player.position.distanceTo(world.planetPos) - world.planetRadius;
    if (altitude < PLANET_CRASH_ALTITUDE) {
      this.host.die('CRASHED INTO THE PLANET');
      return;
    }
    if (sunDist < SUN_KILL_DIST) {
      this.host.die('FLEW INTO THE SUN');
      return;
    }
    this.checkStation(out);

    const lock = this.ordnance.targetLock;
    if (lock && !lock.state.alive) this.ordnance.targetLock = null;
    this.updateMissileLock(out);
  }

  /**
   * Are we down, bounced, or clear? The rule is docking.ts's; what it costs is
   * ours.
   */
  private checkStation(out: StepEvent[]): void {
    const { player, world } = this.state;
    const station = world.station;
    const outcome = dockingOutcome(
      player.position, player.quaternion, station, world.stationDockZ, player.speed,
      { v: this.tmp, q: this.tmpQ, r: this.tmp2 });
    if (outcome === 'clear') return;
    if (outcome === 'docked') {
      this.host.dock();
      return;
    }
    // hit the hull, or fluffed the slot. The rails let go, so the computer
    // lines the ship up again for another go (docs/TODO/212).
    this.state.session.dockRails = false;
    const away = this.tmp2.copy(player.position).sub(station.position).normalize();
    player.position.copy(station.position).addScaledVector(away, BOUNCE_STANDOFF);
    player.speed = 0;
    this.host.applyPlayerDamage(
      playerImpactDamage(IMPACT.stationScrape), station.position, 'station');
    out.push(say(SCRAPE_SAID[outcome] ?? 'COLLISION', 3));
  }

  /** While armed, lock onto whatever enters the sight. Ordnance reports; we say it. */
  private updateMissileLock(out: StepEvent[]): void {
    const { player, session } = this.state;
    this.reply(this.ordnance.updateLock(
      player.position, viewDirection(player.quaternion, session.view, this.tmp)), out);
  }

  /** Rock hermits offer trade; generation ships offer only awe. */
  private updateEncounters(out: StepEvent[]): void {
    const { world, player, session } = this.state;
    for (const npc of world.npcs) {
      if (!npc.state.alive) continue;
      const dist = npc.object.position.distanceTo(player.position);
      if (npc.role === 'hermit') {
        // must leave and come back before trading again, or you'd be stuck
        // in a docking loop while parked alongside
        if (dist > HERMIT_HAIL_RANGE) session.hermitCooldown = false;
        if (dist < HERMIT_HAIL_RANGE && !session.hermitCooldown) {
          // The number is interpolated rather than typed. The line said
          // `SLOW TO 20` beside a rule of 40 until docs/TODO/180.
          out.push(say(`ROCK HERMIT — SLOW TO ${HERMIT_DOCK_SPEED} AND CLOSE TO TRADE`, 2));
        }
        if (dist < HERMIT_DOCK_RANGE && player.speed < HERMIT_DOCK_SPEED
          && this.host.inFlight() && !session.hermitCooldown) {
          // A hermit-killer gets as far as the tunnel mouth and no further
          // (docs/TODO/96). The cooldown is what the trade path sets on the
          // way out, and it does the same job here. Say it once. Make them
          // leave and come back to hear it again.
          if (hermitRefuses(this.state.commander.disrepute ?? 0)) {
            session.hermitCooldown = true;
            out.push(say(
              'ROCK HERMIT: "WE KNOW WHAT YOU DID" — YOUR REPUTATION IS TOO BAD TO TRADE HERE',
              4));
          } else {
            this.host.openHermitTrade();
          }
        }
      } else if (npc.role === 'generation' && dist < GENERATION_SIGHT_RANGE
        && !session.genShipSeen) {
        session.genShipSeen = true;
        out.push(say('DERELICT GENERATION SHIP — NO LIFE SIGNS', 6));
        out.push(heard('generationShipFound'));
      }
    }
  }

  /**
   * An NPC asked to fire. `fire-resolution.ts` rolls the dice.
   *
   * This is what a shot LOOKS and SOUNDS like, which is the half an episode
   * does not have. It is the bolt, the bang, and `npcFired` for the counter.
   */
  private resolveNpcFire(npc: NpcShip, event: FireEvent, out: StepEvent[]): void {
    const { world, player } = this.state;
    // Reported before anything is resolved, and before any draw. The report
    // wants the shot whether or not it lands. A `random()` moved across a
    // branch would change every seeded outcome after it (game/rng.ts).
    out.push({
      kind: 'npcFired', npc, weapon: event.weapon, atPlayer: event.at === 'player',
    });
    const shot = resolveNpcFire(npc, event, this.fire);
    if (shot.weapon === 'missile') {
      this.reply(shot.launch, out);
      return;
    }
    if (shot.at === 'target') {
      // Placed at the SHIP THAT FIRED, and not at the bolt (docs/TODO/142).
      // This branch is the only one that makes a noise. An NPC that shoots
      // another NPC draws a tracer and says nothing. So the sound already means
      // "someone is shooting at YOU", and the beam always ends on the hull. The
      // place says
      // which side it came from. `audio.ts` is where it stays at full gain.
      out.push(heard('enemyLaser', npc.object.position.clone()));
      // The visible bolt: to us on a hit, wide of us on a miss. The scatter is
      // drawn HERE, after the resolution — two `random()` draws that decide
      // nothing, and taking them earlier would move every seeded outcome after.
      const to = shot.hit
        ? player.position.clone()
        : player.position.clone().add(
            randomDirection(new THREE.Vector3()).multiplyScalar(80 + random() * 140));
      world.effects.tracer(
        npc.nosePosition(this.tmp).clone(), to,
        npc.role === 'thargoid' || npc.role === 'thargon' ? 0xd05cff : 0xff5c40, 0.22);
      return;
    }
    world.effects.tracer(
      npc.nosePosition(this.tmp).clone(), shot.at.object.position.clone(), 0xffaa55, 0.18);
  }

  /**
   * Ordnance reports what it did; saying it is ours.
   *
   * `m.offer` is deliberately dropped. A message's key is rendered from the
   * binding table, and the step may not reach `ui/` (tools/portability.mjs).
   *
   * The only reply that carries one is `alreadyLocked`. It comes from the
   * player's own arm key through game.ts, and never through here. The step's
   * replies are NPC ordnance.
   */
  private reply(result: OrdnanceOutcome, out: StepEvent[]): void {
    out.push(...result.events);
    if (!result.reply) return;
    const m = ordnanceMessage(result.reply);
    out.push(say(m.text, m.seconds));
  }

  /** Where we are, for the encounter rules. */
  private system(): StarSystem {
    return this.state.systems[this.state.commander.systemIndex];
  }
}
