// An NPC ship: what it decides each frame, and how it flies while it decides.
//
// ONE RESPONSIBILITY, and `NpcShip` holds it. A ship reads the world through
// `WorldView`. It picks a behaviour for its role. It steers, and it reports a
// shot as a `FireEvent`. It applies no consequence at all (invariant 15).
// `world-step.ts` calls `update` once a frame. `game.ts` resolves what comes
// back.
//
// The roles and what each one does are listed above the class. This header does
// not repeat that list.
//
// **`update` IS THE DISPATCH, AND NOTHING ELSE (docs/TODO/184 M2).** It is 37
// lines. It clears `state.flownBy`, it asks `inert` first, then it asks the
// role's own behaviour. It sets no speed, it steers nothing, and it reads no
// distance. Three files hold what it used to decide: `game/npc-idle.ts`,
// `game/npc-fighter.ts` and `game/npc-trader.ts`.
//
// EVERY FLIGHT MODEL ENDS AT `steerToward` AND `advance`, so one ship moves one
// way. `state.flownBy` records which model moved it. The primitives are this
// file's, and every caller of them is somebody else's.
//
// THE TRAINER DRIVES THIS FILE DIRECTLY (invariant 5).
// `src/ai-training/scenario.ts` builds an `NpcShip`. It calls `brainFly` and
// `tickClocks` per frame. So the flight model the trainer optimises is the
// shipped one, and no second copy exists.
//
// THE STEP ALLOCATES NOTHING. The class holds seven scratch vectors and two
// static buffers for that reason alone. A fresh vector inside `update` costs an
// allocation per ship per frame.
//
// THE FLEET QUERIES LEFT IN docs/TODO/169 M2, and `game/hostility.ts` holds
// them now. They are `isHostileToPlayer`, `hostilesNear`, `nearestEngaging` and
// `nearestNpc`. This file asks the first of them, like the other seven readers
// do. It is a rule over a fleet rather than a thing a ship does.
//
// THE SHARED MATHS LEFT IN M3, to `game/flight-maths.ts`. `steerQuatToward`
// and `velocityOf` are the nose-and-thrust rule, and five files outside the
// ships read them.
//
// THE FLIGHT HALF ONCE STAYED, and docs/TODO/169 M3 measured why. `brainFly`,
// `attack` and `pursue` each steer, throttle, advance and then pull a trigger.
// Each one returns a `FireEvent`. They are decision loops rather than steering
// primitives, so a free function over them needed about eighteen handles.
//
// The true primitives are `advance`, `steerToward`, `faceToward` and `facing`,
// at 21 lines. Those four stay. In 169 M3 the behaviour half reached the
// transform, the turn rate and the scratch vectors 69 times. A collaborator
// that held them would answer 69 calls, which is a wide seam around a small
// subject. **An OBJECT that HAS the ship answers one**, and docs/TODO/183 is
// where the measurement finally gave way to that.
//
// THE TRADER'S WORKING LIFE LEFT IN docs/TODO/176 M2, to
// `game/trader-flight.ts`. It arrives, it works the lane, then it docks or it
// leaves. `stepTrader` takes a narrow interface rather than this class, and
// `NpcShip` satisfies it with no cast. Two of the nine scratch objects served
// that one member, so they went with it.
//
// THE SAVED SHAPE LEFT IN docs/TODO/181, to `game/npc-state.ts`. `NpcState` is
// what a ship holds rather than what it does, and a snapshot walks it
// generically. `freshNpcState` went with it, so the shape and its opening value
// read together, and every per-field doc comment travelled with its field.
//
// `PlayerRef` went too. `FireEvent` and `WorldView` did NOT: each one names
// `NpcShip`, so moving it would make the child import its parent.
//
// A SHIP HOLDS THE BEHAVIOUR ITS ROLE FLIES (docs/TODO/182). It is built once,
// in the constructor, so the step allocates nothing. Every role holds one:
//
//  - `game/npc-idle.ts` — a rock and a hermit tumble, a derelict drifts, and a
//    drone whose mothership died tumbles slower than a rock;
//  - `game/npc-fighter.ts` — the pirate, the police, the bounty hunter, the
//    Thargoid and its drone, which ask three questions in one order;
//  - `game/npc-trader.ts` — the trader, which turns and fights when it flees,
//    and otherwise calls `game/trader-flight.ts`.
//
// THE SEAM IS AN OBJECT RATHER THAN A NARROW INTERFACE, and that is the whole
// reason the earlier cuts fought. A free FUNCTION over the flight models would
// need about eighteen handles, which docs/TODO/169 M3 measured as a 69-call
// seam and refused. A collaborator that HAS the ship needs one.
//
// A PILOT FLIES A SHIP (docs/TODO/183). A behaviour says WHAT a ship does. A
// pilot says HOW it flies while it fights. The three are
// `game/npc-brain-pilot.ts`, `game/npc-attack-run.ts` and
// `game/npc-pursuit.ts`, and each takes a `PilotShip` rather than this class.
//
// THIS FILE STILL HOLDS ONE PILOT, and `pursuitFly` is why. `PursuitPilot`
// carries two fields across frames that `NpcState` does not save. So the ship
// owns the pilot for its life, and a behaviour asks the ship for it.
//
// THE RAIL STAYS TOO (docs/TODO/183 M3). `chooseWeapon` is the ship
// arbitrating between its own pilots, so a behaviour asks what leaves it.
import * as THREE from 'three';
import { buildShip, buildAsteroid, buildHermitBeacon } from '../ships/geometry.ts';
import { registeredHull } from '../ships/registry.ts';
import {
  ASTEROID_IDENTITY, rosterSpec, shipAccel, type NpcSpec,
} from './ship-specs.ts';
import type { NpcRole } from './ship-roles.ts';
import type {
  NpcCombatProfileId, ShipDesignId, ShipIdentity,
} from './ship-identity.ts';
import { chooseTactic, type TacticHull } from './tactic-choice.ts';
import { steerQuatToward } from './flight-maths.ts';
import type { BrainSelection } from './brain-names.ts';
import { MISSILE_RELOAD } from '../constants/ordnance.ts';
import { npcWeaponByte } from './gunnery.ts';
import { npcMissileEmergency } from './missile-launch.ts';
import {
  energyAfterDamage, isDestroyed, npcEnergyPolicy, playerLaserDamage,
  regeneratedEnergy, type NpcEnergyPolicy,
} from './npc-energy.ts';
import type { NpcEnergyPoints } from './damage-units.ts';
import { random, randomDirection, randomQuaternion } from './rng.ts';
import { PursuitPilot } from './npc-pursuit.ts';
import type { PilotShip } from './npc-pilot.ts';
import { MIN_CRUISE_FRACTION, UNDER_FIRE_SECONDS } from '../constants/attack-run.ts';
import type { NpcBehaviour } from './npc-behaviour.ts';
import {
  derelictIdle, hermitIdle, inertTumble, rockIdle,
} from './npc-idle.ts';
import { fighterBehaviour } from './npc-fighter.ts';
import { traderBehaviour } from './npc-trader.ts';
import { freshNpcState, type NpcState, type PlayerRef } from './npc-state.ts';
import { ThreatLock } from './threat-lock.ts';

