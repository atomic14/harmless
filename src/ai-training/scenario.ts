// Combat scenarios shared by the trainer (batch) and the viewer (real time).
//
// AN EPISODE IS THE REAL GAME, WITH THE SKY EMPTIED.
//
// The pirates are `NpcShip`s flying `NpcShip.brainFly`. The target is a
// `PlayerShip` flown from a `FlightDemand`, exactly as the human's hands and
// the combat computer fly it. The guns are `game/gunnery.ts`, the ramming is
// `game/collisions.ts`, the missiles are `game/ordnance.ts`, the dice are
// `game/rng.ts`. There is no second physics here at all — this file chooses who
// fights whom, and scores it.
//
// WHAT IT IS NOT is `world-step.ts`. Invariant 5 covers deciding and invariant
// 15 splits deciding from resolving, so `Episode.step` is the trainer's
// orchestrator standing where the game's step stands — two implementations of
// one contract. Every call below that looks redundant is a debt to that split:
// `p.npc.tickClocks(dt)`, the target's `regenerate` inside `fly()`, and
// `p.npc.chooseWeapon(...)`, which decides whether a missile leaves the rail.
// docs/TODO/77 gave the ship one entry point for every clock, so an episode can
// no longer pay one of those debts and miss another.
//
// WHAT A SHOT COSTS IS NO LONGER HERE. `resolveNpcShot` below is the trainer's
// tally over `game/fire-resolution.ts` — the game's own resolver, over this
// episode's `FireWorld` — so the rack, the hit roll, the damage and the shield
// face have one home. The remaining divergence is docs/TODO/73, in the DECIDING
// half: an episode never hands a brain-flown pirate to the scripted break-off
// the way `NpcShip.update` does inside the brain's guard range, so a training
// pirate never completes a pass.
//
// What is deliberately KEPT is the methodology: the win conditions, the escape
// range, the engagement and tail-time shaping, the opponent pool and the four
// fitness functions.
//
// Erasable-TypeScript only — runs in Node via --experimental-strip-types.

import * as THREE from 'three';

import { PlayerShip, rampToward, type FlightDemand } from '../player.ts';
import { PLAYER_FLIGHT } from '../constants/player-flight.ts';
import {
  NpcShip, steerQuatToward, type FireEvent, type PlayerRef,
} from '../game/npc.ts';
import {
  BRAIN_RATE_DECAY, BRAIN_RATE_RAMP, DECISION_INTERVAL,
} from '../constants/brain-flight.ts';
import {
  Ordnance, autopilotEcm, fireEcm, type Missile, type OrdnanceWorld,
} from '../game/ordnance.ts';
import { resolveNpcFire, type FireWorld } from '../game/fire-resolution.ts';
import { hitFromAhead } from '../game/shield-face.ts';
import { ThreatLock } from '../game/threat-lock.ts';
import { SPECS, shipAccel, type NpcSpec } from '../game/ship-specs.ts';
import { TURN } from '../constants/hull-motion.ts';
import { shipDisplayName, shipTargetRadius } from '../ships/registry.ts';
import { LASER_RANGE } from '../constants/player-gun.ts';
import {
  hitCone, canFire, chargeShot, playerLaser,
  npcHitChance, npcTriggerPull, npcWeaponByte,
} from '../game/gunnery.ts';
import { npcCrossfireDamage } from '../game/npc-energy.ts';
import { npcImpactDamage, playerImpactDamage } from '../game/impact-damage.ts';
import { IMPACT } from '../constants/impact.ts';
import type { NpcEnergyPoints, PlayerPoolPoints } from '../game/damage-units.ts';
import {
  COBRA_MK_3_HULL_ID,
  type NpcCombatProfileId, type PlayerHullId, type ShipDesignId,
} from '../game/ship-identity.ts';
import { npcLaserDamageToPlayer } from '../game/gunnery.ts';
import { memberTier } from '../game/threat.ts';
import { MAX_TIER } from '../constants/threat.ts';
import type { LaserType } from '../game/commander.ts';
import { pirateSpecForTier } from '../game/ship-specs.ts';
import { npcVsNpcs, playerVsNpcs } from '../game/collisions.ts';
import { MAX_ENERGY, MAX_SHIELD } from '../constants/pools.ts';
import {
  aftShieldLeft, applyDamage, durability, energyLeft, foreShieldLeft,
  freshSystems, poolsLeft, regenerate, type RegenOptions, type ShipSystems,
} from '../game/systems.ts';
import { seedWorld, random, randomDirection } from '../game/rng.ts';
import {
  act, makeObs, makeScratch, type Brain, type Control,
} from './policy.ts';
import { observeFor, shipView, writeView } from './observation.ts';

/** One ship in an episode, however it is flown. */
export interface EpisodeShip {
  /** live transform — for a pirate these ARE the mesh's own vectors */
  readonly pos: THREE.Vector3;
  readonly quat: THREE.Quaternion;
  readonly radius: number;
  /** hull name, for the viewer's model choice and the HUD */
  readonly name: string;
  readonly speed: number;
  /**
   * How much of this ship is left, 0..1.
   *
   * A FRACTION, and the ONLY place either side of the fight is normalized — the
   * AI's observation boundary and the shaped fitness that reads it. Both ships
   * hold exact source-scale numbers underneath (a pirate its released energy
   * bank in `NpcEnergyPoints`, the target the commander's three 255-point pools
   * in `PlayerPoolPoints`), divided by its own maximum here and nowhere else
   * (TODO 29).
   */
  readonly hp: number;
  alive: boolean;
  /** telemetry the fitness functions and the tournament read */
  shotsFired: number;
  shotsHit: number;
  damageDealt: number;
  damageTaken: number;
  /** unit vector along the nose, written into `out` */
  forward(out: THREE.Vector3): THREE.Vector3;
}

export interface ShotEvent {
  from: EpisodeShip;
  to: EpisodeShip;
  hit: boolean;
}

export type Controller =
  | { kind: 'policy'; brain: Brain }
  | { kind: 'scripted' }
  /**
   * A pirate flying the SHIPPED opposition: the pursuit dogfighter, switch
   * included — hold the six while astern, slash past on the attack run the
   * moment the target faces it. The flight is `NpcShip.pursuitFly`, the same
   * call `update()` makes for every live pirate, so an episode cannot drift
   * from the fight a player actually meets (docs/TODO/102). Pirates only:
   * the target is a `PlayerShip` and cannot fly an NPC pilot.
   */
  | { kind: 'pursuit' }
  /**
   * A target that simply leaves: nose away from the nearest pirate, throttle
   * open. It exists so that "do nothing" stops being a winning pirate policy —
   * no evolved trader has learned to run (all orbit at ~2100 and die), so the
   * pressure to give chase is put into the pool by hand.
   */
  | { kind: 'runner' }
  /**
   * A target that turns hard and barely translates — how a human actually
   * knife-fights. Chris flies at a median of 66 with the pitch pinned near its
   * cap, and stops dead to bring guns to bear. A policy needs a slow target in
   * the pool or it cruises near its maximum and never learns to chase one down.
   */
  | { kind: 'holding' }
  /**
   * A target that TRANSLATES, flat out, and never points at anybody — an
   * instrument, not a pilot (docs/TODO/66). Every other target is stationary
   * (`holding`) or leaving (`scripted`/`runner`), so the world had no way to
   * ask: does an attack run, aimed at where the target was AT THAT INSTANT,
   * still clear a target that has MOVED by the time the two ships meet?
   *
   * Two properties make it a measurement rather than a pilot:
   *
   *   - It never steers at a pirate, so a contact is entirely the pirate's
   *     doing. A target that charges would ram ships that flew perfectly.
   *   - Its waypoints are rolled around the ORIGIN, not itself, so it sweeps the
   *     arena at 400 instead of leaving it — the whole difference from
   *     `scripted`, which random-walks away and takes the fight with it.
   *
   * It is not a claim about how a human flies (`holding` is closer). It is the
   * geometry, isolated.
   */
  | { kind: 'weaving' };

/**
 * How far from the arena's centre a `weaving` target's waypoints are rolled.
 *
 * Pirates spawn 1,500 to 2,700 out, so a target sweeping a sphere this size
 * stays inside the volume they are already converging on. Bigger and it starts
 * outrunning them the way `runner` does; much smaller and it is doing tight
 * circles rather than translating, which is `holding` with extra steps.
 */
