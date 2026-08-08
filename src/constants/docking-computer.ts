// The docking computer: where it will take the job, and the hand it flies with.
//
// The equipment's mode machine is `game/autopilot.ts`; the one frame of flying
// is `dockingComputerStep` in `game/world-step.ts`, which steers and throttles
// only — the approach it steers along is `planDocking` and the slot test is
// `dockingOutcome`, exactly as when you fly in by hand. The autopilot has to
// genuinely thread the letterbox; it gets no dispensation.

/**
 * How close to the station the docking computer will take the job, in world
 * units. Far enough to be useful from the end of the torus run, near enough to
 * be an approach aid rather than a taxi across the system. Equal to the
 * player's `LASER_RANGE` by coincidence of scale, not by rule.
 */
export const DOCK_COMPUTER_RANGE = 3500;

/**
 * How fast it turns the ship onto the planned heading, in radians a second.
 * Well under the commander's own `TURN.pitch` of 2.0: it flies like a cautious
 * pilot, and the roll has to settle before the letterbox.
 */
export const DC_TURN_RATE = 1.2;

/**
 * How hard it works the throttle: the fraction of the gap between current and
 * planned speed closed per second (clamped to 1 per frame, so a long frame
 * cannot overshoot the plan).
 */
export const DC_THROTTLE_GAIN = 1.5;
