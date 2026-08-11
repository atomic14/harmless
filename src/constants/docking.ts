// Threading the station slot: the letterbox, the approach that lines you up on
// it, and the cube that says you hit the hull instead.
//
// The rules that spend these are `game/docking.ts`: `planDocking` flies the
// approach for NPC traders and the player's docking computer alike, and
// `dockingOutcome` is the ONE answer to "docked, bounced, or clear" for
// everything with a hull. What a miss COSTS is the orchestrator's
// (`IMPACT.stationScrape`, and `BOUNCE_STANDOFF` in ./station.ts).
//
// Both released stations put their slot on the front face as a rectangle
// TALLER THAN IT IS WIDE in station-local coordinates (20x60 Coriolis,
// 32x64 Dodo), so a ship's wings line up with the station's local Y.

/**
 * How far out the approach gate sits, in multiples of the station half-width.
 * A RATIO not a distance: the gate scales with the hull, so a Dodo's longer
 * approach comes from its bigger box. Five half-widths is 800 units at a
 * Coriolis and 980 at a Dodo.
 */
export const GATE_HALF_WIDTHS = 5;

/**
 * How far out a ship stands off while it comes ROUND to the slot side, as a
 * multiple of the gate distance (and so, through it, of the station half-width).
 *
 * Slightly outside the gate, so the detour ends somewhere the ordinary approach
 * can pick up from. It was an unnamed 1.15 beside an unnamed 0.95 that decided
 * when the stand-off fired; docs/TODO/136 gave it a name on its way past, and
 * left a comment on the branch itself saying why the branch is wrong.
 */
export const STANDOFF_WIDTHS = 1.15;

/**
 * Off-axis error we insist on before committing to the run in, in world units.
 *
 * A ship that reaches the gate off-axis and then flies straight carries that
 * error into the hull, not the slot. Once committed, `planDocking` tolerates
 * twice this — the phase latches, or a shrinking `along` flips it back to
 * 'gate' and the ship oscillates without ever docking. The same figure is the
 * lateral half of `arrived`, which is what NPC traders dock on.
 */
export const LINED_UP_LATERAL = 45;

/**
 * Bounding cube around the station, a margin over the half-width in world
 * units, a little larger than the hull. Inside it you are either in the slot
 * channel or you have hit the hull.
 *
 * Measured against the widest point of both released hulls at station scale:
 * the Coriolis reaches 160 against a 160 slot plane, the Dodo's five tallest
 * vertices reach 243 against a 196 one. 50 clears both without letting a ship
 * slip past a vertex and be reported clear.
 */
export const HULL_BOX_MARGIN = 50;

/** The same cube for every NPC — the SAME RULE as the player's, so NPC traffic
 *  bounces off a Dodo's hull where a smaller margin would have clipped it. */
export const NPC_HULL_BOX_MARGIN = HULL_BOX_MARGIN;

/**
 * The slot channel, as half-extents ACROSS the slot and ALONG it, in
 * station-local world units. The released slots are 20x60 (Coriolis) and
 * 32x64 (Dodo); sized from the narrower of the two so one rule covers both and
 * a ship that threads the Coriolis threads the Dodo.
 */
export const SLOT_HALF_ACROSS = 26;
export const SLOT_HALF_ALONG = 62;

/** How far into the -Z face counts as being in the channel, in world units. */
export const SLOT_DEPTH = 60;

/**
 * Wings vs the slot's long axis, in radians — how badly you may be rolled and
 * still fit through the letterbox. A quarter turn's tolerance either side, and
 * symmetric: a ship upside down in the slot still fits.
 */
export const ROLL_TOLERANCE = 0.65;
