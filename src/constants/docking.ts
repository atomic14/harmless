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
 * How far round from the slot axis an approach turns in, in radians — the
 * bearing at which `dock-path.ts`'s stand-off funnel reaches the gate distance.
 *
 * Outside it the path holds the gate distance all the way round to astern;
 * inside it the path dives for the slot. So it is the size of the last turn: a
 * ship coming from behind flies round at the gate radius, and everything it has
 * to do to get in happens over this much bearing.
 *
 * Bounded from ABOVE by the letterbox and measured against the hull. A dive
 * that starts abeam is still level with the hull when it starts down, and
 * enters `dockingOutcome`'s box 23 units off the axis against a channel 26 wide
 * — inside it, but with nothing left for the ship's own tracking error, and over
 * `npm run dock-probe`'s 504 approaches a third of a turn scrapes 126 times
 * against none at a quarter (`test/docking.test.ts` holds the curve to the
 * channel; the probe is what says the SHIP stays with the curve).
 *
 * Bounded from BELOW by the same two things in the other direction: the whole
 * dive has to fit inside this much bearing, so a tighter one is a sharper turn
 * flown closer in, and the ship starts cutting the corner of the box instead of
 * the curve.
 */
export const TURN_IN = Math.PI / 4;

/**
 * Where the approach stops curving and flies straight, in station half-widths:
 * the radius at which `dock-path.ts`'s funnel meets the slot axis, and so the
 * length of the RUN IN that follows it. Three fifths of the gate distance, which
 * is three half-widths at both released stations.
 *
 * A ship should be pointing down the slot before it is in the slot. Without a
 * straight leg the funnel dives all the way to the letterbox and the ship goes
 * through it still turning: measured at 13.6 degrees off the axis in a median
 * approach and 19.3 at worst — which is what a pilot feels as the slot arriving
 * too fast and at an angle (Chris, flying docs/TODO/136: *"it feels quite tight
 * into the slot so the angle seems a bit too much"*). With the leg it is 5.4 and
 * 12.4, against 2.9 and 7.3 for the branch-and-corridor approach both replaced.
 *
 * Bounded BELOW by the hull, and that is what makes clearing it a property of the
 * PATH rather than of the ship's tracking: the whole of `dockingOutcome`'s box is
 * inside this radius, so the curve never enters the box at all and the straight
 * leg enters it dead on the axis. Bounded ABOVE by the gate, because the funnel
 * needs radius to spend on its dive — at four fifths the dive is squeezed into a
 * corner the follower has to round, and the plan's own heading starts moving 12
 * degrees in a frame where three fifths moves 0.7. Tied to `GATE_HALF_WIDTHS`
 * rather than stated flat so that a bigger gate keeps the same shape of funnel.
 *
 * The interior optimum is real and was measured over `npm run dock-probe`'s 504
 * approaches. Three fifths is the only one of the three that keeps everything:
 * at 2.5 half-widths three approaches have a plan that jumps over 20 degrees in
 * a frame — the worst 91.8 — and four scrape; at 3.5 the worst jump is 12.3, one
 * scrapes, and the wings arrive 17.6 degrees off the slot against 7.5; at three
 * fifths nothing jumps more than 1.1 degrees and nothing scrapes.
 */
export const RUN_IN_WIDTHS = GATE_HALF_WIDTHS * 0.6;

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
