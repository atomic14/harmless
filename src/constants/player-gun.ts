// The player's gun, as numbers: how far it reaches, how often it fires, how hot
// it gets and how much it forgives.
//
// The rules that spend these are `game/gunnery.ts`. What a hit is WORTH is
// deliberately absent: that is the released game's arithmetic, resolved from the
// hull and fitting through the catalogue. The NPC's gun is `npc-gun.ts`; the two
// are asymmetric by design (see `LASER_GRAZE`), and the one thing they share,
// the reach, is read from here by npc-gun.ts rather than written twice.

/**
 * How far the player's laser reaches, in world units. `NPC_LASER_RANGE` is
 * defined FROM this value rather than restating it.
 */
export const LASER_RANGE = 3500;

/**
 * The cadence and heat of each fitted laser. Cadence is Harmless's; the heat is
 * tuned so each laser matches the Elite-A player-laser spec's OVERHEAT TIMES on
 * our own 0..1 heat scale — beam and military both cook in ~3.5s, differing only
 * in what a hit is worth; the pulse lasts ~19s. See `LASER_COOL_RATE`.
 *
 * `mining` is absent because Harmless has no mining MOUNT: the mining laser is a
 * fitting that changes what a destroyed rock yields, not a weapon you select.
 * Exhaustiveness is enforced where spent: `playerLaser` indexes it with a
 * `LaserType`, so a fourth member with no row here is a compile error.
 */
export const LASER_PACING = {
  pulse: { cooldown: 0.24, heat: 0.067 },
  beam: { cooldown: 0.09, heat: 0.05 },
  military: { cooldown: 0.09, heat: 0.05 },
} as const;

/** The laser cuts out at this temperature and will not fire again until it cools. */
export const LASER_CUTOUT = 0.98;

/**
 * ...and how fast it cools, in units of that same 0..1 scale per second — the
 * third number of the heat model, beside `LASER_PACING` and `LASER_CUTOUT`.
 *
 * The rates depend on the REAL fire cadence, which is frame-quantized: the world
 * steps in FIXED_DT (1/60s) slices, so a 0.09s cooldown fires every 0.10s (10 Hz)
 * and the 0.24s pulse every 0.25s. Against 0.22/s of cooling:
 *
 *   - pulse    0.067 every 0.25s = 0.27/s, nets +0.05, cuts out in ~19s.
 *   - beam     0.050 every 0.10s = 0.50/s, nets +0.28, cuts out in ~3.4s.
 *   - military 0.050 every 0.10s = 0.50/s, nets +0.28, cuts out in ~3.4s.
 *
 * From the cut-out a cold gun is 4.5s away (cooling is continuous and dt-scaled,
 * so NOT quantized). The gun stops firing at `LASER_CUTOUT`, so the gauge never
 * climbs past it to 1.0.
 */
export const LASER_COOL_RATE = 0.22;

/**
 * What one laser shot draws from the energy bank. The Elite-A player laser
 * spends one energy point per firing event (spec §11), and our energy pool IS
 * the released 255 (`MAX_ENERGY`, constants/pools.ts), so the number transfers
 * directly. A soft, secondary limit: sustained fire slowly erodes the bank that
 * also recharges the shields, so holding the trigger costs you defence. Heat is
 * the hard limit (`LASER_CUTOUT`).
 *
 * The firing gate keeps one point in reserve after paying (so you need two to
 * shoot); the last bank is `LOW_ENERGY`, a separate rule, and firing is
 * deliberately NOT gated on it.
 */
export const LASER_ENERGY_COST = 1;

/**
 * How much of a target's silhouette counts as a hit, as a multiple of its
 * radius. THE PLAYER'S ONLY — an NPC's shot is not a ray through a cone but
 * `npcHitChance`'s die roll behind `NPC_FIRE_GATE`, so there is no NPC number
 * this has to agree with.
 */
export const LASER_GRAZE = 0.9;

/**
 * Grazing radius for drifting cargo, in world units. Canisters are ~12 units
 * across, so an exact ray needs 1.4 degrees at 500m and they felt unhittable.
 * They are not a skill target — shooting one is a deliberate act — so they get
 * a flat, generous tolerance.
 *
 * @rule gun.graze.canister
 */
export const CANISTER_GRAZE = 20;

/**
 * The same allowance for an escape capsule, which since docs/TODO/108 is a
 * different hull rather than a small canister: released design 2, whose
 * catalogue radius is 16 source units against the canister's 20. Four fifths
 * of the canister's tolerance, which is the ratio the two silhouettes had while
 * a capsule was drawn as a canister at 0.8 scale — so shooting one is no harder
 * than it was, and the number now has a hull behind it.
 *
 * Its own rule, not `CANISTER_GRAZE * 0.8`: these are two objects' silhouettes,
 * and retuning how forgiving cargo is must not silently move the pod.
 *
 * @rule gun.graze.pod
 */
export const POD_GRAZE = 16;

/**
 * Aim assist: an angular allowance ON TOP of the target's silhouette, so a
 * shot that is nearly right still connects. Two degrees at knife range,
 * tapering to nothing by ASSIST_FADE_END so distance shooting still demands
 * precision.
 *
 * The ring sight is drawn to this exact angle (see #crosshair in style.css), so
 * the reticle changes with it: the circle is the envelope, not decoration.
 *
 * WHY AN ALLOWANCE AT ALL, in the measured numbers that justify it. The shot is
 * a ray against the actual mesh rather than a cone around a sphere, so a hull's
 * shape decides how hard it is to hit: an Anaconda subtends 1.3 degrees nose-on
 * and 2.5 broadside, a Sidewinder 1.6 across its wings and 0.6 vertically, and
 * a Sidewinder at 500 units is 1.9 degrees. Holding a mouse inside that while
 * both ships manoeuvre is most of why fights read as flailing, and it is the
 * half of the combat problem that belongs to the player rather than to the AI.
 * A cone sized from the target's MAXIMUM radius was the alternative and it
 * makes every ship a ball — an Anaconda no easier to hit down its long flank
 * than head-on, and shots landing on empty space beside thin hulls.
 */
export const AIM_ASSIST = 0.035;
export const ASSIST_FADE_START = 900;
export const ASSIST_FADE_END = 2400;