const WEAVE_RADIUS = 900;

/** How often a `weaving` target picks somewhere new to be. */
const WEAVE_MIN_SECONDS = 2.5;
const WEAVE_MAX_SECONDS = 4;

/**
 * The hulls a target can fly, and the envelope each one is flown at.
 *
 * NOT a ship table: every number here is READ from the game, and the ones that
 * are not (playerCobraSlow's ceiling) are the deliberate handicap that hull
 * exists to apply.
 *
 * `gun` says which weapon the hull carries when it is armed, and it is the
 * ROLE's gun: a freighter shoots with an NPC's gun, the commander's hull with
 * the commander's pulse laser. That asymmetry is the game's, not a modelling
 * convenience.
 */
export type TargetHullId = 'traderCobra' | 'playerCobra' | 'playerCobraSlow';

interface TargetHull {
  name: string;
  radius: number;
  maxSpeed: number;
  accel: number;
  maxPitch: number;
  maxRoll: number;
  rateRamp: number;
  rateDecay: number;
  /** rad/s the scripted controllers may swing the nose at */
  steerRate: number;
  gun: 'player' | 'npc';
}

/** The freighter every brain before generation 1 was trained against. */
const TRADER_COBRA: NpcSpec = SPECS.trader[0];

function traderHull(): TargetHull {
  const s = TRADER_COBRA;
  return {
    name: 'Cobra Mk III',
    radius: shipTargetRadius(s.designId),
    maxSpeed: s.maxSpeed,
    accel: shipAccel(s),
    maxPitch: s.turnRate * TURN.pitch,
    maxRoll: s.turnRate * TURN.roll,
    rateRamp: BRAIN_RATE_RAMP,
    rateDecay: BRAIN_RATE_DECAY,
    steerRate: s.turnRate,
    gun: 'npc',
  };
}

/**
 * The commander, as a target — the ship a pirate actually hunts. Straight from
 * PLAYER_FLIGHT, so the caps are the same numbers as the ship rather than a
 * stand-in's rounded copies.
 *
 * DURABILITY IS NOT A PROPERTY OF THE HULL ROW: every target flies the
 * commander's own three 255-point pools through `game/systems.ts`, so
 * `train/survivability.ts` corrects no stand-in's hp — the stand-in is the
 * commander (TODO 29).
 */
function targetFlightHull(maxSpeed: number, accel: number): TargetHull {
  return {
    name: 'Cobra Mk III (player)',
    radius: shipTargetRadius(TRADER_COBRA.designId),
    maxSpeed,
    accel,
    maxPitch: PLAYER_FLIGHT.maxPitch,
    maxRoll: PLAYER_FLIGHT.maxRoll,
    rateRamp: PLAYER_FLIGHT.rateRamp,
    rateDecay: PLAYER_FLIGHT.rateDecay,
    steerRate: PLAYER_FLIGHT.maxPitch,
    gun: 'player',
  };
}

const TARGET_HULLS: Record<TargetHullId, () => TargetHull> = {
  traderCobra: traderHull,
  /**
   * The commander's own speed and agility — the thing pirates actually have to
   * track. A pursuit curve fitted to the 1.8x slower freighter overshoots a
   * player on every pass, so the pirate spends the fight re-acquiring: measured
   * in the game, a Sidewinder is lined up on the player for 5% of a fight.
   */
  playerCobra: () => targetFlightHull(PLAYER_FLIGHT.maxSpeed, PLAYER_FLIGHT.accel),
  /**
   * How a human actually flies in a dogfight, from Chris's recorded envelope:
   * median speed 66, pitch held at 1.36 of a possible 1.45. He turns almost on
   * the spot and stops dead to bring guns to bear. A pursuer that has never seen
   * a slow target has no policy for one — the ceiling is the handicap, and
   * everything else is the commander's own ship.
   */
  playerCobraSlow: () => {
    const h = targetFlightHull(90, 120);
    h.name = 'Cobra Mk III (player, knife-fighting)';
    return h;
  },
};

/**
 * Which hull a pirate flies.
 *
 * SAMPLED FROM THE ROSTER, by the game's own rule. An episode draws a threat
 * tier from its seed and hands each attacker the hull `threat.ts` would give
 * the Nth member of a group at that tier — so the trainer meets the same spread
 * of released builds the sky does, from a tier-0 Sidewinder to a tier-2 Monitor,
 * rather than a fixed pair of hulls (TODO 29).
 */
function pirateSpecFor(seed: number, index: number, count: number): NpcSpec {
  // one rung count, not a third spelling of it: tiers run 0..MAX_TIER
  const tier = seed % (MAX_TIER + 1);
  return pirateSpecForTier(memberTier(tier, index), (seed >>> 2) + index * 7 + count);
}

/**
 * The record schema an episode's setup and report are written against. A bump
 * means the WORLD changed — recharge (2), then missiles (3), then the target's
 * E.C.M. answer (4), then fewer launches (5) — so rows of different schema are
 * not one measurement and nothing should average across a bump. No RECORD FIELD
 * changes on a bump; the number says which world a row was measured in.
 * docs/TRAINING-LOG.md has the columns.
 *
 * Two standing decisions:
 *
 * **E.C.M. is an ACTION, not a reflex.** As a policy output it is a decision the
 * search must find and can get wrong, and the bank it spends is visible to it
 * (`observeDefend` slot 15). A free reflex would hand a selector that rewards
 * never being hit 250 pool points to bank while it hides (docs/TODO/72). The
 * head is `DEFEND_OUT_SIZE` and only a defence genome has it.
 *
 * **The one-in-the-air cap stays.** A FAIRNESS rule — the player gets one press,
 * so a gang gets one warhead — kept so this schema stays comparable to 3 on
 * every axis but the answer itself.
 */
export const EPISODE_SCHEMA = 5;

// --- the target's scale, which is the commander's ----------------------------
//
// THERE IS NO NORMALIZED SCALE. The episode's target is the commander, with
// `game/systems.ts`'s three 255-point pools, hit through the same `applyDamage`
// the game runs and for the same `npcLaserDamageToPlayer` points. Every damage
// path in an episode is a runtime combat function:
//
//   NPC laser -> the target     gunnery.ts  npcLaserDamageToPlayer
//   NPC laser -> another ship   npc-energy.ts npcCrossfireDamage
//   player laser -> a ship      npc.ts      takeLaserHit (the oracle)
//   a ram, either way           constants/impact.ts IMPACT.ram
//   a warhead -> the target     ordnance.ts flies it, constants/impact.ts
//                               IMPACT.warhead prices it (docs/TODO/62)
//
// AND THE POOLS COME BACK, by `systems.ts`'s own `regenerate` and no other rule
// — the same call `world-step.ts` makes for the commander every frame, and the
// same debt `p.npc.tickClocks(dt)` pays on the pirate side. An episode where
// damage was permanent had exactly one surviving strategy, never to be hit,
// which is a good description of the policy it produced (docs/TODO/63). It costs
// a gentler episode and a pools-left figure that measures recovery as well as
// avoidance: every defence and evade number in docs/TRAINING-LOG.md predating
// 2026-08-04 was measured without recharge and is INCOMPARABLE with one after.

/**
 * The commander's laser, from the commander's hull — one entry per type. A
 * commander who has bought the combat computer has almost certainly bought a
 * better laser than the one he launched with, so a policy must be fittable at
 * beam/military rate, not just pulse. It matters more than a damage number:
 * `beam` and `military` reload at 0.09s against pulse's 0.24, so the trigger
 * discipline that pays is a different discipline and heat, not the clock, limits
 * them.
 */
const PLAYER_LASERS: Record<LaserType, ReturnType<typeof playerLaser>> = {
  pulse: playerLaser(COBRA_MK_3_HULL_ID, 'pulse'),
  beam: playerLaser(COBRA_MK_3_HULL_ID, 'beam'),
  military: playerLaser(COBRA_MK_3_HULL_ID, 'military'),
};

/**
 * The packed weapon byte an armed freighter fires with — the trader Cobra's
 * own released build, read off the roster row this episode's target stands in
 * for rather than chosen.
 */
const TRADER_WEAPON_BYTE = npcWeaponByte(TRADER_COBRA.profileId);