// NPC ships. Behaviour matrix:
//  - traders  fly in from the system edge, do business near the station, and
//    depart; they only fight back (flee + ECM) when attacked
//  - pirates  hunt the player in loose packs, or prey on traders when the
//    player is out of reach
//  - police   protect station space: attack pirates on sight and fugitives
//  - hunters  lone bounty killers; only interested in offender/fugitive players
//  - thargoid/thargon  always hostile; thargons go inert without a mothership
//
// Every one of them steers by a turn toward a heading at a capped rate, and a
// thrust along its nose. That is the player's rule too.
//
// WHAT EACH ROLE DOES IS NOT IN THIS FILE. The list above is the matrix a
// reader needs to follow the class. The code that flies it is in the three
// behaviours the header names.



/**
 * The world facts an NPC may inspect during one simulation step.
 *
 * `dockZ` is required because it belongs to the live station: a Coriolis uses
 * 160 while a Dodo uses 135. Keeping it in this per-step view means a ship
 * cannot accidentally remember a value supplied by an earlier caller.
 */
export interface WorldView {
  station: THREE.Object3D;
  dockZ: number;
  fleet: readonly NpcShip[];
  /** 0 clean, 1 offender, 2 fugitive */
  playerLegal: number;
  /**
   * Is a hostile missile ALREADY homing on the player?
   *
   * One in the air at a time, across the whole gang. E.C.M. destroys every
   * missile in flight in one burst, for a quarter of the bank. It is a complete
   * answer to one missile, and no answer at all to five. So the cap on the air
   * makes the counterplay the player already owns work.
   *
   * It costs the gang nothing it can see. A ship that cannot launch fires its
   * gun instead.
   *
   * It is on the view rather than read off the world, because a ship decides
   * and reports. `game.ts` supplies what the ship is allowed to know.
   */
  missileInbound: boolean;
  brains: BrainSelection;
  /**
   * Where the system's sun is, so a trader on its way out can run for it and
   * jump. It is optional. A test that flies no departure need not supply it,
   * and a trader with no sun in view falls back to a random heading
   * (`game/trader-flight.ts`).
   */
  sunPos?: THREE.Vector3;
  /**
   * How far the COMMANDER is from the station, for the station's truce
   * (`truceHolds`, law.ts). `world-step.ts` measures it once a frame and hands
   * it down. The ship, the HUD blip, the combat computer and the bribe key must
   * all read one number.
   *
   * It is optional, and the omitted value is INERT rather than convenient. An
   * absent distance is infinite, so no truce holds, and every ship behaves as
   * it did before docs/TODO/158. A reader that forgets the field therefore
   * loses a promise of peace, and can never invent one. That is the same
   * bargain `Canister.occupant` strikes with `''` (docs/TODO/156).
   */
  playerToStation?: number;
}

