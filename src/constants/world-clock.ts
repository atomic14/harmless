// The clock the world advances on: the size of one slice, and the two limits that
// stop a stalled tab from a catch-up on all of them at once. The slice is the
// game's. The two limits are the browser frame loop's. It is the same clock from
// two ends: the sim asks "how long is one step", and the loop asks "how many may
// one animation frame run".
//
// The loop is `Game.loop` in game/game.ts. The step is `WorldStep.step` in
// game/world-step.ts.

/**
 * The world advances in slices of exactly this. 60Hz. It matches the rate the NPC
 * brains decide at (10Hz, every sixth step). It also matches the rate that every
 * combat number in this project was measured against.
 */
export const FIXED_DT = 1 / 60;

/**
 * The longest real interval the loop will simulate before it drops the backlog. A
 * backgrounded tab, a breakpoint or a slow first paint can hand the loop seconds.
 * To simulate them lands the ship somewhere it was never flown to.
 */
export const MAX_FRAME_TIME = 0.25;

/**
 * ...and the most steps one frame may run, so a stall cannot spiral. If the
 * catch-up costs more real time than it buys, the backlog grows every frame. At
 * the cap, the loop drops the backlog entirely (`accumulator = 0`).
 *
 * It has its own rule id. It is a count of STEPS in one frame of real time, and
 * it is the only constant at 5 that is about the loop rather than the game.
 *
 * @rule clock.maxStepsPerFrame
 */
export const MAX_STEPS_PER_FRAME = 5;

/**
 * Unread taps of one key that the input carries across busy frames. Three, which
 * is about the most a hand delivers into a single dropped frame. It is well
 * inside `MAX_STEPS_PER_FRAME`, so a backlog is spent as movement the player
 * asked for. `test/input.test.ts` holds the inequality.
 */
export const CARRY_LIMIT = 3;
