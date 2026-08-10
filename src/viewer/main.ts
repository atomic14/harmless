// Combat viewer: watch the pilots the game ships actually fly.
//
// It replays `ai-training/scenario.ts` — the same episodes the trainer scores —
// with the real wireframe hulls, so a pilot can be WATCHED rather than read off
// a table. The design gallery used to be on the same page behind a `G` key,
// which meant this page opened on the gallery and the combat viewer read as
// deleted; it is `/gallery` now (viewer/gallery-main.ts) and neither page has a
// mode key.
//
// This file is the page's DOM SHELL and nothing else: canvas, HUD, keys, and
// the frame loop. The rows — which fight, flown by which pilot — are
// `./scenarios.ts`, which is DOM-free so `npm test` can build and fly every
// row headless. That split is the fix for this page's 2026-08 outage: a
// module-scope call here still loaded a trained brain after the trained line
// was retired, so `/viewer` threw at import and nothing went red
// (docs/TODO/102). Anything that can go stale against the game belongs in
// scenarios.ts, under the gate; nothing here may ask for a brain.

import * as THREE from 'three';

import { buildShip } from '../ships/geometry.ts';
import { requireShipDef } from '../ships/registry.ts';
import { shipDesignIdOf } from '../game/ship-identity.ts';
import { SPECS } from '../game/ship-specs.ts';
import { createStage } from './stage.ts';
import { Episode, type ShotEvent, type EpisodeShip } from '../ai-training/scenario.ts';
import { FIXED_DT } from '../constants/world-clock.ts';
import {
  SCENARIOS, SHIPPED_DEFENCE, SHIPPED_PIRATE, scenarioById, type ViewerScenario,
} from './scenarios.ts';

/** The two hulls the combat scenarios fly, resolved through the registry. */
const COBRA_MK3 = requireShipDef(shipDesignIdOf(10));
const SIDEWINDER = requireShipDef(shipDesignIdOf(17));

/**
 * What the two sides are painted, read from the roster rather than copied.
 *
 * These were `0xff9a5c` and `0xffffff` written out here, which are exactly
 * `SPECS.pirate[0].color` and `SPECS.trader[0].color` — ship DATA, hand-copied
 * into a dev page, so a recoloured roster would have left this viewer showing
 * the old colours while claiming to show the fight (docs/TODO/93). Not the
 * phosphor palette: a hull colour says which ship, not which instrument.
 *
 * Index 0 of each role, which is what the copies were, so the viewer looks the
 * same as it did. Deliberately not `specForDesign` per pirate: every pirate in
 * an episode is drawn one colour here so that the eye can tell the sides apart
 * at a glance, which is the whole job of this page.
 */
const PIRATE_COLOUR = SPECS.pirate[0].color;
const TRADER_COLOUR = SPECS.trader[0].color;

// --- the scene ---------------------------------------------------------------

const { scene, camera, render } = createStage();

// --- episode visualisation ---------------------------------------------------

interface ShipView {
  sim: EpisodeShip;
  object: THREE.Group;
  isPirate: boolean;
}

let episode: Episode;
let views: ShipView[] = [];
let tracers: { line: THREE.Line; life: number }[] = [];
let seed = 1;
let scenario: ViewerScenario = SCENARIOS[0];
let paused = false;
let speed = 1;
let camMode: 'orbit' | 'chase' = 'orbit';
let elapsed = 0;

function resetEpisode(newSeed?: number): void {
  for (const v of views) scene.remove(v.object);
  for (const t of tracers) scene.remove(t.line);
  for (const m of drawnMissiles) scene.remove(m);
  views = [];
  tracers = [];
  drawnMissiles.clear();
  if (newSeed !== undefined) seed = newSeed;
  episode = scenario.build(seed);
  elapsed = 0;

  for (const p of episode.pirates) {
    const object = buildShip(p.name === 'Sidewinder' ? SIDEWINDER : COBRA_MK3, PIRATE_COLOUR);
    scene.add(object);
    views.push({ sim: p, object, isPirate: true });
  }
  const traderObj = buildShip(COBRA_MK3, TRADER_COLOUR);
  scene.add(traderObj);
  views.push({ sim: episode.trader, object: traderObj, isPirate: false });
}

