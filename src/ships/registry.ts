// One hull per design id, and the one place anything asks for one.
//
// `game/ship-identity.ts` says WHAT a ship is; this says what that looks like
// and how big it is. Keeping the two apart (TODO 23) is the point: nothing here
// hands back anything you could usefully compare to decide what a ship is — it
// hands back a mesh definition and a radius, both derived from the id.
//
// Two answers, because there are two kinds of design. A `elite-a:design:*` id
// resolves to a released hull (`elite-a-hulls.ts`); a `harmless:design:*` id
// resolves to one of ours (`harmless-hulls.ts`), and the record says which.
//
// THE RADIUS IS A GAMEPLAY NUMBER, and this is its only home: the pack's own
// targetable radius through `sourceGeometryToWorld`, which is what makes the
// ray tests in `game/shot.ts` and the hit cone in `game/gunnery.ts` agree with
// the released ships rather than with a guess.

import {
  HARMLESS_OVERLAYS, shipDesign, shipDesignIdOf, type ShipDesignId,
} from '../game/ship-identity.ts';
import {
  eliteAHull, ELITE_A_HULLS, sourceGeometryToWorld, type EliteAHull,
} from './elite-a-hulls.ts';
import {
  GENERATION_SHIP, GENERATION_SHIP_RADIUS, ROCK_HERMIT_RADIUS,
} from './harmless-hulls.ts';
import type { ShipDef } from './geometry.ts';

export { sourceGeometryToWorld };

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
 * The two designs the game names directly rather than through the roster.
 *
 * A canister and a missile are objects, not ships, so `ship-specs.ts` has no
 * row for them — but they are released designs with released geometry, and
 * `game/cargo.ts` and `game/ordnance.ts` have to say which. Written down once
 * here and validated against the catalogue, rather than at those call sites.
 */
export const OBJECT_DESIGNS = {
  cargoCanister: shipDesignIdOf(4),
  /**
   * The released escape pod. Harmless has no pod MESH — a capsule is drawn as a
   * canister in a different colour — so this id is here for its COMBAT PROFILE:
   * what a pod can absorb before it breaks up is the pack's (see game/cargo.ts).
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
 * A label, and only a label. Ask here with the id, not off `ShipDef.name`,
 * so two roster rows sharing a hull do not share a name by accident.
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
 * same size — there is no per-role or per-tier adjustment, and adding one would
 * put this rule back in two places.
 */
export function shipTargetRadius(id: ShipDesignId): number {
  return registeredHull(id).targetRadius;
}

/**
 * Every released hull, in source order — for the viewer and the geometry tests.
 *
 * The full `EliteAHull`, not the trimmed record above, because both callers want
 * what the trim drops: the gun vertex, the source-unit radius and the face
 * reconstruction's report.
 */
export const SOURCE_HULLS: readonly EliteAHull[] = ELITE_A_HULLS;
