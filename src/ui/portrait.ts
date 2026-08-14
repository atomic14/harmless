// Where a system's inhabitant portrait lives.
//
// Nine lines and its own file, because it has two readers that are otherwise
// unrelated: the short range chart's readout paints it beside the cursor, and
// the DATA ON SYSTEM page paints it beside the statistics. Leaving it in either
// one would make that file a place the other reaches through, which is what
// docs/TODO/149 split `ui/screens.ts` to stop.

import type { StarSystem } from '../galaxy/galaxy.ts';

/**
 * Where an inhabitant portrait lives, or '' if there isn't one.
 *
 * Galaxy 1 only: the filename carries index and system name, so a galaxy 2
 * world usually 404s and hides itself — but the eight galaxies share a name
 * pool, so a system could collide on index AND name and show the wrong species.
 * Cheaper to check the galaxy than to reason about the collision.
 *
 * The images are generated offline and committed (tools/generate-species.py),
 * so this is a plain static asset.
 *
 * Loaded eagerly, deliberately: `loading="lazy"` on a ~10 KB on-screen image
 * buys nothing and the intersection callback never fires in a throttled tab,
 * leaving the portrait blank while the same URL fetches fine.
 */
export function portraitUrl(sys: StarSystem, galaxy: number): string {
  if (galaxy !== 1) return '';
  return `species/${String(sys.index).padStart(3, '0')}-${sys.name.toLowerCase()}.png`;
}
