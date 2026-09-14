// Review experiment: move one pirate along a known path and fly the real player.
// Usage from the repository root:
//   node --experimental-strip-types --no-warnings docs/reviews/combat-computer-2026-09-12/probe.mjs
// Add --holdout for the independent orbit grid; add --hard-gate for the candidate.
// It prints JSON lines. It runs no career, shots, damage, saves or browser code.
// The target stays selected to isolate tracking from target-switch decisions.
// Orbit radius describes the path around the origin, not the player's distance.
// The first ten seconds are excluded from sustained-tracking measurements.
// rollsPerMinute counts absolute roll travel, including changes of direction.
// firstLock is the first valid firing angle and range; it is not a sustained lock.
import * as THREE from 'three';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PlayerShip } from '../../../src/player.ts';
import { NpcShip } from '../../../src/game/npc.ts';
// The variant changes only the co-pilot call's optional roll gate. The shared
// steering rule, flight model, lead, throttle and gun cone stay as shipped.
const sourceUrl = new URL('../../../src/game/scripted-co-pilot.ts', import.meta.url);
const hardGate = process.argv.includes('--hard-gate');
let moduleUrl = sourceUrl.href;
let temporary;
if (hardGate) {
  let source = readFileSync(sourceUrl, 'utf8');
  const before = 'this.aim.sub(player.position), this.steerMem, cone)';
  if (source.split(before).length !== 2) throw Error('The controller changed; review the experiment before reuse.');
  source = source.replace(before, 'this.aim.sub(player.position), this.steerMem, cone, 0.1)');
  source = source.replace(/from '([^']+)'/g, (whole, name) => {
    if (name === 'three') return `from '${import.meta.resolve('three')}'`;
    return name.startsWith('.') ? `from '${new URL(name, sourceUrl).href}'` : whole;
  });
  temporary = mkdtempSync(join(tmpdir(), 'harmless-combat-review-'));
  const path = join(temporary, 'scripted-co-pilot.ts');
  writeFileSync(path, source);
  moduleUrl = pathToFileURL(path).href;
}
const { ScriptedCoPilot } = await import(moduleUrl);
if (temporary) rmSync(temporary, { recursive: true });
import { hitCone } from '../../../src/game/gunnery.ts';
import { LASER_RANGE } from '../../../src/constants/player-gun.ts';
import { seedWorld } from '../../../src/game/rng.ts';

