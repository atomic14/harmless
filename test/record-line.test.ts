// Your record moving, flown: the console actually says it, and says it behind
// the deed and the launch that caused it (docs/TODO/130).
//
// `test/world-step.test.ts` owns the geometry that reaches `raiseLegal` — the
// two scan ranges — and the pure claim that `recordVerdict` names exactly the
// roles `isHostileToPlayer` turns on. This is the half that needs a real Game,
// because the defect was never in the rule: the record moved correctly and said
// `LEGAL STATUS: FUGITIVE` into a console that `STATION DEFENCE LAUNCHED` took
// away in the same frame. Becoming a Fugitive — the most expensive thing that
// can happen to a commander short of dying — was never read by anybody.
//
// So every check here drives the real Game and reads `session.messageText`
// frame by frame, as a pilot would. The running order being asserted is:
//
//     what you did → what the sky did about it → where you now stand.
//
// The exercise is NOT here: `test/combat-sim-career.test.ts` already gates that
// a simulated kill cannot reach `raiseLegal` at all (invariant 5), and a second
// home for that claim is a second thing to keep in step.

import * as THREE from 'three';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { recordVerdict } from '../src/game/law.ts';
import {
  CONTRABAND, DEFENCE_RANGE, FUGITIVE, OFFENDER, SCAN_LINE_SECONDS, SCAN_RANGE,
} from '../src/constants/law.ts';
import { WITCHPOINT_RADII } from '../src/constants/planet.ts';
import { check, consoleWatcher, dismissBriefing, eq } from './harness.ts';

const DEFENCE = 'STATION DEFENCE LAUNCHED';
const CAPSULE = 'ESCAPE CAPSULE DESTROYED';

/** Seconds of frames — long enough for two queued lines to reach the console. */
const SETTLE = Math.ceil((SCAN_LINE_SECONDS * 2 + 6) * 60);

/**
 * A commander in flight with an empty sky, out of the launch tunnel and at
 * rest, and a way to watch the console (harness.ts).
 *
 * Same rig as test/character-line.test.ts and for the same reason: a fight in
 * the same seconds as the deed would put its own lines on the console and make
 * the ORDER ambiguous, which is the one thing every block below is about.
 */
function flying(seed: number): { g: Game; fly: (steps: number) => string[] } {
  const g = withoutSaving(() => {
    seedWorld(seed);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    game.launch();
    return game;
  }).value;
  const fly = consoleWatcher(g);
  fly(400);                                  // past the launch tunnel
  g.state.world.clearNpcs();
  g.state.player.speed = 0;
  return { g, fly };
}

/** How far the ship is from the station that might take an interest. */
const fromStation = (g: Game): number =>
  g.state.player.position.distanceTo(g.state.world.station.position);

/** A point `d` ahead of where the ship is actually pointing, whatever that is. */
const ahead = (g: Game, d: number): THREE.Vector3 => g.state.player.position.clone()
  .add(new THREE.Vector3(0, 0, -1).applyQuaternion(g.state.player.quaternion)
    .multiplyScalar(d));

/** A lawful ship in front of the nose, its matrix current so a ray can find it. */
function trader(g: Game, d = 1200) {
  const ship = g.spawnNpc('trader', ahead(g, d), 7);
  ship.object.updateMatrixWorld(true);
  return ship;
}

/** Where a `RECORD:` line fell in a run of console lines, and what it said. */
const record = (said: string[]): { line: string | undefined; at: number } => {
  const at = said.findIndex((t) => t.startsWith('RECORD:'));
  return { line: said[at], at };
};

console.log('\nthe console says when a murder moves your record');
{
  // THE DEFECT. Before docs/TODO/130 this run contained no RECORD line at all:
  // `raiseLegal` said LEGAL STATUS into a console `callStationDefence` claimed
  // three lines later, and the only surviving word about the worst thing you
  // can do to your career was that some Vipers had launched.
  const { g, fly } = flying(20_300_810);
  const c = g.state.commander;
  check(`the deed is done in the station's sight (${Math.round(fromStation(g))}` +
    ` < ${DEFENCE_RANGE})`, fromStation(g) < DEFENCE_RANGE);

  g.destroyNpc(trader(g));
  const said = fly(SETTLE);
  eq('destroying a lawful ship makes you a Fugitive', c.legalStatus, FUGITIVE);

  const launched = said.indexOf(DEFENCE);
  const { line, at } = record(said);
  check(`the sky answered first (${said.join(' / ')})`, launched >= 0);
  eq('...and the record follows it', line, recordVerdict(c.legalStatus));
  check('...AFTER it, not instead of it', at > launched);
  check('...and it names who is now coming, assembled and not written out',
    line?.includes('FUGITIVE') === true && line?.includes('WILL ENGAGE') === true);
  check('...and it is said once, not on a timer that re-arms',
    fly(SETTLE * 2).filter((t) => t.startsWith('RECORD:')).length === 0);
}

console.log('...and says it where nobody is watching, too');
{
  // The record is not a thing the station does to you. Out at the witchpoint no
  // fleet launches and there is no line to wait behind, so the verdict is the
  // FIRST thing said — which is also the control that the ordering above is the
  // queue doing its job rather than an accident of two lines.
  const { g, fly } = flying(20_300_811);
  const c = g.state.commander;
  g.state.player.position.copy(g.state.world.station.position).normalize()
    .multiplyScalar(g.state.world.planetRadius * WITCHPOINT_RADII);
  check(`well out of the station's reach (${Math.round(fromStation(g))}` +
    ` > ${DEFENCE_RANGE})`, fromStation(g) > DEFENCE_RANGE);

  g.destroyNpc(trader(g));
  const said = fly(SETTLE);
  const { line, at } = record(said);
  eq('the record moved all the same', c.legalStatus, FUGITIVE);
  eq(`...and the console says so (${said.join(' / ')})`, line, recordVerdict(FUGITIVE));
  eq('...with nothing ahead of it', at, 0);
  check('...and no fleet was scrambled at an empty sky',
    !said.includes(DEFENCE) && !g.state.session.defenceLaunched);
}

