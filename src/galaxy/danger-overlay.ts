// Which systems the charts ring in red — the model half of the danger overlay.
//
// The living galaxy already knows where pirates are working; until now the only
// way to hear about it was to put the cursor on a world and read its data
// screen. This turns the same fact into something visible across all 256 dots
// at once.
//
// It is a MODEL, deliberately: `ui/screens.ts` paints what this returns and
// decides nothing. That is the HUD's model/painter split (docs/ARCHITECTURE.md)
// and invariant 10 — a derived economic quantity does not live in a render
// file — and it is what lets the rule be tested without a canvas.
//
// Pure and read-only by construction: it is handed a `danger` LOOKUP, never the
// LivingGalaxy itself, so a draw path cannot reach `state()` and insert an
// entry for a system merely by drawing it.

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