/** Everything fixed about an episode before it runs — the record's inputs. */
export interface EpisodeSetup {
  schema: number;
  seed: number;
  maxTime: number;
  escapeRange: number;
  target: {
    /** which of the 15 flyable hulls supplies the armour and the pools */
    shipId: PlayerHullId;
    /** which flight envelope it is flown at */
    hull: TargetHullId;
    laser: string;
    armed: boolean;
    /** part of the fit-out, because it doubles how fast the pools come back */
    energyUnit: boolean;
    /**
     * ...and the E.C.M., which is the only answer to a warhead there is. Beside
     * the laser and the energy unit because it belongs to the same question —
     * what is this commander FITTED with — and it changes a fight more than
     * either: a missile is 250 of her 765 pool points (docs/TODO/72).
     */
    ecm: boolean;
    controller: string;
    pools: { foreShield: number; aftShield: number; energy: number };
  };
  pirates: {
    designId: ShipDesignId;
    profileId: NpcCombatProfileId;
    name: string;
    maxEnergy: number;
    controller: string;
    /** what one of its registered hits costs THIS target, armour already off */
    damagePerHit: number;
    /** the rack it warped in with — 250 pool points a round (docs/TODO/62) */
    missiles: number;
  }[];
}

/** What an episode leaves behind — the same shape whoever ran it. */
export interface EpisodeReport {
  schema: number;
  setup: EpisodeSetup;
  seconds: number;
  outcome: 'destroyed' | 'escaped' | 'cleared' | 'timeout';
  target: {
    alive: boolean;
    pools: { foreShield: number; aftShield: number; energy: number };
    /** exact pool points taken, and the same as a fraction of the full pools */
    damageTaken: number;
    healthFraction: number;
    shots: number;
    hits: number;
    damageDealt: number;
  };
  pirates: {
    profileId: NpcCombatProfileId;
    alive: boolean;
    energy: number;
    maxEnergy: number;
    shots: number;
    hits: number;
    damageDealt: number;
    damageTaken: number;
    /** warheads it put in the air, and what is still on the rail */
    missilesFired: number;
    missilesLeft: number;
  }[];
}

export interface EpisodeOptions {
  seed: number;
  /** one brain per pirate; scripted pirates use the game's chase AI */
  pirates: Controller[];
  trader: Controller;
  /**
   * Hull for the trader. Defaults to `traderCobra`, the freighter every brain
   * has ever been trained against. `playerCobra` gives it the commander's own
   * speed and agility, which is the thing pirates actually have to track.
   */
  traderClass?: TargetHullId;
  /** armed traders shoot back (used for pack scenarios) */
  traderArmed?: boolean;
  /**
   * Which laser an armed target fires. Pulse unless a caller says otherwise,
   * so every existing episode and every archived run means what it did.
   */
  traderLaser?: LaserType;
  /**
   * Does the target carry an extra energy unit? It DOUBLES the bank's recharge
   * (`ENERGY_UNIT_MULTIPLIER`), so it is the one fitting that changes how a
   * fight goes rather than how it opens: a policy fitted at one recovery rate
   * has learned a disengage-and-heal discipline wrong for the ship it will fly.
   * Off unless a caller says otherwise, so every archived run means what it did.
   */
  targetEnergyUnit?: boolean;
  /**
   * Does the target carry an E.C.M.? Off unless a caller says otherwise, so
   * every archived run still means what it did. `train/defence-fight.ts` turns
   * it on for every defence fight. It only DOES anything for a policy with an
   * E.C.M. head: the equipment without the output is theatre (docs/TODO/62).
   */
  targetEcm?: boolean;
  /**
   * Which of the 15 flyable hulls the target IS — its per-hit armour and the
   * size of its three pools. The Cobra Mk III unless a caller says otherwise,
   * because that is the ship a career flies and the only one the game can put
   * you in; `train/profile-sweep.ts` is what exercises the other fourteen.
   */
  targetShipId?: PlayerHullId;
  maxTime?: number;
  /**
   * How far the target has to get before it is gone for good. Without it the
   * episode is a box the trader can neither escape nor be lost in, so closing
   * the distance is worth nothing and only aiming pays — and the trainer evolves
   * pirates that stand still and pivot, useless where the player can simply leave.
   */
  escapeRange?: number;
}

/** A pirate: a real NpcShip, plus the tally the fitness functions read. */
class PirateShip implements EpisodeShip {
  readonly npc: NpcShip;
  readonly radius: number;
  readonly name: string;
  shotsFired = 0;
  shotsHit = 0;
  damageDealt = 0;
  damageTaken = 0;
  /**
   * Warheads this ship has put in the air.
   *
   * Counted separately from `shotsFired`, which is a LASER tally: a missile has
   * no hit roll and no cone, so folding it in would corrupt every accuracy
   * figure derived from the pair. It is also the only way to see the rack empty,
   * which is the acceptance test docs/TODO/62 sets.
   */
  missilesFired = 0;
  /**
   * The rack it warped in with — read at construction, because `state.missiles`
   * is what is LEFT and a record written at the end of a fight would report the
   * empty rail as the fit-out.
   */
  readonly missilesCarried: number;

  constructor(spec: NpcSpec, position: THREE.Vector3, variantSeed: number) {
    this.npc = new NpcShip('pirate', position, variantSeed, spec);
    this.radius = this.npc.radius;
    this.name = shipDisplayName(spec.designId);
    this.missilesCarried = this.npc.state.missiles;
  }

  get pos(): THREE.Vector3 { return this.npc.object.position; }
  get quat(): THREE.Quaternion { return this.npc.object.quaternion; }
  get speed(): number { return this.npc.state.speed; }
  /** Normalized at the boundary — the ship's bank is whole energy points. */
  get hp(): number { return this.npc.healthFraction; }
  set hp(v: number) { this.npc.state.energy = Math.round(v * this.npc.maxEnergy); }
  get alive(): boolean { return this.npc.state.alive; }
  set alive(v: boolean) { this.npc.state.alive = v; }

  forward(out: THREE.Vector3): THREE.Vector3 {
    return out.set(0, 0, -1).applyQuaternion(this.quat);
  }
}

/**
 * The target: the player's own flight model, flown from a FlightDemand.
 *
 * `PlayerShip.update` takes what the pilot WANTS and asks nothing about who
 * the pilot is — which is the seam this whole merge turns on. A human's hands,
 * the combat computer and a training scenario all produce the same four
 * numbers, and the ship cannot tell them apart.
 */
class TargetShip implements EpisodeShip {
  readonly ship: PlayerShip;
  readonly hull: TargetHull;
  readonly radius: number;
  readonly name: string;
  /** which of the 15 flyable hulls: the armour, the pools and the recharge */
  readonly shipId: PlayerHullId;
  /**
   * The commander's own three pools, in `PlayerPoolPoints` — the game's object,
   * hit by the game's `applyDamage`.
   */
  readonly sys: ShipSystems;
  /**
   * Which hull's recharge rating and which fit-out `regenerate` runs on — built
   * once, because `energyRegenPerSecond` applies each of them exactly once and a
   * caller assembling this per frame is how a rate gets doubled twice.
   */
  readonly regen: RegenOptions;
  /** every point the pools can hold: both faces and the bank */
  readonly maxPool: number;
  /**
   * The fit-out `ordnance.ts` reads — only ever "is there an E.C.M." (`EcmFit`).
   * `Ordnance.triggerEcm` took a `CommanderData` and an episode's target has
   * never been one, so the RULE was narrowed to what it reads (as `OrdnanceWorld`
   * and `FireWorld` were) rather than putting a career, a cargo hold and a legal
   * status inside a training episode to satisfy one boolean (docs/TODO/72).
   */
  readonly equipment: { readonly ecm: boolean };
  alive = true;
  shotsFired = 0;
  shotsHit = 0;
  /** in NpcEnergyPoints — what it took OFF a pirate */
  damageDealt = 0;
  /** in PlayerPoolPoints — what came off its own pools */
  damageTaken = 0;
  /** ramped turn rates — the pilot's, not the hull's (see FlightDemand) */
  pitchRate = 0;
  rollRate = 0;