/**
 * A shot this ship took, and what it took it with.
 *
 * The weapon is part of the report, because the choice is the SHIP's decision
 * rather than the orchestrator's. See `chooseWeapon`.
 *
 * Only the player is ever shot at with a missile. ordnance.ts's hostile
 * missiles home on the player, and a missile has nothing else to chase.
 */
export type FireEvent =
  | { at: 'player'; weapon: 'laser' | 'missile' }
  | { at: NpcShip; weapon: 'laser' };

export class NpcShip {
  readonly object: THREE.Object3D;
  readonly role: NpcRole;
  readonly radius: number;
  readonly bounty: number;
  readonly cargoDrop: number;
  /**
   * The full bank, in source energy points, from this ship's exact released
   * build. It is not a roster number. Two ships of the same design are as tough
   * as the pack says that design is, and `ship-specs.ts` has no say in it.
   */
  readonly maxEnergy: number;
  /**
   * How player lasers treat this ship, and whether it recovers — resolved once
   * from `profileId`. Immunity and the Constrictor's halving live in here, so
   * nothing that shoots at a ship has to know which ship it is.
   */
  readonly energyPolicy: NpcEnergyPolicy;
  /**
   * The packed weapon byte this ship's exact released build carries — what its
   * gun is worth against the commander, resolved once from `profileId`.
   *
   * A number the ship KNOWS, and not a rule it applies. An NPC returns a
   * FireEvent, and the Game resolves what the shot costs (world-step.ts).
   * `energyPolicy` is the same shape: it is what the ship knows about incoming
   * fire, rather than something it does with it.
   */
  readonly weaponByte: number;
  readonly armed: boolean;

  /**
   * The pirates hunting this ship — the ships whose `npcTarget` is this one.
   *
   * Private, and the invariant belongs to the three verbs below, so the list
   * has one home rather than being spliced by hand from other modules.
   */
  readonly attackers: NpcShip[] = [];
  /** NPC-vs-NPC target, assigned by the game (pirate→trader, police→pirate). */
  npcTarget: NpcShip | null = null;
  /**
   * The pursuit dogfighter this ship flies.
   *
   * IT HOLDS THE TWO TRANSIENT FIELDS THIS CLASS USED TO. The break-off phase
   * and the slash-or-hold hysteresis bit are re-decided every frame, and
   * neither is in `NpcState`. So neither ever belonged to the ship
   * (docs/TODO/183 M2).
   */
  private readonly pursuit = new PursuitPilot();

  /**
   * What this kind of ship does with one frame.
   *
   * Built once from `role`, in the constructor, and held for the ship's life.
   * `role` is saved, so a restored ship rebuilds the same one and nothing new
   * enters `NpcState` (docs/TODO/182 M1).
   *
   * `update` below clears `state.flownBy` and then asks this. A behaviour that
   * flies the ship stamps it, and one that leaves the ship alone does not.
   */
  private readonly behaviour: NpcBehaviour;

  /**
   * The drone behaviour, for a Thargon whose mothership died.
   *
   * NOT the one above, because `inert` is a state a ship enters part-way
   * through its life rather than a role it spawns as.
   */
  private readonly inert: NpcBehaviour = inertTumble();

  /**
   * Whether the pursuit pilot is veering off to avoid a ram this frame, for the
   * readout alone (`describeFlight`). Read off the transient break state rather
   * than mirrored into `NpcState`, so the bit has one home.
   */
  get breakingOff(): boolean {
    return this.pursuit.breaking;
  }

  /**
   * Top speed and turn rate for this hull, from the roster (ship-specs.ts).
   *
   * Public because `game/trader-flight.ts` takes a narrow interface rather than
   * this class, and its two hull numbers are these (docs/TODO/176 M2). They are
   * facts about a hull, like `accel` and `radius` beside them.
   */
  readonly maxSpeed: number;
  readonly turnRate: number;
  /** Thrust, units/s — per hull, from the roster (ship-specs.ts shipAccel). */
  readonly accel: number;
  private readonly tmpDir = new THREE.Vector3();
  private readonly tmpDir2 = new THREE.Vector3();

  readonly variantSeed: number;