const dt = 1 / 60;
const up = new THREE.Vector3(0, 1, 0);
function run(name, path, seconds, pilotClass = ScriptedCoPilot, initialSpeed = 200) {
  seedWorld(20260912);
  const player = new PlayerShip(new THREE.Vector3(), new THREE.Vector3(0, 0, -1));
  player.speed = initialSpeed;
  const target = new NpcShip('pirate', new THREE.Vector3(0, 0, -1000), 1);
  const cp = new pilotClass();
  const velocity = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const to = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const look = new THREE.Matrix4();
  const errors = [];
  const distances = [];
  let firstLock = null, onGun = 0, askFire = 0, inRange = 0, n = 0;
  let gap = 0, longestGap = 0, rollTravel = 0, rollReversals = 0, pitchReversals = 0;
  let lastRoll = 0, lastPitch = 0, maxRoll = 0;
  let minGap = Infinity;
  for (let i = 0; i < seconds * 60; i++) {
    const t = i * dt;
    path(t, target.object.position, velocity);
    target.state.speed = velocity.length();
    look.lookAt(target.object.position, ahead.copy(target.object.position).add(velocity), up);
    target.object.quaternion.setFromRotationMatrix(look);
    const step = cp.step(dt, player, [target], 0, false, null, Infinity, target);
    if (step.kind !== 'fly') throw Error('lost target');
    player.update(dt, step.demand);
    to.copy(target.object.position).sub(player.position);
    forward.set(0, 0, -1).applyQuaternion(player.quaternion);
    const distance = to.length();
    const error = forward.angleTo(to);
    const hit = error < hitCone(target.radius, distance) && distance <= LASER_RANGE;
    if (hit && firstLock === null) firstLock = t;
    minGap = Math.min(minGap, distance - target.radius);
    if (t <= 10) continue;
    n++;
    if (hit) { onGun++; gap = 0; } else { gap += dt; longestGap = Math.max(longestGap, gap); }
    if (distance <= LASER_RANGE) inRange++;
    if (step.demand.fire) askFire++;
    errors.push(error * 180 / Math.PI);
    distances.push(distance);
    rollTravel += Math.abs(step.demand.rollRate) * dt;
    maxRoll = Math.max(maxRoll, Math.abs(step.demand.rollRate));
    const r = Math.abs(step.demand.rollRate) > 0.1 ? Math.sign(step.demand.rollRate) : 0;
    const p = Math.abs(step.demand.pitchRate) > 0.1 ? Math.sign(step.demand.pitchRate) : 0;
    if (r && lastRoll && r !== lastRoll) rollReversals++;
    if (p && lastPitch && p !== lastPitch) pitchReversals++;
    if (r) lastRoll = r;
    if (p) lastPitch = p;
  }
  errors.sort((a,b) => a-b);
  distances.sort((a,b) => a-b);
  const pct = (v) => +(100 * v / n).toFixed(1);
  const result = { name, seconds, radius: target.radius, firstLock: firstLock?.toFixed(2),
    onGun: pct(onGun), requestFire: pct(askFire), inRange: pct(inRange),
    medianError: +errors[Math.floor(n / 2)].toFixed(2), p95Error: +errors[Math.floor(n * .95)].toFixed(2),
    longestGap: +longestGap.toFixed(2), medianDistance: +distances[Math.floor(n / 2)].toFixed(0),
    minHullGap: +minGap.toFixed(1), rollsPerMinute: +(rollTravel / (2 * Math.PI) / (n * dt) * 60).toFixed(2),
    rollReversals, pitchReversals, maxRoll: +maxRoll.toFixed(3),
  };
  console.log(JSON.stringify(result));
  return result;
}
const orbit = (radius, speed, plane, phase = 0) => (t, position, velocity) => {
  const a = t * speed / radius + phase;
  const x = Math.cos(a) * radius, y = Math.sin(a) * radius;
  const vx = -Math.sin(a) * speed, vy = Math.cos(a) * speed;
  if (plane === 'horizontal') { position.set(x, 0, y); velocity.set(vx, 0, vy); }
  if (plane === 'vertical') { position.set(0, x, y); velocity.set(0, vx, vy); }
  if (plane === 'tilted') { position.set(x, y / Math.SQRT2, y / Math.SQRT2); velocity.set(vx, vy / Math.SQRT2, vy / Math.SQRT2); }
};

for (const seconds of process.argv.includes('--holdout') ? [] : [30, 60]) {
  for (const plane of ['horizontal', 'vertical', 'tilted']) {
    for (const radius of [400, 800, 1600]) {
      for (const speed of [150, 300]) run(`${plane}-r${radius}-v${speed}`, orbit(radius, speed, plane), seconds);
    }
  }
  run('straight-crossing', (t, p, v) => { p.set(-900 + 150 * t, 0, -700); v.set(150, 0, 0); }, seconds);
  run('weaving-away', (t, p, v) => { p.set(350 * Math.sin(.8 * t), 0, -1200 - 180 * t); v.set(280 * Math.cos(.8 * t), 0, -180); }, seconds);
  run('straight-away', (t, p, v) => { p.set(0, 0, -1800 - 280 * t); v.set(0, 0, -280); }, seconds);
}

if (process.argv.includes('--holdout')) {
  for (const seconds of [45, 90]) {
    for (const plane of ['horizontal', 'vertical', 'tilted']) {
      for (const radius of [600, 1200, 2400]) {
        for (const speed of [200, 350]) {
          for (const phase of [.7, 2.1, 4.2]) {
            run(`${plane}-r${radius}-v${speed}-phase${phase}`, orbit(radius, speed, plane, phase), seconds);
          }
        }
      }
    }
  }
}

export { run, orbit };
