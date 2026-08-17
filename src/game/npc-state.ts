// The saved shape of a ship, and the value it starts at.
//
// ONE RESPONSIBILITY. `NpcState` is everything about a ship that can CHANGE,
// and `freshNpcState` is what a new one holds. Nothing here decides anything.
//
// IT NAMES NO SHIP CLASS, and `test/npc-state.test.ts` holds that. So a caller
// that wants the SHAPE does not import 1,200 lines of behaviour to reach it.
// `train/aim-fight.ts` is the one reader outside `game/npc.ts` that wanted
// exactly this, and it is why docs/TODO/181 moved the type rather than the
// class.
//
// A SNAPSHOT IS THIS, WALKED GENERICALLY. `game/snapshot.ts` reads the fields
// rather than a list, and it never names the type. So a field added below is
// saved with no second edit, and `test/snapshot.test.ts` holds that.
//
// TWO OF ITS SIBLINGS STAYED IN `game/npc.ts`, and the reason is one rule.
// `FireEvent` carries `{ at: NpcShip }` and `WorldView` carries
// `fleet: readonly NpcShip[]`. Each one names the class, so moving it would
// make this file import the file it came out of. TypeScript erases a type-only
// cycle and it would compile. It would still be a child that depends on its
// parent.
//
// It came out of `game/npc.ts` (docs/TODO/181).

import * as THREE from 'three';

import { type AttackPhase } from './break-off.ts';
import { makeDockPlan, type DockPlan } from './docking.ts';
import { type TraderPhase } from './trader-flight.ts';
import { type TacticId } from '../constants/tactics.ts';
import { EXTEND_RANGE_MAX } from '../constants/attack-run.ts';
import { random, randomDirection } from './rng.ts';

/**
 * Everything about a ship that can CHANGE.
 *
 * All of it in one object, which is the point. A snapshot IS this, walked
 * generically, so there is no list of fields to keep in step.
 *
 * `pos` and `quat` are the SAME THREE objects the mesh uses, not copies. The
 * renderer therefore reads the state rather than being told about it, and
 * there is no sync step to forget either.
 */
export interface NpcState {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  /** Pack spread so groups attack from different bearings. */
  packOffset: THREE.Vector3;
  waypoint: THREE.Vector3;
  /** Where the last attack came from; traders flee this. */
  fleeFrom: THREE.Vector3;
  /**
   * The docking computer's reusable outputs and its behavior-driving phase.
   *
   * `phase` latches once a trader commits to the slot run. The vectors are live
   * scratch objects `planDocking` rewrites in place each frame. The whole plan
   * is held here, so both the replay state and the allocation-free path
   * survive.
   */
  dockPlan: DockPlan;
  /** Trader lifecycle. */
  traderPhase: TraderPhase;
  /**
   * The cached trained-brain flight decision, re-taken every brainTimer
   * seconds. It is state because the step reads it. A ship reloaded
   * mid-decision must act on the same choice the original held, or six frames
   * of difference compound.
   */
  brainControl: { pitch: number; roll: number; throttle: number; fire: boolean } | null;
  /**
   * Derived at spawn FROM THE RNG, so they cannot be re-derived on restore: by
   * then the stream is somewhere else. A game constant may live outside the
   * state; a value worked out at runtime may not.
   *
   * Decided at spawn: does this one have business at the station?
   */
  docksHere: boolean;
  tumbleAxis: THREE.Vector3;
  /**
   * Whether this ship carries E.C.M., rolled against its spec's chance at
   * spawn. A shake of the dice on warp-in decides a disposition. That changes
   * what the ship does for the rest of its life, so it is state, not a
   * constant.
   */
  hasEcm: boolean;
  /**
   * The ship's bank, in SOURCE ENERGY POINTS — a whole number, never a
   * fraction. Anything that wants 0..1 asks `healthFraction`; anything that
   * wants to hurt it passes points. Those are the only two ways in.
   */
  energy: number;
  /**
   * Regeneration's sub-second remainder, as whole ticks — see
   * ELITE_A_REGEN_TICKS_PER_SECOND. State because the step reads it: a ship
   * reloaded mid-tick must recover at the same moment the original did.
   */
  regenCarry: number;
  alive: boolean;
  /** Hit by anything at all — police do NOT read this, see isHostileToPlayer. */
  provoked: boolean;
  /** True when it was specifically the player who attacked us. */
  provokedByPlayer: boolean;
  /** Homing missiles this ship can still launch at the player. */
  missiles: number;
  /** Mission flag: destroying this advances the Constrictor hunt. */
  isMissionTarget: boolean;
  fleeing: boolean;
  /** where this ship is in its attack run — see break-off.ts */
  attackPhase: AttackPhase;
  /**
   * Which flight actually moved this ship last step. It is a trained policy,
   * the scripted attack run, the pursuit dogfighter, or the run for the
   * horizon. It is `none` for a ship that flew none of them.
   *
   * Reported, never read by a rule. `attackPhase` is only touched inside
   * `attack()`, so a brain-flown or pursuit pirate leaves it stale. A field
   * that says which flight ran is the honest version of the readout. It costs
   * nothing to snapshot, because NpcState is walked generically.
   *
   * IT IS RE-DECIDED EVERY STEP. `update()` clears it, and each flight stamps
   * it. The version that only the three combat flights ever wrote still lied
   * twice. A trader on its lane and a pirate outside interest range both kept
   * whichever word ran last. A ship that never flew at all kept the
   * constructor's. The readout then quoted `attackPhase` off the back of it.
   * See docs/TODO/88.
   */
  flownBy: 'brain' | 'scripted' | 'pursuit' | 'fleeing' | 'none';
  /** seconds of evasive flying left after the last hit taken — see break-off.ts */
  underFire: number;
  /**
   * How far out THIS run goes before turning back, rolled from the band in
   * break-off.ts every time the ship starts extending. State for `hasEcm`'s
   * reason: a shake of the dice decides it, so it cannot be re-derived on
   * restore.
   */
  extendRange: number;
  /** which side this run passes on, +1 or -1, re-rolled with extendRange */
  passSide: number;
  /**
   * WHICH WAY this ship flies its attack run — see constants/tactics.ts.
   *
   * Rolled once at spawn from the hull's own capability set. It is re-rolled
   * only on something a pilot would act on: a wound, a last stand, or a spell
   * with the guns cold. It is state for `hasEcm`'s reason. A die roll decides
   * it, so it cannot be re-derived on restore.
   */
  tactic: TacticId;
  /** seconds on the current tactic — the dwell the switch reads */
  tacticClock: number;
  /**
   * Seconds since this ship last got a shot away.
   *
   * The SLEEPER's clock: "this is not working, try something else". It ticks in
   * `attack()` and only there. A tactic governs the scripted flight, and a
   * brain-flown ship's tactic is dormant until it hands over. That is the line
   * `flownBy` draws.
   */
  dryFor: number;
  /**
   * Completed attack runs, over this ship's whole life.
   *
   * A missile costs money and there is no resupply. So a ship spends one when
   * the fight goes badly, rather than when the geometry is convenient. "I have
   * flown at this twice and it is still there" is how it finds that out. See
   * `npcMissileEmergency`.
   *
   * NOT per-target. A pirate that harried a trader and then turned on the
   * commander still spent its afternoon on failures. That is the disposition
   * this stands in for.
   */
  passesMade: number;
  /** Thargons go inert when their mothership dies. */
  inert: boolean;
  tradeTimer: number;
  /** Set true once this ship flew off, or docked, and should be removed. */
  wantsDespawn: boolean;
  /** This trader put in at the station rather than jumping out. */
  docked: boolean;
  /** On final approach into the slot — the station must not shove it away. */
  docking: boolean;
  /**
   * Tier-2 gang member: flies the coordinated pack policy and doesn't scare
   * off. Set by the Game from pirateThreat() when the player looks worth
   * organising against.
   */
  organised: boolean;
  /**
   * Paid off, and no longer interested — see isHostileToPlayer.
   *
   * Cargo buys a pirate (game/jettison.ts) and credits buy a policeman
   * (game/law.ts); the field does not care which, and neither does the rule
   * that honours it.
   */
  satisfied: boolean;
  /** Threat tier this ship was spawned at — sets what killing it is worth. */
  threatTier: number;
  /** Public so the Game can scrub speed off on a collision. */
  speed: number;
  fireCooldown: number;
  /**
   * Time until this ship may launch another missile. It is separate from
   * fireCooldown ON PURPOSE. The gun's reload is up to 1.7s, and a ship in its
   * last stand does not have that long. A missile must not queue behind a bolt.
   * It ticks in tickClocks.
   */
  missileReload: number;
  waypointTimer: number;
  brainTimer: number;
  brainPitchRate: number;
  brainRollRate: number;
}