  /**
   * What this ship IS — see ship-identity.ts.
   *
   * Immutable, so it is not in `NpcState`. A ship does not become another
   * design mid-flight.
   *
   * It is saved beside the role and seed (`NpcSnapshot`), because a save must
   * carry the id rather than re-derive it. The moment a blueprint loader picks
   * by system, the roster's recommended variant stops being the only answer.
   */
  readonly designId: ShipDesignId;
  readonly profileId: NpcCombatProfileId;

  /** All serialisable mutable state, exposed through this one public path. */
  readonly state: NpcState;

  /**
   * @param identity what a RESTORED ship was — omitted for a fresh spawn, which
   * takes the roster's. Every restore supplies one: a snapshot that names no
   * ids is refused at `savedShipIdentity` rather than arriving here without
   * them. Deterministic either way: nothing here draws from the rng to decide
   * it.
   */
  constructor(
    role: NpcRole, position: THREE.Vector3, variantSeed: number,
    specOverride?: NpcSpec, identity?: ShipIdentity,
  ) {
    this.role = role;
    this.variantSeed = variantSeed;
    // The roster entry this ship flies, resolved once: the hull branches below
    // read it, and so does its identity. An asteroid has no roster entry —
    // ASTEROID_IDENTITY is the roster's answer for it.
    const rostered = rosterSpec(role, variantSeed, specOverride);
    this.designId = identity?.designId ?? rostered?.designId ?? ASTEROID_IDENTITY.designId;
    this.profileId = identity?.profileId ?? rostered?.profileId ?? ASTEROID_IDENTITY.profileId;
    // How tough it is comes from what it IS, not from the row that picked it.
    this.energyPolicy = npcEnergyPolicy(this.profileId);
    this.maxEnergy = this.energyPolicy.maxEnergy;
    // ...and what its own gun is worth comes from the same place, for the same
    // reason. Two ships of one released build shoot as hard as the pack says.
    this.weaponByte = npcWeaponByte(this.profileId);
    // Built before anything else. `pos` and `quat` are filled in once the mesh
    // exists, by `bindTransform` below. The shape and its opening value are
    // `game/npc-state.ts` (docs/TODO/181), and its two seeded draws are in
    // there with it, in the order the stream expects.
    this.state = freshNpcState(this.maxEnergy);
    if (role === 'hermit') {
      // The one rostered ship with no tabulated hull: a hollowed rock, so its
      // mesh is generated at the registry's radius for it.
      const hull = registeredHull(this.designId);
      const hermitRadius = hull.targetRadius;
      this.object = buildAsteroid(hermitRadius, variantSeed * 977 + 3, 0xb9b9a5);
      // NAMED, because the console prints the mesh's name. `buildShip` names
      // every tabulated hull, and `buildAsteroid` names nothing. So the bracket
      // and the ship-ID line read ASTEROID on a hermit at every range, until
      // docs/TODO/187 (GitHub #40).
      this.object.name = hull.name;
      const beacon = buildHermitBeacon(hermitRadius);
      this.object.add(beacon);
      this.behaviour = hermitIdle(beacon);
      this.radius = hermitRadius;
      this.bounty = 0;
      this.cargoDrop = 0;
      this.maxSpeed = 0;
      this.turnRate = 0;
      this.accel = 0;
      this.state.speed = 0;
      this.state.hasEcm = false;
      this.armed = false;
      this.bindTransform(position);
      return;
    }
    if (role === 'asteroid') {
      this.behaviour = rockIdle();
      const radius = 25 + (variantSeed % 45);
      this.object = buildAsteroid(radius, variantSeed * 131 + 7, 0x9a9a8a);
      this.radius = radius;
      this.bounty = 4;
      this.cargoDrop = 0;
      this.maxSpeed = 0;
      this.turnRate = 0;
      this.accel = 0;
      this.state.speed = 0;
      this.state.hasEcm = false;
      this.armed = false;
    } else {
      // WHICH BEHAVIOUR THIS ROLE FLIES. A derelict drifts, a trader is
      // docs/TODO/184 M2's and still runs in `update`, and everything else
      // fights.
      this.behaviour = role === 'generation' ? derelictIdle()
        : role === 'trader' ? traderBehaviour()
          : fighterBehaviour();
      const spec = rostered!;
      // The hull and its size come from the DESIGN, and not from the roster
      // row. `ships/registry.ts` is the only way to either. So two roster rows
      // of one design cannot disagree about its look or its size.
      const hull = registeredHull(this.designId);
      this.object = buildShip(hull.def!, spec.color);
      this.radius = hull.targetRadius;
      this.bounty = spec.bounty;
      this.cargoDrop = spec.cargoDrop ?? 0;
      this.maxSpeed = spec.maxSpeed;
      this.turnRate = spec.turnRate;
      this.accel = shipAccel(spec);
      this.state.speed = spec.maxSpeed * 0.5;
      this.state.missiles = spec.missiles ?? 0;
      this.state.hasEcm = random() < (spec.ecmChance ?? 0);
      this.armed = spec.armed ?? false;
    }
    randomDirection(this.state.packOffset).multiplyScalar(250 + random() * 500);
    // WHICH WAY THIS ONE FIGHTS, decided by a shake of the dice on warp-in, so
    // it is state. A rock has no attack run and never reaches `attack()`, so it
    // does not draw; the roll is taken here, last.
    if (role !== 'asteroid') {
      this.state.tactic = chooseTactic(this.tacticHull, 1, 'spawn', random());
    }
    this.bindTransform(position);
  }