console.log('...and never over the deed that caused it');
{
  // The other line `callStationDefence` used to erase. Shooting a capsule is
  // the one deed in this family that HAS words of its own, so it is the case
  // that proves the launch waits rather than merely that the record does.
  const { g, fly } = flying(20_300_812);
  const c = g.state.commander;
  g.state.world.cargo.spawnCapsule(ahead(g, 400));
  for (const item of g.state.world.cargo.items) item.object.updateMatrixWorld(true);

  g.fireLaser();
  const said = fly(SETTLE);
  const { line, at } = record(said);
  eq('the capsule broke up', g.state.world.cargo.items.length, 0);
  eq(`the deed keeps the console it earned (${said.join(' / ')})`, said[0], CAPSULE);
  check('...the launch waits its turn', said.indexOf(DEFENCE) === 1);
  eq('...and the record comes last', line, recordVerdict(c.legalStatus));
  check('...which is the Fugitive-grade offence killing a crew is', at === 2
    && c.legalStatus === FUGITIVE);
}

console.log('...once, however many call sites want to say it');
{
  // THE SCAN, flown for real — docs/TODO/122's case, which test/world-step.test.ts
  // can no longer finish because the verdict is the HOST's line now and its host
  // is a stub. It is also where the duplicate would show: `world-step.ts` used
  // to write out its own `recordVerdict` beside `raiseLegal`'s, and putting
  // either back gives the console the same sentence twice.
  const { g, fly } = flying(20_300_814);
  const c = g.state.commander;
  c.cargo[CONTRABAND[0]] = 3;
  const cop = g.spawnNpc('police', ahead(g, SCAN_RANGE * 0.5), 9);
  cop.object.updateMatrixWorld(true);

  // Stopped on the frame the scan fires, because what is WAITING at that
  // moment is the only place a second call site's copy shows. Two identical
  // lines in a row are invisible to a watcher that reads the console: it never
  // CHANGES, it just holds the same sentence for twice as long.
  let opened: string[] = [];
  for (let f = 0; f < 600 && opened.length === 0; f++) opened = fly(1);
  const waiting = g.state.session.queued.map((q) => q.text);
  eq('the hold was read', c.legalStatus, OFFENDER);
  eq(`the scan speaks first (${opened.join(' / ')})`,
    opened[0], 'POLICE SCAN: CONTRABAND DETECTED');
  eq(`...with exactly one verdict waiting behind it (${waiting.join(' / ')})`,
    waiting.filter((t) => t.startsWith('RECORD:')).length, 1);
  eq('...which is the record the scan actually left',
    fly(SETTLE).find((t) => t.startsWith('RECORD:')), recordVerdict(OFFENDER));
}

console.log('...and says nothing at all when the record does not move');
{
  // THE CONTROL, and the case that decides the rule: every laser hit that lands
  // on a lawful ship reaches `raiseLegal`, so a line per CALL would shout the
  // same record down the length of a fight. Only a MOVE speaks. Counted in
  // console lines, because the status is not the claim.
  // Out at the witchpoint, so the only ship in the sky is the one being shot:
  // a launched Viper fleet would be an eleven-second dogfight around the claim.
  const { g, fly } = flying(20_300_813);
  const c = g.state.commander;
  g.state.player.position.copy(g.state.world.station.position).normalize()
    .multiplyScalar(g.state.world.planetRadius * WITCHPOINT_RADII);
  const target = trader(g, 500);

  g.fireLaser();
  const first = fly(SETTLE);
  eq('the first hit files an offence', c.legalStatus, OFFENDER);
  eq(`...and says so once (${first.join(' / ')})`,
    first.filter((t) => t.startsWith('RECORD:')).length, 1);

  // Held in front of the nose and kept in the fight — a dead trader would be a
  // SECOND move, to Fugitive, and this block is about the offence that does not
  // move. The hits are real; only the dying is prevented.
  let hits = 0;
  for (let volley = 0; volley < 12; volley++) {
    target.object.position.copy(ahead(g, 500));
    target.object.updateMatrixWorld(true);
    target.state.energy = target.maxEnergy;
    const was = target.state.energy;
    g.fireLaser();
    hits += target.state.energy < was ? 1 : 0;
    fly(20);
  }
  const after = fly(SETTLE);
  check(`the fight went on (${hits} landed hits, the target`
    + ` ${target.state.alive ? 'alive' : 'dead'})`, hits === 12 && target.state.alive);
  eq('...and the record, which did not move, said nothing further',
    after.filter((t) => t.startsWith('RECORD:')).length, 0);
  eq('...and the status is where the first hit left it', c.legalStatus, OFFENDER);
  // AND THE CONSOLE FELL QUIET, which is the half that has teeth. A line
  // queued per CALL rather than per move would say the same words twelve times
  // over — and twelve identical lines never CHANGE, so the watcher above sees
  // one console and no defect. What it leaves behind is a backlog: nearly a
  // minute of `RECORD: OFFENDER` with everything else in the game waiting
  // behind it. Deleting the move guard is caught here and nowhere else.
  eq(`nothing is still waiting to be said (${g.state.session.queued.length} queued)`,
    g.state.session.queued.length, 0);
  eq('...and the console is free for whatever happens next',
    g.state.session.messageText, '');
}
