// A neutral trader that comes close says so, one time (docs/TODO/209).
//
// Chris flew a trip to the station. He reported that a neutral trader did not
// mass lock him. The lock did fire when the torus drive ran. The drive is off
// for most of a trip, so most passes said nothing at all.
//
// A real World with ships placed by hand, as `test/targets.test.ts` does.

import * as THREE from 'three';
import { World } from '../src/game/world.ts';
import { seedWorld } from '../src/game/rng.ts';
import { generateGalaxy } from '../src/galaxy/galaxy.ts';
import { closePassLines } from '../src/game/close-pass.ts';
import { CLOSE_PASS_CLEAR, MASS_LOCK_SHIP, MASS_LOCK_STATION } from '../src/constants/torus.ts';
import { check, eq } from './harness.ts';

console.log('\nthe close pass');

seedWorld(20_260_912);
const world = new World();
world.build(generateGalaxy(1)[7]);
world.clearNpcs();
// Far from the station, so the truce holds nobody back.
const here = world.station.position.clone().add(new THREE.Vector3(0, 0, 60_000));
const at = (d: number) => here.clone().add(new THREE.Vector3(d, 0, 0));
const trader = world.spawn('trader', at(MASS_LOCK_SHIP - 500), 1);
world.spawn('pirate', at(1000), 2);
const rock = world.spawn('asteroid', at(300), 3);
const far = world.spawn('trader', at(MASS_LOCK_SHIP + 500), 4);

const lines = (toStation = 60_000): string[] => closePassLines({
  npcs: world.npcs, playerPos: here, legalStatus: 0, playerToStation: toStation,
});

const first = lines();
eq('one line, for the one trader inside the lock radius', first.length, 1);
check('...and it names the ship', first[0].includes(trader.object.name.toUpperCase()));
check('...and it says what to do with it', first[0].includes('TARGETS'));
check('the pirate gets no line, because it announces itself, and it is not a trader',
  world.npcs.some((n) => n.role === 'pirate') && first.length === 1);
check('...the rock gets none either', rock.role === 'asteroid' && first.length === 1);
check('...and a trader beyond the radius waits its turn',
  !first.join().includes(far.object.name.toUpperCase()));

eq('the same trader says nothing a second time', lines().length, 0);
far.object.position.copy(at(MASS_LOCK_SHIP - 100));
eq('...and the second trader speaks when it arrives', lines().length, 1);

// The flag clears only when the ship opens back out, so a wobble across the
// radius does not repeat the line.
trader.object.position.copy(at(MASS_LOCK_SHIP + 100));
eq('a ship just outside the radius stays quiet, and keeps its flag', lines().length, 0);
trader.object.position.copy(at(MASS_LOCK_SHIP - 100));
eq('...so a step back inside says nothing', lines().length, 0);
trader.object.position.copy(at(CLOSE_PASS_CLEAR + 100));
eq('...but a ship that really left lets go of the flag', lines().length, 0);
check('...and the flag is down', !trader.state.announcedClose);
trader.object.position.copy(at(MASS_LOCK_SHIP - 100));
eq('...so a second approach speaks again', lines().length, 1);

// The approach to the station is thick with traffic, and the pilot is busy.
for (const n of world.npcs) n.state.announcedClose = false;
eq('inside the station mass lock, nothing speaks', lines(MASS_LOCK_STATION - 1).length, 0);

world.clearNpcs();
const dead = world.spawn('trader', at(1200), 5);
dead.state.alive = false;
const docked = world.spawn('trader', at(1300), 6);
docked.state.docked = true;
eq('a wreck is not a chance to pirate, and neither is a docked ship', lines().length, 0);

// A trader that the commander shot at is still a trader. `isHostileToPlayer`
// owns who attacks the commander, and this file restates none of that rule.
// It silences the pirate above. It says nothing about a trader.
world.clearNpcs();
const shot = world.spawn('trader', at(1400), 7);
shot.state.provokedByPlayer = true;
eq('a trader you already shot at is a fight you started, not an offer', lines().length, 0);
world.clearNpcs();
const picked = world.spawn('trader', at(1400), 8);
picked.state.targeted = true;
eq('...and the ship the pilot picked needs no invitation either', lines().length, 0);
world.clearNpcs();
world.spawn('trader', at(1400), 9);
eq('...where a trader nobody touched does speak (the control)', lines().length, 1);
// The article is `shipArticle` in targets.ts, so the list and the line cannot
// disagree about one ship. A message that said "A OPHIDIAN" read as a fault.
world.clearNpcs();
const vowel = world.spawn('trader', at(1400), 10);
vowel.object.name = 'Ophidian';
check('a name that starts with a vowel takes AN', lines()[0].startsWith('AN OPHIDIAN'));
world.clearNpcs();
const cons = world.spawn('trader', at(1400), 11);
cons.object.name = 'Boa';
check('...and every other name takes A', lines()[0].startsWith('A BOA'));
