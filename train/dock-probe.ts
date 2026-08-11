// Does the docking computer still get in? — approaches flown, and how they end.
//
//   npm run dock-probe
//
// docs/TODO/126 changes HOW the autopilot flies: it produced no `FlightDemand`
// at all, writing `player.quaternion` through a shortest-arc slerp about an axis
// no stick can make. Replacing that with pitch and roll is the fix, and it is
// also the one change in this codebase that can quietly ruin the hardest thing
// in the game — the plan's own warning: "a demand-flown autopilot that misses
// the letterbox is a worse bug than the one being fixed."
//
// So the claim needs a NUMBER, before and after, and it needs to be the same
// number: this flies the shipped `WorldStep` — the real plan, the real slot
// test, the real bounce — from a spread of starting geometries, and reports how
// many of them end up docked and how long each took.
//
// WHAT IT SPREADS OVER, and why each matters:
//
//   bearing   WHERE THE SHIP STARTS, as an angle from the slot's own normal:
//             dead in front of the slot, out to the side, and DIRECTLY BEHIND
//             the station, at four azimuths around each. This replaced a grid
//             of four cardinal offsets on 2026-08-11 and it is the whole reason
//             docs/TODO/136 exists — every approach the probe had ever flown
//             began on the slot side, so the two worst defects in the approach
//             lived in a region nothing measured. "It docks 320/320" meant "it
//             docks from in front".
//   range     900 to 3,000 units out — inside the gate and well outside it, so
//             both approach phases are exercised from cold.
//   spin      the station turned before the run, so the slot is not in the same
//             place every time. A letterbox that only worked at one rotation
//             would otherwise pass every case.
//   facing    WHICH WAY THE SHIP IS POINTING when the computer takes over:
//             at the station, away from it, across, and the world -Z the probe
//             used to assume. Pointing AT the station is how Chris reproduced
//             the pitch oscillation, and it was not a case the probe could
//             express.
//
// 504 approaches. WHAT IT MEASURED, for docs/TODO/126: the old quaternion slerp
// docked 320/320, median 15.2s, worst 36.3s, 2 scrapes; the demand-flown
// autopilot docks 320/320, median 16.8s, worst 30.6s, 3 scrapes. Those are on
// the OLD grid, which flew only from the slot side, and they are kept for the
// record rather than for comparison — the grid changed on 2026-08-11.
//
// AND WHAT THOSE COLUMNS COULD NOT SEE (docs/TODO/134, GitHub #23): whether the
// ship rolls hard over and back the whole way in. Docking well and flying well
// are different claims, and only the first had a number — so the reversal
// columns are the second. An autopilot that reverses its roll 17 times in a
// median approach is oscillating however reliably it ends up on the pad.
//
//   before 134   320/320   median 16.8s   30.6s worst   3 scrapes
//                median 17 roll reversals, worst 29 · pitch 3 and 7 · 7 restarts
//   after        320/320   median 16.8s   25.2s worst   1 scrape
//                median  8 roll reversals, worst 15 · pitch 3 and 7 · 4 restarts
//
// The restart column is the one number here NOT to read too closely: on a second
// grid flown to check the fade angle it went the other way (17 to 24 on one
// setting, 17 to 17 on another) while the reversal medians agreed on both. It is
// a handful of approaches either side, not a trend.
//
// ON THE 504-APPROACH GRID, which is the one that runs now, docs/TODO/136 M2-M3
// replaced the reactive approach with a PATH and a follower on it:
//
//   before      504/504   median 19.4s   38.6s worst   1 scrape
//               roll: median 10 reversals, 1.2 turns swept · pitch 5 and 12
//               223 approaches jump over 20 degrees, worst 180.0
//   after       504/504   median 15.6s   30.8s worst   0 scrapes
//               roll: median 16 reversals, 1.7 turns swept · pitch 2 and 8
//               NO approach jumps over 20 degrees, worst 3.4
//
// Read the two roll columns together, which is why the second one was added. The
// plan column and the pitch column are the defect this item existed for, and
// they are gone: from directly astern the old approach reversed its plan through
// a half turn and pitched hard over ten times an approach, in 28 seconds; the
// path arrives in 16 with one pitch reversal and a plan that moves a degree.
// What went the other way is the ROLL, and it is the same ring in both — a
// ship holding a bank hunts around it at about a reversal a second, on a curve
// or on a dead-straight run in, in this version and the one before it. The path
// spends more of the approach banked, so it collects more of it. That ring is
// `dockingSticks`, not the plan, and it is the biggest thing left.
//
// The ship starts at rest in one of four attitudes (`Facing`), including the
// world -Z the old grid always assumed, which is deliberately unhelpful: the
// first thing most runs have to do is turn.

