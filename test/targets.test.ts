// What the ship can fight, and which one the pilot picked (docs/TODO/206 M1).
//
// A real World with a few ships placed by hand. The list puts the ships that
// attack first, then the rest, each group nearest first. The pick is a flag
// on one ship's state, so a save carries it with the ship.

import * as THREE from 'three';
import { World } from '../src/game/world.ts';
import { seedWorld } from '../src/game/rng.ts';
import { generateGalaxy } from '../src/galaxy/galaxy.ts';
import { pickTarget, pickedTarget, targetList } from '../src/game/targets.ts';
import { SCANNER_RANGE } from '../src/constants/console.ts';
import { check, eq } from './harness.ts';

console.log('\nthe target list');

seedWorld(20_260_923);
const world = new World();
world.build(generateGalaxy(1)[7]);
world.clearNpcs();
// Far from the station, so its truce holds nobody back.
const here = world.station.position.clone().add(new THREE.Vector3(0, 0, 60_000));
const at = (d: number) => here.clone().add(new THREE.Vector3(d, 0, 0));
const trader = world.spawn('trader', at(900), 1);
const farPirate = world.spawn('pirate', at(3000), 2);
const nearPirate = world.spawn('pirate', at(2000), 3);
const police = world.spawn('police', at(1500), 4);
const rock = world.spawn('asteroid', at(500), 5);
const beyond = world.spawn('trader', at(SCANNER_RANGE + 2000), 6);

const view = () => ({ npcs: world.npcs, playerPos: here, legalStatus: 0, playerToStation: 60_000 });
const names = () => targetList(view()).map((r) => r.ship);

const list = names();
check('the ships that attack come first, nearest first',
  list[0] === nearPirate && list[1] === farPirate);
check('...then every other ship, nearest first', list.slice(2).join() === [rock, trader, police].join());
check('a ship beyond scanner range is not on the list', !list.includes(beyond));
eq('a pirate that attacks reads HOSTILE', targetList(view())[0].standing, 'HOSTILE');
eq('a trader is on the list, and says the law protects it',
  targetList(view()).find((r) => r.ship === trader)?.cost, 'THE LAW PROTECTS THIS SHIP');
eq('...and so does the police ship',
  targetList(view()).find((r) => r.ship === police)?.cost, 'THE LAW PROTECTS THIS SHIP');
eq('a rock costs nothing to shoot', targetList(view()).find((r) => r.ship === rock)?.cost, null);

eq('with no pick, no ship is picked', pickedTarget(world.npcs), null);
pickTarget(world.npcs, trader);
eq('a pick marks one ship', pickedTarget(world.npcs), trader);
pickTarget(world.npcs, police);
check('...and a second pick lets go of the first', pickedTarget(world.npcs) === police && !trader.state.targeted);
pickTarget(world.npcs, beyond);
check('the picked ship stays on the list beyond scanner range', names().includes(beyond));
beyond.state.alive = false;
eq('a picked ship that dies is picked no more', pickedTarget(world.npcs), null);

// The pick travels with the ship through a save, because it is state.
pickTarget(world.npcs, rock);
const saved = JSON.parse(JSON.stringify(world.captureNpcs()));
check('the save writes the pick on the picked ship',
  saved.some((n: { state: { targeted: boolean } }) => n.state.targeted));
