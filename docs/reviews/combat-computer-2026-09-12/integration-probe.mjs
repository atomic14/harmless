// Review reproductions for target commitment, controller state, and automatic fire.
// Every Game operation runs inside withoutSaving(). Production code is unchanged.
import * as THREE from 'three';
import { Game } from '../../../src/game/game.ts';
import { headlessShell } from '../../../src/engine/shell.ts';
import { withoutSaving } from '../../../src/game/storage.ts';
import { seedWorld } from '../../../src/game/rng.ts';
import { pickTarget } from '../../../src/game/targets.ts';
import { ScriptedCoPilot } from '../../../src/game/scripted-co-pilot.ts';
import { CombatComputer } from '../../../src/game/combat-computer.ts';
import { Autopilot } from '../../../src/game/autopilot.ts';
import { Ordnance } from '../../../src/game/ordnance.ts';
import { dismissBriefing } from '../../../test/harness.ts';

const dt = 1 / 60;
const output = (name, values) => console.log(JSON.stringify({ name, ...values }));
function open() {
  seedWorld(20260912);
  const g = new Game(() => headlessShell());
  dismissBriefing(g);
  g.launch();
  for (let f = 0; f < 400; f++) g.step(dt, f * dt);
  g.state.world.clearNpcs();
  g.state.player.position.set(0, 40000, 0);
  g.state.player.quaternion.identity();
  g.state.player.speed = 0;
  g.state.player.pitchRate = 0;
  g.state.player.rollRate = 0;
  Object.assign(g.state.session, {
    ccEngaged: false, dcEngaged: false, dockTrial: false, dockRails: false,
    handFlown: false, torusEngaged: false, course: null, view: 0,
  });
  return g;
}
function spawn(g, role, x, z, seed = 1) {
  const n = g.state.world.spawn(role, new THREE.Vector3(x, 40000, z), seed);
  n.state.speed = 0;
  return n;
}
function run(g, frames) { for (let f = 0; f < frames; f++) g.step(dt, 20 + f * dt); }

