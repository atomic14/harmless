// The three-phase attack run, as a pilot: close, fire through the pass, come
// round again.
//
// ONE RESPONSIBILITY. `attack` flies one frame of that run and reports the shot
// it took. `break-off.ts` owns the phase machine, and `attack-run.ts` owns the
// steering and the speed. `pass-aim.ts` owns where the pass is aimed, and
// `separation.ts` keeps a gang out of its own way. This is the file that spends
// all four against one ship.
//
// THE SHIPPED PIRATE DOES NOT FLY IT BY DEFAULT, and `brain-names.ts` decides.
// A live pirate flies the pursuit dogfighter. The `scripted` A/B reverts every
// pirate to this run, and an armed trader turns and fights with it. The pursuit
// pilot falls back to it when the commander breaks off far enough.
//
// IT NEEDS NO STATE OF ITS OWN. Every field it reads is in `NpcState` and is
// therefore saved: the phase, the passes made, the extend range, the tactic and
// its clock. So it is free functions rather than an object, and the pursuit
// pilot next door is an object because its two fields are NOT saved.
//
// It came out of `game/npc.ts` (docs/TODO/183 M2).

import * as THREE from 'three';

import { attackRunSteer, attackRunSpeed } from './attack-run.ts';
import { separationFrom } from './separation.ts';
import { SEPARATION_PUSH } from '../constants/separation.ts';
import { chooseTactic, tacticSwitchReason } from './tactic-choice.ts';
import { TACTICS, type TacticId } from '../constants/tactics.ts';
import { THARGOID_FIRE_RATE } from '../constants/npc-gun.ts';
import { npcTriggerPull } from './gunnery.ts';
import { approach } from './flight-maths.ts';
import { random } from './rng.ts';
import type { PilotShip } from './npc-pilot.ts';
import type { FireEvent, NpcShip } from './npc.ts';

/** Scratch, so a per-frame path allocates nothing. See `game/npc.ts`. */
const tmpAway = new THREE.Vector3();
const tmpDir = new THREE.Vector3();
/** The reused mate list, never truncated, so growth allocates once. */
const mateSlots: THREE.Vector3[] = [];

export function matePositions(
  ship: PilotShip, fleet: readonly PilotShip[],
): readonly THREE.Vector3[] {
  const out = mateSlots;
  out.length = 0;
  for (const m of fleet) {
    if (m === ship || m === ship.npcTarget || !m.state.alive || m.state.inert) continue;
    out.push(m.object.position);
  }
  return out;
}

function updateTactic(ship: PilotShip, dt: number): TacticId {
  ship.state.tacticClock += dt;
  ship.state.dryFor += dt;
  const why = tacticSwitchReason({
    tactic: ship.state.tactic,
    health: ship.healthFraction,
    underFire: ship.state.underFire,
    sinceChosen: ship.state.tacticClock,
    sinceShot: ship.state.dryFor,
  });
  if (why !== null) {
    ship.state.tactic = chooseTactic(
      ship.tacticHull, ship.healthFraction, why, random(), ship.state.tactic);
    ship.state.tacticClock = 0;
    // A new plan starts with a clean sleeper clock. Otherwise a ship that
    // switched BECAUSE its guns were cold is judged on the old tactic's
    // silence. It would then switch again at the next chance.
    ship.state.dryFor = 0;
  }
  return ship.state.tactic;
}

export function attack(
  ship: PilotShip,
  dt: number,
  targetPos: THREE.Vector3,
  dist: number,
  isPlayer: boolean,
  npcTarget?: NpcShip,
  /**
   * The ships around this one, for keeping out of their way.
   *
   * Optional, and it defaults to nothing. So every existing caller keeps
   * working, the trainer among them, and simply flies with no wingman to
   * avoid. That is exactly right for a one-on-one episode.
   */
  fleet: readonly NpcShip[] = [],
  /**
   * How the target is MOVING, if the caller knows.
   *
   * Optional, for two reasons. Without it the aim below degrades to what it
   * always did, which is a run laid on where the target is now. A stationary
   * fixture also has nothing to say.
   *
   * Every live caller passes it. The aim point is the thing docs/TODO/66 is
   * about, and a pass laid on a stale position is mostly spent before the
   * hulls meet. See `leadTime`.
   */
  targetVel?: THREE.Vector3,
): FireEvent | null {
  // WHERE TO BE and WHETHER TO SHOOT are two decisions, not one. The flight
  // may break off (see break-off.ts) while the gun below still fires. So a
  // police ship, bounty hunter, Thargoid or knife-range pirate does not go
  // silent at the range a human actually fights at.
  ship.state.flownBy = 'scripted';
  // `underFire` is NOT decayed here. `tickClocks` is its one home. Otherwise
  // it would decay for a scripted ship, and latch for a brain-flown one.
  // WHICH WAY IT IS FIGHTING, before anything reads the numbers that follow.
  // `tacticSwitchReason` is roll-free on purpose. A switch that drew from
  // the stream to decide whether to switch would burn a number per hostile
  // per frame. So the dice come out only when the answer is yes.
  const tactic = TACTICS[updateTactic(ship, dt)];
  // WHERE TO BE is attack-run.ts's decision. It is the same composition the
  // commander's scripted co-pilot flies, so the two cannot drift. What stays
  // here is the gang's business: a bend of the chosen line away from wingmen
  // (separation.ts), which a lone ship has none of.
  const steer = attackRunSteer(
    ship.state, ship.object.position, ship.object.quaternion, ship.state.speed,
    targetPos, targetVel ?? null, dist, ship.state.underFire > 0,
    ship.state.packOffset, tactic, random);
  const crowd = separationFrom(ship.object.position, matePositions(ship, fleet), tmpAway);
  if (steer !== null) {
    if (crowd > 0) steer.addScaledVector(tmpAway, SEPARATION_PUSH * crowd);
    ship.steerToward(steer, dt);
  } else if (ship.state.attackPhase === 'passing' && crowd > 0) {
    // a pass steers for nothing — except a wingman about to be hit
    ship.steerToward(
      tmpDir.copy(ship.object.position)
        .addScaledVector(tmpAway, SEPARATION_PUSH * crowd), dt);
  }
  ship.state.speed = approach(
    ship.state.speed,
    attackRunSpeed(ship.state.attackPhase, ship.facing(targetPos), ship.maxSpeed, tactic),
    ship.accel * dt);
  ship.advance(dt);
  ship.state.fireCooldown -= dt;
  // The SAME gun brainFly uses — literally the same call, so it cannot become
  // a second one. This is the path every police ship, bounty hunter, Thargoid
  // and knife-range pirate fires on. Thargoids keep their edge as a
  // multiplier on the shared cooldown rather than a separate literal.
  const reload = npcTriggerPull(
    ship.state.fireCooldown, ship.facing(targetPos), dist, random,
    ship.role === 'thargoid' ? THARGOID_FIRE_RATE : 1);
  if (reload !== null) {
    ship.state.fireCooldown = reload;
    // It got one away, so whatever it does is working. The sleeper's clock
    // is reset by the TRIGGER rather than by the hit. "Did my plan give me a
    // shot" is the question. Whether the bolt connected is gunnery.ts's coin,
    // and not this ship's doing.
    ship.state.dryFor = 0;
    return isPlayer
      ? { at: 'player', weapon: 'laser' }
      : { at: npcTarget!, weapon: 'laser' };
  }
  return null;
}
