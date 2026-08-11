// Time on aim: what an attacker's gun is actually WORTH, against what it could
// be worth if it never missed a gate — the number `constants/npc-gun.ts` states
// from memory and nothing measures.
//
//   node --experimental-strip-types train/aim-probe.ts [episodes] [seed base]
//   npm run aim-probe
//
// `npc-gun.ts` said, beside the cooldown it justifies, that "a pirate is only
// inside the firing gate for about 5% of a fight, so it is waiting to be aimed,
// not waiting on the cooldown". That was a comment, not a measurement, and
// docs/TODO/139 turns on it: the best case an attacker can ever have — point
// blank, the capped hit chance, never out of the gate — is at or under
// `SHIELD_REGEN` for fourteen of the seventeen builds in the pirate roster, so
// what the gun is worth at REAL time on aim decides whether a fight can go
// anywhere at all. This tool measures the gap between the two.
//
// THE FIGHT IT FLIES IS `train/aim-fight.ts`, and every question about what a
// column means is answered there: the two ways she flies, the two pilots they
// fly, which numbers are the game recorder's and which are the fight's own, and
// what is NOT in the laser columns. This file is the grid and the tables.
//
// ## The three tables
//
// IS IT AIMED AT HER — the aim half, per pilot, per gang, per behaviour: how
// much of the fight it spent inside its own gate and in range, how far off her
// its nose sat, how many merges it completed and how many shots it got away
// against the cadence's own ceiling.
//
// WHAT THE GUN IS WORTH — the damage half. Effective points a second against
// BEST CASE: this build's own tabulated damage against this hull, at
// `npcHitChance(0)` over the mean reload, derived from the pack and the
// constants rather than restated, so a retune moves the column with it. Beside
// it, the three causes she can be billed by, because the laser is not what a
// fight costs her — and survivability's two outcome columns, so a row here and
// a row there can be read against each other.
//
// BY BUILD — the same comparison for each of the seventeen builds the roster
// can send, which is the table docs/TODO/139 argues from, re-derived rather
// than quoted.
//
// A pilot that never lines up and one that lines up and cannot hurt you are
// different defects with different fixes (139 M3), and one number cannot tell
// them apart. That is why the aim and the damage are separate tables.

import {
  MAX_TIME, PILOTS, TARGETS, flyAimFight,
  type Attacker, type Pilot, type Target,
} from './aim-fight.ts';
import { quantile } from '../src/game/combat-sim-report.ts';
import { npcHitChance } from '../src/game/gunnery.ts';
import { NPC_COOLDOWN_LO, NPC_COOLDOWN_SPREAD } from '../src/constants/npc-gun.ts';
import { PASS_CLOSE, PASS_FAR } from '../src/constants/combat-record.ts';
import { IMPACT } from '../src/constants/impact.ts';
import { SHIELD_REGEN } from '../src/constants/recharge.ts';

/**
 * Held out, and distinct from every other base in the project (survivability's
 * 918,273, flight-probe's 30,000,007, ram-probe's 40,000,009, evaluate's
 * 10,000,019, evolve's 5,000,011). Overridable on the command line so the same
 * table can be taken again on an independent grid — 137's rule, and the one
 * that decides whether a difference is real.
 */
const AIM_BASE = 50_000_017;

const GANGS = [1, 2, 3, 4];

/**
 * The mean reload, which is what a best case spends between shots — the LO plus
 * half the spread, because `npcTriggerPull` draws uniformly across it.
 */
export const MEAN_COOLDOWN = NPC_COOLDOWN_LO + NPC_COOLDOWN_SPREAD / 2;

/** Shots a minute a gun could manage if it were never out of the gate. */
const CADENCE_CEILING = 60 / MEAN_COOLDOWN;

/** A pooled cell: an `Attacker`'s fields, added up across ships and fights. */
type Cell = Omit<Attacker, 'hull' | 'damagePerHit'> & {
  /** best-case points a second, weighted by the seconds each build flew */
  bestSeconds: number;
  ships: number;
  episodeSeconds: number;
  /**
   * One median range per FIGHT, and the table takes the median of them. Pooling
   * every frame's range instead would be eight million numbers for a figure
   * nobody reads to three places, and averaging medians would let one chase
   * that never closed drag a knife fight's row out with it.
   */
  medians: number[];
  /**
   * Every point she lost, by every cause — laser, warhead and contact — because
   * the laser columns beside it are not what a fight costs her. It is the
   * quantity docs/TODO/139 M2 has to move; the split is under the table.
   */
  allDamage: number;
  warheads: number;
  /** fights in this cell, and the two outcomes survivability's rows report */
  fights: number;
  flattened: number;
  destroyed: number;
};

