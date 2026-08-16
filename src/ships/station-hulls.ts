// The two stations: released geometry, at a size Harmless chose.
//
// Both hulls are exact. The Coriolis is design 1 and the Dodo is design 0, read
// out of the same generated catalogue as every ship. Both are drawn FOUR TIMES
// the one geometry conversion. That factor is the only per-object scale in the
// project, and it is OURS rather than a source value:
//
//     STATION_PRESENTATION_SCALE = 4
//
// Why it exists. `sourceGeometryToWorld` puts one world unit at four source
// units, anchored on the Cobra Mk III. Through it, the released Coriolis is 40
// world units across the half-diagonal, which is 1.7 Cobras wide.
//
// The Harmless scene always placed a 160-unit station, 4.7 Cobras wide, and
// `game/docking.ts` is built on that width. Three rules depend on it:
//
//   - the approach gate is five station half-widths out;
//   - the launch standoff and the Vipers' stack are absolute distances;
//   - the slot channel is a tolerance in world units.
//
// A station shrunk fourfold would move all three at once. It would turn a
// 900-unit approach into a 225-unit one, which is a docking change rather than
// a geometry one.
//
// So the SHAPE is the released table, and the SIZE is the scene's. A station is
// drawn at one world unit per source unit, which is where the familiar 160
// comes from.
//
// Nothing else may reach for this. A hull that looks wrong at the ship scale is
// wrong in the source or wrong in the scene. This is not a knob. It is one
// stated decision about two objects, and this file is where it is stated.

import * as THREE from 'three';

import { shipDesignIdOf, type ShipDesignId } from '../game/ship-identity.ts';
import { buildShip, type ShipDef } from './geometry.ts';
import { requireShipDef, shipDisplayName } from './registry.ts';
import { SOURCE_UNITS_PER_WORLD_UNIT } from './elite-a-hulls.ts';

/**
 * How much larger than the one geometry conversion a station is drawn.
 *
 * AN EXPRESSION, not a coincidence. It was a second `4`, and its comment said
 * in English that "4 is exactly the factor that cancels the conversion". Nothing
 * enforced that.
 *
 * Written this way, a station stays 1:1 with its source units, whatever the
 * ship conversion becomes. That is 160 for the Coriolis and 196 for the Dodo.
 * Every absolute docking distance above is built on it.
 *
 * It cannot live in src/constants/, because its meaning IS this product over
 * the ships' own anchor, and that directory may not import the anchor. It is
 * the `WORLD_SPEED_PER_SOURCE_SPEED` shape
 * (docs/TODO/completed/90-constants-cleanup.md).
 */
export const STATION_PRESENTATION_SCALE = SOURCE_UNITS_PER_WORLD_UNIT;

/** The two released stations, by design id. */
export const STATION_DESIGNS = {
  /** dodecahedral, and what a high-tech system gets */
  dodo: shipDesignIdOf(0),
  coriolis: shipDesignIdOf(1),
} as const;

/** A built station: the mesh, and how far its slot face is from its centre. */
export interface StationHull {
  readonly designId: ShipDesignId;
  readonly name: string;
  readonly object: THREE.Object3D;
  /**
   * Distance from the centre to the slot face plane, in world units.
   *
   * Derived from the hull rather than written down. The slot sits on the face
   * furthest along the source's +Z, and `buildShip`'s half turn puts that on
   * local -Z. It is 160 for the Coriolis, which is the number the scene and
   * docking.ts always used. It is 196 for the Dodo.
   */
  readonly dockZ: number;
}

/** The released def at the station scale. A copy: the registry's is shared. */
function presented(designId: ShipDesignId): ShipDef {
  const def = requireShipDef(designId);
  return { ...def, scale: def.scale * STATION_PRESENTATION_SCALE };
}

/** How far the slot face is from the centre, for a def already at scale. */
function slotFaceDistance(def: ShipDef): number {
  return def.vertices.reduce((far, v) => Math.max(far, v[2]), 0) * def.scale;
}

/** Build one of the two stations. Nothing else in the project may scale a hull. */
export function buildStation(
  designId: ShipDesignId, color: THREE.ColorRepresentation,
): StationHull {
  const def = presented(designId);
  return {
    designId,
    name: shipDisplayName(designId),
    object: buildShip(def, color),
    dockZ: slotFaceDistance(def),
  };
}

/** What a station of this design measures, and no station is built. */
export function stationDockZ(designId: ShipDesignId): number {
  return slotFaceDistance(presented(designId));
}
