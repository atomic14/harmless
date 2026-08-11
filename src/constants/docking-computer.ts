// The docking computer: where it will take the job, and the hand it flies with.
//
// The equipment's mode machine is `game/autopilot.ts`; the one frame of flying
// is `dockingComputerStep` in `game/world-step.ts`, which turns `planDocking`'s
// approach into a `FlightDemand` (`dockingSticks`, game/docking.ts) and lets
// `PlayerShip.update` fly it. The slot test is `dockingOutcome`, exactly as when
// you fly in by hand. The autopilot has to genuinely thread the letterbox; it
// gets no dispensation.
//
// What is here is the HAND, not the geometry it threads: how much of the
// letterbox's roll tolerance the turn may spend, the off-nose angle over which
// it may spend anything at all — a fade rather than a cap, because the axis the
// turn steers its roll against goes degenerate as the nose arrives
// (docs/TODO/134) — and how far along the approach path the follower looks.
// The geometry itself — the gate, the stand-off, the corridor, the slot — is
// constants/docking.ts.
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

/**
 * The off-nose angle, in radians, over which the TURN's claim on the roll axis
 * ramps in. Below it the roll belongs to the slot; above it the turn may spend
 * the letterbox budget as before.
 *
 * Why the claim has to fade at all: the turn measures its roll against
 * `nose × heading` (`dockingSticks`), the axis the wings must lie on for a pull
 * to shorten the heading error. That vector's LENGTH is `sin` of this very
 * angle, so it vanishes exactly when the controller succeeds — and a vanishing
 * vector still has a direction, which is then numerical residue. Ungated, the
 * autopilot flew four seconds dead on the gate heading while rolling hard over
 * and back every 0.45s at 1.3 rad/s, chasing it (docs/TODO/134, GitHub #23).
 *
 * Six degrees, and it is the MIDDLE of a flat optimum rather than a peak. Swept
 * over `npm run dock-probe`'s 320 approaches the median approach takes 10, 9, 8,
 * 8 and 9 roll reversals at 0.05, 0.08, 0.10, 0.13 and 0.16 — flat from 0.08 to
 * 0.13, against 17 with no fade at all. Wider is worse for a reason worth
 * keeping: at 0.20 and 0.35 the turn is refused authority it genuinely needs and
 * the reversals climb back to 15, because the ship stops correcting until the
 * error is large and then corrects hard.
 *
 * The value is NOT read off the worst-case or fall-back-to-the-gate columns.
 * Those disagree between the shipped grid and a second, independent one flown to
 * check this very thing — 0.10 has the best worst case on one and 0.13 on the
 * other — so they are one unlucky approach apiece and not a signal. The median
 * agrees on both (8 and 9 here, 20 and 9 before and after on the second grid),
 * and that is what chose it.
 *
 * Much tighter than the co-pilot's `ROLL_FADE_ANGLE` (0.35), which is the right
 * relationship rather than a coincidence: that one fades a roll that is merely
 * TOO EAGER near the gun cone, so it can afford to be wide, while this one
 * suppresses an axis that is genuinely MEANINGLESS near zero and must give the
 * turn back its authority as soon as there is a real turn to make. Separate rule
 * ids either way — a gun cone's number and a letterbox's.
 *
 * Its own rule id: it shares the value 0.1 with `DECISION_INTERVAL` and
 * `CORRIDOR_START`, which are a duration in seconds and a share of a journey.
 * Three unrelated tenths, and this is the only one that is an angle.
 *
 * There is deliberately no floor to match `ROLL_FADE_FLOOR`. The co-pilot keeps
 * a fraction of its roll near the nose because it has nothing else to do with
 * that axis; here the axis has a second job — fitting the slot — so the claim
 * goes all the way to zero and the slot's own roll is what stands.
 *
 * @rule docking.turnFadeAngle
 */
export const DC_TURN_FADE_ANGLE = 0.10;

/**
 * How far ahead ALONG THE PATH the follower aims, as a share of the gate
 * distance.
 *
 * This is the whole of the follower (`dock-path.ts`): the approach is a curve
 * from the ship to the slot mouth, and the ship flies at the point one of these
 * along it. Everything the path buys is bought here — the aim is never a point
 * the ship is sitting on, so the heading to it is well conditioned; it always
 * moves forward along the curve, so the heading cannot reverse; and it rounds
 * the curve's corners for free, because an aim point rounding a corner moves
 * continuously even where the tangent does not.
 *
 * SPENT TWICE, against the same number: never further than this share of the
 * gate, and never further than this share of what is LEFT of the path. The
 * second clamp is not a refinement — without it, a ship inside the last
 * lookahead is aimed at the END of the path, the station's own centre, and a
 * ship flying straight at the centre holds its bearing instead of closing it. It
 * arrives at the hull face carrying whatever it was off by: four scrapes an
 * approach, measured, before the clamp went in.
 *
 * WHAT THE SWEEP SAYS, over `npm run dock-probe`'s 504 approaches, and it is a
 * cliff on one side and a slope on the other. Too long and the ship cuts the
 * corner — a pursuit flies inside a curve by roughly the square of the lookahead
 * over twice the radius, which at half the gate is 100 units of the 800 the
 * stand-off holds — and the scrapes go 0, 0, 0, 4, 36 at 0.30, 0.35, 0.40, 0.45
 * and 0.50. Too short and it chases a point inside its own turn: the worst
 * single-frame heading change is 10.9 degrees at 0.30 against 3.4 at 0.35, with
 * no scrapes to show for it. The middle of what is left is this.
 *
 * A SHARE rather than a distance, so a bigger station's longer approach is flown
 * with a longer lookahead: `GATE_HALF_WIDTHS` is a multiple of the half-width,
 * so this is one too, at one remove.
 *
 * It replaced a constant of the same name that meant something else — how far
 * down the axis the old gate aim was allowed to LEAD, once the ship had earned
 * it by being lined up. That was docs/TODO/135's fix to a plan that jumped when
 * the run committed, and it is subsumed: with a path there is no commit to jump
 * at, because the run is the last leg of the same curve.
 *
 * Its own rule id: it shares the value 0.35 with two of the scripted co-pilot's
 * steering angles, a lane alpha, a spawn chance and a share of receptions. Six
 * unrelated 0.35s, and this is the only one that is a distance.
 *
 * @rule docking.pathLookahead
 */
export const DC_PATH_LOOKAHEAD = 0.35;
