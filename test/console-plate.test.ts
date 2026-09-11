// The console line's plate belongs to its words — GitHub #37, docs/TODO/172.
//
// While a screen is open, `#message` gets a background and a border, because a
// screen is 92% opaque and amber text over it is unreadable without a ground of
// its own. `#message` is `position: absolute`, so it is a block box, and an
// empty one still paints 12px of vertical padding and a 1px border. That bare
// rectangle is what Chris photographed.
//
// TWO CLAIMS, AND THE PAIR IS THE POINT.
//
//  - THE PLATE. `body.screen-open #message` declares a background or a border.
//  - THE VANISH. A rule hides `#message` while it holds nothing.
//
// A gate that only asked for the `:empty` rule would pass on a stylesheet that
// had dropped both, which is a different design and not this one. So the day
// somebody gives the line a plate, the plate already knows how to go.
//
// THE THIRD CLAIM IS BEHAVIOUR, and the stylesheet cannot state it. `:empty`
// matches an element with no child node at all. The painter must therefore
// leave none. A writer that assigned `' '` or an empty `<span>` would defeat
// the selector and say nothing, so the real painter is driven here.

import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { Hud } from '../src/hud/hud.ts';
import { buildHudFrame } from '../src/hud/hud-binding.ts';
import { freshState } from '../src/game/state.ts';
import { newCommander } from '../src/game/commander.ts';
import { captureById } from './screen-capture.ts';
import { check, eq } from './harness.ts';

console.log('\nthe console plate goes with its words');

// --- the stylesheet: a plate that knows how to disappear ---------------------
{
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  // A selector's OWN block, the reader test/help-overlay.test.ts uses: the
  // `\s*\{` refuses to reach across a nested rule, and the selector is escaped
  // so that `body.screen-open` cannot match `bodyXscreen-open`.
  const blockOf = (selector: string): string | null => {
    const literal = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = css.match(new RegExp(`^${literal}\\s*\\{([^}]*)\\}`, 'm'));
    return m ? m[1] : null;
  };

  const plate = blockOf('body.screen-open #message') ?? '';
  const hasPlate = /(^|[\s;])(background|border):/.test(plate);
  check('a screen gives the console line a plate of its own',
    hasPlate,
    'body.screen-open #message declares neither a background nor a border'
    + ' — if that is deliberate, the :empty rule below is no longer needed');

  const empty = blockOf('#message:empty');
  check('...and the plate goes when the words do',
    empty !== null && /display:\s*none/.test(empty),
    'no `#message:empty { display: none }` rule, so an empty line still paints'
    + ` its ${hasPlate ? 'plate' : 'plate — except that the plate is gone too'}`);
}

// --- the painter: an emptied line holds no child node ------------------------
{
  const state = freshState(newCommander());
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  /** What the real painter writes into `#message` for one frame. */
  const painted = (messageText: string, messageTimer: number): string => {
    const frame = buildHudFrame({
      commander: state.commander,
      sys: state.sys,
      world: {
        planetPos: V(0, 0, 1e6),
        planetRadius: 1000,
        sunPos: V(0, 0, -1e6),
        station: { position: V(0, 0, 1e6) },
        npcs: [],
      },
      camera: new THREE.PerspectiveCamera(),
      playerPos: state.player.position,
      playerQuat: state.player.quaternion,
      playerForward: V(0, 0, -1),
      viewDir: V(0, 0, -1),
      missiles: [], canisters: [], targetLock: null, inFlight: false,
      exercise: null,
      prompts: [],
      messageText,
      messageTimer,
    } as unknown as Parameters<typeof buildHudFrame>[0], {
      a: V(0, 0, 0), b: V(0, 0, 0), c: V(0, 0, 0), q: new THREE.Quaternion(),
    });
    // captureById returns innerHTML, then textContent, then ''. A single space
    // is truthy, so it survives that fallback and this assertion sees it.
    return captureById(() => new Hud().render(1 / 60, frame)).get('message') ?? '';
  };

  eq('a live line reaches the element (the control)',
    painted('BOUNTY: 6.5 Cr', 1.5), 'BOUNTY: 6.5 Cr');
  eq('a timed-out line leaves nothing at all, so :empty matches',
    painted('BOUNTY: 6.5 Cr', 0), '');
}
