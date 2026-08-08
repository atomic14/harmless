// The commander's flight envelope: how fast the ship you fly goes, how hard it
// accelerates, how sharply it turns, and how a turn ramps up and bleeds off.
//
// One object, the only spelling — a harness that flies the player's ship reads
// it rather than hand-copying the numbers. The RULE these are arguments to is
// `player.ts`'s `rampToward`. What an NPC's brain flies the same rule with is
// `brain-flight.ts`, and the two must not be fused — see `rateRamp` below.

/**
 * The player's flight envelope, in one place a harness can read. Training flies
 * THIS ship as the target (`ai-training/scenario.ts` reads `PLAYER_FLIGHT`), so
 * a change to any of these is a change to the world every pirate brain is
 * fitted in.
 */
export const PLAYER_FLIGHT = {
  /** Top speed, world units per second. */
  maxSpeed: 400,

  /** Thrust, world units per second per second, in both directions. */
  accel: 220,

  /**
   * The player's Cobra turns at these (a Harmless number, not a released one),
   * set so you out-turn a pirate Cobra and Krait, match a Mamba, and are edged
   * only by a Sidewinder — as it should be, those being far smaller ships.
   * `test/combat-model.test.ts` re-derives those comparisons from the roster.
   */
  maxRoll: 2.5,
  maxPitch: 1.45,

  /**
   * How fast a turn rate ramps up while a control is held, as a time constant
   * in reciprocal seconds.
   *
   * DO NOT FUSE THIS WITH `brain-flight.ts`'s `BRAIN_RATE_RAMP`. That one is
   * also 4.1396 but is a DIFFERENT RULE: this is the player's FEEL setting and
   * retuning it is nearly free; `BRAIN_RATE_RAMP` is what every shipped genome
   * was fitted at, and moving it puts the policies out of distribution with
   * nothing going red. They live in separate files so they can move apart, and
   * each names the other so neither is moved in ignorance.
   * `test/combat-model.test.ts` pins both against the linear rule they came from.
   */
  rateRamp: 4.1396,

  /**
   * How fast the turn rate bleeds off when you let go. Tightens the tail of a
   * tap so movement stops when the key does; peak rates are untouched.
   */
  rateDecay: 13.3886,
} as const;
