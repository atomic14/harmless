// The trained brain, as a pilot: a fitted policy flying a real ship.
//
// ONE RESPONSIBILITY. `brainFly` runs one decision of a `Brain` and applies it
// to the ship it is given. It reads the world through an observation, and it
// ramps the control it gets back. It then pulls the trigger on `gunnery.ts`'s
// rule rather than on the policy's own.
//
// A PILOT, NOT A FREE FUNCTION OVER A NARROW INTERFACE, and docs/TODO/183 is
// why. It takes a `PilotShip`, which `NpcShip` satisfies structurally.
//
// THE TRAINER FLIES THIS EXACT CODE (invariant 5).
// `src/ai-training/scenario.ts` calls it per frame, so the model an episode
// optimises is the shipped one and no second copy exists. That is why it is
// exported rather than private to a behaviour.
//
// THE BUFFERS ARE MODULE-WIDE AND THAT IS DELIBERATE. They were static members
// of `NpcShip`, shared by every ship in the sky, and they stay shared. One per
// pilot would allocate per SHIP rather than once, and a training episode builds
// thousands. Nothing here yields, so a shared buffer is safe.
//
// It came out of `game/npc.ts` (docs/TODO/183 M1).

import * as THREE from 'three';

import { act, makeObs, makeScratch, type Brain } from '../ai-training/policy.ts';
import {
  observeFor, shipView, writeView, type ObservableMate, type ThreatsView,
} from '../ai-training/observation.ts';
import { TURN } from '../constants/hull-motion.ts';
import {
  BRAIN_RATE_DECAY, BRAIN_RATE_RAMP, DECISION_INTERVAL,
} from '../constants/brain-flight.ts';
import { npcTriggerPull } from './gunnery.ts';
import { rampToward } from '../player.ts';
import { random } from './rng.ts';
import type { PilotShip } from './npc-pilot.ts';
import type { FireEvent, NpcShip } from './npc.ts';

// sized for the WIDEST encoder; narrower brains read their own prefix
const obsBuf = makeObs();
/** scratch packmate list, reused so the 10 Hz decision stays allocation-light */
const mateView: ObservableMate[] = [];
/** …backed by a pool that is never truncated, so growth allocates once */
const matePool: ObservableMate[] = [];
const scratch = makeScratch();
/**
 * The observation views, refilled per decision — see policy.ts `shipView`.
 *
 * ONE number is load-bearing, and it is a field brainFly never writes.
 * `meView.laserTemp` stays 0, so obs slot 1 (our laser heat) is always 0 in
 * the game. Every shipped brain was fitted against exactly that. To feed it a
 * real number is a retrain, and not a one-line fix.
 *
 * `hp` is filled truthfully. Nothing shipped reads it on this path. Only
 * `observePackWide`'s slot 25 and `observeDefend`'s slot 14 do. A 26-input
 * pack brain must be TRAINED against a real number rather than a constant
 * 1.0. None is in the tree, and `npm test` holds the directory to the three
 * that are.
 *
 * The rest are inert: brainFly overwrites the me envelope and the target's
 * pos/quat/speed every decision, and no encoder reads a TARGET's `cls`. Kept
 * with a plausible envelope only because it reads easier in a debugger than
 * zeroes.
 */
const meView = shipView(0, 0);
const targetView = shipView(400, 1.1, 300);

/** the seed its hull and stats were generated from — kept so a snapshot can rebuild it */


