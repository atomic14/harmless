// The shell, implemented against a browser.
//
// Every DOM and window API the game uses is in this file and nowhere else. It
// is the whole port surface: a desktop build writes one of these against its
// own toolkit and changes nothing in `src/game/`.
//
// Each member is here because it was a line in game.ts. The comments say which
// so the mapping stays checkable.

import type * as THREE from 'three';
import { createRenderStack } from './render-stack.ts';
import { elementById } from './inert-dom.ts';
import { sightFraction } from './sight.ts';
import type { Shell, Presentation } from './shell.ts';

export function browserShell(canvas: HTMLCanvasElement, scene: THREE.Scene): Shell {
  const stack = createRenderStack(canvas, scene);

  const view: Presentation = {
    camera: stack.camera,
    beams: stack.beams,
    // was `this.render.composer.render()` in Game.draw
    draw: () => stack.composer.render(),
    // The console's height decides where the sight sits (engine/sight.ts). It
    // is measured here, at each resize, because only the browser knows it.
    // A screen-open console hides by visibility, so it still has a height.
    // The two custom properties hand the same answer to the stylesheet. The
    // crosshair and the ship-ID line read `--sight-y`. The console lines on a
    // narrow window stand on `--console-h`.
    resize: (w, h) => {
      const consoleHeight = document.getElementById('hud')?.offsetHeight ?? 0;
      const sightY = sightFraction(consoleHeight, h);
      const root = document.documentElement.style;
      root.setProperty('--sight-y', `${(sightY * 100).toFixed(2)}%`);
      root.setProperty('--console-h', `${consoleHeight}px`);
      return stack.resize(w, h, sightY);
    },
  };

  return {
    view,

    // was `window.addEventListener('resize', ...)` in the constructor
    onResize: (fn) => { window.addEventListener('resize', () => fn()); },

    // was a listener on `#screen` in the constructor. The listener lives on the
    // persistent overlay container, since screen contents are re-rendered
    // wholesale, and it passes the closest element carrying data-key/data-row.
    onScreenClick: (fn) => {
      document.getElementById('screen')!.addEventListener('click', (e) => {
        const el = (e.target as HTMLElement).closest('[data-key],[data-row]');
        fn(el ?? e.target, e);
      });
    },

    // The pointer's twin of the above, on the same persistent container. No
    // `closest()` lookup: hover has no data-key or data-row meaning, and the
    // only thing that answers it is a canvas, which is `e.target` already.
    onScreenMove: (fn) => {
      document.getElementById('screen')!.addEventListener('mousemove', (e) => {
        fn(e.target, e);
      });
    },

    // was the requestAnimationFrame pair at the end of the constructor
    runLoop: (frame) => {
      const tick = (now: number): void => {
        frame(now);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },

    // was `document.documentElement.style.setProperty('--sight-r', ...)`
    setSightRadius: (px) => {
      document.documentElement.style.setProperty('--sight-r', `${Math.round(px)}px`);
    },

    // was the `#crosshair` lookup in Game.updateSight — the last DOM reference
    // in game.ts. It is presentation rather than a rule. The Game decides
    // whether the shot would land. The shell decides what that looks like.
    setSightLit: (on) => { elementById('crosshair').classList.toggle('locked', on); },

    // was the `toggleHelp` case in runCommand
    toggleHelp: () => { document.getElementById('help')!.classList.toggle('hidden'); },

    // was the `#bomb-flash` block in detonateEnergyBomb. The offsetWidth read
    // is a forced reflow — it restarts the CSS animation, so two bombs in quick
    // succession both flash. Deleting it would look like it worked once.
    flashBomb: () => {
      const flash = document.getElementById('bomb-flash');
      if (!flash) return;
      flash.classList.add('boom');
      void flash.offsetWidth;
      flash.classList.remove('boom');
    },

    size: () => ({ width: window.innerWidth, height: window.innerHeight }),
  };
}
