// Which systems the charts ring in red — the model half of the danger overlay.
//
// The living galaxy already knows where the pirates work. Until now, the only
// way to hear about it was a cursor on a world and a read of its data screen.
// This turns the same fact into something visible across all 256 dots at
// once.
//
// It is a MODEL, deliberately: `ui/screens.ts` paints what this returns and
// decides nothing. That is the HUD's model and painter split
// (docs/ARCHITECTURE.md), and invariant 10: a derived economic quantity does
// not live in a render file. It is also what lets a test drive the rule with no
// canvas.
//
// Pure and read-only by construction. It is handed a `danger` LOOKUP, and never
// the LivingGalaxy itself. So a draw path cannot reach `state()` and insert an
// entry for a system merely because it drew it.

import { DANGER_VISIBLE } from '../constants/living-galaxy.ts';
import type { StarSystem } from './galaxy.ts';

/**
 * The systems whose piracy is public knowledge — the same threshold the data
 * screen's headline uses, so the ring and the news line always agree.
 *
 * A Set rather than a list: both painters ask "is this dot flagged?" once per
 * system while walking all 256 of them.
 */
export function dangerousSystems(
  systems: StarSystem[],
  danger: (systemIndex: number) => number,
): Set<number> {
  const flagged = new Set<number>();
  for (const s of systems) {
    if (danger(s.index) > DANGER_VISIBLE) flagged.add(s.index);
  }
  return flagged;
}
