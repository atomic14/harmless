// The clock the world advances on: the size of one slice, and the two limits
// that stop a stalled tab trying to catch up on all of them at once. The slice
// is the game's; the two limits are the browser frame loop's. Same clock from
// two ends — the sim asks "how long is one step", the loop asks "how many may
// one animation frame run".
//
// The loop is `Game.loop` in game/game.ts; the step is `WorldStep.step` in
// game/world-step.ts.

/**
 * The world advances in slices of exactly this. 60Hz, matching the rate the NPC
 * brains decide at (10Hz, every sixth step) and the rate every combat number in
 * this project was measured against.
 */
export const FIXED_DT = 1 / 60;

/**
 * Longest real interval the loop will simulate before dropping the backlog. A
 * backgrounded tab, breakpoint or slow first paint can hand the loop seconds;
 * simulating them lands the ship somewhere it was never flown to.
 */
export const MAX_FRAME_TIME = 0.25;

/**
 * ...and the most steps one frame may run, so a stall cannot spiral: if catching
 * up costs more real time than it buys, the backlog grows every frame. At the
 * cap the loop drops the backlog entirely (`accumulator = 0`).
 */
export const MAX_STEPS_PER_FRAME = 5;

/**
 * Unread taps of one key the input carries across busy frames. Three, about the
 * most a hand delivers into a single dropped frame — well inside
 * `MAX_STEPS_PER_FRAME`, so a backlog is spent as movement the player asked for.
 * `test/input.test.ts` holds the inequality.
 */
export const CARRY_LIMIT = 3;
