// Evaluation tournament: HOW WE TELL THE TRAINING WORKED.
//
//   node --experimental-strip-types train/evaluate.ts [episodes]
//
// NOTHING TRAINED SHIPS (2026-08-05, `src/game/brain-names.ts`): the three
// trained policies were retired the day three retrains in a row optimised
// their way out of fighting, and `src/ai-training/brains/` is empty. The
// no-argument run therefore scores the CODE baselines and says so; it earns
// its keep again the day `train/evolve.ts` breeds a candidate and its stem is
// added to `CANDIDATES` below.
//
// Three principles:
//  1. HELD-OUT SEEDS — training uses seeds derived from gen*977+e*131+7
//     (max ≈ 400k). Evaluation uses seeds starting at 10,000,019, which the
//     optimiser has never seen. Good scores here mean the policy generalises,
//     not that it memorised its training episodes.
//  2. BASELINES — every candidate is scored alongside the scripted AI
//     and an untrained random policy on the SAME seeds. The interesting
//     number is the gap.
//  3. BEHAVIOUR METRICS, not just fitness — kill rate, time-to-kill,
//     accuracy, survival, pirate losses, and for packs the mean angular
//     spread of attackers at the moments shots land (the flanking measure).

import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import {
  Episode, type Controller, type EpisodeShip, type TargetHullId,
} from '../src/ai-training/scenario.ts';
import { randomBrain, brainFromFile, type Brain, type BrainFile } from '../src/ai-training/policy.ts';
import { makeRng } from '../src/game/rng.ts';
import { FIXED_DT } from '../src/constants/world-clock.ts';
import { printDesignSweep, printPlayerHullSweep } from './profile-sweep.ts';
import { printFlightShapes } from './flight-probe.ts';

const BRAINS_DIR = new URL('../src/ai-training/brains/', import.meta.url).pathname;
const N = Number(process.argv[2] ?? 60); // episodes per matchup
const HOLD_OUT_BASE = 10_000_019;
const DT = FIXED_DT;

function tryLoad(name: string): Brain | null {
  try {
    return brainFromFile(JSON.parse(readFileSync(`${BRAINS_DIR}${name}.json`, 'utf8')) as BrainFile);
  } catch {
    return null;
  }
}

/**
 * Every policy this tool will score, if its weights are on disk.
 *
 * It listed twenty names when twenty-odd experiments were committed; TODO 57
 * deleted all but the three the game then flew, and 2026-08-05 retired those
 * three too — so today it is empty, `src/ai-training/brains/` is empty, and
 * that is the resting state rather than an oversight. The `tryLoad`-plus-`if`
 * shape is what makes a missing file a skipped row rather than a crash.
 *
 * Comparing a new candidate is dropping its file in the directory and adding
 * the stem here: `pirate-attack-*` stems grow solo rows, `pirate-pack-*` pack
 * rows, `jameson-defend-*` defence rows.
 */
const CANDIDATES: readonly string[] = [];

const brains: Record<string, Brain | null> =
  Object.fromEntries(CANDIDATES.map((n) => [n, tryLoad(n)]));

const rng = makeRng(0xdead);
const randomPirate = randomBrain(rng);

interface Metrics {
  episodes: number;
  /**
   * THE HEADLINE, and it used to be a kill rate.
   *
   * TODO 29 put the episode's target on the commander's own three 255-point
   * pools, hit for the source rule's 9 to 21 points a time. Nothing kills her
   * inside forty-five seconds any more, so a kill rate reads 0 for every
   * policy including the scripted aimbot, and a column that is always zero
   * ranks nothing. This is the same quantity with the granularity restored:
   * the mean share of her pools an attacker took.
   */
  poolShare: number;
  killRate: number; // % episodes the trader died — kept, and now usually 0
  accuracy: number; // pirate shot accuracy %
  shots: number; // mean laser shots per episode, all attackers
  onSix: number; // mean seconds attackers spent on the target's six
  piratesLost: number; // mean per episode
  traderSurvivalTime: number; // mean seconds trader stayed alive
  flankSpread: number; // mean pairwise angular separation (deg) at hit moments (packs)
}

