// The trained brain flies a narrow view of a ship, and a fixture proves it.
//
// `game/npc-pilot.ts` and `game/npc-brain-pilot.ts` came out of `game/npc.ts`
// in docs/TODO/183 M1. Chris named the cause on 2026-08-17: the project never
// used a good OO approach, so every earlier cut asked what narrow interface a
// free FUNCTION would need and measured a wide seam.
//
// THE CLAIM HERE IS NOT `test/hostility.test.ts`'s, AND THAT IS THE POINT.
// That file holds that a fleet RULE names no ship class, which is right for a
// rule. **A pilot needs the whole ship.** So the claim that holds is narrower
// and truer: the ship a pilot FLIES is a `PilotShip`, and every import from
// `npc.ts` is `import type` — erased, so there is no cycle at runtime.
//
// TWO KINDS OF EVIDENCE, and neither one is enough alone:
//
//  1. A SOURCE SCAN. The pilot's own parameter is a `PilotShip`, and nothing it
//     imports from `npc.ts` is a value. A scan can go green because it is
//     broken, so a file that DOES import a value from `npc.ts` is read by the
//     same code, as the control.
//  2. A FIXTURE. The pilot is flown off an object literal with no hull, no
//     geometry and no energy bank. A scan cannot say whether the context is
//     honestly narrow. This can.
//
// WHAT IS NOT HERE. Whether a brain flies WELL is `train/`'s question, and
// `test/combat-model.test.ts` holds the rate ramps it spends. This file holds
// that a pilot needs a ship-shaped thing rather than the ship.

import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { brainFly } from '../src/game/npc-brain-pilot.ts';
import type { PilotShip } from '../src/game/npc-pilot.ts';
import { freshNpcState } from '../src/game/npc-state.ts';
import { seedWorld } from '../src/game/rng.ts';
import { check, eq } from './harness.ts';
import { defendShaped } from './fixtures.ts';

// --- the pilot flies a PilotShip, and imports no value from npc.ts ----------

console.log('\nthe trained brain flies a narrow view of a ship');
{
  const src = (path: string) =>
    readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  const pilot = src('game/npc-brain-pilot.ts');
  check('brainFly takes a PilotShip', /ship: PilotShip/.test(pilot));
  check('...and nothing it flies is typed NpcShip',
    !/ship: NpcShip|: readonly NpcShip\[\]/.test(pilot));

  // EVERY npc.ts IMPORT IS TYPE-ONLY. That is what makes the cycle a paper one:
  // TypeScript erases it, so at runtime `npc.ts` imports a pilot and a pilot
  // imports nothing back.
  const npcImports = [...pilot.matchAll(/^import(.*?)from '\.\/npc\.ts';$/gm)]
    .map((m) => m[1]);
  check(`brainFly imports from npc.ts type-only (${npcImports.length} import(s))`,
    npcImports.length > 0 && npcImports.every((i) => i.trim().startsWith('type')));

  // The control. Without it, a scan that read the wrong file or a pattern that
  // matched nothing would report exactly the same green.
  const valueReader = src('game/world.ts');
  check('...and the scan is not vacuous — game/world.ts imports a VALUE from it',
    /^import \{[^}]*NpcShip[^}]*\} from '\.\/npc\.ts';$/m.test(valueReader));
}

// --- ...and a ship it flies is not a ship -----------------------------------
//
// The narrowest thing `PilotShip` describes. There is no hull here, no
// geometry, no weapon and no roster row. `NpcShip` satisfies the same
// interface, and this fixture shows that it does not have to.

console.log('a brain flies an object literal');
{
  seedWorld(20_260_818);

  const ship = (): PilotShip & { advanced: () => number } => {
    let advanced = 0;
    const state = freshNpcState(128);
    state.pos = new THREE.Vector3();
    state.quat = new THREE.Quaternion();
    const object = new THREE.Object3D();
    return {
      object,
      role: 'pirate',
      maxSpeed: 250,
      turnRate: 1.2,
      accel: 40,
      speedFloor: 50,
      healthFraction: 1,
      tacticHull: { radius: 30, maxSpeed: 250, turnRate: 1.2 },
      state,
      facing: () => 0,
      steerToward: () => {},
      advance(dt: number) { advanced += dt; },
      advanced: () => advanced,
    };
  };

  const DT = 1 / 60;
  const target = new THREE.Vector3(0, 0, -400);
  const level = new THREE.Quaternion();

  {
    const it = ship();
    const shot = brainFly(it, defendShaped, DT, target, level, 0, 400, null);
    // THE STAMP IS THE CLAIM docs/TODO/88 IS ABOUT. `update` clears `flownBy`
    // before it dispatches, so a pilot that flies and does not stamp reports
    // nothing at all.
    eq('a brain stamps what flew the ship', it.state.flownBy, 'brain');
    eq('...and it advanced the ship it was given', it.advanced(), DT);
    check('...and it took no shot, because it was told to shoot at nothing',
      shot === null);
  }

  {
    // A decision is taken on the first frame, and held for `DECISION_INTERVAL`.
    // The clock is the ship's, so two pilots over one ship share it.
    const it = ship();
    brainFly(it, defendShaped, DT, target, level, 0, 400, null);
    check('a brain leaves a control on the ship it flew',
      it.state.brainControl !== null);
    check('...and it set a decision clock', it.state.brainTimer > 0);
  }

  {
    // The trigger is `gunnery.ts`'s rule rather than the policy's own output,
    // which is why a shot needs something to shoot AT.
    const it = ship();
    it.state.fireCooldown = 0;
    const shot = brainFly(it, defendShaped, DT, target, level, 0, 400, 'player');
    check('a brain told to shoot at the commander can report a laser',
      shot === null || (shot.at === 'player' && shot.weapon === 'laser'));
  }
}