const blank = (): Cell => ({
  frames: 0, linedUp: 0, inRange: 0, aimError: 0, aliveSeconds: 0,
  shots: 0, hits: 0, damage: 0, passes: 0, bestSeconds: 0, ships: 0,
  episodeSeconds: 0, medians: [], allDamage: 0, warheads: 0,
  fights: 0, flattened: 0, destroyed: 0,
});

/** What this build could do at 100% time on aim, point blank — the plan's table. */
export const bestCase = (damagePerHit: number): number =>
  (damagePerHit * npcHitChance(0)) / MEAN_COOLDOWN;

function add(into: Cell, a: Attacker): void {
  into.frames += a.frames;
  into.linedUp += a.linedUp;
  into.inRange += a.inRange;
  into.aimError += a.aimError;
  into.aliveSeconds += a.aliveSeconds;
  into.shots += a.shots;
  into.hits += a.hits;
  into.damage += a.damage;
  into.passes += a.passes;
  into.bestSeconds += bestCase(a.damagePerHit) * a.aliveSeconds;
  into.ships += 1;
}

const pct = (n: number, d: number): string => (d ? `${((n / d) * 100).toFixed(1)}%` : '—');
const per = (n: number, d: number, dp = 2): string => (d ? (n / d).toFixed(dp) : '—');

// --- the run -----------------------------------------------------------------

/**
 * Fly the whole grid and print it.
 *
 * Behind a main-module guard, and every probe here learnt that the hard way in
 * two different directions: `train/flight-probe.ts` documented a command line
 * it did not have and printed NOTHING when it was run, and `train/ram-probe.ts`
 * has a test beside it that must be able to import its helpers without flying
 * 3,200 episodes on the import.
 */
