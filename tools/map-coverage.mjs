// Which parts of the game does the map never name?
//
// `docs/ARCHITECTURE.md` is the map, and a reader opens it first. `CLAUDE.md`
// names it under "Sources of truth". The decomposition programme moved nine
// responsibilities out of `game.ts` (docs/TODO/150, docs/TODO/155). Four more
// splits followed it. Every module header was repaired. The map was not, so it
// carried three false claims until docs/TODO/166.
//
// THE MAP'S OWN CITATIONS ALL RESOLVE, so a path check finds nothing. It names
// 53 files, and every one of them is on disk. The rot went the other way: the
// tree gained fourteen modules, and the map gained no word about any of them.
// This tool asks that reverse question.
//
// IT REPORTS. IT NEVER FAILS THE BUILD. A map is not an index. A gate that
// demanded a line per file would turn the map into an index, which is the one
// thing the map must not become. The number below is for a person to read. It
// has the same standing as the `-ing` count in `tools/ste.mjs`.
//
// So read it after a split. A module that holds a subject the map describes
// wants a line. A module that holds a detail does not.
//
// Run: node tools/map-coverage.mjs   (also `npm run map:report`, and part of
// `npm run check`)

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MAP = 'docs/ARCHITECTURE.md';
const ROOT = 'src/game';

/**
 * Above this many lines, a module is worth a look in the map.
 *
 * It is half of the 400-line ceiling in `tools/sizes.mjs`. That ceiling detects
 * a file with two responsibilities. This number detects a file with ONE
 * responsibility that is large enough to name.
 *
 * A lower number reports the small helpers. The map must not list those, so a
 * lower number would report work that nobody should do.
 */
const LIMIT = 200;

/**
 * A generated file is data, and the map describes code.
 *
 * `npm run generate:elite-a` writes the three files this skips. Their length is
 * the pack's, and no reader opens one to learn the shape of the game.
 */
const GENERATED = /\.generated\.ts$/;

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = join(dir, e.name);
  if (e.isDirectory()) return walk(p);
  return /\.ts$/.test(e.name) && !GENERATED.test(e.name) ? [p] : [];
});

const map = readFileSync(MAP, 'utf8');

/**
 * The shortest name that identifies this module to a reader of the map.
 *
 * `src/game/combat-sim.ts` and `src/game/screens/combat-sim.ts` share a base
 * name. So a file in a subdirectory carries that directory, and the map must
 * write it the same way. `screens/survivors.ts` in the map is the worked
 * example.
 */
function mapName(path) {
  const parts = path.split('/');
  return parts.length > 3 ? parts.slice(-2).join('/') : parts[parts.length - 1];
}

const modules = walk(ROOT)
  .map((path) => ({ path, n: readFileSync(path, 'utf8').split('\n').length }))
  .filter((f) => f.n > LIMIT)
  .map((f) => ({ ...f, named: map.includes(mapName(f.path)) }));

const missing = modules.filter((f) => !f.named).sort((a, b) => b.n - a.n);

for (const f of missing) console.log(`      ${String(f.n).padStart(5)}  ${f.path}`);

console.log(`map: ${missing.length} of ${modules.length} modules over ${LIMIT} lines`
  + ` are named nowhere in ${MAP}`);
console.log('This run reports. No build turns red on it (docs/TODO/166 M3).');
