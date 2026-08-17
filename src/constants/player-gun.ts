// The player's gun, as numbers: how far it reaches, how often it fires, how hot
// it gets, and how much it forgives.
//
// The rules that spend these are `game/gunnery.ts`. What a hit is WORTH is
// deliberately absent. That is the released game's arithmetic, resolved from the
// hull and the fitting through the catalogue. The NPC's gun is `npc-gun.ts`. The
// two are asymmetric by design (see `LASER_GRAZE`), and npc-gun.ts reads the one
// thing they share, the reach, from here rather than write it twice.

/**
 * How far the player's laser reaches, in world units. `NPC_LASER_RANGE` is
 * defined FROM this value, rather than a restatement of it.
 */
export const LASER_RANGE = 3500;

/**
 * The cadence and the heat of each fitted laser. The cadence is Harmless's. The
 * heat is tuned so that each laser matches the OVERHEAT TIMES of the Elite-A
 * player-laser spec, on our own 0..1 heat scale. Beam and military both cook in
 * about 3.5s, and they differ only in what a hit is worth. The pulse lasts about
 * 19s. See `LASER_COOL_RATE`.
 *
 * `mining` is absent because Harmless has no mining MOUNT. The mining laser is a
 * fitting that changes what a destroyed rock yields. It is not a weapon you
 * select. Exhaustiveness is enforced where it is spent: `playerLaser` indexes
 * this with a `LaserType`, so a fourth member with no row here is a compile
 * error.
 */
export const LASER_PACING = {
  pulse: { cooldown: 0.24, heat: 0.067 },
  beam: { cooldown: 0.09, heat: 0.05 },
  military: { cooldown: 0.09, heat: 0.05 },
} as const;

/** The laser cuts out at this temperature. It will not fire again until it cools. */
export const LASER_CUTOUT = 0.98;

/**
 * ...and how fast it cools, in units of that same 0..1 scale per second. It is
 * the third number of the heat model, beside `LASER_PACING` and `LASER_CUTOUT`.
 *
 * The rates depend on the REAL fire cadence, which is frame-quantized. The world
 * steps in FIXED_DT (1/60s) slices, so a 0.09s cooldown fires every 0.10s
 * (10 Hz), and the 0.24s pulse fires every 0.25s. Against 0.22/s of cooling:
 *
 *   - pulse    0.067 every 0.25s = 0.27/s, nets +0.05, cuts out in ~19s.
 *   - beam     0.050 every 0.10s = 0.50/s, nets +0.28, cuts out in ~3.4s.
 *   - military 0.050 every 0.10s = 0.50/s, nets +0.28, cuts out in ~3.4s.
 *
 * From the cut-out, a cold gun is 4.5s away. Cooling is continuous and
 * dt-scaled, so it is NOT quantized. The gun stops firing at `LASER_CUTOUT`, so
 * the gauge never climbs past it to 1.0.
 */
export const LASER_COOL_RATE = 0.22;

/**
 * What one laser shot draws from the energy bank.
 *
 * The Elite-A player laser spends one energy point per firing event (spec §11).
 * Our energy pool IS the released 255 (`MAX_ENERGY`, constants/pools.ts). So
 * the number transfers directly.
 *
 * It is a soft, secondary limit. Sustained fire slowly erodes the bank
 * that also recharges the shields, so a held trigger costs you defence. Heat is
 * the hard limit (`LASER_CUTOUT`).
 *
 * The firing gate keeps one point in reserve after it pays, so you need two to
 * shoot. The last bank is `LOW_ENERGY`, which is a separate rule, and firing is
 * deliberately NOT gated on it.
 *
 * It has its own rule id. The released spec fixes it at one point per firing
 * event. So it is the one value in its group that Harmless does not choose.
 *
 * @rule gun.laserEnergyCost
 */
export const LASER_ENERGY_COST = 1;

/**
 * How much of a target's silhouette counts as a hit, as a multiple of its radius.
 * It is THE PLAYER'S ONLY. An NPC's shot is not a ray through a cone. It is
 * `npcHitChance`'s die roll behind `NPC_FIRE_GATE`, so there is no NPC number
 * that this has to agree with.
 */
export const LASER_GRAZE = 0.9;

/**
 * Grazing radius for drifting cargo, in world units. A canister is about 12 units
 * across, so an exact ray needs 1.4 degrees at 500m, and they felt unhittable.
 * They are not a skill target — a shot at one is a deliberate act — so they get a
 * flat, generous tolerance.
 *
 * @rule gun.graze.canister
 */
export const CANISTER_GRAZE = 20;

/**
 * The same allowance for an escape capsule.
 *
 * Since docs/TODO/108 a capsule is a different hull, rather than a small
 * canister. It is released design 2, and its catalogue radius is 16 source
 * units against the canister's 20.
 *
 * It is four fifths of the canister's tolerance. That is the ratio the two
 * silhouettes had while a capsule was drawn as a canister at 0.8 scale. A shot at one is therefore no
 * harder than it was, and the number now has a hull behind it.
 *
 * It is its own rule, not `CANISTER_GRAZE * 0.8`. These are two objects'
 * silhouettes, and a retune of how forgiving cargo is must not silently move the
 * pod.
 *
 * @rule gun.graze.pod
 */
export const POD_GRAZE = 16;

/**
 * Aim assist: an angular allowance ON TOP of the target's silhouette, so a shot
 * that is nearly right still connects. It is two degrees at knife range, and it
 * tapers to nothing by ASSIST_FADE_END, so distance shooting still demands
 * precision.
 *
 * The ring sight is drawn to this exact angle (see #crosshair in style.css), so
 * the reticle changes with it. The circle is the envelope, not decoration.
 *
 * WHY AN ALLOWANCE AT ALL, in the measured numbers that justify it. The shot is a
 * ray against the actual mesh, rather than a cone around a sphere. A hull's shape
 * therefore decides how hard it is to hit. An Anaconda subtends 1.3 degrees
 * nose-on and 2.5 broadside. A Sidewinder subtends 1.6 across its wings and 0.6
 * vertically, and one at 500 units is 1.9 degrees. A mouse held inside that
 * while both ships manoeuvre is most of why a fight reads as a flail. It is
 * the half of the combat problem that belongs to the player rather than to the
 * AI.
 *
 * The alternative was a cone sized from the target's MAXIMUM radius, and that
 * makes every ship a ball. An Anaconda is then no easier to hit down its long
 * flank than head-on, and a shot lands on empty space beside a thin hull.
 */
export const AIM_ASSIST = 0.035;
/**
 * Where the aim assist begins to fade out, in world units.
 *
 * @rule gun.assistFadeStart
 */
export const ASSIST_FADE_START = 900;
export const ASSIST_FADE_END = 2400;