function main(episodes: number, base: number): void {
  const cells = new Map<string, Cell>();
  const builds = new Map<string, Cell & { damagePerHit: number }>();
  let warheads = 0;

  for (const target of TARGETS) {
    for (const pilot of PILOTS) {
      for (const gang of GANGS) {
        const cell = blank();
        for (let e = 0; e < episodes; e++) {
          const fight = flyAimFight(pilot, target, gang, base + e * 7919);
          cell.episodeSeconds += fight.seconds;
          if (fight.median !== null) cell.medians.push(fight.median);
          cell.allDamage += fight.taken;
          cell.warheads += fight.warheads;
          cell.fights += 1;
          if (fight.flattened) cell.flattened += 1;
          if (fight.destroyed) cell.destroyed += 1;
          warheads += fight.warheads;
          for (const a of fight.attackers) {
            add(cell, a);
            // The by-build table is the SHIPPED pilot's, in the fight she can be
            // caught in: mixing a chase in would average two flights into one row.
            if (pilot !== 'pursuit' || target.label !== 'knife-fights') continue;
            const b = builds.get(a.hull)
              ?? { ...blank(), damagePerHit: a.damagePerHit };
            add(b, a);
            builds.set(a.hull, b);
          }
        }
        cells.set(`${target.label}:${pilot}:${gang}`, cell);
      }
    }
  }

  /** Every row of the grid, in the order the tables print it. */
  const grid: [Target, Pilot, number, Cell][] = TARGETS.flatMap(
    (t) => PILOTS.flatMap(
      (p) => GANGS.map((g) => [t, p, g, cells.get(`${t.label}:${p}:${g}`)!] as
        [Target, Pilot, number, Cell])));

  console.log(`\n${episodes} episodes per row · ${MAX_TIME}s · seed base ${base}`);
  console.log('a fitted commander in her own Cobra, flying back —'
    + ' train/aim-fight.ts is the fight\n');

  console.log('## is it aimed at her?\n');
  console.log('| she | pilot | gang | median range | lined up | in range | aim error |'
    + ' passes/ship | shots/pass | shots/min/ship |');
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const [t, pilot, gang, c] of grid) {
    console.log(`| ${t.label} | ${pilot} | ${gang} |`
      + ` ${(quantile(c.medians, 0.5) ?? 0).toFixed(0)} |`
      + ` ${pct(c.linedUp, c.frames)} | ${pct(c.inRange, c.frames)} |`
      + ` ${per(c.aimError, c.frames, 1)}° | ${per(c.passes, c.ships)} |`
      // Shots PER PASS needs a pass to divide by: a chase nobody closes in scores
      // fewer than one per ship, and the ratio there is arithmetic on noise —
      // 3,865 shots a pass says the denominator was two, not that anyone fired.
      + ` ${c.passes >= c.ships ? per(c.shots, c.passes, 1) : '—'} |`
      + ` ${per(c.shots * 60, c.aliveSeconds, 1)} |`);
  }
  console.log('\nlined up = inside its own gate AND its own range, over the ship-frames it');
  console.log(`was alive for. shots/min/ship has a ceiling of ${CADENCE_CEILING.toFixed(1)} —`
    + ' the mean reload, never');
  console.log('out of the gate: the two columns move together, so the gate is the limit.');
  console.log(`a pass is a merge inside ${PASS_CLOSE} and back out past ${PASS_FAR}`
    + ' (constants/combat-record.ts),');
  console.log('and a fight nobody closes in scores none — which is a reading, not a blank.');

  console.log('\n## what the gun is worth\n');
  console.log('| she | pilot | gang | hit rate | best case | effective | of best |'
    + ' gang laser | warheads | contact | all causes | a face down | destroyed |');
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'
    + ' --- | --- |');
  for (const [t, pilot, gang, c] of grid) {
    const best = c.aliveSeconds ? c.bestSeconds / c.aliveSeconds : 0;
    const effective = c.aliveSeconds ? c.damage / c.aliveSeconds : 0;
    // The three causes the world can bill her, and nothing else can: the laser
    // is tallied, the warheads are counted, and what is left is contact.
    const warheadPoints = c.warheads * IMPACT.warhead.commander;
    const contact = c.allDamage - c.damage - warheadPoints;
    console.log(`| ${t.label} | ${pilot} | ${gang} | ${pct(c.hits, c.shots)} |`
      + ` ${best.toFixed(2)}/s | ${effective.toFixed(2)}/s | ${pct(effective, best)} |`
      + ` ${per(c.damage, c.episodeSeconds).padStart(5)}/s |`
      + ` ${per(warheadPoints, c.episodeSeconds).padStart(5)}/s |`
      + ` ${per(contact, c.episodeSeconds).padStart(5)}/s |`
      + ` ${per(c.allDamage, c.episodeSeconds).padStart(5)}/s |`
      + ` ${pct(c.flattened, c.fights)} | ${pct(c.destroyed, c.fights)} |`);
  }
  console.log('\nbest case = this build\'s own tabulated damage at point-blank hit chance');
  console.log('over the mean reload — 100% time on aim. effective = the same points at the');
  console.log('aim it actually got. gang laser is all of their guns together, against a');
  console.log(`SHIELD_REGEN of ${SHIELD_REGEN.toFixed(3)} points a second PER FACE: that`
    + ' comparison is what');
  console.log('docs/TODO/139 is about, and it is the last four columns that have to move.');
  console.log('\nthe three causes are every way the world can bill her: the laser is tallied'
    + ' shot');
  console.log(`by shot, a warhead is ${IMPACT.warhead.commander} points`
    + ` (${warheads} landed across the run), and contact is what`);
  console.log('is left. the aim columns above describe the FIRST of the three only — which');
  console.log('is the point: read them beside the split, not instead of it.');
  console.log('\na face down and destroyed are train/survivability.ts\'s two outcome columns,');
  console.log('watched its way — every step, because a face that was flattened and came');
  console.log('back is still a face that was flattened. they are here so that a fight this');
  console.log('tool stages and a row that tool prints can be read against each other.');

  console.log('\n## by build — the shipped pilot, in the fight she can be caught in\n');
  console.log('| build | points/hit | lined up | shots/min | hit rate | best case |'
    + ' effective | of best |');
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- |');
  const rows = [...builds.entries()]
    .sort((a, b) => bestCase(b[1].damagePerHit) - bestCase(a[1].damagePerHit));
  for (const [hull, c] of rows) {
    const best = bestCase(c.damagePerHit);
    const effective = c.aliveSeconds ? c.damage / c.aliveSeconds : 0;
    console.log(`| ${hull} | ${c.damagePerHit} | ${pct(c.linedUp, c.frames)} |`
      + ` ${per(c.shots * 60, c.aliveSeconds, 1)} | ${pct(c.hits, c.shots)} |`
      + ` ${best.toFixed(2)}/s | ${effective.toFixed(2)}/s | ${pct(effective, best)} |`);
  }
  console.log('\nthe best-case column is docs/TODO/139\'s table, re-derived from the pack');
  console.log('and the constants rather than restated; the effective column beside it is');
  console.log('what that build managed against a commander who was flying back.\n');
}

const isMain = process.argv[1]?.endsWith('aim-probe.ts') ?? false;
if (isMain) {
  main(Number(process.argv[2]) || 200, Number(process.argv[3]) || AIM_BASE);
}
