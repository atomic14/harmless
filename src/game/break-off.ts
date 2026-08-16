// The phases of an attack run: which leg a ship flies, and how hard it
// throttles back to turn. It also names the leg for a readout.
//
// The RANGES these read are `constants/attack-run.ts`. Where the closing leg
// aims is `pass-aim.ts`; how the run-out curves is `extend-arc.ts`.
//
// TO STEER AND TO SHOOT ARE TWO DECISIONS. `attack()` used to `return null` the
// moment it broke off. The break-off and the held trigger were therefore one
// statement. Every police ship, bounty hunter, Thargoid and knife-range pirate
// went silent inside 220 units — Chris's "it feels almost like they stop
// shooting when they get close". A ship that turns away, and that has you in
// its gate, should shoot. So `attack()` steers away AND runs `npcTriggerPull`.
//
// The rule is the same for every hostile: all of them reach `attack()` and all
// break off at the same distance. WHICH of the ranges a given ship uses is
// `constants/tactics.ts`. The type is imported for `describeFlight` alone and is
// erased at build, so nothing here depends on that file at run time.

import type { TacticId } from '../constants/tactics.ts';
import {
  BREAK_OFF_RANGE, CLOSING_THROTTLE_MIN, EXTEND_RANGE,
  EXTEND_RANGE_MAX, EXTEND_RANGE_MIN,
} from '../constants/attack-run.ts';

/**
 * Turn a 0..1 roll into a turn-back range.
 *
 * It takes the roll rather than a call to `random()`, so it stays pure. The
 * whole band is then assertable, and no test needs a seed. `rng.ts` is the only
 * source of chance in the program, and the caller in npc.ts is where that
 * lives.
 */
export function rollExtendRange(roll: number): number {
  return EXTEND_RANGE_MIN + (EXTEND_RANGE_MAX - EXTEND_RANGE_MIN) * roll;
}

/**
 * Where an attack run is in its cycle.
 *
 * `closing` — nose on the target, throttle up, and shoot when the gate allows.
 * `passing` — inside `BREAK_OFF_RANGE`: hold the heading and go THROUGH, and
 *   shoot on the way. This is the half the code did not have.
 * `extending` — past the target, and the range opens; turn back at
 *   `EXTEND_RANGE` and close again.
 */
export type AttackPhase = 'closing' | 'passing' | 'extending';

/**
 * How hard a closing ship pulls the throttle back, from how far off its nose
 * is. It is 1 when the ship is pointed at the target. It is
 * `CLOSING_THROTTLE_MIN` when the ship is 90 degrees or more off.
 *
 * Chris: "if an NPC needs to turn quickly, it should slow down? And then speed
 * up?" — which is right, but NOT for the usual reason, and the difference
 * decides whether the rule does anything.
 *
 * **Less speed does not raise the turn rate.** `steerToward` rotates by
 * `turnRate * dt` and `turnRate` is a constant off the ship's spec; speed
 * appears nowhere in it. A Krait pitches at 1.4 rad/s stopped and 1.4 rad/s
 * flat out. So if this rule were an attempt to buy angular velocity it would
 * buy exactly none.
 *
 * What it buys is the other two, and both matter here:
 *
 *   - **Turn radius.** r = v/omega. Half the speed is half the radius, so a
 *     slow ship comes round inside its own turn rather than wide of it. This is
 *     the whole reason the turn-in at EXTEND_RANGE works.
 *   - **Relative angular rate.** The rate a ship must MATCH to hold its nose on
 *     something is v_rel/range. Its own speed is therefore part of that rate.
 *     Less throttle does not make the ship turn faster. It makes the target
 *     sweep slower. That is why Chris found a low throttle let him hold NPCs at
 *     close range, and full throttle did not.
 *
 * It is a cosine rather than a distance band, because the quantity that decides
 * it is an angle. A ship 900 units out, and dead on its line, has no reason to
 * slow down. A ship 300 out, and 80 degrees off, has every reason. The band
 * this replaced (`dist > 700 ? max : max * 0.45`) got both of those backwards.
 *
 * @param floor the slowest this ship's TACTIC lets it get. It defaults to the
 * constant. A tactic is a choice of how much speed to trade for turn radius,
 * and every value it may pass stays above `MIN_CRUISE_FRACTION`.
 */
export function closingThrottle(
  headingErrorRad: number, floor: number = CLOSING_THROTTLE_MIN,
): number {
  const aligned = Math.max(0, Math.cos(headingErrorRad));
  return floor + (1 - floor) * aligned;
}

/**
 * The next phase of an attack run, from the range and from whether somebody
 * shoots at the ship.
 *
 * It is a pure function, so a test asserts the whole cycle without a flight.
 * `test/npc.test.ts` walks a ship in and out, and checks it comes back round.
 *
 * WHY A FLY-PAST RATHER THAN A REVERSAL. The scripted chase used to steer to
 * `own * 2 - target` the moment it came inside 220: directly away, a 180 turn.
 * That is the slowest turn there is, and the range does not allow it. A Krait
 * pitches at 1.4 rad/s, so a reversal takes 2.24s and covers 651 units of
 * travel. It starts that reversal at 220 units, from a target it points
 * straight at. So it flies through. A Python, at 0.49 rad/s, needs 1,026 units
 * to turn around inside 220. Chris: "the correct thing would be to do an attack
 * run and fly past, then turn for another attack run."
 *
 * `extending` IS THE ONLY PHASE A HIT CHANGES. It is also the only one where a
 * hit makes no sense to ignore. `closing` already turns, and `passing` is over
 * in a fraction of a second. A ship that opens the range is committed to run
 * out for as long as its rolled turn-back takes. That also makes the fight
 * answer the player. To get on its six, and to land shots, is what breaks the
 * pattern.
 */