import * as THREE from 'three';

import { freshState } from '../src/game/state.ts';
import { newCommander } from '../src/game/commander.ts';
import { WorldStep, type StepHost } from '../src/game/world-step.ts';
import { Ordnance } from '../src/game/ordnance.ts';
import { seedWorld } from '../src/game/rng.ts';

/** Hands off the stick: the autopilot is the only pilot in these runs. */
const COAST = { rollRate: 0, pitchRate: 0, throttle: 0, fire: false };

/** Give up on a run after this long — a circling autopilot is a failed one. */
const PATIENCE_SECONDS = 120;

/**
 * A roll rate below this is an axis at rest, not a direction (rad/s). Without
 * it every crossing of zero on the way through a genuine roll would score as a
 * reversal, and the number would measure arithmetic rather than flying.
 */
const STILL_ENOUGH = 0.05;

interface Run {
  docked: boolean;
  seconds: number;
  /** scrapes: the hull box or a fluffed slot, each of which costs damage */
  bumps: number;
  /**
   * How many times the roll reversed direction — the number docs/TODO/134
   * exists for, and the one thing the first three columns cannot see. An
   * approach that docks perfectly while the ship rolls hard over and back all
   * the way in scores 320/320 above and is the bug reported as #23.
   */
  rollReversals: number;
  /** the same for pitch, which is the control on the same stick that behaves */
  pitchReversals: number;
  /**
   * How far the ship ROLLED in total, in turns — the integral of the rate, which
   * is the thing the reversal count above cannot see. The two answer different
   * questions and both are needed: a ship flying a curve has to hold a bank, and
   * a controller holding one rings around it, so a curved approach reverses more
   * often than a straight one however gently. What #23 actually was is a full
   * quarter turn each way at 1.3 rad/s; a two-degree wobble at the same
   * frequency scores the same in the column beside this one and is not the same
   * flying (docs/TODO/136).
   */
  rollSwept: number;
  /** run -> gate: an approach thrown far enough off the axis to start again */
  phaseDrops: number;
  /**
   * The largest the commanded HEADING moved in a single frame, in radians —
   * docs/TODO/135. The two columns above measure the ship's answer; this
   * measures the question, and the question was the one jumping: committing to
   * the run swapped an aim point 800 units OUT from the slot for the station
   * centre, which for a ship already inside the gate is a reversal. A plan that
   * teleports is flown at full stick, because `pitchOnto` saturates at 20
   * degrees of error and nothing in the loop damps what that builds up.
   */
  headingJump: number;
}

/** Where the ship points when the docking computer takes over. */
type Facing = 'at' | 'away' | 'across' | 'world';

