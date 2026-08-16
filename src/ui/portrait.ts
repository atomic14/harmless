// Where a system's inhabitant portrait lives.
//
// Nine lines and its own file, because two otherwise unrelated readers want it.
// The short-range chart's readout paints it beside the cursor. The DATA ON
// SYSTEM page paints it beside the statistics. It left in either
// one would make that file a place the other reaches through, which is what
// docs/TODO/149 split `ui/screens.ts` to stop.

import type { StarSystem } from '../galaxy/galaxy.ts';

/**
 * Where an inhabitant portrait lives, or '' if there isn't one.
 *
 * Galaxy 1 only. The filename carries the index and the system name, so a
 * galaxy 2 world usually 404s and hides itself.
 *
 * The eight galaxies share a name pool. So a system could collide on index AND
 * name, and show the wrong species. A check of the galaxy is cheaper than an
 * argument about the collision.
 *
 * The images are generated offline and committed (tools/generate-species.py),
 * so this is a plain static asset.
 *
 * It loads eagerly, and that is deliberate. `loading="lazy"` on a ~10 KB
 * on-screen image buys nothing. The intersection callback never fires in a
 * throttled tab, and the portrait stays blank while the same URL fetches
 * fine.
 */
export function portraitUrl(sys: StarSystem, galaxy: number): string {
  if (galaxy !== 1) return '';
  return `species/${String(sys.index).padStart(3, '0')}-${sys.name.toLowerCase()}.png`;
}
