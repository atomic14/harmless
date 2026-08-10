// The phosphor: is it still in one home, and does that home still say what the
// fourteen scattered copies said?
//
// docs/TODO/93 swept four colours out of fourteen homes in three spellings. Two
// things have to keep holding afterwards, and they are different in kind:
//
//   1. The SWEEP DID NOT CHANGE WHAT ANYTHING LOOKS LIKE. `alpha()` and the
//      generated `--*-rgb` triples replaced sixteen hand-written `rgba()`s, and
//      the item's whole claim is that they produce the same bytes. So the
//      spellings that were in the tree are pinned here VERBATIM, as string
//      literals — this is the one file where writing `rgba(77, 255, 92, 0.25)`
//      out by hand is the point rather than the bug, because it is testing the
//      generator against what it replaced. `tools/palette.ts` exempts this file
//      for exactly that reason.
//
//   2. THE GATE CAN FAIL. A checker that has only ever been seen passing is not
//      evidence of anything. Each of its three arms is driven with input that
//      must be rejected, so a future edit that guts one of them goes red here
//      rather than going quiet.

import { check, eq } from './harness.ts';
import { HUD, DOC, TINT, CSS_VARS, alpha, rgb24, channels } from '../src/palette.ts';
import { renderStylesheet, strayColours, posteriseCopy } from '../tools/palette.ts';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

console.log('\n--- palette ---');

// --- the values themselves ---------------------------------------------------
//
// Pinned because they ARE the game's identity: the landing page, the manual and
// the encyclopaedia are public, and a colour changing by accident is a change to
// what HARMLESS looks like. A deliberate recolour edits this list and says so.

eq('the cockpit green is unchanged', HUD.green, '#4dff5c');
eq('the cockpit dim is unchanged', HUD.dim, '#1d6b26');
eq('the cockpit amber is unchanged', HUD.amber, '#ffb444');
eq('the cockpit red is unchanged', HUD.red, '#ff4d4d');

// The SECOND palette, deliberate and named as such (Chris, 2026-08-10). If
// these ever equal the four above, the decision has been reversed by accident.
eq('the document green is unchanged', DOC.green, '#33ff33');
eq('the document amber is unchanged', DOC.amber, '#ffcc33');
// The casts are load-bearing: both objects are `as const`, so tsc knows the
// literal types cannot overlap and rejects the comparison outright. That is a
// stronger guarantee than this assertion — the day someone collapses the two
// palettes, `npm run lint` fails before `npm test` gets a chance. The runtime
// check stays for the reader, who should not have to infer the decision from a
// type error.
check('the two palettes are still two',
  (DOC.green as string) !== HUD.green && (DOC.amber as string) !== HUD.amber);

// --- alpha(): the sixteen rgba() spellings it replaced -----------------------
//
// Left column: what `alpha()` is asked for now. Right column: the exact string
// that used to be written out at that call site, copied from the tree before the
// sweep. A mismatch here is a visible change on a real screen.

const WAS: ReadonlyArray<readonly [string, string]> = [
  // hud/tunnel.ts — the station tunnel's rings, spokes and bay-mouth rim
  [alpha(HUD.green, 0.25), 'rgba(77, 255, 92, 0.25)'],
  [alpha(HUD.green, 0.85), 'rgba(77, 255, 92, 0.85)'],
  [alpha(HUD.green, 0.9), 'rgba(77, 255, 92, 0.9)'],
  // encyclopaedia/chart.ts — the 256-world map's four tones
  [alpha(DOC.green, 0.16), 'rgba(51, 255, 51, 0.16)'],
  [alpha(DOC.green, 0.92), 'rgba(51, 255, 51, 0.92)'],
  [alpha(DOC.green, 0.75), 'rgba(51, 255, 51, 0.75)'],
  // the amber and red spellings the stylesheets carried
  [alpha(HUD.amber, 0.35), 'rgba(255, 180, 68, 0.35)'],
  [alpha(HUD.red, 0.8), 'rgba(255, 77, 77, 0.8)'],
  [alpha(HUD.dim, 0.5), 'rgba(29, 107, 38, 0.5)'],
];
for (const [got, was] of WAS) eq(`alpha() still spells ${was}`, got, was);

// --- rgb24(): the three.js half -------------------------------------------
//
// `viewer/gallery.ts` needed the amber as a number and as a string, and held a
// private copy rather than converting. These are the two numbers that were
// written out — gallery's RADIUS_COLOUR and world-step's WARHEAD_FLASH.

