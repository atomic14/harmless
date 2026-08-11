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
// (docs/TODO/134) — how far ahead the roll reads its own rate, which is what
// lets it hold a bank rather than ring around one (docs/TODO/137), and how far
// along the approach path the follower looks. The geometry itself — the gate,
// the stand-off, the corridor, the slot — is constants/docking.ts.
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
 * the ship is still drifting when it reaches the mouth.
 *
 * IT IS WHAT THE WINGS ARRIVE WITH, which was not knowable until the roll
 * stopped ringing (`DC_ROLL_LEAD`, docs/TODO/137). The path keeps a small
 * correction alive the whole way in — the nose sits 5 or 6 degrees off, which is
 * `DC_TURN_FADE_ANGLE` or more, so the turn holds its full claim right up to the
 * mouth and banks by exactly this much. Undamped, the ship swung through ±40
 * degrees around that bank and the letterbox caught it wherever the swing
 * happened to be; damped, it sits where it is asked, and `ROLL_TOLERANCE` times
 * this is the answer. Over `npm run dock-probe`'s 504 approaches, at a lead of
 * 0.10, the median approach goes through the slot 3.1, 3.8, 4.3, 5.0 and 5.5
 * degrees off its long axis at 0.25, 0.28, 0.30, 0.33 and 0.35 — a straight line
 * through this constant, which is the mechanism showing itself.
 *
 * SO IT IS CHOSEN AT THE KNEE RATHER THAN AS LOW AS IT WILL GO. Below 0.30 the
 * median keeps falling and the WORST case blows out past where it started — 33.5
 * degrees at 0.25 and 34.3 at 0.28, against 30.0 before this item — on a second,
 * independent grid as well as the shipped one, so it is a signal and not one
 * unlucky approach. That is the turn being refused a bank it genuinely needs:
 * the correction goes unmade, the ship arrives off the axis and rolls hard at
 * the mouth. Below 0.15 it is scrapes and a plan jumping again.
 *
 * Half of the tolerance was the old value and the argument for it was the same
 * sentence — "enough to hold a line, far short of enough to be turning on the
 * way in". The first half was true and the second was not: the ship spent all
 * 19 degrees of it turning, every approach.
 *
 * Its own rule id: it shares the value with `HERMIT_CHANCE`, `GANG_SHARE`, the
 * two `SPEED_KEPT` fractions and three more — eight unrelated three-tenths, of
 * which this is the only share of an ANGLE, and the only one a pilot could see.
 *
 * @rule docking.slotMargin
 */
export const DC_SLOT_MARGIN = 0.30;

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
 * Its own rule id: it shares the value 0.1 with `DECISION_INTERVAL`,
 * `CORRIDOR_START` and `DC_ROLL_LEAD` below — a duration in seconds, a share of
 * a journey, and a lead time in seconds belonging to the very same control law.
 * Four unrelated tenths, and this is the only one that is an angle.
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
 * How far ahead IN TIME the roll ask reads the rate it is already rolling at,
 * in seconds. The damping term, and the whole of docs/TODO/137.
 *
 * WHAT IT FIXES is a controller that could choose a bank and not hold one. A
 * proportional ask (`steerStick`, saturating at `STEER_SATURATION`) driving a
 * rate ramp (`PLAYER_FLIGHT.rateRamp`) is a second-order loop with no damping
 * term at all: full stick at 0.35 rad against a cap of 2.5 rad/s is a gain of
 * about 7 per second, against a ramp time constant of a quarter of a second,
 * which puts the loop at a damping ratio of 0.38 — 25% overshoot and a ring at
 * roughly a reversal a second. On the run in the ring was ±40 degrees, because
 * the disturbance never stops: the ship rolls past the bank, its pitch plane
 * sweeps with it, the heading error moves in its own frame and the roll is asked
 * for again. Held on a fixture with the demand standing still, a 30-degree bank
 * overshoots by 7.6 degrees, reverses twice and takes 1.5s to settle; with this
 * term it overshoots by 1.8, reverses once and settles in 1.0s, and a 10-degree
 * bank does not reverse at all (`test/docking-computer.test.ts`).
 *
 * Ahead IN TIME rather than a gain, because that is what makes it a number a
 * person can argue with: at the rate the ship is rolling now, where will the
 * error be in a tenth of a second, and ask for THAT. The arithmetic behind the
 * value is the same: this times the gain is the damping the loop was missing,
 * and 0.23s would be critical damping on its own.
 *
 * IT IS NOT SET AS HIGH AS THE RING ALONE WOULD WANT, and the reason is the
 * measurement that mattered. Over `npm run dock-probe` the roll reversals fall
 * monotonically with it — 18 with no term at all, 14 at 0.06, 12 at 0.10, 10 at
 * 0.16, 9 at 0.28 — and so does the roll swept, 1.9 turns to 0.9. But past about
 * 0.10 it starts costing the NOSE (median 5.4 degrees off the slot axis going
 * in, 6.3 here, 6.6 at 0.16) and it costs the last of the ring's usefulness: the
 * ship stops correcting until the error is large. Past 0.28 the plan itself
 * starts jumping and the sweep scrapes. Two grids agree on 0.08–0.12 as the flat
 * part of the trade.
 *
 * A FEEDFORWARD FOR THE STATION'S OWN SPIN WAS BUILT HERE AND MEASURED AWAY.
 * The letterbox turns at `STATION_SPIN` forever, so holding the wings on it is a
 * standing roll rate, which a proportional law can only produce by holding a
 * standing error — 1.8 degrees, and this term adds to it (3.3 at 0.10, 4.8 at
 * 0.20). Crediting the roll the slot itself asks for removes the added lag
 * exactly, and on the fixture it does: the standing error stays 1.8 at any lead.
 * In flight it is worth 0.1 degrees at the letterbox on both grids, because what
 * the wings arrive with is set by the bank the turn is holding (`DC_SLOT_MARGIN`)
 * and not by the lag. It cost a field on the plan, an import of the station's
 * spin into the flight law and a gate for the phase, so it is not here. If the
 * turn's claim at the mouth is ever made to fade properly, look at it again.
 *
 * Its own rule id: it shares the value 0.1 with `DC_TURN_FADE_ANGLE` two
 * definitions up — which is an ANGLE IN RADIANS to this one's SECONDS, and the
 * pair is worth keeping straight: that one says how far off the nose has to be
 * before the turn may bank at all, this one how far ahead the bank reads itself.
 * Also with `DECISION_INTERVAL` and `CORRIDOR_START`.
 *
 * @rule docking.rollLead
 */
