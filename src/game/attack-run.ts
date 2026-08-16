// The three-phase attack run — close, pass, extend — as a shipless decision:
// where to point the nose, and how fast to fly.
//
// The rules it builds on are each one-home and pure:
//
//   - the phase machine and the throttle curve (break-off.ts);
//   - the lead and the pass-width arithmetic (pass-aim.ts);
//   - the run-out curve (extend-arc.ts);
//   - the tactic profiles (constants/tactics.ts).
//
// This file is the vector composition that turns those numbers into an aim
// point. That is behaviour too, so it lives in ONE place. npc.ts calls it for
// every pirate, and the commander's scripted co-pilot calls it as well. A
// second copy would drift from the run the co-pilot exists to replicate.
//
// Three things are deliberately NOT here:
//
//   - wingman separation, which is a gang concern that npc.ts composes on top;
//   - the trigger, because the NPC gun and the commander's laser are different
//     instruments;
//   - the tactic SWITCH, which reads a ship's own hull and hurt. The caller
//     chooses the tactic, and this file flies it.
//
// The steer decision and the speed decision are two calls, because they happen
// on either side of the steering itself. The closing throttle reads the heading
// error AFTER the nose moved this frame's step. One call for both was
// measurably not the same fight.

import * as THREE from 'three';
import {
  nextAttackPhase, rollExtendRange, closingThrottle, type AttackPhase,
} from './break-off.ts';
import { leadTime, passMissDistance } from './pass-aim.ts';
import { extendArcAngle } from './extend-arc.ts';
import type { Tactic } from '../constants/tactics.ts';

/**
 * The per-run dice a ship carries between frames.
 *
 * It is a subset of `NpcState`, which is how a save keeps it. The co-pilot
 * keeps its own copy per engagement.
 */
export interface AttackRunState {
  attackPhase: AttackPhase;
  /** how far out THIS run goes before the turn back — re-rolled per run */
  extendRange: number;
  /** which side this run passes on, +1 or -1, re-rolled with extendRange */
  passSide: number;
  /** completed runs over the ship's life — read by the missile rules */
  passesMade: number;
}

const tmpTo = new THREE.Vector3();
const tmpSide = new THREE.Vector3();
const tmpOut = new THREE.Vector3();
const tmpMark = new THREE.Vector3();
const tmpAim = new THREE.Vector3();

/**
 * A unit vector to one side of the run in — THE SIDE THE SHIP ALREADY MOVES TO.
 *
 * It is the part of the ship's own heading that is not along the line of
 * sight, normalized: "keep going the way you are going, only more so."
 *
 * The side comes off the HEADING, and that makes the loop negative feedback. A
 * ship wide of the line turns in. A ship inside it turns out. Neither crosses
 * the target.
 *
 * `passSide` is the tie-break and only the tie-break. A ship pointed dead at
 * its target has no side yet, and that is when the coin is tossed. It is
 * derived rather than stored, so no snapshot grows.
 */
function passOffset(
  pos: THREE.Vector3, quat: THREE.Quaternion, targetPos: THREE.Vector3, passSide: number,
): THREE.Vector3 {
  const to = tmpTo.copy(targetPos).sub(pos).normalize();
  const side = tmpSide.set(0, 0, -1).applyQuaternion(quat);
  side.addScaledVector(to, -side.dot(to));
  const len = side.length();
  if (len > 1e-3) return side.divideScalar(len);
  const tie = tmpSide.set(1, 0, 0).applyQuaternion(quat);
  tie.addScaledVector(to, -tie.dot(to));
  const tieLen = tie.length();
  return tieLen > 1e-4 ? tie.multiplyScalar(passSide / tieLen) : tie.set(0, 0, 0);
}

/**
 * How fast the RANGE shuts. It is our speed, less the part of the target's
 * motion that takes it away down the same line.
 *
 * It is the one number the aim is built from. `leadTime` turns it into when
 * the ships meet. `passMissDistance` turns it into how wide to step.
 */
function closingRate(
  pos: THREE.Vector3, speed: number,
  targetPos: THREE.Vector3, targetVel: THREE.Vector3 | null, dist: number,
): number {
  if (!targetVel || dist < 1e-3) return speed;
  const to = tmpTo.copy(targetPos).sub(pos).divideScalar(dist);
  return speed - targetVel.dot(to);
}