export interface PlayerRef {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  /** current speed. The brain's observation needs it to lead a shot. */
  speed: number;
}


/**
 * A ship's state at the moment it warps in.
 *
 * `pos` and `quat` are left null on purpose. `NpcShip.bindTransform` points
 * them at the mesh's OWN vectors once the hull exists, so the renderer reads
 * this state rather than a copy of it. There is no sync step to forget.
 *
 * IT DRAWS FROM THE SEEDED STREAM, twice: `docksHere` and `tumbleAxis`. The
 * order of those two draws is load-bearing. A draw moved across a branch
 * changes every seeded outcome in the game (`game/rng.ts`, invariant 11).
 *
 * `maxEnergy` is an argument rather than a field read, because it comes from
 * the ship's combat profile and this file knows nothing about a profile.
 *
 * The caller fills in what the HULL decides. The speed, the missiles and the
 * E.C.M. all depend on the roster row. `hasEcm` below is the placeholder that
 * the constructor overwrites.
 */
export function freshNpcState(maxEnergy: number): NpcState {
  return {
    pos: null as unknown as THREE.Vector3,
    quat: null as unknown as THREE.Quaternion,
    packOffset: new THREE.Vector3(),
    waypoint: new THREE.Vector3(),
    fleeFrom: new THREE.Vector3(),
    dockPlan: makeDockPlan(),
    traderPhase: 'trading',
    brainControl: null,
    docksHere: random() < 0.5,
    hasEcm: false,   // the spec sets it once the hull is known
    tumbleAxis: randomDirection(new THREE.Vector3()),
    energy: maxEnergy, regenCarry: 0,
    alive: true, provoked: false, provokedByPlayer: false, missiles: 0,
    isMissionTarget: false, fleeing: false, attackPhase: 'closing', underFire: 0, flownBy: 'none',
    extendRange: EXTEND_RANGE_MAX, passSide: 1, passesMade: 0,
    tactic: 'run', tacticClock: 0, dryFor: 0,
    inert: false, tradeTimer: 0,
    wantsDespawn: false, docked: false, docking: false, organised: false,
    satisfied: false, threatTier: 0, speed: 0, fireCooldown: 0, missileReload: 0,
    waypointTimer: 0, brainTimer: 0, brainPitchRate: 0, brainRollRate: 0,
  };
}