/** scratch for the tracer geometry below */
const tracerDir = new THREE.Vector3();

/**
 * The warheads currently on screen.
 *
 * A missile is not an `EpisodeShip` and does not want to be: `ordnance.ts`
 * already flies a real `Object3D` for it, so this page adds that object rather
 * than building a second one to copy a position into. Kept as a set because the
 * episode's list is the truth and this is only what has been shown of it.
 *
 * It exists because pirates in an episode LAUNCH now (docs/TODO/62), and a
 * warhead is 250 of the commander's 765 pool points: without this the page would
 * show a target losing a third of herself to nothing at all, which is exactly
 * the kind of lie the viewer is here to stop telling.
 */
const drawnMissiles = new Set<THREE.Object3D>();

/** Add what has been launched, drop what has gone off. */
function syncMissiles(): void {
  const live = new Set<THREE.Object3D>();
  for (const m of episode.missiles) {
    live.add(m.object);
    if (!drawnMissiles.has(m.object)) {
      scene.add(m.object);
      drawnMissiles.add(m.object);
    }
  }
  for (const object of drawnMissiles) {
    if (live.has(object)) continue;
    scene.remove(object);
    drawnMissiles.delete(object);
  }
}

function syncViews(events: ShotEvent[]): void {
  syncMissiles();
  for (const v of views) {
    v.object.position.set(v.sim.pos.x, v.sim.pos.y, v.sim.pos.z);
    v.object.quaternion.set(v.sim.quat.x, v.sim.quat.y, v.sim.quat.z, v.sim.quat.w);
    v.object.visible = v.sim.alive;
  }
  for (const e of events) {
    // From the NOSE, along the nose. This used to draw hull-centre to
    // target-centre, which made every shot look like it left the side of the
    // ship and curved onto the target: at any bank angle the line visibly
    // disagreed with where the ship was pointing. The sim never fired that way
    // (measured: hits average 0.5 degrees off the nose, worst 1.9), so this was
    // purely a drawing bug, and a misleading one.
    //
    // A miss now flies PAST the target instead of into it. Drawing a miss to
    // the target's centre made it look like a hit that failed to register.
    const f = e.from.forward(tracerDir);
    const r = e.from.radius;
    const ox = e.from.pos.x + f.x * r;
    const oy = e.from.pos.y + f.y * r;
    const oz = e.from.pos.z + f.z * r;
    const reach = Math.hypot(e.to.pos.x - ox, e.to.pos.y - oy, e.to.pos.z - oz);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(
      e.hit
        ? [ox, oy, oz, e.to.pos.x, e.to.pos.y, e.to.pos.z]
        : [ox, oy, oz, ox + f.x * reach, oy + f.y * reach, oz + f.z * reach],
      3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: e.hit ? 0xffe9a8 : 0xff5c40,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, life: 0.2 });
  }
}

function updateCamera(dt: number): void {
  // frame the action: midpoint of living ships, distance from their spread
  const alive = views.filter((v) => v.sim.alive);
  if (!alive.length) return;
  const mid = new THREE.Vector3();
  for (const v of alive) mid.add(v.object.position);
  mid.divideScalar(alive.length);
  let spread = 400;
  for (const v of alive) spread = Math.max(spread, v.object.position.distanceTo(mid) * 2.4);

  if (camMode === 'orbit') {
    const a = elapsed * 0.12;
    const offset = new THREE.Vector3(Math.cos(a), 0.35, Math.sin(a)).multiplyScalar(spread * 1.4);
    camera.position.lerp(mid.clone().add(offset), Math.min(1, dt * 2));
  } else {
    // chase the first pirate
    const p = views[0];
    const back = new THREE.Vector3(0, 40, 160).applyQuaternion(p.object.quaternion);
    camera.position.lerp(p.object.position.clone().add(back), Math.min(1, dt * 4));
  }
  camera.lookAt(mid);
}

// --- HUD & controls ----------------------------------------------------------