  constructor(hull: TargetHull, shipId: PlayerHullId, energyUnit: boolean, ecm: boolean) {
    this.hull = hull;
    this.radius = hull.radius;
    this.name = hull.name;
    this.shipId = shipId;
    this.sys = freshSystems();
    this.regen = { shipId, energyUnit };
    this.equipment = { ecm };
    this.maxPool = durability(true);
    this.ship = new PlayerShip(new THREE.Vector3(), new THREE.Vector3(0, 0, -1));
    this.ship.speed = hull.maxSpeed * 0.5;
  }

  get pos(): THREE.Vector3 { return this.ship.position; }
  get quat(): THREE.Quaternion { return this.ship.quaternion; }
  get speed(): number { return this.ship.speed; }
  /** The gun's clocks live on the systems block, as the commander's do. */
  get laserTemp(): number { return this.sys.laserTemp; }
  set laserTemp(v: number) { this.sys.laserTemp = v; }
  get laserCooldown(): number { return this.sys.laserCooldown; }
  set laserCooldown(v: number) { this.sys.laserCooldown = v; }
  /**
   * THE observation boundary: exact points in, a fraction out.
   *
   * `systems.ts`'s own expression rather than this file's arithmetic, because
   * the combat computer feeds the identical number to the identical slot of the
   * identical encoder and the two must not be able to disagree (docs/TODO/71).
   */
  get hp(): number { return poolsLeft(this.sys); }
  /** Points left across all three pools, exact. */
  get pool(): number {
    return this.sys.foreShield + this.sys.aftShield + this.sys.energy;
  }

  forward(out: THREE.Vector3): THREE.Vector3 {
    return this.ship.getForward(out);
  }

  /** Fly one step of a discrete control, ramping to this hull's envelope. */
  step(dt: number, c: Control): void {
    const h = this.hull;
    this.pitchRate = rampToward(
      this.pitchRate, c.pitch * h.maxPitch, c.pitch !== 0, dt, h.rateRamp, h.rateDecay);
    this.rollRate = rampToward(
      this.rollRate, c.roll * h.maxRoll, c.roll !== 0, dt, h.rateRamp, h.rateDecay);
    this.fly(dt, {
      pitchRate: this.pitchRate,
      rollRate: this.rollRate,
      throttle: c.throttle,
      fire: false,
      limits: { accel: h.accel, maxSpeed: h.maxSpeed },
    });
  }

  /**
   * Fly one step of a demand whose ROTATION has already happened — the
   * scripted controllers swing the nose with `steerQuatToward`, as every
   * scripted ship in the game does, rather than through pitch and roll.
   */
  fly(dt: number, demand: FlightDemand): void {
    this.ship.update(dt, demand);
    // THE WHOLE OF systems.ts's `regenerate`, the same call world-step.ts makes
    // for the commander once a frame: the gun's cooldown and heat, the energy
    // bank, and both shield faces once the bank is out of its last quarter.
    // Running only the gun's lines made every hit permanent (docs/TODO/63).
    //
    // Here rather than in `Episode.step` because this is where a target's frame
    // is, and every controller in this file — the policy's `step`, the four
    // scripted pilots' `coast` — comes through it exactly once per step.
    regenerate(this.sys, dt, this.regen);
  }

  /**
   * Take a hit, in the commander's own points, through the commander's own
   * rule: the facing shield first, the remainder straight into the bank,
   * destroyed at zero energy. `roll` is the equipment-damage die, which an
   * episode has no fittings to wreck — so it is fed a constant and nothing is
   * drawn from the world's stream for it.
   */
  takeDamage(points: PlayerPoolPoints, fromFront = true): void {
    this.damageTaken += points;
    const r = applyDamage(this.sys, points, fromFront, () => 1);
    if (r.destroyed) this.alive = false;
  }
}

export class Episode {
  readonly pirates: PirateShip[] = [];
  readonly trader: TargetShip;
  t = 0;
  readonly maxTime: number;
  done = false;
  /** the target got clear — the pirates lost it, and no one gets paid */
  escaped = false;
  /**
   * How many times a pirate has flown into the TARGET — the count, not a
   * quotient. Counted where the ram is billed, so it cannot disagree with the
   * damage; `train/ram-probe.ts` needs exactly this number and cannot recover it
   * from `damageTaken`, which folds lasers, rams and ship-on-ship contact into
   * one total (docs/TODO/66). Multiply by `IMPACT.ram.commander` for the points.
   */
  traderRams = 0;
  /**
   * Warheads that actually REACHED her — counted where the impact is billed,
   * for the reason `traderRams` above is: it cannot be recovered from
   * `damageTaken`, which is lasers and rams and this in one total, and it is
   * the number that says whether the E.C.M. is doing anything. `missilesFired`
   * on the pirate side is how many were launched; the difference is how many
   * were answered (docs/TODO/72).
   */
  warheadsTaken = 0;
  readonly escapeRange: number;
  /** the gun the armed target fires — see PLAYER_LASERS */
  private readonly playerLaser: typeof PLAYER_LASERS[LaserType];
  /** proximity shaping accumulator per pirate */
  readonly engagedTime: number[];
  /**
   * Time each pirate spent ON THE TARGET'S SIX — behind it, and pointed at
   * it. Paying for the tail position asks for the manoeuvre that is actually
   * threatening, rather than for damage by whatever route.
   */
  readonly tailTime: number[];

  private readonly opts: EpisodeOptions;
  private readonly fleet: NpcShip[] = [];
  /**
   * The missiles in this episode's sky — `game/ordnance.ts`, unchanged, over a
   * sky with nothing to draw into.
   *
   * NOT a second missile model, the one thing docs/TODO/62 forbids: the spawn,
   * the homing, the hostile warhead's own `HOSTILE_MISSILE_LIFE` clock, the
   * `MISSILE_HIT_RANGE` fuse and the E.C.M. rule are the game's. All an episode
   * supplies is the `OrdnanceWorld` — its own fleet, and an `attach` with no
   * scene behind it, the same bargain `headlessShell()` makes for the renderer
   * and `inert-dom.ts` for a painter. Nothing reads the scene back.
   */
  private readonly ordnance: Ordnance;
  /**
   * The sky a fired shot is resolved against — `game/fire-resolution.ts`, the
   * game's own resolver, over this episode's target and this episode's
   * warheads.
   *
   * Four members, and every one of them is a fact only an episode has: which
   * hull the target is, where it is, what a hit does to it, and what to do with
   * a ship shot out of the sky (nothing — there is no bounty here and nothing to
   * despawn). Everything else about a resolved shot is the rule, and the rule is
   * not in this file any more.
   */
  private readonly fire: FireWorld;
  private readonly obs = makeObs();
  private readonly scratch = makeScratch();
  private readonly meView = shipView();
  private readonly threatView = shipView();
  private readonly scratchVecs = { a: new THREE.Vector3(), b: new THREE.Vector3() };
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  /** scratch for `hitFromAhead`, its own because the two above are live across it */
  private readonly faceVec = new THREE.Vector3();
  private readonly faceQuat = new THREE.Quaternion();
  private readonly traderVel = new THREE.Vector3();
  private readonly traderWaypoint = new THREE.Vector3();
  private traderWaypointTimer = 0;
  /** the pirate the trader's policy is fighting — game/threat-lock.ts's rule */
  private readonly threatLock = new ThreatLock<PirateShip>();
  /**
   * The policy trader's decision clock and held control — `DECISION_INTERVAL`,
   * the SAME 10Hz the combat computer and an armed trader decide at in the
   * game, not the physics step: deciding at a reaction speed the game never
   * gives is exactly the second world the trainer exists to not be.
   */
  private traderControl: Control | null = null;
  private traderDecisionTimer = 0;
  private traderFireCooldown = 1.5;

