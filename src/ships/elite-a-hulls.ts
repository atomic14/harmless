// The 38 released hulls, at the one scale, ready to render.
//
// This is where source data becomes something the renderer can take. The flat
// generated arrays in game/elite-a/geometry.generated.ts come in. A `ShipDef`
// with closed face loops goes out. `sourceGeometryToWorld` is the single
// conversion between the two coordinate systems. Nothing else in the project
// may scale a hull.
//
// THE ANCHOR. Source design 10 is the Cobra Mk III. Its vertex table is the
// table `ships/geometry.ts` shipped by hand — (32,0,76), (-32,0,76), (0,26,24),
// (-120,-3,-8) and so on, byte for byte — carried with `scale: 0.25`. So the
// Cobra keeps the size it always had if, and only if, one world unit is four
// source units. That is the whole derivation:
//
//     world = source / 4          SOURCE_UNITS_PER_WORLD_UNIT = 4
//
// Every one of the 38 designs takes it, and so does every target radius. There
// is deliberately no per-ship factor to reach for. A hull that looks wrong at
// this scale is wrong in the source or wrong in the scene. Both of those are
// somewhere else's problem.
//
// A CONSEQUENCE WORTH THE RECORD. The released Coriolis is 160 source units,
// which is 40 world units. The Harmless scene places it at 160 world units,
// and the docking rules in game/docking.ts are written against that. In the
// source a station is only 1.7 Cobras across. In Harmless it is 4.7.
//
// That gap is a scene decision, not a geometry one. So this file builds the
// two station designs and the viewer shows them. world/system-scene.ts still
// flies the Harmless station — see ships/harmless-hulls.ts.

import {
  eliteADesign, eliteADesignIds, eliteAGeometry, eliteATargetRadius,
} from '../game/elite-a/catalogue.ts';
import { reconstructFaces, readSourceHull, type HullTopology } from './elite-a-faces.ts';
import type { ShipDef } from './geometry.ts';

/** One world unit is four source units. See the anchor in the header. */
export const SOURCE_UNITS_PER_WORLD_UNIT = 4;

/** Source units to world units. The only conversion between the two. */
export function sourceGeometryToWorld(sourceUnits: number): number {
  return sourceUnits / SOURCE_UNITS_PER_WORLD_UNIT;
}

/**
 * One released design, converted.
 *
 * `def` is what the renderer builds. Everything beside it is the part of the
 * source header that a caller may legitimately want:
 *
 *   - the target radius the guns use;
 *   - the gun vertex a muzzle flash leaves from;
 *   - the range beyond which the original no longer drew it;
 *   - the report of how the face loops came out.
 */
export interface EliteAHull {
  readonly designId: number;
  readonly name: string;
  readonly def: ShipDef;
  /** Target radius in WORLD units: the catalogue's, through the one scale. */
  readonly targetRadius: number;
  /** The same radius in source units, for a comparison against the pack. */
  readonly targetRadiusSourceUnits: number;
  /**
   * Where the guns sit, in world units and already nose-forward.
   *
   * `gunVertexIndex` is a real index, and 0 is a real answer. The pack's byte
   * is 0 for thirty-two of the 38 designs. It points at vertex 0, which is
   * usually the nose. Six ships name a later vertex: the Transporter, the
   * Cobra Mk III, the Anaconda, the Cobra Mk I, the Asp Mk II and the
   * Thargoid. So there is nothing here to treat as absent.
   */
  readonly gunVertex: readonly [number, number, number];
  /** Source range at which the original stopped drawing it, in world units. */
  readonly visibilityDistance: number;
  /** The divisor the source applied to its face normals. */
  readonly normalScaleDivisor: number;
  /** What the face reconstruction found, and what it could not. */
  readonly topology: HullTopology;
}

/**
 * The nose points along -Z in world space, and `buildShip` turns it there.
 *
 * A def is stated +Z-nose, as the source states it (docs/INVARIANTS.md
 * invariant 7). The builder used to mirror Z alone, which is a REFLECTION. For
 * a left/right symmetric hull that is identical to a half turn. For anything
 * else it is a mirror image.
 *
 * Thirty of the thirty-eight released designs are symmetric, and nobody
 * noticed. Eight are not: the Transporter, the Thargoid, the Thargon, the
 * escape pod, the alloy plate, the boulder, the asteroid and the splinter. So
 * the builder now turns a hull rather than flips it.
 *
 * This helper says where a source point ends up. Two readers need to agree
 * with the mesh: the gun vertex below, and the tests.
 */
export function sourcePointToWorld(
  x: number, y: number, z: number,
): [number, number, number] {
  return [sourceGeometryToWorld(-x), sourceGeometryToWorld(y), sourceGeometryToWorld(-z)];
}

function buildHull(designId: number): EliteAHull {
  const design = eliteADesign(designId);
  const hull = readSourceHull(eliteAGeometry(designId));
  const topology = reconstructFaces(hull);
  const radiusSource = eliteATargetRadius(design);
  const gun = hull.vertices[design.gunVertexIndex];
  return {
    designId,
    name: design.shipName,
    def: {
      name: design.shipName,
      scale: sourceGeometryToWorld(1),
      vertices: hull.vertices.map((v) => [v.x, v.y, v.z] as [number, number, number]),
      edges: hull.edges.map((e) => [e.a, e.b] as [number, number]),
      faces: topology.loops.map((loop) => [...loop.vertices]),
    },
    targetRadius: sourceGeometryToWorld(radiusSource),
    targetRadiusSourceUnits: radiusSource,
    gunVertex: sourcePointToWorld(gun.x, gun.y, gun.z),
    visibilityDistance: sourceGeometryToWorld(design.visibilityDistance),
    normalScaleDivisor: design.normalScaleDivisor,
    topology,
  };
}

/**
 * Every released hull, converted once at load.
 *
 * Eager and immutable, so it is a constant rather than a cache. 38 hulls of a
 * few dozen edges each take microseconds. A lazy memo would be module-level
 * mutable state for no gain. CLAUDE.md's rule on a global applies to a cache
 * too.
 */
export const ELITE_A_HULLS: readonly EliteAHull[] = eliteADesignIds().map(buildHull);

const byDesignId = new Map(ELITE_A_HULLS.map((hull) => [hull.designId, hull]));

/** One released hull by its source design id, 0-37. */
export function eliteAHull(designId: number): EliteAHull {
  const hull = byDesignId.get(designId);
  if (!hull) throw new Error(`elite-a hull: no design ${designId}`);
  return hull;
}
