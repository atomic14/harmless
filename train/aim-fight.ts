// ONE fight, measured from the attacker's side: who was aimed at whom, how
// often the trigger came back, and what it took off her.
//
// The pair to `train/defence-fight.ts` and there for the same reason: the fight
// a table is measured over is a decision, and a decision belongs in one file
// that every reader of the table can open. `train/aim-probe.ts` is the grid and
// the tables; this is what one cell of it flies. `test/aim-probe.test.ts`
// imports THIS, so the bounds a measurement may not cross are checked against
// the fight rather than against the printing.
//
// ## The fight
//
// A fitted commander in her own Cobra — armed, E.C.M. fitted — against a gang
// over 45 seconds, with the pools recharging as the game recharges them. TWO
// AXES, because each of them moves the answer more than the gang size does.
//
// SHE FLIES ONE OF TWO BEHAVIOURS, and the difference is not decoration:
//
//   - `knife-fights` is `holding` — turns hard and barely translates, which is
//     how a human actually fights and is close to Chris's own recorded envelope
//     (median speed 66, pitch near its cap). A pirate can reach her.
//   - `runs` is `scripted`, and it is `train/survivability.ts`'s defender, so
//     the rows here explain the pools-stripped column there. It ambles until
//     something shoots it and then runs flat out: `train/ram-probe.ts` measured
//     that ships settle at ~397 against a pirate's ~240 and are never caught
//     again. A gun that never gets in range is not a gun that cannot aim, and
//     an aim figure that pooled the two would be neither.
//
// AND THE ATTACKERS FLY ONE OF TWO PILOTS, which is the one thing survivability
// does not vary:
//
//   - `pursuit` is the SHIPPED opposition (`game/brain-names.ts`:
//     `pirateBrainNameFor` returns it unless the A/B control asks otherwise) —
//     the dogfighter that chases onto your six. It is what a player meets.
//   - `scripted` is the hand-written attack run, the A/B control, and the pilot
//     every survivability figure ever printed was measured against.
//
// ## Where each number's rule lives
//
// LINED UP, IN RANGE and AIM ERROR are the game's own recorder's
// (`game/combat-sim-report.ts`): this builds a `CombatSimRecorder`, feeds it the
// fight and reads the report, exactly as `train/flight-probe.ts` does since
// docs/TODO/34. There is one `NPC_FIRE_GATE` test in this project and it is not
// here. What IS this file's own is the denominator — it counts the ship-frames
// it fed in, so a caller can pool shares by weight instead of averaging shares.
//
// SHOTS, HITS and DAMAGE are the episode's own tallies, which are LASER ONLY:
// `Episode.resolveNpcShot` counts a missile in `missilesFired` and credits a
// warhead to nobody, and a ram is billed to `hurtSelf`. `taken` beside them is
// every point she was billed by every cause, so a caller can show the split
// rather than imply the laser was all of it.
//
// THE LEG SPLIT is the same aim angle again, grouped by the leg the ship was
// flying (`flightLeg` below). The grouping is this file's; the angle and every
// word are the game's. It is not a second aim rule, and it does not count LINED
// UP, which stays the recorder's alone.
//
// ALIVE SECONDS, not the episode's: a pirate destroyed at 12 seconds did not
// spend the other 33 failing to shoot, and dividing by 45 would report the
// defender's gun as the attacker's aim.
//
// The E.C.M. is fitted and neither of these two flights ever presses it (only a
// policy with an E.C.M. head asks), so every warhead counted here landed — the
// standing decision of docs/TODO/72, inherited rather than quietly differed
// from. Both sides are the training world's stand-ins, and the shipped defence
// outflies this one: `train/survivability.ts`'s header has the full list.

import * as THREE from 'three';
import { Episode, type Controller } from '../src/ai-training/scenario.ts';
import {
  CombatSimRecorder, aimAngle, type FrameSample,
} from '../src/game/combat-sim-report.ts';
import { NO_OPENING } from '../src/game/combat-sim-opening.ts';
import { describeFlight } from '../src/game/break-off.ts';
import type { NpcState } from '../src/game/npc.ts';
import { energyLow } from '../src/game/systems.ts';
import { FIXED_DT } from '../src/constants/world-clock.ts';

/** How long one fight runs — survivability's clock, so the rows pair. */
export const MAX_TIME = 45;

/** The pilots, shipped first. `game/brain-names.ts` is why that is the order. */
export const PILOTS = ['pursuit', 'scripted'] as const;
export type Pilot = (typeof PILOTS)[number];