  /**
   * What `constants/tactics.ts` needs to know about this hull: how big it is, how fast it
   * goes, how hard it turns.
   *
   * A getter over the three fields rather than a stored object. None of them
   * can change, because the ship is the hull it was built as. A second copy of
   * an immutable fact is a second copy to keep in step.
   */
  get tacticHull(): TacticHull {
    return { radius: this.radius, maxSpeed: this.maxSpeed, turnRate: this.turnRate };
  }

  /**
   * Point the state's transform AT the mesh's own vectors, rather than copying
   * between them.
   *
   * This is what makes the renderer read-only over the state. There is one
   * position in memory. The step writes it, and three.js reads it for the
   * matrix. No sync pass, and none to forget.
   */
  private bindTransform(position: THREE.Vector3): void {
    this.object.position.copy(position);
    // NOT quaternion.random(). THREE reaches for Math.random inside it, off
    // the seeded stream. Two arrivals in one system would then disagree about
    // which way the ships face.
    randomQuaternion(this.object.quaternion);
    this.state.pos = this.object.position;
    this.state.quat = this.object.quaternion;
  }

  /**
   * Fly one frame of the pursuit dogfighter.
   *
   * A THIN DELEGATE, and it earns its place. The pilot holds two transient
   * fields, so it is per ship and private. The trainer flies this exact entry
   * (invariant 5), and `game/npc-pursuit.ts` is what it reaches.
   */
  pursuitFly(
    dt: number, target: PlayerRef, dist: number, fleet: readonly PilotShip[] = [],
  ): FireEvent | null {
    return this.pursuit.fly(this, dt, target, dist, fleet);
  }

  /** @returns a fire event if this ship shot at something this frame */
  update(
    dt: number,
    player: PlayerRef,
    view: WorldView,
  ): FireEvent | null {
    if (!this.state.alive) return null;
    // Before anything decides. Elapsed time does not care what the ship does.
    // The roles that return early below are exactly the ones every clock in
    // here gives a rate of 0 to anyway. See `tickClocks`.
    this.tickClocks(dt);
    // ...and this step owes an answer for who flies. It is cleared here rather
    // than set in every branch. So a flight added later that forgets to stamp
    // reports nothing at all, which is a visible gap. The alternative is the
    // last word a real flight left behind, which is invisible, and which is the
    // defect docs/TODO/88 is about.
    this.state.flownBy = 'none';

    // THE DISPATCH, AND `inert` COMES FIRST (docs/TODO/184 M2). A drone whose
    // mothership died tumbles. It is a STATE rather than a role, so it is not
    // built in the constructor.
    //
    // **THE ORDER IS A DEFECT docs/TODO/184 M1 SHIPPED, AND M2 CLOSES IT.**
    // Before M1 a Thargon held no behaviour. It fell past the dispatch to this
    // check, and it tumbled. M1 gave every fighting role a behaviour, and the
    // dispatch asked that first. So an inert drone flew the fighter and never
    // tumbled again. Nine probes stayed byte-identical, because no probe kills
    // a Thargoid mothership.
    //
    // Asking `inert` first is exactly the pre-M1 order. Only
    // `game/combat-wreck.ts` sets the flag, and only on a Thargon, so no other
    // role can reach this line with it set.
    if (this.state.inert) return this.inert.fly(this, dt, player, view);

    // THE ROLE'S OWN BEHAVIOUR (docs/TODO/182 M1). Every role holds one since
    // M2, so this line always answers and `update` is the dispatch alone.
    return this.behaviour.fly(this, dt, player, view);
  }

  /**
   * Note that `a` is hunting this ship. Idempotent, so a caller never has to
   * ask whether the link is already there.
   *
   * Only PIRATES register. Police and hunters set `npcTarget` and stop there.
   * A trader on the run reads this list to decide who to run from. To register
   * the law would make it turn and duel the police behind it.
   */
  addAttacker(a: NpcShip): void {
    if (!this.attackers.includes(a)) this.attackers.push(a);
  }

  /**
   * Drop the links that went stale. The invariant is `alive` and still pointed
   * at us. Order is preserved, because `nearestAttacker` takes the first one,
   * and that is the one this ship already runs from.
   */
  pruneAttackers(): void {
    let n = 0;
    for (const a of this.attackers) {
      if (a.state.alive && a.npcTarget === this) this.attackers[n++] = a;
    }
    this.attackers.length = n;
  }

