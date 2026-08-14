// Which systems the charts mark as trading away from the 1984 baseline — the
// model half of the prices overlay.
//
// Nearly every system has SOME drift. It is 243 to 251 of 256 at the samples
// the plan measured, so "has it moved" is not a question worth drawing. "Has it
// moved enough to be worth a jump" is, and that is `PRICE_DIVERGENCE_VISIBLE`.
//
// The model returns a DIRECTION and not a magnitude on purpose. The chart draws
// a tell — dear or cheap — at three pixels a system. The number already has a
// home in the market estimate, which is `M` on either chart. A second home
// would be two places to keep a price.

import { PRICE_DIVERGENCE_VISIBLE } from '../constants/living-galaxy.ts';
import { COMMODITIES, type StarSystem } from './galaxy.ts';

/** Which way a system's strongest price pressure points. */
export type PriceDrift = 'dear' | 'cheap';

/**
 * The systems trading far enough off baseline to be worth the jump, by the
 * direction of their strongest drift.
 *
 * Strongest by ABSOLUTE size. A system that is 20% dear in one good and 16%
 * cheap in another is marked dear. The bigger opportunity is the one the mark
 * is for.
 *
 * It takes a multiplier lookup rather than the galaxy, for the same reason
 * `dangerousSystems` does: a draw path must not reach `state()`, which inserts.
 */
export function divergentSystems(
  systems: StarSystem[],
  priceMultiplier: (systemIndex: number, commodity: number) => number,
): Map<number, PriceDrift> {
  const drifted = new Map<number, PriceDrift>();
  for (const s of systems) {
    let strongest = 0;
    for (let i = 0; i < COMMODITIES.length; i++) {
      const drift = priceMultiplier(s.index, i) - 1;
      if (Math.abs(drift) > Math.abs(strongest)) strongest = drift;
    }
    if (Math.abs(strongest) > PRICE_DIVERGENCE_VISIBLE) {
      drifted.set(s.index, strongest > 0 ? 'dear' : 'cheap');
    }
  }
  return drifted;
}