withoutSaving(() => {
  // The public view-change command while the automatic trigger has a front target.
  {
    const g = open();
    Object.assign(g.state.commander.equipment, { combatComputer: true, rearLaser: true });
    const pirate = spawn(g, 'pirate', 0, -1000);
    const trader = spawn(g, 'trader', 0, 1000, 2);
    g.state.session.ccEngaged = true;
    g.input.injectPress('Digit2');
    run(g, 1);
    output('rear_view_autofire', {
      view: g.state.session.view, engaged: g.state.session.ccEngaged,
      laserTemp: g.state.sys.laserTemp, legalStatus: g.state.commander.legalStatus,
      traderProvoked: trader.state.provokedByPlayer,
      pirateProvoked: pirate.state.provokedByPlayer,
    });
  }
  // A lawful ship obstructs the target, with the correct front mount selected.
  {
    const g = open();
    g.state.commander.equipment.combatComputer = true;
    const pirate = spawn(g, 'pirate', 0, -1500);
    const trader = spawn(g, 'trader', 0, -700, 2);
    run(g, 1);
    output('obstructed_autofire', {
      laserTemp: g.state.sys.laserTemp, legalStatus: g.state.commander.legalStatus,
      traderProvoked: trader.state.provokedByPlayer,
      pirateProvoked: pirate.state.provokedByPlayer,
    });
  }
  // A saved in-progress turn versus its first step in a fresh game instance.
  {
    const g = open();
    const rock = spawn(g, 'asteroid', 1600, -1200);
    pickTarget(g.state.world.npcs, rock);
    run(g, 12);
    const snap = g.captureSnapshot();
    run(g, 1);
    const continued = g.captureSnapshot().player;
    const fresh = open();
    fresh.restoreSnapshot(structuredClone(snap));
    const roundTripSame = JSON.stringify(fresh.captureSnapshot().player) === JSON.stringify(snap.player);
    run(fresh, 1);
    const restored = fresh.captureSnapshot().player;
    output('save_mid_turn', { saved: snap.player, savedComputer: snap.combatComputer,
      roundTripSame, continued, restored,
      orientationDifference: new THREE.Quaternion(...continued.quat).angleTo(new THREE.Quaternion(...restored.quat)),
    });
  }
  // An inbound missile survives its launcher, so there is no ship to target.
  {
    const g = open();
    Object.assign(g.state.commander.equipment, { combatComputer: true, ecm: true });
    g.state.session.ccEngaged = true;
    const ordnance = new Ordnance(g.state.world);
    ordnance.launchHostile(g.state.player.position.clone().add(new THREE.Vector3(0, 0, -1000)));
    const auto = new Autopilot(g.state, new CombatComputer());
    const result = auto.combatSteer(dt, false, ordnance.hostileMissilePos);
    output('missile_without_ship', { inbound: ordnance.missileInbound,
      ecm: result.ecm, engaged: g.state.session.ccEngaged, events: result.events });
  }
  // Manual override and re-engagement retain the old turn rates.
  {
    const g = open();
    const rock = spawn(g, 'asteroid', 1600, -1200);
    const cp = new ScriptedCoPilot();
    let last;
    for (let i = 0; i < 30; i++) last = cp.step(dt, g.state.player, [rock], 0, false, null, Infinity, rock);
    cp.step(dt, g.state.player, [rock], 0, true, null, Infinity, rock);
    rock.object.position.set(0, 40000, -1000);
    const resumed = cp.step(dt, g.state.player, [rock], 0, false, null, Infinity, rock);
    const fresh = new ScriptedCoPilot().step(dt, g.state.player, [rock], 0, false, null, Infinity, rock);
    output('reenage_after_manual_override', { oldDemand: last.demand, resumed: resumed.demand, fresh: fresh.demand });
  }
  // reset() also leaves the sticky steering side from the previous engagement.
  {
    const g = open();
    const rock = spawn(g, 'asteroid', 0, -1000);
    rock.object.position.y = 39000;
    const cp = new ScriptedCoPilot();
    cp.step(dt, g.state.player, [rock], 0, false, null, Infinity, rock);
    cp.reset();
    rock.object.position.set(1000, 40000, -1000);
    const reset = cp.step(dt, g.state.player, [rock], 0, false, null, Infinity, rock);
    const fresh = new ScriptedCoPilot().step(dt, g.state.player, [rock], 0, false, null, Infinity, rock);
    output('reset_retains_steering_side', { reset: reset.demand, fresh: fresh.demand });
  }
  // Public Game input: a manual pause lets the real ship stop its roll.
  {
    const g = open();
    const rock = spawn(g, 'asteroid', 1600, -1200);
    pickTarget(g.state.world.npcs, rock);
    run(g, 12);
    const oldRoll = g.state.player.rollRate;
    g.input.press('ArrowUp');
    run(g, 1);
    g.input.release('ArrowUp');
    run(g, 180);
    rock.object.position.copy(g.state.player.position).addScaledVector(g.state.player.getForward(new THREE.Vector3()), 1000);
    g.state.player.speed = 0;
    const before = g.state.player.rollRate;
    g.state.session.handFlown = false;
    run(g, 1);
    output('game_reengagement', { oldRoll, before, after: g.state.player.rollRate });
  }
  // The automatic lock veto needs no firing solution or recent progress.
  {
    const g = open();
    const a = spawn(g, 'pirate', 3000 * Math.sin(.4), -3000 * Math.cos(.4));
    const b = spawn(g, 'pirate', 0, -500, 2);
    const cp = new ScriptedCoPilot();
    cp.step(dt, g.state.player, [a], 0, false, null);
    let result;
    for (let f = 0; f < 600; f++) result = cp.step(dt, g.state.player, [a,b], 0, false, null);
    const fresh = new ScriptedCoPilot().step(dt, g.state.player, [a,b], 0, false, null);
    output('commit_without_gun_solution', { seconds: 10, heldOriginal: cp.lock.held === a,
      heldFire: result.demand.fire, freshFire: fresh.demand.fire });
  }
});