/**
 * One frame of the run. It advances the phase, and it rolls the next run's
 * dice at the moment a pass completes. It then returns the point to steer
 * toward. It returns null to hold the committed line, which is what a pass IS.
 *
 * @param packOffset the gang's approach bearing for this ship. It applies only
 * outside the ship's own turn-back range. Null for a ship on its own.
 * @param rng the caller's stream. npc.ts passes the world's seeded `random`,
 * so a pirate's rolls stay exactly where they were. The co-pilot passes the
 * same stream for the same reason.
 * @returns a scratch vector that is valid until the next call. Steer, then let
 * go.
 */
export function attackRunSteer(
  state: AttackRunState,
  pos: THREE.Vector3, quat: THREE.Quaternion, speed: number,
  targetPos: THREE.Vector3, targetVel: THREE.Vector3 | null, dist: number,
  underFire: boolean,
  packOffset: THREE.Vector3 | null,
  tactic: Tactic,
  rng: () => number,
): THREE.Vector3 | null {
  const wasPhase = state.attackPhase;
  state.attackPhase = nextAttackPhase(state.attackPhase, dist, underFire, state.extendRange);
  if (state.attackPhase === 'extending' && wasPhase !== 'extending') {
    // A NEW run: re-roll how far this one goes, and which side the next pass
    // steps off to. A roll here rather than at spawn is what destaggers a
    // gang — see break-off.ts. Arrival at `extending` is what it MEANS to
    // complete a pass.
    state.extendRange = rollExtendRange(rng());
    state.passSide = rng() < 0.5 ? -1 : 1;
    state.passesMade += 1;
  }
  if (state.attackPhase === 'passing') {
    // GO THROUGH. The heading that got here is already the one that carries
    // it past. A turn at this moment is what caused the collisions.
    return null;
  }
  if (state.attackPhase === 'extending') {
    // Past it, and the range opens again. The path is a curve, `psi` off the
    // outward radial, bent toward the side the next run-in wants. extend-arc.ts
    // has the ramp. This is the geometry that takes the ramp as numbers.
    const side = passOffset(pos, quat, targetPos, state.passSide);
    const out = tmpOut.copy(pos).sub(targetPos);
    const outLen = out.length();
    if (outLen <= 1e-4) return null;
    out.divideScalar(outLen);
    const psi = extendArcAngle(dist, state.extendRange, tactic.arcAngle);
    return tmpAim.copy(pos)
      .addScaledVector(out, Math.cos(psi) * dist)
      .addScaledVector(side, Math.sin(psi) * dist);
  }
  // CLOSING: aim beside where it WILL be. The offset keeps the run off the
  // hull. The lead stops the target's own travel from swallowing that offset.
  // pass-aim.ts argues both. One closing speed feeds both halves.
  const closing = closingRate(pos, speed, targetPos, targetVel, dist);
  const mark = tmpMark.copy(targetPos);
  if (targetVel) mark.addScaledVector(targetVel, leadTime(dist, closing));
  if (dist > state.extendRange) {
    // still inbound from far out: approach on the gang's offset bearing
    const aim = tmpAim.copy(targetPos);
    return packOffset ? aim.add(packOffset) : aim;
  }
  return tmpAim.copy(mark).addScaledVector(
    passOffset(pos, quat, mark, state.passSide),
    passMissDistance(dist, closing, speed, tactic.missDistance));
}

/**
 * The speed this frame of the run wants. It is flat out, except in the closing
 * leg. There the throttle comes off the HEADING ERROR, so that a ship on its
 * way round halves its turn radius. break-off.ts has the arithmetic.
 *
 * @param facing the nose-to-target angle AFTER this frame's steering. That is
 * the honest figure, and it is the reason this is a second call.
 */
export function attackRunSpeed(
  phase: AttackPhase, facing: number, maxSpeed: number, tactic: Tactic,
): number {
  return phase === 'closing'
    ? maxSpeed * closingThrottle(facing, tactic.throttleFloor)
    : maxSpeed;
}
