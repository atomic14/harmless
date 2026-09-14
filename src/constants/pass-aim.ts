// Where an attack run is aimed: beside the target, and ahead of it.
//
// An attack run has to pass beside where the target WILL BE, on a line it has
// room to get onto. These three numbers say how far beside, and how far ahead.
// `game/pass-aim.ts` turns them into a heading.
//
// `MAX_LEAD_SECONDS` has a SECOND reader, and it is not an attack run. The
// scripted co-pilot caps its own lead with it (`game/scripted-co-pilot.ts`).
// The two lead for different reasons and take the same ceiling, which the
// comment on the constant states.

/**
 * How far to the SIDE of its target a ship aims its attack run. 110 clears the
 * largest pirate hull, plus the commander's radius, twice over. It still stays
 * inside the gun's firing gate on the way in. It is the miss the ship AIMS for,
 * not the one it gets. `passMissDistance` is the correction.
 */
export const PASS_MISS_DISTANCE = 110;

/**
 * The furthest ahead of a target that a ship will aim, in seconds. The commander
 * pitches at 1.45 rad/s, so half a second is already 41 degrees of heading
 * change. That is enough lead to matter, and it does not extrapolate a stale
 * straight line.
 *
 * TWO PILOTS TAKE IT, for two different reasons, and the ceiling is the same
 * one. The attack run leads to predict a MERGE (`game/pass-aim.ts`). The
 * scripted co-pilot leads to cancel the time its own NOSE takes to swing
 * (`PURSUIT_LEAD_GAIN`). Both are "how far ahead a ship may aim", and both are
 * bounded by that same pitch rate. It stays one rule with one home.
 */
export const MAX_LEAD_SECONDS = 0.5;

/**
 * The most that geometry may stretch the aim, in multiples of the intended pass.
 * It binds only where no heading opens the gap asked for. Past it, the ship flies
 * more across its run than along it, which is the orbit that this flight model
 * replaced.
 *
 * @rule passaim.maxMissStretch
 */
export const MAX_MISS_STRETCH = 3;
