// The lead marker leads with the target's REAL speed.
//
// docs/TODO/92: it used to lead every locked ship at a constant 220 — the
// armed trader's cruise — so the one ship it aimed truly at was the one not
// shooting back, and a Fer-de-Lance at 330 was under-led by a third. The
// marker now reads `npc.state.speed` through the same `velocityOf` the ships
// aim with. A fast ship and a slow one on the same bearing must therefore get
// different lead points — the assertion below goes red if the speed is ever
// pinned to a constant again.

import * as THREE from 'three';
import { seedWorld } from '../src/game/rng.ts';
import { NpcShip } from '../src/game/npc.ts';
import { screenTargets, scannerContacts, dockingAid, shipIdUnderView } from '../src/hud/hud-model.ts';
import { CONTACT_COLORS } from '../src/hud/hud.ts';
import { dockingOutcome } from '../src/game/docking.ts';
import { ROLL_TOLERANCE } from '../src/constants/docking.ts';
import { check, eq } from './harness.ts';

console.log('\nhud model');
{
  const camera = new THREE.PerspectiveCamera(60, 1, 1, 50_000);
  camera.updateMatrixWorld();
  const scratch = new THREE.Vector3();
  const origin = new THREE.Vector3(0, 0, 0);
  const ahead = new THREE.Vector3(0, 0, -1);

  /** A locked pirate dead ahead, crossing right to left at `speed`. */
  const lockedAt = (speed: number) => {
    seedWorld(92);
    const npc = new NpcShip('pirate', new THREE.Vector3(0, 0, -2000), 0);
    npc.object.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    npc.state.speed = speed;
    return screenTargets([npc], origin, ahead, camera, 0, npc, scratch, Infinity)[0];
  };

  const slow = lockedAt(100);
  const fast = lockedAt(350);
  check('a fast ship and a slow one on the same bearing lead differently',
    !!slow?.lead && !!fast?.lead && Math.abs(fast.lead.x - slow.lead.x) > 1e-4,
    `slow ${slow?.lead?.x?.toFixed(4)}, fast ${fast?.lead?.x?.toFixed(4)}`);
  check('...and the faster ship asks for MORE lead, along its heading',
    !!slow?.lead && !!fast?.lead
    && fast.lead.x < slow.lead.x && slow.lead.x < slow.x,
    'crossing toward -X, so more speed pushes the lead further left');

  // Chris rejected a floor for the stopped case: the marker on the hull IS the
  // answer — a stopped target needs no lead, and a floor would be a new
  // constant lying about where the shot lands.
  const still = lockedAt(0);
  check('a stopped target\'s lead collapses onto the bracket',
    !!still?.lead
    && Math.abs(still.lead.x - still.x) < 1e-9
    && Math.abs(still.lead.y - still.y) < 1e-9);
}

// --- a rock hermit is named as one (docs/TODO/187) ---------------------------
//
// GitHub #40: *"It's not obvious enough that you are attacking a rock hermit.
// You need to be close before it is identified as one."* The bracket and the
// ship-ID line print the mesh's name, and the hermit's mesh comes from the
// asteroid builder, which named nothing. So the console read ASTEROID on a
// hermit at every range, and the beacon was the one tell.
{
  const camera = new THREE.PerspectiveCamera(60, 1, 1, 50_000);
  camera.updateMatrixWorld();
  const scratch = new THREE.Vector3();
  const origin = new THREE.Vector3(0, 0, 0);
  const ahead = new THREE.Vector3(0, 0, -1);
  seedWorld(187);
  const hermit = new NpcShip('hermit', new THREE.Vector3(0, 0, -3000), 0);
  const target = screenTargets([hermit], origin, ahead, camera, 0, null, scratch, Infinity)[0];
  check('a rock hermit\'s bracket names it, and not as an asteroid',
    !!target && target.label.startsWith('ROCK HERMIT'), target?.label);
  eq('...and the ship-ID line agrees',
    shipIdUnderView([hermit], origin, ahead, scratch).split(' ').slice(0, 2).join(' '),
    'ROCK HERMIT');
  const rock = new NpcShip('asteroid', new THREE.Vector3(0, 0, -3000), 0);
  const rockTarget = screenTargets([rock], origin, ahead, camera, 0, null, scratch, Infinity)[0];
  check('...while a plain rock still reads ASTEROID', !!rockTarget && rockTarget.label.startsWith('ASTEROID'),
    rockTarget?.label);
}

