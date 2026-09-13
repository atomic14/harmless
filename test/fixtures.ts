// Fixtures that more than one test file needs.
//
// The bar for putting something here is that two files genuinely share it, not
// that it looks reusable — a fixture nobody else uses belongs beside its tests,
// where you can read it and the assertion together. Everything here earned its
// place by being referenced from at least two of the files.
//
// `check` and the counters are in harness.ts; this is data.

import { readFileSync } from 'node:fs';
import { generateGalaxy } from '../src/galaxy/galaxy.ts';
import {
  genomeSize, randomBrain,
  DEFEND_OBS_SIZE, DEFEND_OUT_SIZE, HIDDEN,
} from '../src/ai-training/policy.ts';
import { makeRng } from '../src/game/rng.ts';
import { FIXED_DT } from '../src/constants/world-clock.ts';
import { CONSTRICTOR_SPEC } from '../src/game/ship-specs.ts';
import { emptyMissionState } from '../src/missions/state.ts';
import type { CommanderFacts, MissionEffect, MissionState, Skeleton } from '../src/missions/model.ts';
import { stepMissions, type MissionContext } from '../src/missions/machine.ts';
import { canAccept } from '../src/missions/offers.ts';

/**
 * Galaxy 1: the canonical universe, and the most-shared fixture in the suite.
 *
 * Generated rather than stored, which is the whole point — if the generator
 * drifts, every test built on this one starts failing at once, and that is a
 * better alarm than a fixture file that would quietly keep agreeing with itself.
 */
export const g1 = generateGalaxy(1);

/**
 * The world's own slice. Tests step at the rate the game steps at; a test that
 * used its own dt would be measuring a world that does not exist, which is the
 * mistake the trainer made for fifteen training runs.
 */
export const DT = FIXED_DT;

export const BRAINS = new URL('../src/ai-training/brains/', import.meta.url).pathname;

/**
 * brains.ts's source, for the gates that hold the weights DIRECTORY to what
 * the file imports. Since 2026-08-05 that is NOTHING — the trained defence
 * line followed the trained pirates out of the bundle (docs/TRAINING-LOG.md
 * runs 20-21) — and the empty directory is itself the asserted claim.
 */
export const brainsSrc = readFileSync(
  new URL('../src/game/brains.ts', import.meta.url), 'utf8');

/**
 * A defence-SHAPED genome, deterministic, for every test whose subject is the
 * machinery a defence brain flies through — brainFly's clocks, the snapshot,
 * the encoder plumbing — none of which cares what the weights say. It stood
 * on the shipped `jameson-defend-*` weights until the line was discarded;
 * what those tests were ever pinning was the SHIP's behaviour, so a seeded
 * random genome of the right shape carries them.
 */
export const defendShaped = randomBrain(
  makeRng(0xdefe4d), DEFEND_OBS_SIZE, HIDDEN, 0.5, DEFEND_OUT_SIZE);

/**
 * A defence genome that ALWAYS asks for the E.C.M. — the yes/no biases of the
 * thirteenth head forced apart, everything else `defendShaped`'s own weights.
 * What the missile tests pin is the mechanism (the head reaches `fireEcm`,
 * the gate needs a warhead, the press costs a quarter of the bank), and that
 * must not depend on whether some particular training run learned to press.
 */
export const ecmPresser = (() => {
  const b = randomBrain(makeRng(0xdefe4d), DEFEND_OBS_SIZE, HIDDEN, 0.5, DEFEND_OUT_SIZE);
  const biasBase = genomeSize(DEFEND_OBS_SIZE, b.hidden, DEFEND_OUT_SIZE) - DEFEND_OUT_SIZE;
  b.weights[biasBase + 11] = -50; // ecm-no
  b.weights[biasBase + 12] = 50;  // ecm-yes
  return b;
})();

/**
 * A commander's mission record with the Constrictor live at one leg.
 *
 * Four files put her on the hunt or the courier run by hand: the chart, the
 * blueprint override, the standing orders and the trainer's career check. A
 * record built here has the shape the machine writes: the live leg, its tag,
 * the tagged entity, and the acceptance in the journal. A test that needs the
 * machine's own placement accepts through `runMissions` instead.
 */
export function constrictorAt(
  leg: 'hunt' | 'report' | 'courier', target: number | null,
): MissionState {
  const st = emptyMissionState();
  const tag = leg === 'hunt' ? 'constrictor#1#hunt' : null;
  st.live.push({ skeleton: 'constrictor', leg, target, tag, progress: 0, deadlineDay: null });
  st.journal.push({ skeleton: 'constrictor', leg: 'hunt', outcome: 'accepted', day: 0, world: 7 });
  if (tag) {
    st.entities[tag] = { kind: 'ship', ship: CONSTRICTOR_SPEC.designId, hull: 1, lastWorld: target ?? 7, alive: true };
  }
  return st;
}

// --- a commander on a side job, for the verb and the company tests ----------
//
// They lived in test/mission-verbs.test.ts until docs/TODO/214 M3 pushed it
// over the size ceiling, and test/mission-company.test.ts needs the same
// four. A second copy would be two fixtures that drift.

/** The facts a mission rule reads, at Lave with scoops fitted, unless `over` says otherwise. */
export const facts = (over: Partial<CommanderFacts> = {}): CommanderFacts => ({
  galaxy: 1, systemIndex: 7, kills: 0, combatScore: 0, legalStatus: 0, scoops: true, day: 0, cargo: [], ...over,
});

/** What a step paid, in tenths. */
export const paid = (effects: MissionEffect[]): number =>
  effects.reduce((sum, e) => sum + (e.kind === 'pay' ? e.tenths : 0), 0);

/** A world whose board carries `job`, and a context standing there. */
export function boardFor(job: Skeleton, over: Partial<CommanderFacts> = {}): MissionContext {
  // A Poor commander, so a job the board gates by kills is on some board
  // (docs/TODO/217 M2). A test about the gate passes its own kills.
  const blooded = { kills: 16, ...over };
  const world = g1.find((s) => canAccept(emptyMissionState(), job.id,
    { commander: facts({ systemIndex: s.index, ...blooded }), skeletons: [job], systems: g1 }))!;
  return { commander: facts({ systemIndex: world.index, ...blooded }), systems: g1, rng: () => 0.5, skeletons: [job] };
}

/** The same context, moved to another world. */
export const moved = (ctx: MissionContext, systemIndex: number, over: Partial<CommanderFacts> = {}): MissionContext =>
  ({ ...ctx, commander: { ...ctx.commander, systemIndex, ...over } });

/** The record after `job` is accepted in `ctx`. */
export const accept = (job: Skeleton, ctx: MissionContext): MissionState =>
  stepMissions(emptyMissionState(), { kind: 'accept', skeleton: job.id }, ctx).state;
