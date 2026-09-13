// The company a job keeps: the pirates on a lane, the ones that wait at the
// jump-in, the pair beside a charge, and the ambush a scoop springs
// (docs/TODO/203 M2, docs/TODO/214).
//
// Every one of them is scenery with a gun. The tags answer nothing in the
// machine, and a kill among them settles no branch. These blocks read what a
// leg asks the arrival and the scoop to spawn. The real-game half, where the
// ships appear in the sky, is test/mission-courses.test.ts.
//
// They left test/mission-verbs.test.ts when docs/TODO/214 M3 pushed it over
// the size ceiling.

import { stepMissions, type MissionContext } from '../src/missions/machine.ts';
import { missionSpawns } from '../src/missions/queries.ts';
import type { MissionEffect } from '../src/missions/model.ts';
import {
  SIDE_AMBUSH, SIDE_DELIVER, SIDE_ESCORT, SIDE_HUNT, SIDE_RECOVER, SIDE_RESCUE, SIDE_SCAN,
} from '../src/missions/skeletons/side.ts';
import { LANE_PIRATES } from '../src/missions/skeletons/lane.ts';
import { ESCORT_LEASH } from '../src/constants/mission-course.ts';
import { accept, boardFor, facts, g1, moved } from './fixtures.ts';
import { check, eq } from './harness.ts';

console.log('\npirates wait at the jump-in (docs/TODO/214 M1)');
{
  // Chris, 2026-09-13: "there are pirates waiting for you when you jump in".
  const hctx = boardFor(SIDE_HUNT);
  const hst = accept(SIDE_HUNT, hctx);
  const at = missionSpawns(hst, hst.live[0].target as number);
  eq('a side hunt spawns the Krait and a wingman', at.length, 2);
  check('...both flown as pirates', at.every((s) => s.job === 'hunt'));
  check('...and only the target answers to the leg', at.filter((s) => s.tag === hst.live[0].tag).length === 1);
  const dctx = boardFor(SIDE_DELIVER);
  const dst = accept(SIDE_DELIVER, dctx);
  eq('a delivery meets a pair at the far end', missionSpawns(dst, dst.live[0].target as number).length, 2);
  eq('...and nothing at the world it was taken at', missionSpawns(dst, dctx.commander.systemIndex).length, 0);
  const rctx = boardFor(SIDE_RECOVER);
  const rst = accept(SIDE_RECOVER, rctx);
  eq('a canister adrift has one Krait circling it', missionSpawns(rst, rst.live[0].target as number).length, 1);
  const sctx = boardFor(SIDE_SCAN);
  const sst = accept(SIDE_SCAN, sctx);
  eq('a scan meets nobody but its subject', missionSpawns(sst, sst.live[0].target as number).length, 1);
}

console.log('\nan escort keeps company (docs/TODO/214 M3)');
{
  const ectx = boardFor(SIDE_ESCORT);
  const est = accept(SIDE_ESCORT, ectx);
  const at = missionSpawns(est, est.live[0].target as number);
  eq('a side escort meets the charge and a pair', at.length, 3);
  eq('...one of them the charge, flown as an escort', at.filter((s) => s.job === 'escort').length, 1);
  check('the leash is outside the escort standoff and inside the scanner', ESCORT_LEASH > 600 && ESCORT_LEASH < 6000);
}

console.log('\na scoop springs an ambush, and so does the end of a scan (docs/TODO/214 M2)');
{
  // Chris, 2026-09-13: "collecting a canister triggers an ambush".
  const spawned = (effects: MissionEffect[]): number =>
    effects.reduce((n, e) => n + (e.kind === 'spawn' ? e.ships.length : 0), 0);
  const rctx = boardFor(SIDE_RECOVER);
  const rst = accept(SIDE_RECOVER, rctx);
  const scooped = stepMissions(rst, { kind: 'scooped', tag: rst.live[0].tag as string }, moved(rctx, rst.live[0].target as number));
  eq('the canister scooped asks the game for the pair', spawned(scooped.effects), 2);
  check('...and says so, behind the leg\'s own line',
    scooped.effects.some((e) => e.kind === 'later' && e.text === SIDE_RECOVER.legs[0].ambush?.say));
  eq('...and the leg still moved on', scooped.state.live[0]?.leg, 'home');
  const pctx = boardFor(SIDE_RESCUE);
  const pst = accept(SIDE_RESCUE, pctx);
  eq('the pod scooped asks for the Krait',
    spawned(stepMissions(pst, { kind: 'scooped', tag: pst.live[0].tag as string }, moved(pctx, pst.live[0].target as number)).effects), 1);
  const sctx = boardFor(SIDE_SCAN);
  const sst = accept(SIDE_SCAN, sctx);
  eq('the scan done asks for the escort', spawned(stepMissions(sst, { kind: 'scanned', tag: sst.live[0].tag as string }, sctx).effects), 2);
  eq('...and a subject destroyed springs nothing',
    spawned(stepMissions(sst, { kind: 'destroyed', tag: sst.live[0].tag as string }, sctx).effects), 0);
  const dctx = boardFor(SIDE_DELIVER);
  const dst = accept(SIDE_DELIVER, dctx);
  eq('a delivery has no ambush to spring',
    spawned(stepMissions(dst, { kind: 'docked' }, moved(dctx, dst.live[0].target as number)).effects), 0);
}

console.log('\nambush: the lane has pirates while the leg is live (docs/TODO/203 M2)');
{
  const ctx: MissionContext = { commander: facts(), systems: g1, rng: () => 0.5, skeletons: [SIDE_AMBUSH] };
  const st = accept(SIDE_AMBUSH, ctx);
  const target = st.live[0].target as number;
  eq('the lane job spawns the lane pirates at its world',
    JSON.stringify(missionSpawns(st, target, [SIDE_AMBUSH])), JSON.stringify(LANE_PIRATES));
  check('...all flown as pirates', LANE_PIRATES.every((p) => p.job === 'hunt'));
  eq('...and none anywhere else', missionSpawns(st, (target + 1) % g1.length, [SIDE_AMBUSH]).length, 0);
  const done = stepMissions(stepMissions(st, { kind: 'arrived' }, { ...ctx, commander: facts({ systemIndex: target }) }).state,
    { kind: 'docked' }, { ...ctx, commander: facts({ systemIndex: target }) }).state;
  eq('...and they are gone once the lane is cleared', missionSpawns(done, target, [SIDE_AMBUSH]).length, 0);
}