eq('rgb24 reproduces the amber gallery and world-step held', rgb24(HUD.amber), 0xffb444);
eq('rgb24 reproduces the green', rgb24(HUD.green), 0x4dff5c);
eq('channels splits the green the way an rgba() did', channels(HUD.green).join(','), '77,255,92');
check('rgb24 refuses something that is not a #rrggbb', (() => {
  try { rgb24('greenish'); return false; } catch { return true; }
})());

// Memoised, so a draw loop calling alpha() per ring per frame does not reparse.
// The memo must not become a way for one colour to answer for another.
check('the channel memo does not confuse two colours',
  channels(HUD.green).join() !== channels(DOC.green).join()
  && channels(HUD.green).join() === '77,255,92');

// --- the generated stylesheet ------------------------------------------------

const generated = renderStylesheet();
const onDisk = readFileSync(new URL('../src/palette.css', import.meta.url), 'utf8');
eq('src/palette.css is what src/palette.ts says it is', onDisk, generated);

// Every colour lands twice — once as itself, once as the bare triple an
// `rgba(var(--x-rgb), a)` needs. Without the twin, sixteen stylesheet rules
// have nowhere to reach and the sweep would have had to invent a second home.
for (const [name, colour] of CSS_VARS) {
  const [r, g, b] = channels(colour);
  check(`--${name} is emitted with its rgb twin`,
    generated.includes(`  --${name}: ${colour};`)
    && generated.includes(`  --${name}-rgb: ${r}, ${g}, ${b};`));
}

// The one rung of the green ladder a stylesheet asks for: the landing page's
// PLAY button under the pointer, which was `#7dff88` written out in landing.css
// and is the same value the charts draw a world in range with.
eq('the lift is the value landing.css and the charts shared', TINT.lift, '#7dff88');
check('...and it reaches CSS, since landing.css needs it',
  CSS_VARS.some(([name]) => name === 'hud-green-lift'));

// --- the gate can fail -------------------------------------------------------
//
// Arm 1: a colour spelled outside the one home. Driven in all three spellings
// the tree actually held, because catching only `#4dff5c` would have missed the
// `rgba(77, 255, 92, …)` in tunnel.ts and the `0xffb444` in world-step.ts.

const scratch = mkdtempSync(join(tmpdir(), 'palette-gate-'));
const planted = (name: string, body: string): number => {
  const path = join(scratch, name);
  writeFileSync(path, body);
  return strayColours([path]).length;
};

check('the gate catches a hex copy', planted('a.ts', "const g = '#4dff5c';\n") === 1);
check('the gate catches an UPPERCASE hex copy', planted('b.ts', "const g = '#4DFF5C';\n") === 1);
check('the gate catches a 0x copy', planted('c.ts', 'const a = 0xffb444;\n') === 1);
check('the gate catches an rgba() copy', planted('d.css', 'a { color: rgba(77, 255, 92, 0.4); }\n') === 1);
check('the gate catches a tight-spaced rgba() copy', planted('e.css', 'a { color: rgba(77,255,92,.4); }\n') === 1);
check('the gate catches the document palette too', planted('f.css', 'a { color: #33ff33; }\n') === 1);
check('the gate catches a rung of the ladder', planted('g.ts', "const x = '#2a7a33';\n") === 1);
check('...and passes a file that reaches for the palette properly',
  planted('h.ts', "import { HUD } from '../palette.ts';\nconst g = HUD.green;\n") === 0);
// The near-misses matter as much: a gate that fires on anything is a gate
// somebody turns off. `#4dff5d` is one digit from the green and is not it.
check('...and does not fire on a colour that merely looks similar',
  planted('i.ts', "const g = '#4dff5d';\n") === 0);

// Arm 2: the generated stylesheet drifting from its source.
check('the gate notices a hand-edited palette.css',
  renderStylesheet() !== `${generated}\n:root { --hud-green: #00ff00; }\n`);

// Arm 3: posterise.py's STATED copy. It is Python and cannot import a .ts, so a
// copy is the honest answer — but only if something reads both ends. This is
// that something, and it found `DARK` claiming a source it never had.
eq('posterise.py\'s stated copy still matches the palette', posteriseCopy().length, 0);

// Importing the gate must not RUN it. Without the entry-point guard at the foot
// of tools/palette.ts, the import at the top of this file reaches its argv
// dispatch, finds no command, prints usage and sets `process.exitCode = 1` — so
// `npm test` printed "0 failed" and then exited non-zero, and `npm run check`
// failed with nothing in its output to say why. Asserted here rather than left
// to the runner, because a suite that fails while reporting success is the one
// failure mode that hides every other.
check('importing the gate does not set a failing exit code', !process.exitCode);
