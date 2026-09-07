// One deterministic pick from a world's 1984 seed.
//
// The tour (tour.ts) and the side-job roster (offers.ts) each choose from a
// short list by world. Neither may read the world's random stream, because
// a draw there moves every seeded result after it. Both use this.
// The slot keeps two picks on one world from correlating, as
// tools/species-prompts.ts learned the hard way.

import type { StarSystem } from '../galaxy/galaxy.ts';

/** An index below `n`, fixed by the world's seed and the slot. */
export function seedPick(sys: StarSystem, slot: number, n: number): number {
  let h = 0x811c9dc5;
  for (const v of [...sys.seed, slot]) {
    h ^= v & 0xffff;
    h = Math.imul(h, 0x01000193);
    h ^= h >>> 15;
  }
  return (h >>> 0) % n;
}