/**
 * How SHE flies, and the label a row wears — see the header. The knife fight
 * comes first because it is the one a player recognises; the runner is
 * survivability's defender and is here so that its rows can be read.
 */
export const TARGETS = [
  { how: 'holding', label: 'knife-fights' },
  { how: 'scripted', label: 'runs' },
] as const;
export type Target = (typeof TARGETS)[number];

/**
 * One LEG of a flight, pooled over the gang: how long the attackers spent in
 * it, and how far off her their noses sat while they were.
 *
 * It is the split docs/TODO/139 M3 turns on. A mean bearing error over a whole
 * fight pools legs that point the nose for opposite reasons: a run that closes
 * wants the nose ON her, and the extend leg of the same run points AWAY by
 * design. One number cannot tell a pilot that cannot aim from a pilot that is
 * not aiming yet.
 */
export interface FlightSlice {
  /** ship-frames in this leg — the denominator `Attacker.frames` counts */
  frames: number;
  /** their bearing error to her, in RADIANS, summed over those frames */
  aimError: number;
}

/**
 * What leg a ship is flying, for the split above — `game/break-off.ts`'s own
 * words, and no new ones.
 *
 * It is NOT `describeFlight`, and the two differences are both deliberate:
 *
 *   1. `describeFlight` lets `evading` outrank the leg, because the strip a
 *      player reads wants to say why a ship stopped flying its run. This table
 *      wants the leg, so a ship under fire is counted in the leg it flew. The
 *      run does not stop when it is shot at — `nextAttackPhase` cuts the extend
 *      short and returns it to `closing` — so the leg is always a real one.
 *   2. It drops the tactic prefix. A tactic decides how WIDE a pass steps and
 *      how tight the run-out curves. It does not decide whether the leg points
 *      the nose at her, which is the only question here.
 *
 * The pursuit dogfighter runs no attack-run phase at all, so its own word is
 * kept whole, exactly as `describeFlight` keeps it.
 */
function flightLeg(state: NpcState): string {
  return state.flownBy === 'scripted'
    ? state.attackPhase
    : describeFlight(state.flownBy, state.attackPhase, state.underFire, state.tactic);
}

/** One attacker's fight, in the terms a table is built from. */
export interface Attacker {
  hull: string;
  /** points a hit takes off THIS commander — the pack's own tabulated number */
  damagePerHit: number;
  /** ship-frames it was sampled in: the denominator, and this file's own */
  frames: number;
  /** of those, frames the recorder scored it inside its gate and in range */
  linedUp: number;
  inRange: number;
  /** its bearing error to her, summed over frames — a mean at the end */
  aimError: number;
  aliveSeconds: number;
  shots: number;
  hits: number;
  /** her pool points, laser only — see the header */
  damage: number;
  passes: number;
}

/** What one fight came to. */
export interface Fight {
  attackers: Attacker[];
  seconds: number;
  /** warheads that reached her — counted, never credited to a pirate */
  warheads: number;
  /** the median range the fight was held at, the recorder's own figure */
  median: number | null;
  /** every point she was billed, by every cause */
  taken: number;
  /** survivability's two outcomes: a face at zero at any instant, and death */
  flattened: boolean;
  destroyed: boolean;
  /**
   * Whether the console ever said ENERGY LOW — `systems.ts`'s own `energyLow`,
   * asked every step. It is the moment the shield stops recovering at all and
   * the player is supposed to break off, and it is the term docs/TODO/139 M2
   * states its gate in, so it is measured rather than inferred from a pool.
   */
  reachedLowEnergy: boolean;
  /** attackers destroyed — the cost of the fight to them, survivability's column */
  attackersLost: number;
  /**
   * The fight's ship-frames split by the leg the attacker was flying at the
   * time, pooled over the gang. `flightLeg` is the key.
   */
  doing: Map<string, FlightSlice>;
}