export function nextAttackPhase(
  phase: AttackPhase, dist: number, underFire = false, extendRange = EXTEND_RANGE,
): AttackPhase {
  // Knife range wins over everything, and it is FIRST for a reason. A ship in
  // `extending` may find the target on top of it again, because the target
  // chased it down. That ship commits to another pass. It does not hold a
  // straight line at somebody on its six.
  if (dist < BREAK_OFF_RANGE) return 'passing';
  // Cleared it. The pass is over the moment the range opens at all.
  if (phase === 'passing') return 'extending';
  // The range still opens: hold the run out until there is room to turn in.
  // UNLESS somebody lands shots. Then cut the run short. Come round now. The
  // run-out curves (extend-arc.ts). So a ship cut short here already did as
  // much of its turn as the range it reached earned it.
  if (phase === 'extending') return dist > extendRange || underFire ? 'closing' : 'extending';
  return 'closing';
}

/**
 * What a ship does now, as a phrase for a record or a readout.
 *
 * It is its own function because three surfaces ask. They are the trainer's
 * SPENT ITS TIME column, the live cockpit strip beside it, and
 * `train/flight-probe.ts`. A phrase invented three times is a phrase that
 * drifts. It reads the SAME fields the flight reads, so it cannot report a
 * flight the ship does not fly.
 *
 * TWO WORDS SINCE docs/TODO/68: the tactic, then the leg. `slash closing`,
 * `knife extending`, `ram closing`. Every bucket repeats the tactic, rather
 * than a column of its own. That repetition is the whole point of the readout.
 * The column counts SECONDS per phrase. So a ship that changed its mind after a
 * hit reads
 *
 *   RUN CLOSING 8.2s · RUN EXTENDING 6.9s · SLASH CLOSING 5.1s · SLASH EVADING 1.2s
 *
 * and the switch is visible as a fact about time, rather than as a label. A
 * label would show only the leg the ship is on now.
 *
 * `evading` outranks the phase, because it is the answer to "why has it stopped
 * flying the run". `fleeing`, `not fighting` and `own policy` carry NO tactic.
 * A trader that runs for the system edge flies no attack run at all. A ship
 * with no combat flight has no tactic to name. A brain-flown ship never runs
 * one: it flies its policy the whole way in, so its tactic is a plan it does
 * not use. The pursuit dogfighter is a fourth case, with no tactic and no
 * phase. It reads `on your six` while it chases, and `breaking off` while it
 * veers clear of a ram. It never runs the attack-run machine those words
 * describe.
 *
 * WHICH FLIGHT RAN IS THE FIRST QUESTION, and since docs/TODO/88 it is the only
 * one that may reach the phase. `attackPhase` starts life at `closing`, and
 * `attack()` alone writes it. So anything that answers ahead of `flownBy`
 * reports that initial value as though the machine produced it. A pirate at
 * ease outside interest range read `slash closing`. An armed trader that fought
 * off its attacker read `fleeing`. The branch it took was named for what a
 * trader does when it has no guns.
 */
export function describeFlight(
  flownBy: 'brain' | 'scripted' | 'pursuit' | 'fleeing' | 'none',
  phase: AttackPhase, underFire: number,
  tactic: TacticId = 'run',
  breaking = false,
): string {
  // No combat flight at all: a pirate at ease, a trader on the lane, an inert
  // Thargon. The name states the absence rather than a guess at the errand.
  // This function knows the flight and not the role. Any word for an errand
  // would be the same stale quote, one step removed.
  if (flownBy === 'none') return 'not fighting';
  // A run, with no intention to turn. `state.fleeing` is the BRANCH, and an
  // armed trader fights from inside it. So the word belongs to the flight that
  // actually points away from the attacker.
  if (flownBy === 'fleeing') return 'fleeing';
  // The pursuit dogfighter is not in an attack-run phase either. It has no
  // `closing`, `passing` or `extending`. It has only "on the six" and "veering
  // off to avoid a ram". A report of `attackPhase` here quoted a word it never
  // set, so the strip read the same "KNIFE CLOSING" as a pirate on a joust. It
  // reads its own two states instead, and NOT `evading`. A pursuit pirate under
  // fire keeps its chase. It does not break the way the attack run does.
  if (flownBy === 'pursuit') return breaking ? 'breaking off' : 'on your six';
  // A brain-flown ship is not IN a phase. Only the scripted run touches
  // `attackPhase`, so a report of it here would quote a stale word. It flies
  // its own policy, and that is the name for the flight. This is not a
  // hypothetical: the first cut of this readout said `closing 45s` for a g3
  // pirate that never ran the closing logic at all. A shot at the ship is the
  // one thing that is true of it either way.
  if (flownBy === 'brain') return underFire > 0 ? 'evading' : 'own policy';
  if (underFire > 0) return `${tactic} evading`;
  return `${tactic} ${phase}`;
}
