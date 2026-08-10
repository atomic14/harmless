// The docking computer: where it will take the job, and the hand it flies with.
//
// The equipment's mode machine is `game/autopilot.ts`; the one frame of flying
// is `dockingComputerStep` in `game/world-step.ts`, which turns `planDocking`'s
// approach into a `FlightDemand` (`dockingSticks`, game/docking.ts) and lets
// `PlayerShip.update` fly it. The slot test is `dockingOutcome`, exactly as when
// you fly in by hand. The autopilot has to genuinely thread the letterbox; it
// gets no dispensation.
//
// TWO CONSTANTS IT NO LONGER HAS, both retired by docs/TODO/126 rather than
// retuned, because the flying they described stopped existing:
//
//   DC_TURN_RATE (1.2 rad/s) was the rate of a shortest-arc slerp written
//   straight onto `player.quaternion` — a turn about an axis no stick can
//   produce. Re-expressed as a fraction of the hull's own caps it was measured
//   over 320 approaches, and the answer was 1: at 0.8 the sweep took 35 scrapes
//   and at 0.9 nine, against 3 at full authority. A cautious cap does not fly
//   cautiously — it flies a roll that cannot keep up with the plan and arrives
//   at the letterbox still turning. So the limit is the commander's own
//   (PLAYER_FLIGHT) and there is no second number for a shipyard to contradict.
//
//   DC_THROTTLE_GAIN (1.5/s) closed a fraction of the speed gap per second by
//   writing `player.speed`. A demand has a THROTTLE — full ahead, full astern
//   or coast — so the plan's speed is held with the hull's own thrust and a
//   deadband of one frame's worth of it.

/**
 * How close to the station the docking computer will take the job, in world
 * units. Far enough to be useful from the end of the torus run, near enough to
 * be an approach aid rather than a taxi across the system. Equal to the
 * player's `LASER_RANGE` by coincidence of scale, not by rule.
 */
export const DOCK_COMPUTER_RANGE = 3500;

/**
 * How much of the slot's roll tolerance the TURN may spend, as a fraction.
 *
 * The docking computer flies one stick with two jobs (`dockingSticks`): rolling
 * to turn, and rolling to fit through a letterbox. What lets them share it is
 * that fitting through is not a point but a WINDOW — `ROLL_TOLERANCE` — so the
 * turn is allowed to bank anywhere inside that window and no further.
 *
 * Not the whole window, because arriving at the exact edge of what fits leaves
 * nothing for the last second: the slot is on a hull that is still turning, and
 * the ship is still drifting when it reaches the mouth. Half of it is the
 * margin, which leaves ~19 degrees of banking authority on the axis — enough to
 * hold a line, far short of enough to be turning on the way in.
 *
 * Its own rule id: it shares the value 0.5 with `BRIBE_SHARE`,
 * `SURVIVOR_RELEASE_SHARE` and two fractions of the heat bar. Five unrelated
 * halves, and this is the only one that is an angle.
 *
 * @rule docking.slotMargin
 */
export const DC_SLOT_MARGIN = 0.5;