const hud = document.getElementById('viewer-hud')!;

function renderHud(): void {
  const p = episode.pirates[0];
  const lines = [
    `SCENARIO   ${scenario.label}`,
    `FLYING     ${scenario.flying}`,
    `SEED       ${seed}`,
    `TIME       ${episode.t.toFixed(1)}s / ${episode.maxTime}s${episode.done ? '  — DONE (auto-restart)' : ''}`,
    `TRADER     hp ${Math.max(0, episode.trader.hp).toFixed(2)}  speed ${episode.trader.speed.toFixed(0)}${episode.trader.alive ? '' : '  ✝ DESTROYED'}`,
  ];
  episode.pirates.forEach((pi, i) => {
    lines.push(
      `PIRATE ${i + 1}   hp ${Math.max(0, pi.hp).toFixed(2)}  shots ${pi.shotsFired}  hits ${pi.shotsHit}` +
      `  acc ${(pi.shotsFired ? (100 * pi.shotsHit) / pi.shotsFired : 0).toFixed(0)}%` +
      // The rack, because a fight can now turn on it: 250 pool points a round.
      `  msl ${pi.missilesFired}/${pi.missilesCarried}${pi.alive ? '' : '  ✝'}`);
  });
  // What ships, asked for rather than typed out (scenarios.ts asks
  // brain-names.ts): two code pilots, nothing trained.
  lines.push('', `SHIPPED    opposition ${SHIPPED_PIRATE} · defence ${SHIPPED_DEFENCE} — code pilots, no trained policy`);
  if (p) lines.push(`FITNESS    ${episode.fitnessAttack(0).toFixed(2)} (attack metric, pirate 1)`);
  hud.textContent = lines.join('\n');
}

// The rows are built here, from the table, so a label and the weights under it
// cannot come apart — which is how this page came to show a pack it does not
// ship under a label implying it does.
const scenarioSelect = document.getElementById('scenario') as HTMLSelectElement;
for (const s of SCENARIOS) {
  const option = document.createElement('option');
  option.value = s.id;
  option.textContent = `${s.label} — ${s.flying}`;
  scenarioSelect.append(option);
}
scenarioSelect.addEventListener('change', (e) => {
  scenario = scenarioById((e.target as HTMLSelectElement).value);
  resetEpisode(1);
});
document.getElementById('btn-restart')!.addEventListener('click', () => resetEpisode(seed + 1));
const pauseBtn = document.getElementById('btn-pause')!;
pauseBtn.addEventListener('click', () => {
  paused = !paused;
  pauseBtn.textContent = paused ? 'RESUME' : 'PAUSE';
});
const speedBtn = document.getElementById('btn-speed')!;
speedBtn.addEventListener('click', () => {
  speed = speed === 1 ? 4 : speed === 4 ? 0.25 : 1;
  speedBtn.textContent = `SPEED ${speed}x`;
});
const camBtn = document.getElementById('btn-cam')!;
camBtn.addEventListener('click', () => {
  camMode = camMode === 'orbit' ? 'chase' : 'orbit';
  camBtn.textContent = `CAM: ${camMode.toUpperCase()}`;
});

// --- main loop ---------------------------------------------------------------

let simAccumulator = 0;
let doneTimer = 0;
let last = performance.now();

resetEpisode(1);

function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  elapsed += dt;

  if (!paused) {
    if (!episode.done) {
      simAccumulator += dt * speed;
      const events: ShotEvent[] = [];
      while (simAccumulator >= FIXED_DT) {
        simAccumulator -= FIXED_DT;
        events.push(...episode.step(FIXED_DT));
      }
      syncViews(events);
    } else {
      doneTimer += dt;
      if (doneTimer > 2.5) {
        doneTimer = 0;
        resetEpisode(seed + 1);
      }
    }
  }

  tracers = tracers.filter((t) => {
    t.life -= dt;
    (t.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, t.life / 0.2);
    if (t.life <= 0) {
      scene.remove(t.line);
      t.line.geometry.dispose();
      return false;
    }
    return true;
  });

  updateCamera(dt);
  render();
  renderHud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
