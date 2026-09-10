// The five verbs docs/TODO/190 M4 adds, each driven through the machine on
// its shipped side job, and the escort verdict through a real world step.
//
// A side job is a LOCAL job, on the boards the seed gives it. Each block
// finds a world whose board carries the job, so the test reads the same
// offer rule the desk reads (`offers.ts`).

import { stepMissions } from '../src/missions/machine.ts';
import type { MissionContext } from '../src/missions/machine.ts';
import { canAccept } from '../src/missions/offers.ts';
import { missionItems, missionSpawns, scanSecondsFor } from '../src/missions/queries.ts';
import { emptyMissionState } from '../src/missions/state.ts';
import type { CommanderFacts, MissionEffect, MissionState, Skeleton } from '../src/missions/model.ts';
import {
  SIDE_ESCORT, SIDE_HUNT, SIDE_RECOVER, SIDE_RESCUE, SIDE_SCAN, SIDE_SMUGGLE,
} from '../src/missions/skeletons/side.ts';
import {
  RESCUE_SALVAGE_PAY, SCAN_SECONDS, SIDE_JOB_PAY, SMUGGLE_TONNES,
} from '../src/constants/missions.ts';
import { NARCOTICS } from '../src/constants/commodities.ts';
import { DOCK_COMPUTER_RANGE } from '../src/constants/docking-computer.ts';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { parseSnapshot } from '../src/game/snapshot-parse.ts';
import { g1 } from './fixtures.ts';
import { SIDE_AMBUSH } from '../src/missions/skeletons/side.ts';
import { LANE_PIRATES } from '../src/missions/skeletons/lane.ts';
import { check, dismissBriefing, eq } from './harness.ts';

const facts = (over: Partial<CommanderFacts> = {}): CommanderFacts => ({
  galaxy: 1, systemIndex: 7, kills: 0, combatScore: 0, legalStatus: 0, day: 0, cargo: [], ...over,
});
const paid = (effects: MissionEffect[]): number =>
  effects.reduce((sum, e) => sum + (e.kind === 'pay' ? e.tenths : 0), 0);

/** A world whose board carries `job`, and a context standing there. */
function boardFor(job: Skeleton, over: Partial<CommanderFacts> = {}): MissionContext {
  const world = g1.find((s) => canAccept(emptyMissionState(), job.id,
    { commander: facts({ systemIndex: s.index }), skeletons: [job], systems: g1 }))!;
  return { commander: facts({ systemIndex: world.index, ...over }), systems: g1, rng: () => 0.5, skeletons: [job] };
}
const moved = (ctx: MissionContext, systemIndex: number, over: Partial<CommanderFacts> = {}): MissionContext =>
  ({ ...ctx, commander: { ...ctx.commander, systemIndex, ...over } });
const accept = (job: Skeleton, ctx: MissionContext): MissionState =>
  stepMissions(emptyMissionState(), { kind: 'accept', skeleton: job.id }, ctx).state;

console.log('\nrecover: a canister adrift, scooped and brought home');
{
  const ctx = boardFor(SIDE_RECOVER);
  const home = ctx.commander.systemIndex;
  const st = accept(SIDE_RECOVER, ctx);
  const live = st.live[0];
  const tag = live.tag as string;
  const target = live.target as number;
  eq('the job opens on the find leg', live.leg, 'find');
  eq('...with a tagged canister adrift at the target',
    JSON.stringify(missionItems(st, target)), JSON.stringify([{ tag, kind: 'cargo' }]));
  eq('...and no ship', missionSpawns(st, target).length, 0);
  const wrong = stepMissions(st, { kind: 'scooped', tag: 'somebody-else' }, moved(ctx, target));
  eq('another canister scooped moves nothing', wrong.state.live[0].leg, 'find');
  const got = stepMissions(st, { kind: 'scooped', tag }, moved(ctx, target));
  eq('the scoop turns the job for home', got.state.live[0].leg, 'home');
  eq('...at the world it was accepted at', got.state.live[0].target, home);
  eq('...and the canister is off the map', missionItems(got.state, target).length, 0);
  eq('...and nothing is paid yet', paid(got.effects), 0);
  const done = stepMissions(got.state, { kind: 'docked' }, moved(ctx, home));
  eq('the dock at home pays', paid(done.effects), SIDE_JOB_PAY.recover);
  eq('...and completes it', done.state.done[SIDE_RECOVER.id], 'complete');
  const shot = stepMissions(st, { kind: 'destroyed', tag }, moved(ctx, target));
  eq('a canister shot is the job failed', shot.state.done[SIDE_RECOVER.id], 'fail');
}

