// The fast forward button (docs/TODO/205 M7).
//
// Chris's words of 2026-09-11: *"instead of being able to cheat the mass lock
// we just skip time forward."* So fast forward runs more fixed steps in each
// screen frame, and it changes no step. The first block proves that claim: a
// trip under fast forward and a trip at normal speed end in the same world,
// step for step. The rest prove each way that fast forward stops by itself.

import * as THREE from 'three';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { restoreRng, rngState, seedWorld } from '../src/game/rng.ts';
import { COURSE_SKIP_KEY } from '../src/game/bindings.ts';
import { SKIP_SPEED } from '../src/constants/course.ts';
import { check, dismissBriefing, eq } from './harness.ts';

console.log('\nfast forward');

/** A commander at the witchpoint on the station course, past both tunnels. */
function onCourse(seed: number): Game {
  const g = withoutSaving(() => {
    seedWorld(seed);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    game.launch();
    return game;
  }).value;
  const settle = (): void => {
    withoutSaving(() => { for (let f = 0, at = 0; f < 400; f++) g.step(1 / 60, at += 1 / 60); });
  };
  settle();
  g.arriveInSystem();
  settle();
  g.state.session.course = 'station';
  return g;
}

function run(g: Game, steps: number, from = 10): void {
  withoutSaving(() => { for (let f = 0; f < steps; f++) g.step(1 / 60, from + f / 60); });
}

function press(g: Game, code: string): void {
  g.input.injectPress(code);
  run(g, 1, 5);
}

/** The world a step leaves, without the console, which counts the player's time. */
function world(g: Game): string {
  const r = (v: THREE.Vector3 | THREE.Quaternion) => v.toArray().map((x) => x.toFixed(6)).join();
  const { messageText, messageTimer, queued, ...session } = g.state.session;
  void messageText; void messageTimer; void queued;
  return JSON.stringify({
    player: [r(g.state.player.position), r(g.state.player.quaternion), g.state.player.speed.toFixed(6)],
    npcs: g.state.world.npcs.map((n) => [n.role, n.state.alive, r(n.object.position)]),
    commander: [g.state.commander.fuel, g.state.commander.credits],
    session,
  });
}

{
  // Both games draw from ONE seeded stream (game/rng.ts). So each trip starts
  // from the same point of it, or the second trip sees other numbers.
  const quiet = (n: Game): void => {
    for (const s of n.state.world.npcs) if (s.role === 'pirate' || s.role === 'hunter') s.state.alive = false;
  };
  const normal = onCourse(20_260_919);
  quiet(normal);
  const start = rngState();
  press(normal, 'Unbound');
  run(normal, 1200);

  const fast = onCourse(20_260_919);
  quiet(fast);
  restoreRng(start);
  press(fast, COURSE_SKIP_KEY);
  eq('the button turns fast forward on', fast.coursePanel()?.skip?.on, true);
  eq('...and the loop runs the fixed step that many times in a frame', (fast as unknown as {
    courses_: { speed: number } }).courses_.speed, SKIP_SPEED);
  run(fast, 1200);
  eq('a trip under fast forward and a trip at normal speed reach the same world, step for step',
    world(fast), world(normal));
  run(fast, 1, 40);
  check('...where one step more is a different world (the control)', world(fast) !== world(normal));
}

{
  const g = onCourse(20_260_920);
  for (const s of g.state.world.npcs) if (s.role === 'pirate' || s.role === 'hunter') s.state.alive = false;
  press(g, COURSE_SKIP_KEY);
  press(g, COURSE_SKIP_KEY);
  eq('a second press stops fast forward', g.coursePanel()?.skip?.on, false);

  press(g, COURSE_SKIP_KEY);
  g.input.press('ArrowUp');
  run(g, 1, 6);
  g.input.release('ArrowUp');
  eq('a flight key takes the ship, and fast forward stops with the course', g.coursePanel()?.skip ?? null, null);
}

// A HOSTILE SHIP NOW ENDS THE COURSE ITSELF, and fast forward goes with it
// (Chris, 2026-09-12). The button used to stay, over a course that flew
// nothing while the aim fought.
{
  const g = onCourse(20_260_921);
  for (const s of g.state.world.npcs) if (s.role === 'pirate' || s.role === 'hunter') s.state.alive = false;
  press(g, COURSE_SKIP_KEY);
  // A pirate appears beside the ship, as the encounters put one.
  const pirate = g.state.world.spawn('pirate',
    g.state.player.position.clone().add(new THREE.Vector3(0, 0, -1500)), 7);
  pirate.state.provokedByPlayer = true;
  run(g, 2, 7);
  eq('a hostile ship nearby ends the course', g.state.session.course, null);
  eq('...so there is no fast forward button left to press', g.coursePanel()?.skip ?? null, null);
}

// ...and with NO co-pilot, the course is the only pilot there is, so it flies
// on through the fight. Fast forward is what stops, and it says why.
{
  const g = onCourse(20_260_921);
  for (const s of g.state.world.npcs) if (s.role === 'pirate' || s.role === 'hunter') s.state.alive = false;
  g.state.brains = { ...g.state.brains, scripted: true };
  press(g, COURSE_SKIP_KEY);
  const pirate = g.state.world.spawn('pirate',
    g.state.player.position.clone().add(new THREE.Vector3(0, 0, -1500)), 7);
  pirate.state.provokedByPlayer = true;
  run(g, 2, 7);
  eq('with no co-pilot the course flies on', g.state.session.course, 'station');
  eq('...and a hostile ship nearby stops fast forward by itself', g.coursePanel()?.skip?.on, false);
  eq('...and the console says why', g.state.session.messageText,
    'HOSTILE SHIP NEARBY — BACK TO NORMAL SPEED');

  press(g, COURSE_SKIP_KEY);
  eq('...and with the hostile ship still there, the button refuses', g.coursePanel()?.skip?.on, false);
  eq('...and says why', g.state.session.messageText, 'NOT WITH A HOSTILE SHIP NEARBY');
}

{
  const g = onCourse(20_260_922);
  g.state.session.course = null;
  press(g, COURSE_SKIP_KEY);
  check('with no course there is no fast forward button', g.coursePanel()?.skip === null);
}
