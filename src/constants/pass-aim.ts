// Where an attack run is aimed: beside the target, and ahead of it.
//
// An attack run has to pass beside where the target WILL BE, on a line it has
// room to get onto. These three numbers say how far beside and how far ahead;
// `game/pass-aim.ts` turns them into a heading.

/**
 * How far to the SIDE of its target a ship aims its attack run. 110 clears the
 * largest pirate hull (plus the commander's radius) twice over while staying
 * inside the gun's firing gate on the way in. It is the miss the ship AIMS for,
 * not the one it gets; `passMissDistance` is the correction.
 */
export const PASS_MISS_DISTANCE = 110;

/**
 * The furthest ahead of a target a ship will aim, in seconds. The commander
 * pitches at 1.45 rad/s, so half a second is already 41 degrees of heading
 * change — enough lead to matter without extrapolating a stale straight line.
 */
export const MAX_LEAD_SECONDS = 0.5;

/**
 * The most the aim may be stretched by geometry, in multiples of the intended
 * pass. Binds only where no heading opens the gap asked for; past it the ship
 * flies more across its run than along it — the orbit this flight model replaced.
 */
export const MAX_MISS_STRETCH = 3;