// --- a pod gets its own blip (docs/TODO/108) ---------------------------------
//
// `scannerContacts` narrowed the drifting objects to `{ object }`, which threw
// `kind` away one call before the blip was painted: a capsule showed in canister
// blue. The parameter is wider now, and the model is where the kind becomes a
// contact — the painter only looks the colour up.

console.log('\nscanner contacts');
{
  const at = (x: number) => ({ object: new THREE.Object3D().translateX(x) });
  const contacts = scannerContacts(
    new THREE.Vector3(0, 0, 5_000), [], [],
    [{ ...at(100), kind: 'cargo' as const }, { ...at(200), kind: 'capsule' as const }],
    0, Infinity);
  const kinds = contacts.map((c) => c.kind);
  check('a canister and a capsule are two different contacts',
    kinds.includes('cargo') && kinds.includes('pod'));
  check('...and the capsule is the pod, not more cargo',
    kinds.filter((k) => k === 'cargo').length === 1);
  check('...each painted its own colour, the capsule in its own mesh\'s',
    CONTACT_COLORS.pod !== CONTACT_COLORS.cargo && CONTACT_COLORS.pod === '#ffd24d');
}

// --- green means the dock test would pass (docs/TODO/120) ---------------------
//
// The port marker painted two states off `inSlot`, the LATERAL test alone, so a
// ship centred in the letterbox and rolled past the tolerance was told LINED UP
// one moment before `dockingOutcome` refused it. `port` is the three-state
// answer, decided here because a canvas cannot be asserted against.
//
// The rolled pose is built from ROLL_TOLERANCE itself, just over and just
// under, so this pins the rule rather than an angle.

console.log('\ndocking port marker');
{
  const camera = new THREE.PerspectiveCamera(60, 1, 1, 50_000);
  camera.updateMatrixWorld();
  const station = new THREE.Object3D();
  station.updateMatrixWorld(true);
  const DOCK_Z = 160;
  const scratch = {
    a: new THREE.Vector3(), b: new THREE.Vector3(), q: new THREE.Quaternion(),
  };

  /**
   * A ship in the slot mouth, facing the station, rolled `off` radians from the
   * slot's long axis. Built the way `planDocking` builds a docking attitude —
   * `lookAt(heading, up)` with the up-hint turned by `off` — so the pose is one
   * the game could actually fly, not a quaternion picked to satisfy the test.
   */
  const pose = (x: number, off: number) => {
    const up = new THREE.Vector3(Math.cos(off), Math.sin(off), 0);
    const quat = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().lookAt(
        new THREE.Vector3(), new THREE.Vector3(0, 0, 1), up));
    const pos = new THREE.Vector3(x, 0, -150);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
    return { pos, quat, forward };
  };
  const aidAt = (x: number, off: number) => {
    const p = pose(x, off);
    return dockingAid(
      station, DOCK_Z, p.pos, p.quat, p.forward, camera, scratch).dockAid;
  };

  const straight = aidAt(0, 0);
  check('the fixture flies a real approach: aid up, wings on the slot axis',
    !!straight && straight.inSlot && straight.rollOk && straight.roll < 1e-6);

  check('off the channel, the marker says only DOCKING PORT',
    aidAt(100, 0)?.port === 'off');
  check('...in the channel and rolled past tolerance, it says ROLL',
    aidAt(0, ROLL_TOLERANCE + 0.05)?.port === 'roll');
  check('...in the channel and within it, LINED UP',
    aidAt(0, ROLL_TOLERANCE - 0.05)?.port === 'lined');

  // The bug in one line, asserted against the dock test rather than against
  // itself: the pose the marker used to paint green is the pose the slot
  // refuses. Restore `port` to `inSlot ? 'lined' : 'off'` and this goes red.
  const rolled = pose(0, ROLL_TOLERANCE + 0.05);
  const outcome = dockingOutcome(
    rolled.pos, rolled.quat, station, DOCK_Z,
    { v: new THREE.Vector3(), q: new THREE.Quaternion(), r: new THREE.Vector3() });
  const aid = aidAt(0, ROLL_TOLERANCE + 0.05);
  check('the pose the old marker called LINED UP is the one the slot refuses',
    outcome === 'slotMiss' && aid?.inSlot === true && aid.port !== 'lined',
    `dockingOutcome ${outcome}, port ${aid?.port}`);
}