export function flyAimFight(
  pilot: Pilot, target: Target, gang: number, seed: number,
): Fight {
  const pirates: Controller[] = Array.from({ length: gang }, () => ({ kind: pilot }));
  const ep = new Episode({
    seed,
    pirates,
    // Armed, in the commander's own hull, with her E.C.M. fitted — the fitted
    // commander survivability models. How she FLIES is the axis.
    trader: { kind: target.how },
    traderArmed: true,
    traderClass: 'playerCobra',
    targetEcm: true,
    maxTime: MAX_TIME,
  });
  const setup = ep.setup();
  const rec = new CombatSimRecorder({
    seed,
    scenario: `aim probe: ${pilot} x${gang}, she ${target.label}`,
    mode: 'scenario',
    // Every step, declared — the recorder's durations follow it.
    sampleHz: 1 / FIXED_DT,
    player: {
      shipId: setup.target.shipId,
      laser: setup.target.laser,
      missiles: 0, ecm: true, energyUnit: false, energyBomb: false,
    },
    opponents: setup.pirates.map((p) => ({
      hull: p.name, designId: p.designId, profileId: p.profileId,
      brain: pilot, role: 'pirate',
    })),
    // Where an episode's ships start is `ai-training/scenario.ts`'s business.
    opening: NO_OPENING,
    coPilot: 'scripted',
  });

  const her = ep.trader;
  const gap = new THREE.Vector3();
  // The denominator, counted where the samples are made: how many ship-frames
  // this fight fed the recorder, per attacker.
  const frames = ep.pirates.map(() => 0);
  const alive = ep.pirates.map(() => 0);
  // ...and the same frames again, split by what the ship was flying. It is
  // counted HERE, beside the denominator it shares, so the split and the total
  // cannot disagree about which frames they cover.
  const doing = new Map<string, FlightSlice>();
  const sample = (): FrameSample => ({
    speed: her.speed,
    pitch: her.pitchRate,
    roll: her.rollRate,
    foreShield: her.sys.foreShield,
    aftShield: her.sys.aftShield,
    energy: her.sys.energy,
    contacts: ep.pirates.flatMap((p, i) => {
      if (!p.alive) return [];
      frames[i] += 1;
      const theirAim = aimAngle(p.pos, p.quat, her.pos);
      const flight = describeFlight(
        p.npc.state.flownBy, p.npc.state.attackPhase, p.npc.state.underFire,
        p.npc.state.tactic);
      const leg = flightLeg(p.npc.state);
      const slice = doing.get(leg) ?? { frames: 0, aimError: 0 };
      slice.frames += 1;
      slice.aimError += theirAim;
      doing.set(leg, slice);
      return [{
        opponent: i,
        dist: gap.copy(her.pos).sub(p.pos).length(),
        speed: p.speed,
        theirAim,
        doing: flight,
        yourAim: aimAngle(her.pos, her.quat, p.pos),
      }];
    }),
  });

  // Survivability's two outcome watches, taken the same way it takes them:
  // every step, because a face that was flattened and came back is still a face
  // that was flattened, and the end-of-fight reading would miss it.
  let flattened = false;
  let lowEnergy = false;
  while (!ep.done) {
    ep.step(FIXED_DT);
    for (let i = 0; i < ep.pirates.length; i++) {
      if (ep.pirates[i].alive) alive[i] += FIXED_DT;
    }
    if (her.sys.foreShield <= 0 || her.sys.aftShield <= 0) flattened = true;
    if (energyLow(her.sys.energy)) lowEnergy = true;
    rec.tick(FIXED_DT, sample);
  }

  const report = rec.report('timeout');
  const shipFrames = frames.reduce((a, b) => a + b, 0);
  // The report states its shares to three places over the whole fight's
  // ship-frames; the counts come back out of them against this file's own
  // denominator, so fights pool by weight rather than by averaging shares.
  const inRange = report.inRangeShare.them * shipFrames;
  const aimError = report.meanAimErrorDeg.them * shipFrames;
  return {
    seconds: report.seconds,
    warheads: ep.warheadsTaken,
    median: report.range.median,
    // Cumulative, and every cause: `damageTaken` is what she was billed, not
    // what is missing from her pools — which recharge, and that is the point.
    taken: her.damageTaken,
    flattened,
    destroyed: !her.alive,
    reachedLowEnergy: lowEnergy,
    attackersLost: ep.pirates.filter((p) => !p.alive).length,
    doing,
    attackers: ep.pirates.map((p, i) => ({
      hull: p.name,
      damagePerHit: setup.pirates[i].damagePerHit,
      frames: frames[i],
      linedUp: (report.opponents[i].linedUpShare ?? 0) * frames[i],
      // Pooled across the gang: `inRangeShare` and `meanAimErrorDeg` are stated
      // over all of them at once, so each ship carries its share of the total.
      inRange: shipFrames ? (inRange * frames[i]) / shipFrames : 0,
      aimError: shipFrames ? (aimError * frames[i]) / shipFrames : 0,
      aliveSeconds: alive[i],
      shots: p.shotsFired,
      hits: p.shotsHit,
      damage: p.damageDealt,
      passes: report.opponents[i].passes,
    })),
  };
}