function runMatchup(
  makePirates: () => Controller[],
  trader: Controller,
  traderArmed: boolean,
  maxTime: number,
  traderClass?: TargetHullId,
): Metrics {
  let kills = 0;
  let hurt = 0;
  let shots = 0;
  let hits = 0;
  let lost = 0;
  let survival = 0;
  let tail = 0;
  let spreadSum = 0;
  let spreadCount = 0;

  for (let e = 0; e < N; e++) {
    const ep = new Episode({
      seed: HOLD_OUT_BASE + e * 7919,
      pirates: makePirates(),
      trader,
      traderArmed,
      traderClass,
      maxTime,
    });
    let traderDeathTime = maxTime;
    while (!ep.done) {
      const events = ep.step(DT);
      for (const ev of events) {
        if (ev.hit && ev.to === ep.trader) {
          const spread = pairwiseSpread(ep.pirates, ep.trader);
          if (spread !== null) {
            spreadSum += spread;
            spreadCount += 1;
          }
        }
      }
      if (!ep.trader.alive && traderDeathTime === maxTime) traderDeathTime = ep.t;
    }
    if (!ep.trader.alive) kills += 1;
    hurt += ep.targetDamageShare();
    tail += ep.tailTime.reduce((a, b) => a + b, 0);
    survival += traderDeathTime;
    for (const p of ep.pirates) {
      shots += p.shotsFired;
      hits += p.shotsHit;
      if (!p.alive) lost += 1;
    }
  }
  return {
    episodes: N,
    poolShare: (100 * hurt) / N,
    killRate: (100 * kills) / N,
    accuracy: shots ? (100 * hits) / shots : 0,
    shots: shots / N,
    onSix: tail / N,
    piratesLost: lost / N,
    traderSurvivalTime: survival / N,
    flankSpread: spreadCount ? spreadSum / spreadCount : NaN,
  };
}

/** Mean pairwise angle (deg) between attacker bearings as seen from the trader. */
function pairwiseSpread(pirates: EpisodeShip[], trader: EpisodeShip): number | null {
  const dirs = pirates.filter((p) => p.alive)
    .map((p) => new THREE.Vector3().subVectors(p.pos, trader.pos).normalize());
  if (dirs.length < 2) return null;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < dirs.length; i++) {
    for (let j = i + 1; j < dirs.length; j++) {
      sum += (dirs[i].angleTo(dirs[j]) * 180) / Math.PI;
      n += 1;
    }
  }
  return sum / n;
}

function row(name: string, m: Metrics): string {
  const f = (x: number, d = 1) => (Number.isNaN(x) ? '—' : x.toFixed(d));
  return `| ${name.padEnd(34)} | ${f(m.poolShare).padStart(5)}% | ${f(m.killRate, 0).padStart(4)}% | ` +
    `${f(m.accuracy, 0).padStart(4)}% | ${f(m.shots).padStart(5)} | ${f(m.onSix).padStart(6)}s | ` +
    `${f(m.piratesLost, 2).padStart(5)} | ${f(m.flankSpread, 0).padStart(5)} |`;
}

const header =
  '| matchup                            | hurt  | kill | acc  | shots | on-six | lost  | sprd° |\n' +
  '| --- | --- | --- | --- | --- | --- | --- | --- |';

console.log(`\nEvaluation tournament — ${N} held-out episodes per matchup (seed base ${HOLD_OUT_BASE})\n`);
if (CANDIDATES.length === 0) {
  console.log('NOTHING TRAINED LOADS. The three trained policies (pirate-attack-g3,');
  console.log('pirate-pack-r4-selectonly, jameson-defend-g2) were retired 2026-08-05 —');
  console.log('three retrains optimised their way out of fighting (docs/TODO/102, runs');
  console.log('20-21). The game flies code pilots only (src/game/brain-names.ts); the');
  console.log('rows below are those baselines. To score a candidate, put its weights in');
  console.log('src/ai-training/brains/ and add the stem to CANDIDATES in this file.\n');
}

// --- 1v1: pirates vs scripted trader ---------------------------------------
//
// The two BASELINES every figure in docs/TRAINING-LOG.md is read against — the
// scripted aimbot and an untrained network. It used to carry rows for the
// shipped brain and four superseded training rounds; the rounds are the log's
// business, their weights went in TODO 57, and the shipped brains went
// 2026-08-05.
console.log('## 1v1 vs scripted trader\n');
console.log(header);
console.log(row('scripted pirate (baseline)', runMatchup(() => [{ kind: 'scripted' }], { kind: 'scripted' }, false, 45)));
console.log(row('random policy (baseline)', runMatchup(() => [{ kind: 'policy', brain: randomPirate }], { kind: 'scripted' }, false, 45)));
for (const key of CANDIDATES.filter((n) => n.startsWith('pirate-attack'))) {
  const b = brains[key];
  if (b) {
    console.log(row(`${key} (candidate)`, runMatchup(() => [{ kind: 'policy', brain: b }], { kind: 'scripted' }, false, 45)));
  }
}

// --- packs of 3 --------------------------------------------------------------
// The gang against the trader every pack brain was trained on. The list is data
// so a candidate ablation slots in without a copy-pasted block.
const PACK_CANDIDATES: { label: string; key: string | null }[] = [
  { label: '3x scripted pirates', key: null },
  ...CANDIDATES.filter((n) => n.startsWith('pirate-pack'))
    .map((key) => ({ label: `${key} (candidate)`, key })),
];

