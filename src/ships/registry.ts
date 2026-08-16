// One hull per design id, and the one place anything asks for one.
//
// `game/ship-identity.ts` says WHAT a ship is. This file says what that looks
// like, and how big it is.
//
// The two stay apart (TODO 23), and that is the point. Nothing here hands back
// anything you could usefully compare to decide what a ship is. It hands back a
// mesh definition and a radius, and both come off the id.
//
// Two answers, because there are two kinds of design. An `elite-a:design:*` id
// resolves to a released hull (`elite-a-hulls.ts`). A `harmless:design:*` id
// resolves to one of ours (`harmless-hulls.ts`). The record says which.
//
// THE RADIUS IS A GAMEPLAY NUMBER, and this is its only home. It is the pack's
// own targetable radius, through `sourceGeometryToWorld`. That is what makes
// the ray tests in `game/shot.ts` and the hit cone in `game/gunnery.ts` agree
// with the released ships, rather than with a guess.

import {
  HARMLESS_OVERLAYS, shipDesign, shipDesignIdOf, type ShipDesignId,
} from '../game/ship-identity.ts';
import {
  eliteAHull, ELITE_A_HULLS, type EliteAHull,
} from './elite-a-hulls.ts';
import {
  GENERATION_SHIP, GENERATION_SHIP_RADIUS, ROCK_HERMIT_RADIUS,
} from './harmless-hulls.ts';
import type { ShipDef } from './geometry.ts';

/** What a design id resolves to: a hull to build, and how big it counts as. */
export interface RegisteredHull {
  readonly designId: ShipDesignId;
  readonly name: string;
  /** Whether the pack supplied this shape or Harmless invented it. */
  readonly source: 'elite-a' | 'harmless';
  /** null when the mesh is generated rather than tabulated — the rock hermit. */
  readonly def: ShipDef | null;
  /** World units. Ray tests, hit cones and collision separation all use it. */
  readonly targetRadius: number;
}

/** The Harmless designs, by id — two of them, and ship-identity.ts says why. */
const OWN: Record<string, RegisteredHull> = {
  [HARMLESS_OVERLAYS.generationShip.designId]: {
    designId: HARMLESS_OVERLAYS.generationShip.designId,
    name: HARMLESS_OVERLAYS.generationShip.name,
    source: 'harmless',
    def: GENERATION_SHIP,
    targetRadius: GENERATION_SHIP_RADIUS,
  },
  [HARMLESS_OVERLAYS.rockHermit.designId]: {
    designId: HARMLESS_OVERLAYS.rockHermit.designId,
    name: HARMLESS_OVERLAYS.rockHermit.name,
    source: 'harmless',
    def: null,
    targetRadius: ROCK_HERMIT_RADIUS,
  },
};

const fromSource = (id: ShipDesignId, hull: EliteAHull): RegisteredHull => ({
  designId: id,
  name: hull.name,
  source: 'elite-a',
  def: hull.def,
  targetRadius: hull.targetRadius,
});

/** The hull behind a design id. Throws on anything that is not one. */
export function registeredHull(id: ShipDesignId): RegisteredHull {
  const record = shipDesign(id);
  if (record.source === 'harmless') return OWN[record.designId];
  return fromSource(record.designId, eliteAHull(record.design.designId));
}

/**
 * The designs the game names directly rather than through the roster.
 *
 * A canister, a pod and a missile are objects rather than ships, so
 * `ship-specs.ts` has no row for them. They are still released designs with
 * released geometry, and `game/cargo.ts` and `game/ordnance.ts` have to say
 * which. They are written down once here, and validated against the catalogue,
 * rather than left at those call sites.
 */
export const OBJECT_DESIGNS = {
  cargoCanister: shipDesignIdOf(4),
  /**
   * The released escape pod: a loose capsule's MESH and its COMBAT PROFILE
   * both, since docs/TODO/108. It was the profile only, and a capsule was drawn
   * as a small canister in a different colour. That is why the pod sits here
   * beside the canister rather than in the roster. It is an object, not a ship.
   */
  escapePod: shipDesignIdOf(2),
  missile: shipDesignIdOf(15),
} as const;

/** The mesh definition for a design that has one. Throws for the generated rock. */
export function requireShipDef(id: ShipDesignId): ShipDef {
  const hull = registeredHull(id);
  if (!hull.def) throw new Error(`ships/registry: ${id} has no tabulated hull`);
  return hull.def;
}

/**
 * What to CALL a design — the released ship name, or the overlay's own.
 *
 * A label, and only a label. Ask here with the id, and never off
 * `ShipDef.name`. Two roster rows that share a hull must not share a name by
 * accident.
 */
export function shipDisplayName(id: ShipDesignId): string {
  return registeredHull(id).name;
}

/** Whether this design has a tabulated hull at all — false only for the rock hermit. */
export function hasShipDef(id: ShipDesignId): boolean {
  return registeredHull(id).def !== null;
}

/**
 * The radius the guns and the collision loops use, in world units.
 *
 * One number per design, from the catalogue. Ships of the same design are the
 * same size. There is no per-role or per-tier adjustment, and a new one would
 * put this rule back in two places.
 */
export function shipTargetRadius(id: ShipDesignId): number {
  return registeredHull(id).targetRadius;
}

/**
 * Every released hull, in source order — for the viewer and the geometry tests.
 *
 * The full `EliteAHull`, and not the trimmed record above. Both callers want
 * what the trim drops: the gun vertex, the source-unit radius, and the report
 * from the face reconstruction.
 */
export const SOURCE_HULLS: readonly EliteAHull[] = ELITE_A_HULLS;