function approach(
  seed: number, bearing: THREE.Vector3, out: number, spin: number, facing: Facing,
): Run {
  seedWorld(seed);
  const state = freshState(newCommander());
  state.world.build(state.systems[state.commander.systemIndex]);
  let docked = false;
  let bumps = 0;
  const host: StepHost = {
    inFlight: () => !docked,
    applyPlayerDamage: () => { bumps += 1; },
    destroyNpc: () => {}, wreckNpc: () => {}, fireLaser: () => {},
    raiseLegal: () => {}, die: () => {}, dock: () => { docked = true; },
    completeHyperspace: () => {}, completeRescue: () => {},
    openHermitTrade: () => {}, autoSave: () => {},
  };
  const step = new WorldStep(state, new Ordnance(state.world), host);

  const station = state.world.station;
  station.rotateZ(spin);
  station.updateMatrixWorld(true);
  // `bearing` is given in the STATION's frame, with -Z the slot normal, so a
  // case means the same thing whatever the spin is.
  const from = bearing.clone().applyQuaternion(station.quaternion).normalize();
  state.player.position.copy(station.position).addScaledVector(from, out);

  const toStation = new THREE.Vector3().subVectors(station.position, state.player.position)
    .normalize();
  const look = new THREE.Vector3();
  if (facing === 'at') look.copy(toStation);
  else if (facing === 'away') look.copy(toStation).negate();
  else if (facing === 'across') {
    look.crossVectors(toStation, new THREE.Vector3(0, 1, 0));
    if (look.lengthSq() < 1e-9) look.set(1, 0, 0);
    look.normalize();
  } else look.set(0, 0, -1);
  state.player.quaternion.setFromRotationMatrix(
    new THREE.Matrix4().lookAt(new THREE.Vector3(), look, new THREE.Vector3(0, 1, 0)));
  state.player.speed = 0;
  state.session.dcEngaged = true;

  const dt = 1 / 60;
  let frames = 0;
  let rollReversals = 0;
  let pitchReversals = 0;
  let phaseDrops = 0;
  let rollSwept = 0;
  let lastRoll = 0;
  let lastPitch = 0;
  let lastPhase = state.dockPlan.phase;
  let headingJump = 0;
  const lastHeading = new THREE.Vector3();
  let haveHeading = false;
  /** The last direction an axis was MOVING in, held across a coast. */
  const reversed = (rate: number, last: number): boolean =>
    Math.abs(rate) >= STILL_ENOUGH && last !== 0 && Math.sign(rate) !== last;

  for (; frames < PATIENCE_SECONDS * 60 && !docked; frames++) {
    // An empty sky every frame: this measures the autopilot, not a dogfight.
    // (The station's own traders spawn and dock, and a Viper on the pad would
    // be a collision the probe would score against the approach.)
    state.world.clearNpcs();
    step.step(dt, frames * dt, { demand: COAST, handsOn: false });

    // The rates the ship is actually flying, which is what the pilot sees out
    // of the window — not the sticks, so a command that the envelope never
    // gets round to flying is not counted against it.
    rollSwept += Math.abs(state.player.rollRate) * dt;
    if (reversed(state.player.rollRate, lastRoll)) rollReversals += 1;
    if (Math.abs(state.player.rollRate) >= STILL_ENOUGH) {
      lastRoll = Math.sign(state.player.rollRate);
    }
    if (reversed(state.player.pitchRate, lastPitch)) pitchReversals += 1;
    if (Math.abs(state.player.pitchRate) >= STILL_ENOUGH) {
      lastPitch = Math.sign(state.player.pitchRate);
    }
    if (lastPhase === 'run' && state.dockPlan.phase === 'gate') phaseDrops += 1;
    lastPhase = state.dockPlan.phase;

    // The plan the step just flew — `state.dockPlan` is the live object
    // `planDocking` wrote this frame, so this is the question the ship was
    // asked, read after the answer.
    if (haveHeading) {
      headingJump = Math.max(headingJump, lastHeading.angleTo(state.dockPlan.heading));
    }
    lastHeading.copy(state.dockPlan.heading);
    haveHeading = true;
  }
  return {
    docked, seconds: frames / 60, bumps, rollReversals, pitchReversals, phaseDrops,
    headingJump, rollSwept: rollSwept / (2 * Math.PI),
  };
}