export function brainFly(
  ship: PilotShip,
  brain: Brain,
  dt: number,
  targetPos: THREE.Vector3,
  targetQuat: THREE.Quaternion,
  targetSpeed: number,
  dist: number,
  fireAt: 'player' | NpcShip | null,
  /**
   * The ships this one is hunting with, or null if it flies alone. Pass it
   * whenever it exists — `observeFor` decides whether this brain can read it.
   */
  fleet: readonly PilotShip[] | null = null,
  /**
   * The rest of the sky, for a DEFENCE brain — the attackers beyond the one
   * being fought (`ThreatsView`). Null for the attack phases, whose encoders
   * never read it; the defence-path callers below build it from `attackers`.
   */
  threats: ThreatsView | null = null,
): FireEvent | null {
  ship.state.flownBy = 'brain';
  ship.state.brainTimer -= dt;
  if (!ship.state.brainControl || ship.state.brainTimer <= 0) {
    ship.state.brainTimer = DECISION_INTERVAL;
    const me = meView;
    const tv = targetView;
    writeView(me, ship.object.position, ship.object.quaternion);
    me.speed = ship.state.speed;
    me.cls.maxSpeed = ship.maxSpeed;
    me.cls.turnRate = ship.turnRate;
    me.laserCooldown = ship.state.fireCooldown;
    // HOW HURT IT IS. An NPC has ONE pool where the commander has three. So
    // its bank is both its overall condition and its energy. It is the same
    // fraction in both slots, because for this ship they are one fact.
    // `cls.hp` is 1 because `healthFraction` is already normalized, which is
    // the same conversion `packmates()` makes for a mate's health.
    me.hp = ship.healthFraction;
    me.cls.hp = 1;
    me.energy = ship.healthFraction;
    // ...and no warhead flies at it. A hostile warhead flies at the
    // COMMANDER (`Missile.target === null` is what makes it hostile), and an
    // NPC's own E.C.M. is `state.hasEcm`, applied by ordnance.ts. So a
    // defence policy never sees slot 16 set, and its E.C.M. head is not read
    // here. The button belongs to the ship that has one to press.
    me.missileInbound = false;
    // One pool, not two faces. Whichever side a hit lands on, this is what
    // it spends. So the split a defence brain reads is the pool, twice.
    me.fore = ship.healthFraction;
    me.aft = ship.healthFraction;
    me.pitchRate = ship.state.brainPitchRate;
    me.rollRate = ship.state.brainRollRate;
    writeView(tv, targetPos, targetQuat);
    tv.speed = targetSpeed;
    // Which observation this brain wants is policy.ts's question — see
    // `observeFor`. All this file owes it is the pack, in the shape the wide
    // encoder reads, and nothing if this ship flies alone.
    ship.state.brainControl = act(
      brain,
      observeFor(brain, me, tv, fleet ? packmates(ship, fleet) : null, obsBuf,
        threats ?? undefined),
      scratch,
    );
  }
  const c = ship.state.brainControl;

  // integrate the discrete control, with the player's ramp rule and the
  // policies' own constants
  const maxPitch = ship.turnRate * TURN.pitch;
  const maxRoll = ship.turnRate * TURN.roll;
  const rampTo = (cur: number, target: number, active: boolean): number =>
    rampToward(cur, target, active, dt, BRAIN_RATE_RAMP, BRAIN_RATE_DECAY);
  ship.state.brainPitchRate = rampTo(ship.state.brainPitchRate, c.pitch * maxPitch, c.pitch !== 0);
  ship.state.brainRollRate = rampTo(ship.state.brainRollRate, c.roll * maxRoll, c.roll !== 0);
  if (c.throttle > 0) ship.state.speed = Math.min(ship.maxSpeed, ship.state.speed + ship.accel * dt);
  // A fighter that can stop dead becomes a turret — see MIN_CRUISE_FRACTION.
  if (c.throttle < 0) {
    ship.state.speed = Math.max(ship.speedFloor, ship.state.speed - ship.accel * dt);
  }
  if (ship.state.brainRollRate !== 0) ship.object.rotateZ(ship.state.brainRollRate * dt);
  if (ship.state.brainPitchRate !== 0) ship.object.rotateX(ship.state.brainPitchRate * dt);
  ship.advance(dt);

  ship.state.fireCooldown -= dt;
  // The policy's own `fire` output is deliberately NOT consulted: the brain
  // decides where to be, the gun decides when to shoot. The trained trigger
  // is a training artifact nobody tuned (r2 lines up 38% of the time yet
  // fires 0.6 shots an engagement — the "they point right at me and never
  // shoot" bug). Rate is exactly what gunnery.ts's npcTriggerPull says, a
  // number that can be tuned rather than an emergent one.
  if (fireAt !== null) {
    const reload = npcTriggerPull(
      ship.state.fireCooldown, ship.facing(targetPos), dist, random);
    if (reload !== null) {
      ship.state.fireCooldown = reload;
      return fireAt === 'player'
        ? { at: 'player', weapon: 'laser' }
        : { at: fireAt, weapon: 'laser' };
    }
  }
  return null;
}

function packmates(ship: PilotShip, fleet: readonly PilotShip[]): ObservableMate[] {
  const out = mateView;
  const pool = matePool;
  let n = 0;
  for (const m of fleet) {
    if (m === ship || m.role !== 'pirate' || !m.state.alive) continue;
    const slot = pool[n] ?? (pool[n] = {
      pos: m.object.position, quat: m.object.quaternion,
      hp: m.healthFraction, cls: { hp: 1 }, alive: true,
    });
    out[n] = slot;
    slot.pos = m.object.position;
    slot.quat = m.object.quaternion;
    // NORMALIZED at the boundary: the encoder divides `hp` by `cls.hp`, so a
    // fraction with divisor 1 is the observation the brains were fitted
    // against. Feeding it raw energy points would break the moment a mate's
    // max differed from the divisor.
    slot.hp = m.healthFraction;
    slot.cls.hp = 1;
    slot.alive = true;
    n += 1;
  }
  out.length = n;
  return out;
}