  /** Is `a` on our list? The read that replaces reaching into the array. */
  hasAttacker(a: NpcShip): boolean { return this.attackers.includes(a); }

  /** the attacker being fought — see game/threat-lock.ts for the rule */
  private readonly attackerLock = new ThreatLock<NpcShip>();

  /**
   * The nearest ship hunting this one, and it prunes the dead as it looks.
   *
   * Public because `game/npc-behaviour.ts`'s `BehaviourShip` names it, and the
   * trader's armed defence spends it (docs/TODO/184 M1).
   */
  nearestAttacker(dt: number): NpcShip | null {
    // Locked, and neither first-registered nor nearest. Which attacker an
    // armed trader fights must not flip with registration order, or teleport
    // with distance (game/threat-lock.ts has the rule and the measurements).
    return this.attackerLock.pick(
      dt,
      this.attackers.filter((a) => a.state.alive),
      (a) => a.object.position.distanceTo(this.object.position),
    );
  }

  /**
   * The other pirates this ship is hunting with, in the shape the pack
   * observations want. Rebuilt per decision (10 Hz) rather than cached,
   * because ships die mid-fight and a stale mate would be observed as still
   * flying.
   *
   * The entries are pooled and refilled, not allocated: a gang of four
   * re-deciding at 10 Hz otherwise churns 40 objects a second for nothing.
   */

  /** The slowest this ship may fly under power. See MIN_CRUISE_FRACTION. */
  get speedFloor(): number {
    return this.role === 'pirate' || this.role === 'thargoid' || this.role === 'thargon'
      ? this.maxSpeed * MIN_CRUISE_FRACTION : 0;
  }

  /**
   * Fly with a trained policy: refresh the discrete control at 10 Hz, then
   * integrate it with the same ramp the player's ship uses.
   *
   * PUBLIC because this is the flight model the trainer optimises against. A
   * training episode drives it directly, with the candidate genome and its own
   * target. So there is exactly one implementation of "how a brain-flown ship
   * moves" (invariant 5).
   */

  /**
   * The pre-RL scripted chase, one step.
   *
   * PUBLIC for the same reason as brainFly. It is the baseline every training
   * table is read against ("scripted pirate"). A baseline that is a second
   * implementation of the thing it baselines is worth nothing.
   *
   * It is also the path every police ship, bounty hunter, Thargoid and
   * knife-range pirate fires on. So it holds ONE flight decision — close, or
   * break off, see break-off.ts — and then ONE gun. Both are taken on every
   * frame, either way.
   */

  /**
   * One frame of the WHOLE `pursuit` pilot, switch included.
   *
   * It is not a single flight. A ship that only ever held the six was a duck
   * the moment it drifted ahead of the commander's guns. So it holds the six
   * while it is astern of the target (`pursue`). It slashes past on the attack
   * run the moment the target's nose swings onto it
   * (`slashesRatherThanHoldSix`).
   *
   * PUBLIC for the same reason as `attack` and `brainFly`. It is what every
   * shipped pirate flies. The training `Episode`'s `pursuit` controller
   * (docs/TODO/102) must be this call, and not a re-implementation of the
   * switch. `update()` above and the episode both come through here, so the two
   * cannot drift. The gun is decided inside `pursue` and `attack`, exactly as
   * the other two pilots decide theirs.
   */

  /**
   * A pursuit pirate's per-frame choice: slash past on the attack run, or hold
   * the commander's six?
   *
   * A ship on the six is safe, because the commander's guns point the other
   * way, and one parked ahead of the commander is a duck. So it holds the six
   * only while it is in the commander's REAR arc. It switches to the evasive
   * attack run the moment the commander swings a nose toward it. Two cones give
   * the
   * switch hysteresis (`PURSUIT_SLASH_CONE`/`PURSUIT_HOLD_CONE`), so a weaving
   * commander does not make it flip flight models frame to frame.
   *
   * `faced` is the angle between the COMMANDER's nose and the direction to this
   * ship. It is the same −Z-forward rule `facing()` uses, taken from the
   * commander's frame rather than ours. It is small when the commander points
   * at us, and about pi when we are dead astern.
   */

  /**
   * Fly the PURSUIT dogfighter. It gets on the target's six, holds there and
   * shoots. It breaks off only to avoid a ram.
   *
   * It is the pirate counterpart of the combat computer's pilot, and the LIVE
   * BRAINS row selects it (brain-names.ts). The DECISIONS are `pursuit.ts`,
   * shared with the co-pilot so the two cannot drift. They are where to aim,
   * how fast to go, and when to break.
   *
   * The same shape as `attack()` and interchangeable with it at the call site:
   * it steers, throttles, advances and returns a `FireEvent` through the same
   * `npcTriggerPull`. What differs is only the aim (chase, not a slashing run)
   * and the speed (match the target and hold gun range, not flat out).
   */