console.log('\nrescue: a pod, a passenger, and the answer at the dock');
{
  const ctx = boardFor(SIDE_RESCUE);
  const home = ctx.commander.systemIndex;
  const st = accept(SIDE_RESCUE, ctx);
  const tag = st.live[0].tag as string;
  const target = st.live[0].target as number;
  eq('a tagged pod drifts at the target',
    JSON.stringify(missionItems(st, target)), JSON.stringify([{ tag, kind: 'capsule' }]));
  const aboard = stepMissions(st, { kind: 'scooped', tag }, moved(ctx, target));
  eq('the scoop records a passenger under the pod\'s tag',
    JSON.stringify(aboard.state.passengers), JSON.stringify([{ tag, mission: SIDE_RESCUE.id }]));
  eq('...and the leg goes on', aboard.state.live[0].leg, 'pod');
  eq('...with nothing paid', paid(aboard.effects), 0);

  const other = stepMissions(aboard.state, { kind: 'survivor', tag: 'somebody-else', fate: 'landed' }, moved(ctx, home));
  eq('a stranger landed moves nothing', other.state.live.length, 1);
  const landed = stepMissions(aboard.state, { kind: 'survivor', tag, fate: 'landed' }, moved(ctx, home));
  eq('the passenger landed pays', paid(landed.effects), SIDE_JOB_PAY.rescue);
  eq('...and completes the job', landed.state.done[SIDE_RESCUE.id], 'complete');
  eq('...and the passenger record is gone', landed.state.passengers.length, 0);
  const sold = stepMissions(aboard.state, { kind: 'survivor', tag, fate: 'sold' }, moved(ctx, home));
  eq('the passenger sold fails it', sold.state.done[SIDE_RESCUE.id], 'fail');
  eq('...and the patron remembers', sold.state.standing[`world-${home}`], -3);

  // The scientist: the pod is lost, and the data came across first.
  const lost = stepMissions(st, { kind: 'destroyed', tag }, moved(ctx, target));
  eq('a pod shot turns the leg into a delivery', lost.state.live[0]?.leg, 'data');
  eq('...back home', lost.state.live[0]?.target, home);
  const salvage = stepMissions(lost.state, { kind: 'docked' }, moved(ctx, home));
  eq('...which pays less', paid(salvage.effects), RESCUE_SALVAGE_PAY);
  check('...and still completes the job, so the next one is open', salvage.state.done[SIDE_RESCUE.id] === 'complete');

  // Abandoned with the passenger aboard: she becomes an ordinary survivor.
  const dropped = stepMissions(aboard.state, { kind: 'abandon', skeleton: SIDE_RESCUE.id }, moved(ctx, home));
  check('abandonment hands the passenger to the crew spaces, once',
    dropped.effects.some((e) => e.kind === 'survivors' && e.people === 1) && dropped.state.passengers.length === 0);
}

console.log('\ntwo rescues at once answer to their own tags');
{
  // Two copies with a patron at Lave, so both are on the one board.
  const first: Skeleton = { ...SIDE_RESCUE, id: 'side-rescue-1', patron: { kind: 'world', seedSlot: 7 } };
  const second: Skeleton = { ...first, id: 'side-rescue-2' };
  const pair = [first, second];
  const ctx: MissionContext = { commander: facts(), systems: g1, rng: () => 0.5, skeletons: pair };
  let st = stepMissions(emptyMissionState(), { kind: 'accept', skeleton: first.id }, ctx).state;
  st = stepMissions(st, { kind: 'accept', skeleton: second.id }, ctx).state;
  const [a, b] = st.live.map((l) => l.tag as string);
  st = stepMissions(st, { kind: 'scooped', tag: a }, ctx).state;
  st = stepMissions(st, { kind: 'scooped', tag: b }, ctx).state;
  eq('both passengers are aboard', st.passengers.length, 2);
  check('...under different tags', a !== b);

  // Save and reload: the record is plain data, and the tags survive it.
  const reloaded = JSON.parse(JSON.stringify(st)) as MissionState;
  const r = stepMissions(reloaded, { kind: 'survivor', tag: a, fate: 'landed' }, ctx);
  eq('landing the first passenger completes the first job', r.state.done[first.id], 'complete');
  eq('...and only that one', r.state.live.map((l) => l.skeleton).join(), second.id);
  eq('...and the second passenger is still aboard', r.state.passengers.map((p) => p.tag).join(), b);
  eq('...and one fee was paid', paid(r.effects), SIDE_JOB_PAY.rescue);
}