/**
 * Start bearings in the station's own frame, as (angle from the slot normal,
 * azimuth around it). -Z is the slot normal, so 0 degrees is dead in front of
 * the letterbox and 180 is directly behind the station.
 *
 * Four azimuths on every ring that has one, because the slot is a LETTERBOX:
 * coming at it from above is not the same problem as coming at it from the side,
 * and the roll needed to fit differs by a quarter turn between them.
 */
const BEARINGS: [string, THREE.Vector3][] = [];
for (const polar of [0, 45, 90, 135, 180]) {
  const rad = polar * Math.PI / 180;
  const azimuths = polar === 0 || polar === 180 ? [0] : [0, 90, 180, 270];
  for (const az of azimuths) {
    const a = az * Math.PI / 180;
    // -Z is the slot normal; X and Y are the slot's across and along
    BEARINGS.push([
      `${String(polar).padStart(3)}°${polar === 0 || polar === 180 ? '    ' : `/${String(az).padStart(3)}°`}`,
      new THREE.Vector3(
        Math.sin(rad) * Math.cos(a), Math.sin(rad) * Math.sin(a), -Math.cos(rad)),
    ]);
  }
}

const FACINGS: Facing[] = ['at', 'away', 'across', 'world'];

const cases = BEARINGS.flatMap(([name, dir]) =>
  [900, 2_000, 3_000].flatMap((out) =>
    [0, 0.9, 2.2].flatMap((spin) =>
      FACINGS.map((facing) => ({
        label: `${name} · ${String(out).padStart(4)} out · spin ${spin} · facing ${facing}`,
        bearing: dir,
        out,
        spin,
        facing,
      })))));

let docked = 0;
let scrapes = 0;
let drops = 0;
const times: number[] = [];
const rolls: number[] = [];
const pitches: number[] = [];
const jumps: number[] = [];
const swept: number[] = [];
const deg = (rad: number): number => rad * 180 / Math.PI;
for (const [i, c] of cases.entries()) {
  const r = approach(90_100 + i, c.bearing, c.out, c.spin, c.facing);
  if (r.docked) { docked += 1; times.push(r.seconds); }
  scrapes += r.bumps;
  if (r.phaseDrops > 0) drops += 1;
  rolls.push(r.rollReversals);
  pitches.push(r.pitchReversals);
  jumps.push(deg(r.headingJump));
  swept.push(r.rollSwept);
  console.log(`${r.docked ? 'DOCKED' : 'FAILED'} ${r.seconds.toFixed(1).padStart(6)}s`
    + ` · ${String(r.bumps).padStart(2)} scrape(s)`
    + ` · ${String(r.rollReversals).padStart(3)} roll rev`
    + ` · ${String(r.pitchReversals).padStart(3)} pitch rev`
    + ` · ${r.rollSwept.toFixed(1).padStart(4)} turns rolled`
    + ` · ${deg(r.headingJump).toFixed(0).padStart(3)}° jump · ${c.label}`);
}
const median = (xs: number[]): number => xs.slice().sort((a, b) => a - b)[xs.length >> 1];
const worst = (xs: number[]): number => Math.max(...xs);
times.sort((a, b) => a - b);
console.log(`\n${docked}/${cases.length} docked · median ${
  times.length ? times[times.length >> 1].toFixed(1) : '—'}s · ${
  times.length ? times[times.length - 1].toFixed(1) : '—'}s worst · ${scrapes} scrapes`);
console.log(`roll swept: median ${median(swept).toFixed(1)} turns`
  + ` · worst ${worst(swept).toFixed(1)}`);
console.log(`roll reversals: median ${median(rolls)} · worst ${worst(rolls)}`
  + ` · pitch: median ${median(pitches)} · worst ${worst(pitches)}`
  + ` · ${drops} run(s) fell back to the gate`);
console.log(`the plan's own heading jumps: median ${median(jumps).toFixed(1)}°`
  + ` · worst ${worst(jumps).toFixed(1)}° in one frame`
  + ` · ${jumps.filter((j) => j > 20).length} approach(es) over 20°`);