  /**
   * Advance the tactic clocks and, if something happened that a pilot would act
   * on, take a new tactic. @returns the one to fly this step.
   *
   * The DECISION is `tactic-choice.ts`'s, and all of it. This reads the ship's
   * own fields into a situation, asks whether there is a reason, and applies
   * the answer. A module decides and reports, and the ship applies. That is the
   * same bargain `attack()` has with `break-off.ts` and `gunnery.ts`.
   */

  /**
   * WHICH weapon leaves the rail — and the one case where something leaves it
   * the flight above did not ask for.
   *
   * The rules are gunnery.ts's. This is the only place that applies them, so a
   * missile is decided once and reported once. `npcMissileLastStand` does not
   * consult the gun's cooldown or firing gate. So a pirate about to die can
   * launch even where it is not lined up for a laser shot.
   *
   * PUBLIC, and it takes a scalar rather than a `WorldView`. `brainFly`,
   * `attack` and `regenerate` are public for the same reason. A training
   * episode drives the flight directly, so it owes the ship this call too.
   * `missileInbound` is the one fact not on the ship, which is whether the air
   * is already occupied. What it REPORTS is resolved by `fire-resolution.ts`,
   * the one home both worlds call.
   *
   * IT DECIDES; IT DOES NOT KEEP TIME. `tickClocks` ticks `missileReload`, and
   * that runs every frame. There is no `dt` here to tempt a second clock, so a
   * second ask in one frame is merely wasteful.
   */
  chooseWeapon(
    shot: FireEvent | null, dist: number, targetPos: THREE.Vector3,
    missileInbound: boolean,
  ): FireEvent | null {
    if (this.state.missiles <= 0) return shot;
    if (this.state.missileReload > 0) return shot;
    // A FRACTION, not points: `npcMissileLastStand` asks "how much of this
    // hull is left", and `healthFraction` is the one place that division
    // happens. It falls back to 1 (untouched) rather than 0 for a bankless
    // ship. A divide-by-zero guard that reported "nearly dead" would make it
    // empty its rack.
    // ONE IN THE AIR AT A TIME, gang-wide. It is checked before the reasons,
    // so a ship that cannot launch keeps its missile AND fires its gun. The
    // gang loses one thing only: the power to saturate a countermeasure that
    // gets a single press.
    if (missileInbound) return shot;
    if (npcMissileEmergency(
      this.healthFraction, this.state.passesMade, dist, this.facing(targetPos),
    )) {
      this.state.missileReload = MISSILE_RELOAD;
      return { at: 'player', weapon: 'missile' };
    }
    return shot;
  }

  /**
   * Move along the nose at the current speed.
   *
   * Public because `game/npc-behaviour.ts`'s `BehaviourShip` names it, and a
   * derelict spends it (docs/TODO/182 M1). It is the same reason `maxSpeed`
   * and `turnRate` are public: a collaborator needs the primitive.
   */
  advance(dt: number): void {
    this.tmpDir.set(0, 0, -1).applyQuaternion(this.object.quaternion);
    this.object.position.addScaledVector(this.tmpDir, this.state.speed * dt);
  }

  /**
   * The muzzle: where a bolt or missile should leave this ship on screen.
   *
   * Lasers are nose-mounted, so this is the hull's front rather than its
   * centre. Without it, a big hull (Anaconda 55, Thargoid 60) appears to fire
   * from inside itself.
   */
  nosePosition(out: THREE.Vector3): THREE.Vector3 {
    return out
      .set(0, 0, -1)
      .applyQuaternion(this.object.quaternion)
      .multiplyScalar(this.radius * 0.9)
      .add(this.object.position);
  }

  /**
   * Where this ship's neighbours are, as a reused array.
   *
   * Everything solid and alive, except itself and the thing it attacks. A hull
   * is a hull, so a trader about its own business is as much of an obstacle as
   * a wingman. The array is an instance field, because this runs per ship per
   * frame.
   *
   * THE TARGET IS NOT AN OBSTACLE. It matters only where the target IS a fleet
   * member — police on a pirate, pirate on a trader — and only inside
   * `passing`. `SEPARATION_RANGE` (200) is inside `BREAK_OFF_RANGE` (220), so a
   * ship commits to the pass before the target is near enough to push it.
   *
   * To hold the committed line through the merge is that phase's job. To treat
   * the target as an obstacle would delete the `ram` tactic
   * (constants/tactics.ts, which aims at the hull). It would also make
   * separation.ts a second home for the pass miss distance `pass-aim.ts` owns.
   * The price is a little more contact, on the order constants/tactics.ts
   * already accepted for the commander.
   */

