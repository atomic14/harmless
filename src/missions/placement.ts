// Where a leg happens: the one draw that picks its world.
//
// `pickInBand` is the Constrictor's own target rule, as the old five-stage
// machine drew it (docs/TODO/190). It makes ONE random draw, and only when the
// band has a candidate. A draw advances the shared world stream, so an extra
// one changes every result after it.

import type { StarSystem } from '../galaxy/galaxy.ts';
import { distanceTenths } from '../galaxy/navigation.ts';
import type { CommanderFacts, MissionState, Placement } from './model.ts';

/**
 * A system between `min` and `max` tenths of a light year from `here`. It is
 * never `here` itself. Null means the galaxy has none in that band.
 */
export function pickInBand(
  systems: readonly StarSystem[], here: number,
  band: { min: number; max: number }, rng: () => number,
): number | null {
  const from = systems[here];
  const candidates = systems.filter((s) => {
    const d = distanceTenths(from, s);
    return s.index !== here && d >= band.min && d <= band.max;
  });
  if (!candidates.length) return null;
  return candidates[Math.floor(rng() * candidates.length)].index;
}

/**
 * The world a leg is placed at, as the leg starts.
 *
 * `ok: false` means the placement found nothing. The machine then leaves the
 * mission on its current leg, as the 1984 courier stage waited for a dock with
 * a candidate. A `handover` placement is `ok: false` until the arc plan, item
 * 192 of docs/TODO/190, builds the jump graph it needs.
 */
export function placeLeg(
  place: Placement, state: MissionState, commander: CommanderFacts,
  systems: readonly StarSystem[], rng: () => number, skeleton: string,
): { ok: true; target: number | null } | { ok: false } {
  switch (place.kind) {
    case 'here': return { ok: true, target: commander.systemIndex };
    case 'anywhere': return { ok: true, target: null };
    case 'origin': {
      // The world of the latest acceptance: the journal holds it.
      const accepted = state.journal.filter((j) => j.skeleton === skeleton && j.outcome === 'accepted');
      const last = accepted[accepted.length - 1];
      return last ? { ok: true, target: last.world } : { ok: false };
    }
    case 'band': {
      const target = pickInBand(systems, commander.systemIndex, place, rng);
      return target === null ? { ok: false } : { ok: true, target };
    }
    case 'world': return { ok: true, target: place.seedSlot };
    case 'entity': {
      const e = state.entities[place.tag];
      return e ? { ok: true, target: e.lastWorld } : { ok: false };
    }
    case 'handover': return { ok: false };
  }
}