  constructor(opts: EpisodeOptions) {
    // `pursuit` is a pirate's pilot: the target is a `PlayerShip` and cannot
    // fly an NPC flight. Refused loudly — the shared `Controller` union would
    // otherwise let it fall silently into the scripted trader below.
    if (opts.trader.kind === 'pursuit') {
      throw new Error('Episode: the target cannot fly pursuit — it is a pirate pilot');
    }
    this.opts = opts;
    // The sky this episode's warheads fly in: its own fleet, and nowhere to
    // draw. `npcs` is the live array, not a copy, because the pirates are pushed
    // into it below and `Ordnance` reads it whenever it is asked.
    const sky: OrdnanceWorld = {
      attach: () => {}, detach: () => {}, npcs: this.fleet,
    };
    this.ordnance = new Ordnance(sky);
    this.playerLaser = PLAYER_LASERS[opts.traderLaser ?? 'pulse'];
    this.maxTime = opts.maxTime ?? 45;
    // 6000 against a 3500 laser and a 1500-2700 spawn: comfortably outside
    // weapons reach, and reachable in a few seconds of running flat out.
    this.escapeRange = opts.escapeRange ?? 6000;
    // The world's own PRNG, seeded per episode. Everything with a die in it —
    // where the pirates spawn, which way they face, whether a shot connects —
    // is drawn from it, because that is what the game draws from (game/rng.ts,
    // and Math.random is banned). One consequence, and it is the same one the
    // game lives with: episodes must be RUN one at a time, not interleaved.
    seedWorld(opts.seed >>> 0);

    this.trader = new TargetShip(
      TARGET_HULLS[opts.traderClass ?? 'traderCobra'](),
      opts.targetShipId ?? COBRA_MK_3_HULL_ID,
      !!opts.targetEnergyUnit, !!opts.targetEcm);
    const trader = this.trader;
    this.fire = {
      target: {
        hullId: trader.shipId,
        pos: trader.pos,
        damage: (damage, from) => trader.takeDamage(damage, this.hitFromFront(from)),
      },
      ordnance: this.ordnance,
      // An episode has nobody to pay and nothing to despawn: `takeDamage` has
      // already taken the ship out of the sky, and the fitness reads `alive`.
      wreck: () => {},
    };
    // random initial trader orientation
    steerQuatToward(
      this.trader.quat, randomDirection(this.tmp).multiplyScalar(1000), Math.PI);

    for (let i = 0; i < opts.pirates.length; i++) {
      const dir = randomDirection(this.tmp);
      const dist = 1500 + random() * 1200;
      const p = new PirateShip(
        pirateSpecFor(opts.seed >>> 0, i, opts.pirates.length),
        this.tmp2.copy(dir).multiplyScalar(dist),
        i * 7 + 1);
      p.npc.faceToward(this.trader.pos); // roughly face the prey
      this.pirates.push(p);
      this.fleet.push(p.npc);
    }
    this.engagedTime = this.pirates.map(() => 0);
    this.tailTime = this.pirates.map(() => 0);
  }

  /**
   * The warheads in the air, for anything that draws the episode.
   *
   * Read-only, and it is `ordnance.ts`'s own list rather than a copy: each entry
   * carries the `Object3D` the missile model already flies, so the combat viewer
   * adds it to its scene and the positions keep themselves. Without this the
   * viewer would show a target losing a third of her pools to nothing at all.
   */
  get missiles(): readonly Missile[] { return this.ordnance.missiles; }

  /** @returns shot events for this step (for the viewer's tracers) */
  step(dt: number): ShotEvent[] {
    if (this.done) return [];
    this.t += dt;
    const events: ShotEvent[] = [];

    // ONE READ PER FRAME, before anybody decides — `world-step.ts` builds its
    // `WorldView` once outside the loop and every ship in that frame sees the
    // same answer. Asking the ordnance per pirate instead would let the first
    // launcher silence the rest within the same step, which is a different
    // program from the one the game runs.
    const missileInbound = this.ordnance.missileInbound;

    // --- pirates ---
    for (let i = 0; i < this.pirates.length; i++) {
      const p = this.pirates[i];
      if (!p.alive) continue;
      // The clocks run whatever the ship is doing: the generator, the evasion
      // decay and the missile reload. `NpcShip.update` does this for the live
      // sky; an episode drives `brainFly`/`attack` directly, so it owes the
      // ship the same call — the trainer flies the real game, and a world where
      // pirates never heal, or where a policy pirate is permanently `underFire`
      // after one hit, would be a second one (docs/TODO/77).
      p.npc.tickClocks(dt);
      const ctrl = this.opts.pirates[i];
      const toTarget = this.tmp.copy(this.trader.pos).sub(p.pos);
      const range = toTarget.length();
      // The policy's trigger is NOT consulted, and neither is a scripted
      // pirate's — brainFly and attack() both gate the gun themselves, on
      // range, the 0.25 rad cone and their own cooldown. That is the game's
      // rule and it is now literally the same code: a pirate shoots exactly as
      // often as being lined up allows.
      const shot = ctrl.kind === 'policy'
        // The fleet goes in unconditionally: what a genome can SEE of it is
        // `observeFor`'s call, not this file's. Deciding it here as well is how
        // the trainer came to be able to produce genomes the game could not fly.
        ? p.npc.brainFly(
          ctrl.brain, dt, this.trader.pos, this.trader.quat, this.trader.speed,
          range, 'player', this.fleet)
        // The shipped opposition: the pursuit dogfighter through the same
        // `pursuitFly` the live `update()` path flies, switch and all
        // (docs/TODO/102). The target's speed rides in on the same PlayerRef
        // the game hands it.
        : ctrl.kind === 'pursuit'
          ? p.npc.pursuitFly(dt, this.traderAsPlayer(), range, this.fleet)
        // THE FLEET GOES IN, and so does the target's VELOCITY. Without the
        // first a scripted pirate in an episode flies with no idea its wingmen
        // exist; without the second it lays its attack run on where the target
        // was rather than where it will be. Either omission is a second physics
        // — the same ship flying differently here from in the game — and that
        // is the one thing this file is organised against.
          : p.npc.attack(dt, this.trader.pos, range, true, undefined, this.fleet,
            this.traderVelocity());
      // WHICH WEAPON leaves the rail is the ship's decision, not the flight's
      // (docs/TODO/62). It keeps no time of its own: `tickClocks` above runs the
      // reload, so this is a decision and nothing else (docs/TODO/77). It no
      // longer passes `matesLost` — an episode never prunes its fleet, so that
      // argument unlocked a rack here that the same fight in the game did not
      // (docs/TODO/75).
      const fired = p.npc.chooseWeapon(shot, range, this.trader.pos, missileInbound);
      if (fired && this.trader.alive) {
        const e = this.resolveNpcShot(p, fired);
        if (e) events.push(e);
      }
      // geometry AFTER the step, as the shaping terms always measured it
      const after = this.tmp.copy(this.trader.pos).sub(p.pos);
      const gap = after.length();
      if (gap < 1500) this.engagedTime[i] += dt;
      // on its six: behind the target's tail AND nose-on to it
      if (gap < 1800 && gap > 120) {
        const dir = after.divideScalar(gap);
        const behind = this.trader.forward(this.tmp2).dot(dir) > 0.35; // we are astern
        const pointed = p.forward(this.tmp2).dot(dir) > 0.9;           // and lined up
        if (behind && pointed) this.tailTime[i] += dt;
      }
    }

    // --- trader ---
    if (this.trader.alive) {
      const tCtrl = this.opts.trader;
      let policyWantsFire = false;
      let policyThreat: PirateShip | null = null;
      if (tCtrl.kind === 'policy') {
        // Locked, exactly as the game holds it (game/threat-lock.ts): the
        // trainer flying a fresh-nearest while the game flies a locked threat
        // would be a second world on the one input geometry feeds.
        policyThreat = this.threatLock.pick(
          dt,
          this.pirates.filter((p) => p.alive),
          (p) => p.pos.distanceTo(this.trader.pos),
        );
        this.traderDecisionTimer -= dt;
        if (!this.traderControl || this.traderDecisionTimer <= 0) {
          this.traderDecisionTimer = DECISION_INTERVAL;
          const threat = policyThreat ?? this.pirates[0];
          this.traderControl = act(
            tCtrl.brain, this.observeTrader(threat, tCtrl.brain, missileInbound), this.scratch);
        }
        const c = this.traderControl;
        policyWantsFire = c.fire && !!this.opts.traderArmed; // armed policies may shoot
        // SHE ANSWERS THE WARHEAD — `ordnance.ts`'s own rule and its own price,
        // through the same `fireEcm` the player's key and the combat computer
        // both press, gated the same way the co-pilot's is (docs/TODO/72). Only
        // a `DEFEND_OUT_SIZE` genome ever asks: `Control.ecm` is false for every
        // brain without the head.
        if (autopilotEcm(c.ecm, missileInbound)) {
          fireEcm(this.trader, this.trader.sys, this.ordnance);
        }
        this.trader.step(dt, { ...c, fire: false });
      } else if (tCtrl.kind === 'runner') {
        this.runningTrader(dt);
      } else if (tCtrl.kind === 'holding') {
        this.holdingTrader(dt);
      } else if (tCtrl.kind === 'weaving') {
        this.weavingTrader(dt);
      } else {
        this.scriptedTrader(dt);
      }

      if (this.opts.traderArmed) {
        if (tCtrl.kind === 'policy') {
          // The gun fires at the ship the brain was OBSERVING when it pulled
          // the trigger, not a fresh nearest — else on frames where the two
          // disagree the policy aims at one ship and is scored on another.
          if (policyWantsFire && policyThreat) {
            const e = this.fireTraderGun(policyThreat);
            if (e) events.push(e);
          }
        } else {
          const threat = this.nearestPirate();
          // A scripted trader's trigger discipline: a slow, deliberate shot
          // when it is properly lined up, on top of whatever its gun allows.
          this.traderFireCooldown -= dt;
          if (threat && this.traderFireCooldown <= 0
              && this.facingAngle(this.trader, threat.pos) < 0.15) {
            this.traderFireCooldown = 1.2;
            const e = this.fireTraderGun(threat);
            if (e) events.push(e);
          }
        }
      }
    }

    this.resolveCollisions();
    // ...and then the warheads, in the phase order world-step.ts runs them in:
    // ships move and shoot, ships are separated and billed, and only then do the
    // projectiles fly (`stepProjectilesAndEffects`).
    this.applyOrdnance(dt);

    const nearest = this.nearestPirate();
    if (this.trader.alive && nearest
        && this.tmp.copy(this.trader.pos).sub(nearest.pos).length() > this.escapeRange) {
      this.escaped = true;
    }
    if (this.t >= this.maxTime || !this.trader.alive || this.escaped
        || this.pirates.every((p) => !p.alive)) {
      this.done = true;
    }
    return events;
  }