export const DC_ROLL_LEAD = 0.10;

/**
 * How far ahead ALONG THE PATH the follower aims, in station half-widths.
 *
 * This is the whole of the follower (`dock-path.ts`): the approach is a curve
 * from the ship to the slot, and the ship flies at the point one of these along
 * it from wherever it is on it. Everything the path buys is bought here — the
 * aim is never a point the ship is sitting on, so the heading to it is well
 * conditioned; it always moves forward along the curve, so the heading cannot
 * reverse; and it rounds the curve's corners for free, because an aim point
 * rounding a corner moves continuously even where the tangent does not.
 *
 * WHAT IT TRADES is the NOSE against the WINGS, and both are measured over
 * `npm run dock-probe`'s 504 approaches, at the letterbox, where they are what a
 * letterbox asks about. Short, and the ship tracks the curve tightly and arrives
 * pointing straight but rolled: at one half-width the median approach goes
 * through 3.4 degrees off the axis and 16.4 off the slot. Long, and it flies
 * inside the curve — by roughly the square of this over twice the radius — so it
 * arrives with more to correct, and correcting is an angle: at two half-widths,
 * 7.9 off the axis and 12.1 off the slot, and 60 scrapes, which is the cliff.
 * One and a half is between them and clear of it: 5.4 and 7.5, nothing scraping.
 *
 * IT DOES NOT VARY, and two rules that made it were tried and measured away.
 * Clamping it to a share of what is LEFT of the path reads well and is what
 * makes the last hundred units twitchy: a ship 7 units off a 26-wide channel was
 * being asked for an 11-degree correction, because the aim had closed to 84
 * units. Extending it to the path's END once the ship is on the straight leg
 * gives the old approach's serene 2.9-degree entry and steps the aim 200 units
 * when the projection crosses onto that leg — median jump 0.6 degrees to 13.9.
 * A flat lookahead has neither and needs no case analysis.
 *
 * IN HALF-WIDTHS, so a bigger station's approach is flown with a longer
 * lookahead — and because the half-width is the scale of the thing being
 * threaded, which is what this is really measured against.
 *
 * It replaced a constant of the same name that meant something else — how far
 * down the axis the old gate aim was allowed to LEAD, once the ship had earned it
 * by being lined up. That was docs/TODO/135's fix to a plan that jumped when the
 * run committed, and it is subsumed: with a path there is no commit to jump at,
 * because the run in is the last leg of the same curve.
 *
 * Its own rule id: it shares the value 1.5 with `DISREPUTE_DECAY`, which is a
 * rate per jump.
 *
 * @rule docking.pathLookahead
 */
export const DC_PATH_LOOKAHEAD = 1.5;
