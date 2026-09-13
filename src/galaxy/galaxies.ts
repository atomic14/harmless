// The eight galaxies, generated once each and kept.
//
// `generateGalaxy` is a pure function of its number, and it costs a few
// milliseconds. Three readers want a galaxy the commander is not in. The
// mission bridge names a lead's world. The story names a journal entry's
// world. The LOG draws the route (docs/TODO/213 M4). One memo, so no reader
// keeps a second copy of the same 256 systems. The bridge kept a memo of
// one galaxy at a time before this file. A story that names two galaxies
// thrashes a memo of one.

import { generateGalaxy, type StarSystem } from './galaxy.ts';

const memo = new Map<number, readonly StarSystem[]>();

/** The systems of `galaxy`, generated on the first ask and kept. */
export function galaxySystems(galaxy: number): readonly StarSystem[] {
  let s = memo.get(galaxy);
  if (!s) {
    s = generateGalaxy(galaxy);
    memo.set(galaxy, s);
  }
  return s;
}
