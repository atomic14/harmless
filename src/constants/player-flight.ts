// The commander's flight envelope: how fast the ship you fly goes, how hard it
// accelerates, how sharply it turns, and how a turn ramps up and bleeds off.
//
// It is one object, and the only spelling. A harness that flies the player's ship
// reads it rather than a hand-copy of the numbers. The RULE that these are
// arguments to is `player.ts`'s `rampToward`. What an NPC's brain flies the same
// rule with is `brain-flight.ts`, and the two must not be fused — see `rateRamp`
// below.

/**
 * The player's flight envelope, in one place that a harness can read. Training
 * flies THIS ship as the target, because `ai-training/scenario.ts` reads
 * `PLAYER_FLIGHT`. A change to any of these is therefore a change to the world
 * that every pirate brain is fitted in.
 */
export const PLAYER_FLIGHT = {
  /**
   * Top speed, world units per second.
   *
   * @rule flight.player.maxSpeed
   */
  maxSpeed: 400,

  /** Thrust, world units per second per second, in both directions. */
  accel: 220,

  /**
   * The player's Cobra turns at these. They are Harmless numbers, not released
   * ones. They are set so that you out-turn a pirate Cobra and a Krait, match a
   * Mamba, and are edged only by a Sidewinder. That is as it should be, because
   * those are far smaller ships. `test/combat-model.test.ts` re-derives the
   * comparisons from the roster.
   */
  maxRoll: 2.5,
  maxPitch: 1.45,

  /**
   * How fast a turn rate ramps up while a control is held, as a time constant in
   * reciprocal seconds.
   *
   * DO NOT FUSE THIS WITH `brain-flight.ts`'s `BRAIN_RATE_RAMP`. That one is also
   * 4.1396, but it is a DIFFERENT RULE. This is the player's FEEL setting, and a
   * retune is nearly free. `BRAIN_RATE_RAMP` is what every shipped genome was
   * fitted at, and a move to it puts the policies out of distribution with
   * nothing going red. They live in separate files so they can move apart, and
   * each one names the other so nobody moves either in ignorance.
   * `test/combat-model.test.ts` pins both against the linear rule they came from.
   *
   * @rule flight.player.rateRamp
   */
  rateRamp: 4.1396,

  /**
   * How fast the turn rate bleeds off when you let go. It tightens the tail of a
   * tap, so movement stops when the key does. The peak rates are untouched.
   */
  rateDecay: 13.3886,
} as const;
