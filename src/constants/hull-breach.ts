// What a hit that gets past the shields costs you, beyond the points: how often
// it wrecks something, whether that something is cargo or a fitting, and which
// fittings can go. Spent by `breachLoss` in game/systems.ts — the second,
// separate consequence of a hit whose bank cost `applyDamage` handles.

/**
 * Chance a hit that reaches the hull wrecks cargo or a fitting.
 *
 * A PROPERTY OF THE HIT, NOT OF HOW BIG IT WAS: `applyDamage` rolls exactly once
 * per penetrating hit (never per point or scaled by damage), so pool size does
 * not change how often equipment breaks. `test/systems.test.ts` counts the rolls.
 */
export const EQUIPMENT_DAMAGE_CHANCE = 0.25;

/**
 * Cargo is lost this often when there is any aboard — equipment is rarer.
 *
 * Only reached once `EQUIPMENT_DAMAGE_CHANCE` has already fired, and only when
 * the ship is carrying something: an empty hold loses a fitting outright, and a
 * ship with no fittings left loses cargo outright.
 */
export const CARGO_LOSS_CHANCE = 0.7;

/**
 * The fittings a hull breach can knock out, in the order they are offered.
 *
 * The absent ones cannot be taken by a breach: the hold, escape pod, energy unit
 * and galactic drive have no "broken" state, and the front laser is what you are
 * shooting with. `as const` plus `breachLoss`'s `commander.equipment[key]` makes
 * a non-fitting key a compile error at the read site; no annotation because this
 * directory may not import the `Equipment` union.
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