console.log('\nsmuggle: the goods go aboard, and the patrol is the risk');
{
  const ctx = boardFor(SIDE_SMUGGLE);
  const r = stepMissions(emptyMissionState(), { kind: 'accept', skeleton: SIDE_SMUGGLE.id }, ctx);
  check('acceptance puts the patron\'s goods aboard',
    r.effects.some((e) => e.kind === 'cargo' && e.commodity === NARCOTICS && e.tonnes === SMUGGLE_TONNES));
  const target = r.state.live[0].target as number;
  const hold = (tonnes: number): number[] => { const c = new Array(17).fill(0); c[NARCOTICS] = tonnes; return c; };
  const landed = stepMissions(r.state, { kind: 'docked' }, moved(ctx, target, { cargo: hold(SMUGGLE_TONNES) }));
  eq('a dock at the target with the goods aboard pays', paid(landed.effects), SIDE_JOB_PAY.smuggle);
  const light = stepMissions(r.state, { kind: 'docked' }, moved(ctx, target, { cargo: hold(SMUGGLE_TONNES - 1) }));
  eq('...and with a tonne sold on the way it fails', light.state.done[SIDE_SMUGGLE.id], 'fail');
  const elsewhere = stepMissions(r.state, { kind: 'docked' }, moved(ctx, 7, { cargo: hold(SMUGGLE_TONNES) }));
  eq('a dock elsewhere is neither', elsewhere.state.live.length, 1);
  const read = stepMissions(r.state, { kind: 'policeScan' }, moved(ctx, target));
  eq('a police scan on the way fails it', read.state.done[SIDE_SMUGGLE.id], 'fail');
}

console.log('\nescort and scan, through the machine');
{
  const ctx = boardFor(SIDE_ESCORT);
  const st = accept(SIDE_ESCORT, ctx);
  const tag = st.live[0].tag as string;
  const target = st.live[0].target as number;
  eq('the charge is spawned as an escort', missionSpawns(st, target)[0]?.job, 'escort');
  const stranger = stepMissions(st, { kind: 'escortSafe', tag: 'somebody-else' }, moved(ctx, target));
  eq('another ship safe pays nothing', paid(stranger.effects), 0);
  const safe = stepMissions(st, { kind: 'escortSafe', tag }, moved(ctx, target));
  eq('the charge safe pays', paid(safe.effects), SIDE_JOB_PAY.escort);
  const again = stepMissions(safe.state, { kind: 'escortSafe', tag }, moved(ctx, target));
  eq('...once', paid(again.effects), 0);
  const later = stepMissions(safe.state, { kind: 'destroyed', tag }, moved(ctx, target));
  eq('...and a loss after the fee reverses nothing', later.state.done[SIDE_ESCORT.id], 'complete');
  eq('a charge lost to anyone fails it',
    stepMissions(st, { kind: 'escortLost', tag }, moved(ctx, target)).state.done[SIDE_ESCORT.id], 'fail');
  eq('...and so does one that jumps out',
    stepMissions(st, { kind: 'escaped', tag }, moved(ctx, target)).state.done[SIDE_ESCORT.id], 'fail');

  const sctx = boardFor(SIDE_SCAN);
  const sst = accept(SIDE_SCAN, sctx);
  const stag = sst.live[0].tag as string;
  eq('the scan leg says how long', scanSecondsFor(sst, stag), SCAN_SECONDS);
  eq('...and nothing for a stranger', scanSecondsFor(sst, 'somebody-else'), null);
  eq('the subject is spawned for a scan', missionSpawns(sst, sst.live[0].target as number)[0]?.job, 'scan');
  const scanned = stepMissions(sst, { kind: 'scanned', tag: stag }, sctx);
  eq('the scan pays', paid(scanned.effects), SIDE_JOB_PAY.scan);
  const killed = stepMissions(sst, { kind: 'destroyed', tag: stag }, sctx);
  eq('a subject destroyed fails it, and the patron minds', killed.state.standing[`world-${sctx.commander.systemIndex}`], -3);

  const hctx = boardFor(SIDE_HUNT);
  const hst = accept(SIDE_HUNT, hctx);
  const htag = hst.live[0].tag as string;
  eq('the side hunt pays on the kill', paid(stepMissions(hst, { kind: 'destroyed', tag: htag }, hctx).effects), SIDE_JOB_PAY.hunt);
  eq('...and a target that jumps out fails it',
    stepMissions(hst, { kind: 'escaped', tag: htag }, hctx).state.done[SIDE_HUNT.id], 'fail');
}