  // --- guns ------------------------------------------------------------------

  /**
   * A pirate pulled the trigger. Resolving it is `game/fire-resolution.ts` —
   * the game's own resolver, and now literally the same call the world step
   * makes, so the rack, the dice, the damage and the shield face cannot drift
   * from it again (docs/TODO/64).
   *
   * What is left here is the trainer's own half: the tally the fitness functions
   * read, and a tracer for the viewer.
   *
   * @returns the tracer to draw, or null when nothing was drawable — a missile
   * is a ship in the sky for the next twenty-five seconds, not a bolt that
   * arrives in the same frame it left. Reporting one as a `ShotEvent` would put
   * a laser line in the viewer and a hit in the accuracy denominator.
   */
  private resolveNpcShot(p: PirateShip, shot: FireEvent): ShotEvent | null {
    const fired = resolveNpcFire(p.npc, shot, this.fire);
    if (fired.weapon === 'missile') {
      // The round is spent and the warhead is in the sky. Counted separately
      // from `shotsFired`, which is a LASER tally (docs/TODO/62).
      p.missilesFired += 1;
      return null;
    }
    p.shotsFired += 1;
    if (fired.hit) {
      p.shotsHit += 1;
      p.damageDealt += fired.damage;
    }
    // A pirate in an episode is only ever pointed at the target: `brainFly` and
    // `attack` are both driven with `'player'` above, and there is nobody else
    // in the sky to be given. The resolver owns the crossfire branch as well
    // because the sky does; all the trainer has to say about one is nothing.
    return fired.at === 'target' ? { from: p, to: this.trader, hit: fired.hit } : null;
  }

  /**
   * What the warheads did — world-step.ts's `applyOrdnance`, with nothing to
   * explode and nobody to tell.
   *
   * Only one of the four `OrdnanceEvent`s can happen in an episode and the other
   * three say why. `hitNpc` needs a missile with a ship for a target, which only
   * the commander's own launcher makes; `ecmDefeated` needs that same ship to
   * carry E.C.M.; `expired` is a firework. A hostile warhead reaching the target
   * is billed exactly as the game bills it — `IMPACT.warhead` in her own pool
   * points, on the face it came in at.
   *
   * IT IS NOT CREDITED TO A PIRATE'S `damageDealt`, because nothing in the sky
   * remembers who launched it — not here and not in the game, where a `Missile`
   * carries a target and a life and no owner. The fitness functions are
   * unaffected: every one of them reads `trader.damageTaken`, which this feeds.
   * `missilesFired` is where a pirate's own rack is visible.
   */
  private applyOrdnance(dt: number): void {
    for (const e of this.ordnance.step(dt, this.trader.pos)) {
      if (e.kind !== 'hitPlayer' || !this.trader.alive) continue;
      this.warheadsTaken += 1;
      this.trader.takeDamage(playerImpactDamage(IMPACT.warhead), this.hitFromFront(e.at));
    }
  }

  /**
   * The target as the `PlayerRef` a pursuit pirate's flight reads — the same
   * three facts `update()` hands `pursuitFly` for the live commander. One
   * reused object: `pos` and `quat` are the target's own live objects, so only
   * the speed genuinely changes between calls.
   */
  private readonly playerRef: PlayerRef = { position: null!, quaternion: null!, speed: 0 };

  private traderAsPlayer(): PlayerRef {
    this.playerRef.position = this.trader.pos;
    this.playerRef.quaternion = this.trader.quat;
    this.playerRef.speed = this.trader.speed;
    return this.playerRef;
  }

  /**
   * How the target is travelling, for a pirate laying its attack run.
   *
   * `NpcShip.attack` wants a velocity and the target carries a heading and a
   * speed, which is the same pair every ship in the game carries — the nose and
   * the thrust are one direction. Its own scratch, because the two the pirate
   * loop already uses are live across the call.
   */
  private traderVelocity(): THREE.Vector3 {
    return this.trader.forward(this.traderVel).multiplyScalar(this.trader.speed);
  }

  /**
   * Which face takes it — `game/shield-face.ts`, the same call `Combat.hitPlayer`
   * makes: the commander has two shields, and an attacker on your six is spending
   * a different pool from one head-on.
   */
  private hitFromFront(from: THREE.Vector3): boolean {
    return hitFromAhead(
      from, this.trader.pos, this.trader.quat, this.faceVec, this.faceQuat);
  }

  /**
   * The target shoots back, with the gun its hull carries.
   *
   * A freighter fires an NPC's gun — loose gate, slow cadence, dice on range.
   * The commander's hull fires the commander's pulse laser: a cone test
   * (gunnery.ts `hitCone`, the same allowance the player's ring sight is drawn
   * to) and a cooldown and heat budget, which is deterministic on purpose so a
   * policy can genuinely learn to aim.
   */
  private fireTraderGun(threat: PirateShip): ShotEvent | null {
    const t = this.trader;
    const to = this.tmp.copy(threat.pos).sub(t.pos);
    const dist = to.length();
    const angle = this.facingAngle(t, threat.pos);

    if (t.hull.gun === 'npc') {
      // the NPC's trigger, gate and cooldown: gunnery.ts's, and the same call
      // npc.ts makes, so the order cannot drift from the game's
      const reload = npcTriggerPull(t.laserCooldown, angle, dist, random);
      if (reload === null) return null;
      t.laserCooldown = reload;
      t.shotsFired += 1;
      if (random() >= npcHitChance(dist)) return { from: t, to: threat, hit: false };
      // An armed freighter shooting a pirate is a CROSSFIRE hit, worth exactly
      // what world-step.ts says one is: the firing build's own laser strength
      // against the target's own defence. The freighter fires the trader Cobra's
      // released byte, the hull it is standing in for.
      const damage = npcCrossfireDamage(TRADER_WEAPON_BYTE, threat.npc.energyPolicy);
      t.shotsHit += 1;
      t.damageDealt += damage;
      this.hurtPirate(threat, damage);
      return { from: t, to: threat, hit: true };
    }

    // the commander's trigger, and the same two calls the game's makes
    if (!canFire(t)) return null;
    chargeShot(t, this.playerLaser);
    t.shotsFired += 1;
    if (dist > LASER_RANGE || angle >= hitCone(threat.radius, dist)) {
      return { from: t, to: threat, hit: false };
    }
    // The commander's hull fires the commander's laser, and what a hit is worth
    // is the TARGET's business — its own defence, immunity and multiplier. The
    // ship applies it, exactly as `Combat.fire` does in the game.
    const before = threat.npc.state.energy;
    threat.npc.takeLaserHit(this.playerLaser.hit, this.trader.pos, true);
    const damage = before - threat.npc.state.energy;
    t.shotsHit += 1;
    t.damageDealt += damage;
    threat.damageTaken += damage;
    return { from: t, to: threat, hit: true };
  }

