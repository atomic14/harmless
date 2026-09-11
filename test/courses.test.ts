// What the ship can do next, with no hand on the stick (docs/TODO/205 M2).
//
// The rule is pure, so no world stands behind it. Each row of the plan's two
// tables is raised here on both sides of its condition. A row that the ship
// cannot fly shows with its reason. A row whose object is not there never
// shows.

import { newCommander, type CommanderData } from '../src/game/commander.ts';
import { courseList, type CourseKind, type CourseWorld } from '../src/game/courses.ts';
import { MAX_FUEL } from '../src/constants/commander.ts';
import { check, eq } from './harness.ts';

console.log('\nthe course list');

const fitted = (): CommanderData => {
  const c = newCommander();
  c.equipment.miningLaser = true;
  c.equipment.scoops = true;
  c.fuel = MAX_FUEL - 10;
  return c;
};

const world = (over: Partial<CourseWorld> = {}): CourseWorld => ({
  situation: 'flight',
  commander: fitted(),
  jump: { ok: true, cost: 30 },
  targetName: 'Lave',
  witchspace: false,
  sky: ['asteroid', 'hermit', 'generation', 'trader'],
  mission: null,
  done: new Set(),
  threat: null,
  ...over,
});

/** A list or a row compared by its content, which `eq` does not do. */
const same = (name: string, actual: unknown, expected: unknown): void =>
  eq(name, JSON.stringify(actual), JSON.stringify(expected));

const kinds = (w: CourseWorld): CourseKind[] => courseList(w).map((c) => c.kind);
const row = (w: CourseWorld, kind: CourseKind) => courseList(w).find((c) => c.kind === kind);

// --- the order ---------------------------------------------------------------
same('in flight, the list runs mission, station, derelict, rocks, hermit, star, jump',
  kinds(world({ mission: 'HUNT THE KRAIT' })),
  ['mission', 'station', 'derelict', 'mine', 'hermit', 'skim', 'jump']);
same('at a launch, the list runs jump, rocks, star',
  kinds(world({ situation: 'launch', sky: [] })), ['jump', 'mine', 'skim']);

// --- the jump ----------------------------------------------------------------
same('a jump with fuel names the target and is free to fly',
  row(world(), 'jump'), { kind: 'jump', what: 'JUMP TO LAVE', why: null });
eq('at a launch, a chart with no target still shows the jump, with the reason',
  row(world({ situation: 'launch', sky: [], jump: { ok: false, reason: 'noTarget' }, targetName: null }), 'jump')?.why,
  'CHOOSE A SYSTEM ON THE GALACTIC CHART FIRST');
check('...and in flight, a chart with no target shows no jump',
  !kinds(world({ jump: { ok: false, reason: 'noTarget' }, targetName: null })).includes('jump'));
eq('a jump the tank cannot cover shows, and says so',
  row(world({ jump: { ok: false, reason: 'noFuel' } }), 'jump')?.why, 'NOT ENOUGH FUEL TO GET THERE');
check('a jump under way is not a course to pick',
  !kinds(world({ situation: 'launch', sky: [], jump: { ok: false, reason: 'alreadyJumping' } })).includes('jump'));

// --- the mission -------------------------------------------------------------
same('a live leg with its target here leads the list, in its own words',
  courseList(world({ mission: 'SCAN THE COBRA' }))[0], { kind: 'mission', what: 'SCAN THE COBRA', why: null });
check('...no leg here, no row', !kinds(world()).includes('mission'));
check('...and a finished one leaves', !kinds(world({ mission: 'X', done: new Set(['mission']) })).includes('mission'));
check('...and no mission row at a launch', !kinds(world({ situation: 'launch', sky: [], mission: 'X' })).includes('mission'));

// --- the station -------------------------------------------------------------
check('in flight, the station is a course', kinds(world()).includes('station'));
check('...but not in witch-space, where the station is out of reach',
  !kinds(world({ witchspace: true })).includes('station'));
check('...and not at a launch, which leaves it', !kinds(world({ situation: 'launch', sky: [] })).includes('station'));

// --- the derelict and the hermit ---------------------------------------------
check('a generation ship in the sky is a course', kinds(world()).includes('derelict'));
check('...no generation ship, no row', !kinds(world({ sky: ['asteroid', 'hermit'] })).includes('derelict'));
check('...and one investigated leaves', !kinds(world({ done: new Set(['derelict']) })).includes('derelict'));
check('a hermit in the sky is a course', kinds(world()).includes('hermit'));
check('...no hermit, no row', !kinds(world({ sky: ['asteroid'] })).includes('hermit'));
check('...one visited leaves', !kinds(world({ done: new Set(['hermit']) })).includes('hermit'));
check('...and the launch never guesses at one, because the launch draws it',
  !kinds(world({ situation: 'launch', sky: ['hermit'] })).includes('hermit'));

// --- the rocks ---------------------------------------------------------------
eq('rocks with a mining laser and scoops are free to fly', row(world(), 'mine')?.why, null);
{
  const c = fitted(); c.equipment.miningLaser = false;
  eq('...with no mining laser, the row says so', row(world({ commander: c }), 'mine')?.why, 'NEEDS A MINING LASER');
}
{
  const c = fitted(); c.equipment.scoops = false;
  eq('...with no scoops, the row says so', row(world({ commander: c }), 'mine')?.why, 'NEEDS FUEL SCOOPS');
}
{
  const c = newCommander();
  eq('...with neither, it names both', row(world({ commander: c }), 'mine')?.why,
    'NEEDS A MINING LASER AND FUEL SCOOPS');
}
check('no rocks in the sky, no row', !kinds(world({ sky: ['hermit'] })).includes('mine'));
check('...but a launch always has rocks, because every system holds some',
  kinds(world({ situation: 'launch', sky: [] })).includes('mine'));

// --- the star ----------------------------------------------------------------
eq('a tank that is not full, with scoops, can skim', row(world(), 'skim')?.why, null);
{
  const c = fitted(); c.equipment.scoops = false;
  eq('...with no scoops, the row says so', row(world({ commander: c }), 'skim')?.why, 'NEEDS FUEL SCOOPS');
}
{
  const c = fitted(); c.fuel = MAX_FUEL;
  check('...a full tank has nothing to gain', !kinds(world({ commander: c })).includes('skim'));
}
check('...and witch-space has no star in reach', !kinds(world({ witchspace: true })).includes('skim'));

// --- witch-space -------------------------------------------------------------
same('in witch-space, with nothing in the sky, the jump is the only course',
  kinds(world({ witchspace: true, sky: ['thargoid'] })), ['jump']);

// --- a way out of a fight (docs/TODO/206 M5) --------------------------------
eq('with a hostile ship on the scanner, RUN leads the list',
  kinds(world({ threat: { fastest: 381, own: 400 } }))[0], 'run');
eq('...and says how thin the margin is', row(world({ threat: { fastest: 381, own: 400 } }), 'run')?.what,
  'RUN FOR IT — YOU ARE ONLY A LITTLE FASTER');
eq('...or that the ship is faster, where it is', row(world({ threat: { fastest: 320, own: 400 } }), 'run')?.what,
  'RUN FOR IT — YOU ARE FASTER');
eq('...or that it is not', row(world({ threat: { fastest: 400, own: 400 } }), 'run')?.what,
  'RUN FOR IT — THEY ARE AS FAST AS YOU');
check('with no hostile ship on the scanner, there is nothing to run from', !kinds(world()).includes('run'));

