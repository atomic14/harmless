// What a hit that gets past the shields costs you, beyond the points: how often
// it wrecks something, whether that something is cargo or a fitting, and which
// fittings can go. `breachLoss` in game/systems.ts spends these. It is the
// second, separate consequence of a hit, and `applyDamage` handles that hit's
// bank cost.

/**
 * The chance that a hit which reaches the hull wrecks cargo or a fitting.
 *
 * It is A PROPERTY OF THE HIT, NOT OF HOW BIG IT WAS. `applyDamage` rolls exactly
 * one time per penetrating hit. It never rolls per point, and the damage never
 * scales it. Pool size therefore does not change how often equipment breaks.
 * `test/systems.test.ts` counts the rolls.
 */
export const EQUIPMENT_DAMAGE_CHANCE = 0.25;

/**
 * Cargo is lost this often when there is any aboard. Equipment is rarer.
 *
 * This is reached only once `EQUIPMENT_DAMAGE_CHANCE` fires, and only when the
 * ship carries something. An empty hold loses a fitting outright, and a ship with
 * no fittings left loses cargo outright.
 *
 * It has its own rule id since docs/TODO/142, which is when a third constant
 * arrived on the value. It shares 0.7 with `THARGOID_FIRE_RATE` (npc-gun.ts) and
 * `STEREO_WIDTH` (audio.ts), and all three must stay free to move apart. This one
 * is what a breach costs a full hold.
 *
 * @rule breach.cargoLossChance
 */
export const CARGO_LOSS_CHANCE = 0.7;

/**
 * The fittings that a hull breach can knock out, in the order they are offered.
 *
 * A breach cannot take the absent ones. The hold, the escape pod, the energy unit
 * and the galactic drive have no "broken" state, and the front laser is what you
 * shoot with. `as const`, plus `breachLoss`'s `commander.equipment[key]`, makes a
 * non-fitting key a compile error at the read site. There is no annotation,
 * because this directory may not import the `Equipment` union.
 */
export const BREAKABLE = [
  ['ecm', 'E.C.M. SYSTEM'],
  ['scoops', 'FUEL SCOOPS'],
  ['rearLaser', 'REAR LASER'],
  ['leftLaser', 'LEFT LASER'],
  ['rightLaser', 'RIGHT LASER'],
  ['dockingComputer', 'DOCKING COMPUTER'],
  ['combatComputer', 'COMBAT COMPUTER'],
] as const;