  /**
   * Angle (radians) between our nose and the direction to a point.
   *
   * Allocation-free: the firing gate takes this path every frame for every
   * ship, and per ship-step of every training episode.
   */
  facing(point: THREE.Vector3): number {
    const forward = this.tmpDir.set(0, 0, -1).applyQuaternion(this.object.quaternion);
    const to = this.tmpDir2.copy(point).sub(this.object.position).normalize();
    return forward.angleTo(to);
  }

  steerToward(point: THREE.Vector3, dt: number): void {
    steerQuatToward(
      this.object.quaternion,
      this.tmpDir.copy(point).sub(this.object.position),
      this.turnRate * dt);
  }

  /**
   * Point the nose at a place, ignoring the turn rate.
   *
   * Only for placing a ship: the training scenarios spawn a pirate and want it
   * roughly facing its prey before the first frame. Flight uses steerToward.
   */
  faceToward(point: THREE.Vector3): void {
    steerQuatToward(
      this.object.quaternion,
      this.tmpDir.copy(point).sub(this.object.position),
      Math.PI);
  }

  /**
   * How much of its bank is left, 0..1.
   *
   * THE NORMALIZED BOUNDARY, and the only one. Runtime combat stores whole
   * source energy points. The HUD's target bar, the AI's health observation and
   * the missile last-stand rule all want a fraction. Every one of them comes
   * through here, rather than divide by a maximum it fetched itself.
   */
  get healthFraction(): number {
    return this.maxEnergy > 0 ? this.state.energy / this.maxEnergy : 1;
  }

  /**
   * A registered player-laser hit of `hit` strength lands.
   *
   * The ship works out what that costs IT. Immunity, the Constrictor's halving
   * and its own per-hit defence are all inside its policy. So the gun never has
   * to know what it shoots at.
   *
   * @returns true if it was destroyed.
   */
  takeLaserHit(hit: number, from?: THREE.Vector3, byPlayer = true): boolean {
    return this.takeDamage(playerLaserDamage(this.energyPolicy, hit), from, byPlayer);
  }

  /**
   * @param points source energy points, minted by whichever module owns the
   * rule. The two guns use `playerLaserDamage` and `npcCrossfireDamage`
   * (npc-energy.ts). A ram, a warhead and the energy bomb use `npcImpactDamage`
   * (impact-damage.ts). The type is branded, so a number from any other scale
   * will not compile, and neither will a bare literal.
   * @returns true if the ship was destroyed.
   */
  takeDamage(points: NpcEnergyPoints, from?: THREE.Vector3, byPlayer = false): boolean {
    this.state.provoked = true;
    // A hit is a hit, whatever landed it. This is the one place every source
    // funnels through, because damage-dealt.ts routes lasers, ordnance and rams
    // here. So the attack run answers all of them, and not gunfire alone.
    this.state.underFire = UNDER_FIRE_SECONDS;
    if (byPlayer) this.state.provokedByPlayer = true;
    if (from && this.role === 'trader') {
      this.state.fleeFrom.copy(from);
      this.state.fleeing = true;
    }
    this.state.energy = energyAfterDamage(this.state.energy, points);
    if (isDestroyed(this.state.energy) && this.state.alive) {
      this.state.alive = false;
      return true;
    }
    return false;
  }

  /**
   * EVERYTHING THAT RUNS ON ELAPSED TIME, whatever the ship is doing.
   *
   * One home for the clocks: `underFire`, `missileReload` and `regenerate`. A
   * clock that ticks inside the one branch that reads it quietly becomes
   * "seconds spent on a particular thing" rather than seconds.
   *
   * A brain-flown ship never calls `attack()`, so `underFire` would latch
   * there. A rack that reloaded only in `chooseWeapon` would freeze whenever
   * the pirate did anything else.
   *
   * PUBLIC, and the one call a training episode owes the ship per frame — see
   * `brainFly` for why an episode drives the ship directly.
   */
  tickClocks(dt: number): void {
    this.regenerate(dt);
    this.state.underFire = Math.max(0, this.state.underFire - dt);
    this.state.missileReload = Math.max(0, this.state.missileReload - dt);
  }

  /**
   * Recover from elapsed simulation time. Stations, rocks and the derelict get
   * a rate of 0 and never move.
   *
   * PUBLIC because the Elite-A energy oracle measures the recharge on its own
   * (test/elite-a-live-combat.test.ts). Everything that FLIES reaches it
   * through `tickClocks`, which is the one per-frame entry point.
   */
  regenerate(dt: number): void {
    const next = regeneratedEnergy(
      { energy: this.state.energy, carryTicks: this.state.regenCarry },
      this.energyPolicy, dt);
    this.state.energy = next.energy;
    this.state.regenCarry = next.carryTicks;
  }
}
