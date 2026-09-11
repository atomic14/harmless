// The human's hands, turned into a FlightDemand.
//
// This is the other half of the seam player.ts opens. It is a PURE function
// from "what is held down" to "what the pilot wants". So the same ship flies
// for a person, a policy and a replay.
//
// It reads no globals. It mutates nothing. It runs under node. That is why a
// test can finally assert the ramp it applies against the model, rather than
// read it in a comment.
//
// The ramp lives HERE rather than in the ship, because the ramp belongs to the
// pilot. This one is the classic keyboard-analogue feel: RATE_RAMP up,
// RATE_DECAY down, capped at MAX_ROLL/MAX_PITCH. The combat computer's is
// deliberately a different one. See FlightDemand.
//
// Mouse DECAY is not done here: `decayMouse` mutates the Input, and a pure
// producer must not. The caller does it, immediately after reading — see
// Game.pilotDemand.
import { rampFlightRate, type FlightDemand } from '../player.ts';
import { PLAYER_FLIGHT } from '../constants/player-flight.ts';

/**
 * Just enough of `Input` to fly by — structural, so `Input` satisfies it
 * without knowing this exists, and a test can pass a literal.
 */
export interface FlightControls {
  held(...codes: string[]): boolean;
  readonly mouseFlight: boolean;
  readonly mouseX: number;
  readonly mouseY: number;
  readonly mouseFire: boolean;
  /** the speed a throttle slider asks for, as a fraction of top speed, or null (docs/TODO/204) */
  readonly wantedSpeed?: number | null;
}

/**
 * The ramped rates the demand continues from — the ship's own, in practice.
 * `speed` is the ship's, for the wanted-speed rule, and a caller with no
 * throttle slider may leave it out.
 */
export interface TurnRates {
  rollRate: number;
  pitchRate: number;
  speed?: number;
}

/** The active bindings the flight controls need, supplied by their owner. */
export interface FlightKeys {
  readonly rollLeft: readonly string[];
  readonly rollRight: readonly string[];
  readonly pitchUp: readonly string[];
  readonly pitchDown: readonly string[];
  readonly accel: readonly string[];
  readonly decel: readonly string[];
  readonly fire: readonly string[];
}

/**
 * What the pilot at the keyboard is asking for.
 *
 * @param c    what is held down, and where the mouse is
 * @param keys the active layout's bindings
 * @param from the rates already being flown, which the ramp continues from
 */
export function flightDemand(
  c: FlightControls, keys: FlightKeys, from: TurnRates, dt: number,
): FlightDemand {
  let rollIn = (c.held(...keys.rollLeft) ? 1 : 0) - (c.held(...keys.rollRight) ? 1 : 0);
  let pitchIn = (c.held(...keys.pitchUp) ? 1 : 0) - (c.held(...keys.pitchDown) ? 1 : 0);

  // mouse flight: analogue axes, keyboard still overrides when touched
  if (c.mouseFlight) {
    if (rollIn === 0) rollIn = -c.mouseX;
    if (pitchIn === 0) pitchIn = c.mouseY;
  }

  // slash only decelerates unshifted — ? opens the controls guide
  const decelHeld = keys.decel.some((k) =>
    c.held(k) && (k !== 'Slash' || !c.held('ShiftLeft', 'ShiftRight')));
  const accelHeld = c.held(...keys.accel);

  return {
    rollRate: rampFlightRate(from.rollRate, rollIn * PLAYER_FLIGHT.maxRoll, rollIn !== 0, dt),
    pitchRate: rampFlightRate(from.pitchRate, pitchIn * PLAYER_FLIGHT.maxPitch, pitchIn !== 0, dt),
    throttle: accelHeld || decelHeld
      ? (accelHeld ? 1 : 0) - (decelHeld ? 1 : 0)
      : throttleToward(c.wantedSpeed ?? null, from.speed),
    fire: c.held(...keys.fire) || c.mouseFire,
  };
}

/**
 * The throttle a wanted speed asks for: open below it, brake above it, and
 * coast inside `PLAYER_FLIGHT.throttleBand` of it (docs/TODO/204 M1). A
 * touch slider sets the wanted speed. A keyboard never does, so with no
 * wanted speed and no key the ship coasts, as it always did.
 */
export function throttleToward(wanted: number | null, speed: number | undefined): number {
  if (wanted === null || speed === undefined) return 0;
  const target = wanted * PLAYER_FLIGHT.maxSpeed;
  if (speed < target - PLAYER_FLIGHT.throttleBand) return 1;
  if (speed > target + PLAYER_FLIGHT.throttleBand) return -1;
  return 0;
}