  private hurtPirate(p: PirateShip, points: NpcEnergyPoints): void {
    p.damageTaken += points;
    p.npc.takeDamage(points, this.trader.pos, true);
  }

  // --- ramming ---------------------------------------------------------------

  /**
   * Ships are solid. The geometry is collisions.ts's — the same call
   * world-step.ts makes — and what it costs is decided here, as it is there.
   */
  private resolveCollisions(): void {
    // A ram costs a ship the stated `IMPACT.ram` in its own points and the
    // commander the stated 115 in hers — the same two calls world-step.ts
    // makes. There is no third number and no conversion between them.
    const ramEnergy = npcImpactDamage(IMPACT.ram);
    if (this.trader.alive) {
      const pos = this.trader.pos;
      const ramPool = playerImpactDamage(IMPACT.ram);
      for (const npc of playerVsNpcs(
        pos, (k) => { this.trader.ship.speed *= k; }, this.fleet, this.scratchVecs)) {
        const p = this.pirates.find((x) => x.npc === npc)!;
        this.traderRams += 1;
        this.trader.takeDamage(ramPool, true);
        this.hurtSelf(p, ramEnergy);
      }
    }
    for (const [a, b] of npcVsNpcs(this.fleet, this.scratchVecs)) {
      for (const npc of [a, b]) {
        this.hurtSelf(this.pirates.find((x) => x.npc === npc)!, ramEnergy);
      }
    }
  }

  /** Damage with nobody to credit — a ram, which the fitness already punishes. */
  private hurtSelf(p: PirateShip, points: NpcEnergyPoints): void {
    p.damageTaken += points;
    p.npc.takeDamage(points);
  }

  // --- the target's pilots ----------------------------------------------------

  /** Turn to face the threat, and stay put doing it. See `holding`. */
  private holdingTrader(dt: number): void {
    const threat = this.nearestPirate();
    if (threat) this.steerTrader(threat.pos, dt);
    // brake toward a crawl rather than a dead stop: a human bleeds speed off
    // and drifts, and a hard zero is a corner the physics never otherwise hits
    this.coast(dt, this.trader.speed > 60 ? -1 : 0);
  }

  /** Nose away from the nearest threat, throttle open, and keep going. */
  private runningTrader(dt: number): void {
    const threat = this.nearestPirate();
    if (threat) {
      this.steerTrader(
        this.tmp2.copy(this.trader.pos).multiplyScalar(2).sub(threat.pos), dt);
    }
    this.coast(dt, 1);
  }

  /**
   * Sweep the arena flat out, indifferent to the pirates. See `weaving`.
   *
   * Waypoints are absolute — a sphere around the origin the fight starts at —
   * rather than relative to the ship, which is the one line that stops this
   * being `scriptedTrader` with the throttle nailed down and the fleeing taken
   * out. And it does not consult `nearestPirate` at all, on purpose: that is
   * what makes a contact the pirate's fault and not the instrument's.
   */
  private weavingTrader(dt: number): void {
    this.traderWaypointTimer -= dt;
    if (this.traderWaypointTimer <= 0
        || this.trader.pos.distanceTo(this.traderWaypoint) < 300) {
      this.traderWaypointTimer =
        WEAVE_MIN_SECONDS + random() * (WEAVE_MAX_SECONDS - WEAVE_MIN_SECONDS);
      this.traderWaypoint.copy(randomDirection(this.tmp2).multiplyScalar(WEAVE_RADIUS));
    }
    this.steerTrader(this.traderWaypoint, dt);
    this.coast(dt, 1);
  }

  /** The pre-RL scripted hauler: amble to waypoints, run when shot at. */
  private scriptedTrader(dt: number): void {
    if (this.trader.damageTaken > 0) {
      const threat = this.nearestPirate();
      if (threat) {
        this.steerTrader(
          this.tmp2.copy(this.trader.pos).multiplyScalar(2).sub(threat.pos), dt);
      }
      this.coast(dt, 1);
      return;
    }
    this.traderWaypointTimer -= dt;
    if (this.traderWaypointTimer <= 0) {
      this.traderWaypointTimer = 8 + random() * 8;
      this.traderWaypoint.copy(this.trader.pos)
        .add(randomDirection(this.tmp2).multiplyScalar(2000));
    }
    this.steerTrader(this.traderWaypoint, dt);
    this.coast(dt, this.trader.speed < this.trader.hull.maxSpeed * 0.4 ? 1 : 0);
  }

  /** Swing the nose toward a place at the hull's turn rate. */
  private steerTrader(point: THREE.Vector3, dt: number): void {
    steerQuatToward(
      this.trader.quat, this.tmp2.copy(point).sub(this.trader.pos),
      this.trader.hull.steerRate * dt);
  }

  /** Throttle only: the nose has already been pointed. */
  private coast(dt: number, throttle: number): void {
    this.trader.pitchRate = 0;
    this.trader.rollRate = 0;
    this.trader.fly(dt, {
      pitchRate: 0, rollRate: 0, throttle, fire: false,
      limits: { accel: this.trader.hull.accel, maxSpeed: this.trader.hull.maxSpeed },
    });
  }

  // --- observation -------------------------------------------------------------

  /**
   * What the trader's policy sees. Same encoder the game feeds an NPC, and
   * chosen the same way — `observeFor`, off the brain's own input count, so a
   * genome this file can produce is by construction one the game can fly
   * (docs/TODO/71).
   *
   * `mates` is null: the target has no fleet, here or in the game.
   */
  private observeTrader(
    threat: PirateShip, brain: Brain, missileInbound: boolean,
  ): Float32Array {
    const me = this.meView;
    const t = this.threatView;
    writeView(me, this.trader.pos, this.trader.quat);
    me.speed = this.trader.speed;
    me.cls.maxSpeed = this.trader.hull.maxSpeed;
    me.cls.turnRate = this.trader.hull.maxPitch / TURN.pitch;
    me.laserTemp = this.trader.laserTemp;
    me.laserCooldown = this.trader.laserCooldown;
    // The two docs/TODO/71 and /72 are about, from `systems.ts`'s expressions —
    // the SAME calls `CombatComputer.step` makes, which is the whole of what
    // keeps the policy in distribution when it leaves the trainer. `cls.hp` is
    // 1 because `poolsLeft` is already a fraction.
    me.hp = this.trader.hp;
    me.cls.hp = 1;
    me.energy = energyLeft(this.trader.sys);
    me.missileInbound = missileInbound;
    me.fore = foreShieldLeft(this.trader.sys);
    me.aft = aftShieldLeft(this.trader.sys);
    me.pitchRate = this.trader.pitchRate;
    me.rollRate = this.trader.rollRate;
    writeView(t, threat.pos, threat.quat);
    t.speed = threat.speed;
    // The rest of the sky, exactly as the combat computer reports it: every
    // live pirate but the fought one, and the warhead if one is homing.
    const live = this.pirates.filter((p) => p.alive);
    return observeFor(brain, me, t, null, this.obs, {
      others: live.filter((p) => p !== threat).map((p) => ({ pos: p.pos })),
      count: live.length,
      missilePos: this.ordnance.hostileMissilePos,
    });
  }

  // --- geometry ----------------------------------------------------------------

