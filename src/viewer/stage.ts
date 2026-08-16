// The canvas, the camera and the bloom — the part both dev pages share.
//
// There are two of them now (TODO 57): `/viewer` is the combat viewer and
// `/gallery` is the 38 released hulls. They used to be one page, with a `G` key
// between them. So `/viewer` opened on the gallery, with a combat dropdown
// underneath it, and the combat viewer read as deleted.
//
// What they genuinely share is the scaffolding: a WebGL context, a bloom pass at
// one strength, a starfield and a resize handler. That is here so there is one
// answer to "what does a dev page look like" rather than two that drift — and it
// is ALL that is here. Neither page's controls, HUD or keys live in this file;
// each owns its own, which is the whole point of the split.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BLOOM, MAX_PIXEL_RATIO } from '../constants/render.ts';

import { createStarfield } from '../world/starfield.ts';

export interface Stage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** draw one frame at the current window size */
  render(): void;
}

/** A lit, starfielded scene sized to the window, on the `#scene` canvas. */
export function createStage(): Stage {
  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  const scene = new THREE.Scene();
  // 55 degrees, NOT the game's CAMERA_FOV of 60, and 200,000 rather than
  // CAMERA_FAR. Nothing records whether the difference is deliberate, so they
  // stay literals. A reach for the game's constants here would reframe both
  // dev pages. That is a decision to MAKE, after a look at the two, rather than
  // a side effect of a tidy-up. The bloom and the pixel-ratio clamp DID
  // belong with engine/render-stack.ts, and went there: they are
  // `constants/render.ts` now, read by both (docs/TODO/118).
  const camera = new THREE.PerspectiveCamera(55, 1, 1, 200000);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(
    new THREE.Vector2(1, 1), BLOOM.strength, BLOOM.radius, BLOOM.threshold));

  const resize = (): void => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();
  scene.add(createStarfield(2200, 90000));

  return { scene, camera, render: () => composer.render() };
}
