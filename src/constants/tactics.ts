// The four ways a hostile can fly the one attack run.
//
// Not four flight models. There is ONE run — `attack-run.ts`'s ranges,
// `pass-aim.ts`'s aim point, `extend-arc.ts`'s run-out — and a tactic is a named
// set of three of its numbers, so the sky varies without a second home for a
// combat rule. The run-out band is deliberately not varied: it is coupled to
// `PASS_FAR`, and a shorter one would stop the trainer counting its attack runs.
//
// Which tactics a hull may fly, and when it re-decides, is `tactic-choice.ts`
// and `game/tactic-choice.ts`. The two types are declared here so the
// `Record<TacticId, Tactic>` annotation can be checked, since this directory may
// not import.

import { CLOSING_THROTTLE_MIN } from './attack-run.ts';
import { PASS_MISS_DISTANCE } from './pass-aim.ts';
import { EXTEND_ARC_ANGLE } from './extend-arc.ts';

/** Which way a ship flies its attack run. */
export type TacticId = 'run' | 'slash' | 'knife' | 'ram';

/** Every tactic, least to most committed — the order a readout should list them. */
export const TACTIC_IDS: readonly TacticId[] = ['slash', 'run', 'knife', 'ram'];

/** One way of flying the run: three numbers the attack-run files already own. */
export interface Tactic {
  readonly id: TacticId;
  /** How far to the side the pass is aimed, before the geometry stretches it. */
  readonly missDistance: number;
  /** The angle the run-out holds off the outward radial at its tightest. */
  readonly arcAngle: number;
  /**
   * The slowest fraction of top speed it throttles back to in order to turn.
   * Every value MUST stay above `MIN_CRUISE_FRACTION`, or the tactic and the
   * turret backstop are in an argument; `test/tactics.test.ts` holds it.
   */
  readonly throttleFloor: number;
  /**
   * Whether the pass is MEANT to connect — `ram` only. A field rather than an
   * `id === 'ram'` check because it is what the clearance gate reads.
   */
  readonly aimsToHit: boolean;
}

export const TACTICS: Record<TacticId, Tactic> = {
  // The shipped attack run, named. Every value is imported rather than repeated
  // so this row cannot drift from the behaviour it is supposed to BE.
  run: {
    id: 'run',
    missDistance: PASS_MISS_DISTANCE,
    arcAngle: EXTEND_ARC_ANGLE,
    throttleFloor: CLOSING_THROTTLE_MIN,
    aimsToHit: false,
  },
  // Wide and fast: it trades the gun for the hull, because a wider aim is a
  // wider angle and `NPC_FIRE_GATE` is an angle. The only row that never touches
  // anything and a third less lethal for it, which is why a hurt ship is
  // weighted toward it.
  slash: {
    id: 'slash',
    missDistance: 175,
    arcAngle: (45 * Math.PI) / 180,
    throttleFloor: 0.72,
    aimsToHit: false,
  },
  // The tightest pass, curving back hard — the dangerous one. Lethality and
  // contact are one axis in this flight model, so how far it may be tightened is
  // a measurement: over 40 episodes, 70 buys a fifth more damage for four times
  // the ramming, so 100 is the knee.
  knife: {
    id: 'knife',
    missDistance: 100,
    arcAngle: (70 * Math.PI) / 180,
    throttleFloor: CLOSING_THROTTLE_MIN,
    aimsToHit: false,
  },
  // A doomed ship aiming at the hull instead of beside it, at full power.
  // Everything else about the run is unchanged, which is what makes it cheap.
  ram: {
    id: 'ram',
    missDistance: 0,
    arcAngle: EXTEND_ARC_ANGLE,
    throttleFloor: 1,
    aimsToHit: true,
  },
};