function packSection(title: string, trader: Controller): void {
  console.log(`\n## pack of 3 vs ${title}\n`);
  console.log(header);
  for (const c of PACK_CANDIDATES) {
    if (c.key === null) {
      console.log(row(c.label, runMatchup(
        () => [{ kind: 'scripted' }, { kind: 'scripted' }, { kind: 'scripted' }],
        trader, true, 60)));
      continue;
    }
    const b = brains[c.key];
    if (!b) continue;
    console.log(row(c.label, runMatchup(
      () => [
        { kind: 'policy', brain: b },
        { kind: 'policy', brain: b },
        { kind: 'policy', brain: b },
      ], trader, true, 60)));
  }
}

// The training target for every pack brain in the table.
packSection('armed scripted trader (all packs trained on this)', { kind: 'scripted' });

// --- candidate against the code ceiling --------------------------------------
//
// The promotion decision, on one screen. Every row is the same fight on the
// same held-out seeds; the only thing that changes is the policy. Until 2026-08-05
// the reference rows were the shipped trained brains; the reference now is the
// scripted pilot, because that is what the game flies. Printed only when a
// candidate is under comparison — with none there is no decision to make, and
// the note at the top has already said why.
{
  const solo = CANDIDATES.filter((n) => n.startsWith('pirate-attack'))
    .map((key) => [`${key} (candidate)`, key] as [string, string]);
  if (solo.length) {
    for (const [title, trader, armed, hull] of [
      ['scripted hauler', { kind: 'scripted' } as Controller, false, undefined],
      ['a commander who fights back', { kind: 'holding' } as Controller, true, 'playerCobra'],
      ['a commander who runs', { kind: 'runner' } as Controller, false, 'playerCobra'],
    ] as const) {
      console.log(`\n## one pirate vs ${title}\n`);
      console.log(header);
      console.log(row('scripted pirate (aimbot ceiling)', runMatchup(
        () => [{ kind: 'scripted' }], trader, armed, 45, hull)));
      for (const [label, key] of solo) {
        const b = brains[key];
        if (b) {
          console.log(row(label, runMatchup(
            () => [{ kind: 'policy', brain: b }], trader, armed, 45, hull)));
        }
      }
    }
  }
  const packs = CANDIDATES.filter((n) => n.startsWith('pirate-pack'))
    .map((key) => [`${key} (candidate)`, key] as [string, string]);
  if (packs.length) {
    console.log('\n## a gang of three vs a commander who fights back\n');
    console.log(header);
    console.log(row('3x scripted pirates (baseline)', runMatchup(
      () => [{ kind: 'scripted' }, { kind: 'scripted' }, { kind: 'scripted' }],
      { kind: 'holding' }, true, 60, 'playerCobra')));
    for (const [label, key] of packs) {
      const b = brains[key];
      if (!b) continue;
      console.log(row(label, runMatchup(
        () => [0, 1, 2].map(() => ({ kind: 'policy', brain: b }) as Controller),
        { kind: 'holding' }, true, 60, 'playerCobra')));
    }
  }
  const defends = CANDIDATES.filter((n) => n.startsWith('jameson-defend'))
    .map((key) => [`${key} (candidate)`, key] as [string, string]);
  if (defends.length) {
    // Two SCRIPTED pirates on her tail — the shipped attack run, the same force
    // `train/defence-fight.ts` trains against. It was two trained pirates until
    // they were retired.
    console.log('\n## the defence policy: two scripted pirates on her tail\n');
    console.log(header);
    const twoScripted = (): Controller[] => [{ kind: 'scripted' }, { kind: 'scripted' }];
    console.log(row('scripted armed trader (floor)', runMatchup(
      twoScripted, { kind: 'scripted' }, true, 45, 'playerCobra')));
    for (const [label, key] of defends) {
      const b = brains[key];
      if (b) {
        console.log(row(label, runMatchup(
          twoScripted, { kind: 'policy', brain: b }, true, 45, 'playerCobra')));
      }
    }
    console.log('(here LOW "hurt" is the defender winning — it is her pools being spent)');
  }
}

// --- how it FLIES, which no score above can see ------------------------------
//
// `scripted` is what ships; a candidate in CANDIDATES gets a row here as well
// as in the tables above ("could not be probed" if its weights are not on disk).
printFlightShapes([
  'scripted', ...CANDIDATES,
], Math.max(12, Math.round(N / 2)));

// --- the catalogue, not the policies ----------------------------------------
printDesignSweep();
// The hull sweep flies a POLICY against every hull, so it needs weights; it ran
// on the shipped pirate until the retirement. One sweep per pirate candidate.
for (const key of CANDIDATES.filter((n) => n.startsWith('pirate-attack'))) {
  if (brains[key]) printPlayerHullSweep(key);
}

console.log('\nhurt = share of the commander\'s three pools taken · kill = she was destroyed');
console.log('acc = attacker accuracy · shots/on-six per episode · lost = attackers lost/episode');