  private nearestPirate(): PirateShip | null {
    let best: PirateShip | null = null;
    let bestD = Infinity;
    for (const p of this.pirates) {
      if (!p.alive) continue;
      const d = p.pos.distanceTo(this.trader.pos);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  /** Angle between a ship's nose and the direction to a point. */
  private facingAngle(s: EpisodeShip, point: THREE.Vector3): number {
    const fwd = s.forward(this.tmp2);
    return fwd.angleTo(this.tmp.copy(point).sub(s.pos).normalize());
  }

  // --- the record -------------------------------------------------------------

  /**
   * What this episode WAS: schema, seed, the target's hull and pools, and every
   * attacker's exact released build — because a number without its inputs is not
   * a measurement. The ids are the catalogue's own (`ship-identity.ts`), never a
   * name and never a copied stat block (TODO 29).
   */
  setup(): EpisodeSetup {
    return {
      schema: EPISODE_SCHEMA,
      seed: this.opts.seed >>> 0,
      maxTime: this.maxTime,
      escapeRange: this.escapeRange,
      target: {
        shipId: this.trader.shipId,
        hull: this.opts.traderClass ?? 'traderCobra',
        // WHICH laser, not "the commander has one": defence episodes fire beam
        // or military (`train/defence-fight.ts`).
        laser: this.trader.hull.gun === 'player'
          ? (this.opts.traderLaser ?? 'pulse') : 'npc',
        armed: !!this.opts.traderArmed,
        energyUnit: this.trader.regen.energyUnit,
        ecm: this.trader.equipment.ecm,
        controller: this.opts.trader.kind,
        pools: { foreShield: MAX_SHIELD, aftShield: MAX_SHIELD, energy: MAX_ENERGY },
      },
      pirates: this.pirates.map((p, i) => ({
        designId: p.npc.designId,
        profileId: p.npc.profileId,
        name: p.name,
        maxEnergy: p.npc.maxEnergy,
        controller: this.opts.pirates[i].kind,
        damagePerHit: npcLaserDamageToPlayer(p.npc.weaponByte, this.trader.shipId),
        missiles: p.missilesCarried,
      })),
    };
  }

  /** How it ended, in the same exact units it was fought in. */
  report(): EpisodeReport {
    const sys = this.trader.sys;
    return {
      schema: EPISODE_SCHEMA,
      setup: this.setup(),
      seconds: +this.t.toFixed(3),
      outcome: !this.trader.alive ? 'destroyed'
        : this.escaped ? 'escaped'
          : this.pirates.every((p) => !p.alive) ? 'cleared' : 'timeout',
      target: {
        alive: this.trader.alive,
        pools: {
          foreShield: sys.foreShield, aftShield: sys.aftShield, energy: sys.energy,
        },
        damageTaken: this.trader.damageTaken,
        healthFraction: +this.trader.hp.toFixed(4),
        shots: this.trader.shotsFired,
        hits: this.trader.shotsHit,
        damageDealt: this.trader.damageDealt,
      },
      pirates: this.pirates.map((p) => ({
        profileId: p.npc.profileId,
        alive: p.alive,
        energy: p.npc.state.energy,
        maxEnergy: p.npc.maxEnergy,
        shots: p.shotsFired,
        hits: p.shotsHit,
        damageDealt: p.damageDealt,
        damageTaken: p.damageTaken,
        missilesFired: p.missilesFired,
        missilesLeft: p.npc.state.missiles,
      })),
    };
  }

  // --- fitness -------------------------------------------------------------
  //
  // EVERY TERM BELOW IS A FRACTION, and that is the second half of the
  // observation-boundary rule: an episode holds exact points, and the moment a
  // number is compared with a shaping weight it is divided by its own maximum.
  // Otherwise the weights would mean something different for every ship — 44
  // points of ram is 60% of a Worm and 17% of a Python — and the four fitness
  // functions below, whose constants were tuned over eighteen runs against a
  // 0..1 scale, would all silently change meaning.

  /**
   * Share of the target's pools TAKEN OFF HER over the episode, 0..1 — its
   * damage, from its side, and the same question `pirateDamageShare` asks of a
   * pirate. Cumulative damage, NOT `1 - hp`: since the pools recharge
   * (docs/TODO/63) the two differ, and `1 - hp` answers "how recently was she
   * hit", which no caller wants — `fitnessAttack` pays 6x this for a pirate's
   * WORK, `fitnessPack` divides it by the clock for pressure, and `evolve.ts`
   * selects attack and pack champions on it. Exact points inside, divided by
   * their own maximum here and nowhere else.
   */
  targetDamageShare(): number {
    return Math.max(0, Math.min(1, this.trader.damageTaken / this.trader.maxPool));
  }

  /**
   * Share of the WHOLE attacking force's banks that the target took off them,
   * 0..1 — `targetDamageShare` asked from the other side of the fight. HER gun's
   * work only: a ram bills `hurtSelf`, a pirate flying into a packmate bills
   * both of them, and neither reaches this. Over the banks SUMMED rather than
   * averaged, so 1.0 means the force is gone — ordered like a kill count, with
   * the granularity a kill count throws away (docs/TODO/65). `fitnessDefend`
   * normalises the same points by ONE attacker's mean bank, so its weight can
   * exceed 1; this is a share of the force, so it cannot.
   */
  attackerDamageShare(): number {
    const banks = this.pirates.reduce((sum, p) => sum + p.npc.maxEnergy, 0);
    return Math.max(0, Math.min(1, this.trader.damageDealt / Math.max(1, banks)));
  }

  /** Share of pirate i's own released bank that has been taken off it, 0..1. */
  pirateDamageShare(i: number): number {
    const p = this.pirates[i];
    return Math.max(0, Math.min(1, p.damageTaken / Math.max(1, p.npc.maxEnergy)));
  }

  /** Fitness for pirate index i, attack phase. */
  fitnessAttack(i = 0): number {
    const killed = !this.trader.alive;
    return (
      6 * this.targetDamageShare() +
      (killed ? 8 + 4 * (1 - this.t / this.maxTime) : 0) +
      0.05 * this.engagedTime[i] +
      0.6 * this.tailTime[i] -
      2 * this.pirateDamageShare(i) -
      (this.escaped ? 6 : 0)
    );
  }

  /**
   * Shared fitness for a policy pack (all pirates one policy). Rewards
   * damage-per-second of engagement, drops the shot penalty, and keeps the
   * survivor term small, so sustained pressure beats a single decisive gamble
   * (docs/TRAINING-LOG.md, round 3).
   */
  fitnessPack(): number {
    const damage = this.targetDamageShare();
    let taken = 0;
    let alive = 0;
    for (let i = 0; i < this.pirates.length; i++) {
      taken += this.pirateDamageShare(i);
      if (this.pirates[i].alive) alive += 1;
    }
    const killed = !this.trader.alive;
    const pressure = damage / Math.max(4, this.t); // damage per second on target
    return (
      5 * damage +
      30 * pressure +
      (killed ? 12 + 5 * (1 - this.t / this.maxTime) : 0) +
      0.5 * alive -
      1.5 * taken
    );
  }

  /** Fitness for an armed policy trader defending itself (Jameson phase). */
  fitnessDefend(): number {
    const killedPirates = this.pirates.filter((p) => !p.alive).length;
    // What IT took off THEM, as a share of one attacker's bank — so the weight
    // means the same thing whether it is shooting a Worm or a Monitor.
    const bank = this.pirates.reduce((sum, p) => sum + p.npc.maxEnergy, 0)
      / Math.max(1, this.pirates.length);
    const dealt = this.trader.damageDealt / Math.max(1, bank);
    // MISSES cost, not shots — a landed shot is already paid for by `dealt`. The
    // price of a miss is set against the measured worth of a hit: one landed hit
    // earns a mean 0.32 through `dealt` (range 0.06-0.88 across the hulls and
    // lasers `defenceFight` spawns), so at -0.05 a shot pays for itself above
    // ~14% accuracy and a full-episode spray costs ~9 — more than the survival
    // term — while the trigger stays worth learning, which -0.1 (break-even
    // ~24%) risked killing outright.
    const misses = this.trader.shotsFired - this.trader.shotsHit;
    return (
      (this.t / this.maxTime) * 8 +
      this.trader.hp * 4 +
      4 * dealt +
      3 * killedPirates -
      0.05 * misses
    );
  }

  /** Fitness for a policy trader, evade phase. */
  fitnessEvade(): number {
    // Escaping ends the episode, so counting raw `t` would pay a runner LESS
    // than one that dawdles for the full 45s. Getting clear is a win: credit
    // it with the whole episode, or the escape bonus below is self-defeating.
    const survived = this.escaped ? this.maxTime : this.t;
    const nearest = this.nearestPirate() ?? this.pirates[0];
    const distBonus = this.trader.alive
      ? Math.min(2, this.trader.pos.distanceTo(nearest.pos) / 3000)
      : 0;
    return (survived / this.maxTime) * 10 + this.trader.hp * 5 + distBonus
      + (this.escaped ? 6 : 0);
  }
}