console.log('\nescort, through a real world step');
{
  const rig = (): { g: Game; tag: string } => {
    const g = withoutSaving(() => {
      seedWorld(1905);
      const game = new Game(() => headlessShell());
      dismissBriefing(game);
      return game;
    }).value;
    const c = g.state.commander;
    const ctx = boardFor(SIDE_ESCORT);
    c.systemIndex = ctx.commander.systemIndex;
    c.missions = accept(SIDE_ESCORT, ctx);
    withoutSaving(() => g.launch());
    c.systemIndex = c.missions.live[0].target as number;
    withoutSaving(() => g.arriveInSystem());
    // Nobody who preys, so the only variable is the charge's own position.
    for (const n of [...g.state.world.npcs]) {
      if (['pirate', 'hunter', 'thargoid', 'thargon'].includes(n.role)) g.state.world.despawn(n);
    }
    return { g, tag: c.missions.live[0].tag as string };
  };
  const step = (g: Game): void => { withoutSaving(() => { g.update(1 / 60, 1); }); };

  const { g, tag } = rig();
  const c = g.state.commander;
  const charge = g.state.world.npcs.find((n) => n.state.missionTag === tag)!;
  check('the charge is in the sky as a trader', charge !== undefined && charge.role === 'trader');
  const station = g.state.world.station.position;
  charge.object.position.copy(station).add({ x: DOCK_COMPUTER_RANGE + 50, y: 0, z: 0 } as never);
  const before = c.credits;
  step(g);
  eq('just outside station range nothing is paid', c.credits, before);
  charge.object.position.copy(station).add({ x: DOCK_COMPUTER_RANGE - 50, y: 0, z: 0 } as never);
  const pirate = g.state.world.spawn('pirate', charge.object.position.clone().add({ x: 200, y: 0, z: 0 } as never), 1);
  step(g);
  eq('...and inside it with a pirate beside her, still nothing', c.credits, before);
  const trader = g.state.world.spawn('trader', charge.object.position.clone().add({ x: -200, y: 0, z: 0 } as never), 2);
  g.state.world.despawn(pirate);
  step(g);
  eq('with the pirate gone and a trader beside her, the fee lands', c.credits - before, SIDE_JOB_PAY.escort);
  eq('...and the job is complete', c.missions.done[SIDE_ESCORT.id], 'complete');
  check('...and the charge is still in the sky to dock', g.state.world.npcs.includes(charge) && charge.state.alive);
  step(g);
  eq('a further frame pays nothing more', c.credits - before, SIDE_JOB_PAY.escort);
  check('a trader beside her never blocked it', g.state.world.npcs.includes(trader));
}

console.log('\nthe survivors prompt counts a passenger, and the loader keeps the tag');
{
  const g = withoutSaving(() => {
    seedWorld(1906);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    return game;
  }).value;
  const c = g.state.commander;
  const ctx = boardFor(SIDE_RESCUE);
  c.systemIndex = ctx.commander.systemIndex;
  c.missions = accept(SIDE_RESCUE, ctx);
  const tag = c.missions.live[0].tag as string;
  c.missions = stepMissions(c.missions, { kind: 'scooped', tag }, ctx).state;
  eq('the passenger is aboard', c.missions.passengers.length, 1);
  withoutSaving(() => { g.enterDocked('resumed'); });
  eq('a dock with a passenger aboard asks', g.screens.topId, 'survivors');
  const before = c.credits;
  g.input.injectPress('KeyM');
  withoutSaving(() => { g.step(1 / 60, 1); });
  eq('handing her over completes the job', c.missions.done[SIDE_RESCUE.id], 'complete');
  eq('...and pays', c.credits - before, SIDE_JOB_PAY.rescue);
  eq('...and leaves no survivor and no passenger', c.survivors + c.missions.passengers.length, 0);

  withoutSaving(() => g.launch());
  const snap = g.captureSnapshot();
  const old = structuredClone(snap) as unknown as { canisters: Record<string, unknown>[] };
  for (const can of old.canisters) delete can.missionTag;
  check('a flight save written before tags still parses',
    parseSnapshot(old as never).canisters.length === snap.canisters.length);
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

console.log('\na step that takes no branch still speaks (docs/TODO/203 M4)');
{
  const said = (effects: MissionEffect[]): string[] => effects.flatMap((e) => (e.kind === 'say' ? [e.text] : []));
  const ctx: MissionContext = { commander: facts(), systems: g1, rng: () => 0.5, skeletons: [SIDE_RESCUE, SIDE_AMBUSH] };
  const st = accept(SIDE_RESCUE, ctx);
  const tag = st.live[0].tag as string;
  const target = st.live[0].target as number;
  const scooped = stepMissions(st, { kind: 'scooped', tag }, moved(ctx, target));
  eq('the pod scooped says the pilot is aboard and what to do next',
    said(scooped.effects).join('|'), 'THE PILOT IS ABOARD. DOCK AT ANY STATION AND LAND HER.');
  const lane = accept(SIDE_AMBUSH, ctx);
  const world = g1[lane.live[0].target as number].name.toUpperCase();
  const arrived = stepMissions(lane, { kind: 'arrived' }, moved(ctx, lane.live[0].target as number));
  eq('the lane reached says to fight through and dock',
    said(arrived.effects).join('|'), `YOU ARE ON THE LANE TO ${world}. FIGHT THROUGH WHATEVER WAITS, AND DOCK AT THE STATION.`);
}
