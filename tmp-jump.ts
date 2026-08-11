import * as THREE from 'three';
import { planDocking, makeDockPlan } from './src/game/docking.ts';
import { dockPath, makeDockPath } from './src/game/dock-path.ts';
const station = new THREE.Object3D(); station.updateMatrixWorld(true);
const DOCK_Z = 160, dt = 1 / 60;
const p = 90 * Math.PI / 180;
const pos = new THREE.Vector3(Math.sin(p), 0, -Math.cos(p)).multiplyScalar(2000);
const plan = makeDockPlan(); const path = makeDockPath();
const last = new THREE.Vector3(); const rows: string[] = [];
for (let f = 0; f < 6000; f++) {
  const before = plan.phase;
  planDocking(pos, station, DOCK_Z, 400, plan);
  dockPath(pos, station, DOCK_Z, plan.swing, before === 'run', path);
  const jump = f > 0 ? last.angleTo(plan.heading) * 180 / Math.PI : 0;
  rows.push(`f=${f} ${before}->${plan.phase} pos=(${pos.x.toFixed(0)},${pos.z.toFixed(0)})`
    + ` lat=${Math.hypot(pos.x, pos.y).toFixed(0)} aim=(${path.aim.x.toFixed(0)},${path.aim.z.toFixed(0)})`
    + ` toGo=${path.toGo.toFixed(0)} jump=${jump.toFixed(1)}°`);
  if (jump > 5) { console.log(rows.slice(-4).join('\n')); break; }
  last.copy(plan.heading);
  if (plan.arrived) break;
  pos.addScaledVector(plan.heading, plan.speed * dt);
}
