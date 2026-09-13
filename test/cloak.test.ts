// The cloaking device, which no shop sells (docs/TODO/219 M5).
//
// While it runs, no ship is hostile to the commander, the condition light
// stays green, the run course sees no threat, and the bank drains. A shot
// drops it, the last bank drops it, and a dock drops it. A ship without the
// fit is told so.

import * as THREE from 'three';
import { seedWorld } from '../src/game/rng.ts';
import { NpcShip } from '../src/game/npc.ts';
import { SHIPPED_BRAINS } from '../src/game/brain-names.ts';
import { engaging, hostilesNear, hostilesOnScanner } from '../src/game/hostility.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { keymap } from '../src/engine/keymap.ts';
import { CLOAK_ENERGY_PER_SECOND, CLOAK_MIN_ENERGY } from '../src/constants/cloak.ts';
import { MAX_ENERGY } from '../src/constants/pools.ts';
import { arrived } from './course-fixtures.ts';
import { check, eq } from './harness.ts';

console.log('\na cloaked commander is nobody\'s business');
{
  seedWorld(11);
  const origin = new THREE.Vector3();
  const pirate = new NpcShip('pirate', new THREE.Vector3(0, 0, -800), 3);
  check('a pirate 800 out engages an uncloaked commander', engaging(pirate, origin, 0, Infinity));
  check('...and not a cloaked one', !engaging(pirate, origin, 0, Infinity, undefined, true));
  check('the condition light stays green', !hostilesNear([pirate], origin, 0, Infinity, undefined, true));
  eq('...and the run course sees no threat', hostilesOnScanner([pirate], origin, 0, Infinity, true).length, 0);
  // The pirate's own frame: it hunts an uncloaked commander, and ambles past a cloaked one.
  const station = new THREE.Object3D();
  const player = { position: origin, quaternion: new THREE.Quaternion(), speed: 0 } as never;
  const view = (cloaked: boolean) => ({
    station, dockZ: 160, fleet: [pirate], playerLegal: 0, brains: SHIPPED_BRAINS,
    missileInbound: false, playerToStation: Infinity, playerCloaked: cloaked,
  }) as never;
  seedWorld(11);
  pirate.update(1 / 60, player, view(false));
  check('a pirate flies at an uncloaked commander', ['pursuit', 'scripted'].includes(pirate.state.flownBy), pirate.state.flownBy);
  seedWorld(11);
  pirate.update(1 / 60, player, view(true));
  check('...and not at a cloaked one', !['pursuit', 'scripted'].includes(pirate.state.flownBy), pirate.state.flownBy);
}

console.log('\nthe key, the bank, the shot and the dock');
{
  const g = arrived(20_260_980);
  const s = g.state;
  const said = () => s.session.messageText;
  // The key, through the input, as a finger or a keyboard sends it. The
  // arrival's tunnel takes the keyboard while it plays, so the test steps
  // through it first.
  let at = 50;
  withoutSaving(() => { for (let f = 0; f < 240; f++) g.step(1 / 60, at += 1 / 60); });
  const press = (): void => { withoutSaving(() => { g.input.injectPress('KeyZ'); g.step(1 / 60, at += 1 / 60); }); };
  press();
  check('a ship without the fit is told so', /NO CLOAKING DEVICE/.test(said()) && !s.session.cloaked);
  s.commander.equipment.cloak = true;
  press();
  check('with the fit, the key cloaks the ship', s.session.cloaked && /CLOAKED/.test(said()));
  const before = s.sys.energy;
  withoutSaving(() => { for (let f = 0; f < 60; f++) g.step(1 / 60, at += 1 / 60); });
  check(`a second of cloak costs about ${CLOAK_ENERGY_PER_SECOND.toFixed(1)} points, net of recharge`,
    s.sys.energy < before, `${before} -> ${s.sys.energy}`);
  // The trigger drops it.
  const fire = keymap().fire[0];
  withoutSaving(() => { g.input.press(fire); g.step(1 / 60, at += 1 / 60); g.input.release(fire); });
  check('a shot drops the cloak, and says why', !s.session.cloaked && /A SHOT IS A FLARE/.test(said()));
  // The last bank drops it.
  press();
  s.sys.energy = CLOAK_MIN_ENERGY + 0.5;
  withoutSaving(() => { for (let f = 0; f < 30 && s.session.cloaked; f++) g.step(1 / 60, at += 1 / 60); });
  check('the last bank drops the cloak, and says why', !s.session.cloaked && /ENERGY LOW/.test(said()));
  check('...and the bank is not spent past it', s.sys.energy > 0 && s.sys.energy <= MAX_ENERGY);
  // A dock drops it.
  press();
  check('cloaked again', s.session.cloaked);
  withoutSaving(() => g.enterDocked());
  check('a dock drops the cloak', !s.session.cloaked);
}
