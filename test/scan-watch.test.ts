// A scan counts while its subject is in view, and needs no missile
// (docs/TODO/203 M5).
//
// The seconds used to count only under the missile lock. The briefing said
// "do not fire", so a player who obeyed it never armed a missile and never
// scanned anything. The subject must now sit inside WATCH_CONE of the view
// and inside scanner range, and the count says itself aloud once a second.

import * as THREE from 'three';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { SOURCE_DESIGN, specForDesign } from '../src/game/ship-specs.ts';
import { shipDesignIdOf } from '../src/game/ship-identity.ts';
import { emptyMissionState } from '../src/missions/state.ts';
import { SIDE_SCAN } from '../src/missions/skeletons/side.ts';
import { SCAN_SECONDS, SIDE_JOB_PAY } from '../src/constants/missions.ts';
import { check, consoleWatcher, dismissBriefing, eq } from './harness.ts';

/** A commander in flight, at rest in an empty sky, with the watch job live. */
function watching(seed: number): { g: Game; fly: (steps: number) => string[]; tag: string } {
  const g = withoutSaving(() => {
    seedWorld(seed);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    game.launch();
    return game;
  }).value;
  const fly = consoleWatcher(g);
  fly(400);
  g.state.world.clearNpcs();
  g.state.player.speed = 0;
  const c = g.state.commander;
  const tag = 'side-scan#1#watch';
  c.missions = {
    ...emptyMissionState(),
    live: [{ skeleton: SIDE_SCAN.id, leg: 'watch', target: c.systemIndex, tag, progress: 0, deadlineDay: null }],
    journal: [{ skeleton: SIDE_SCAN.id, leg: 'watch', outcome: 'accepted', day: c.day, world: c.systemIndex }],
    entities: { [tag]: { kind: 'ship', ship: shipDesignIdOf(SOURCE_DESIGN.anaconda), hull: 1, lastWorld: c.systemIndex, alive: true } },
  };
  return { g, fly, tag };
}

/** The subject, `d` units along `dir` in the ship's frame, flying straight on along it. */
function subject(g: Game, tag: string, dir: THREE.Vector3, d: number): void {
  const along = dir.clone().applyQuaternion(g.state.player.quaternion);
  const at = g.state.player.position.clone().addScaledVector(along, d);
  const spec = specForDesign('trader', shipDesignIdOf(SOURCE_DESIGN.anaconda))!;
  const ship = g.state.world.spawn('trader', at, 0, spec);
  ship.state.missionTag = tag;
  ship.state.tradeTimer = Number.POSITIVE_INFINITY;
  ship.state.waypointTimer = Number.POSITIVE_INFINITY;
  ship.state.waypoint.copy(at).addScaledVector(along, 50_000);
}

console.log('\na scan counts while the subject is in view, with no missile armed');
{
  const { g, fly, tag } = watching(2_031);
  subject(g, tag, new THREE.Vector3(0, 0, -1), 2_000);
  const before = g.state.commander.credits;
  const said = fly(Math.ceil((SCAN_SECONDS + 2) * 60));
  check('the count is said aloud as it runs',
    said.some((t) => /^SCANNING THE ANACONDA\. \d+ OF 20 SECONDS DONE\.$/.test(t)), said.slice(0, 4).join(' / '));
  check('...and the scan completes and pays, with no missile ever armed',
    g.state.commander.missions.live.length === 0 && g.state.commander.credits === before + SIDE_JOB_PAY.scan);
  // The dossier's own line replaces the skeleton's, and it names the world
  // the watch was at, not ANY STATION (docs/TODO/203 M5).
  const world = g.state.systems[g.state.commander.systemIndex].name.toUpperCase();
  check('...and the patron says so, naming the world',
    said.some((t) => t === `YOU HELD THE ANACONDA AT ${world} WITHOUT FIRING, AND EARNED 250.0 CR`), said.at(-1) ?? '');
}

console.log('\n...and not while the subject is behind the player');
{
  const { g, fly, tag } = watching(2_032);
  subject(g, tag, new THREE.Vector3(0, 0, 1), 2_000);
  fly(5 * 60);
  const ship = g.state.world.npcs.find((n) => n.state.missionTag === tag);
  eq('five seconds with the subject astern count nothing', Math.floor(ship?.state.observed ?? -1), 0);
  eq('...and the job is still open', g.state.commander.missions.live.length, 1);
}
