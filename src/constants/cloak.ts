// The cloaking device, which no shop sells (docs/TODO/219 M5). The Dark
// Wheel's door grants it. While it runs, no ship out there is hostile to the
// commander, and the bank pays for it.

import { ENERGY_BANK_POINTS, LOW_ENERGY } from './pools.ts';

/**
 * What the cloak draws from the energy bank each second: a bank every six
 * seconds, which is about eleven points. The recharge gives back about six
 * a second (`ENERGY_REGEN_FRACTION`), so the pool falls by about four a
 * second under the cloak. A full pool then cloaks the ship for about forty
 * five seconds before the last bank drops it. A draw under the recharge
 * would be a cloak that costs nothing, and the fight's answer to everything.
 *
 * @rule cloak.energyPerSecond
 */
export const CLOAK_ENERGY_PER_SECOND = ENERGY_BANK_POINTS / 6;

/**
 * The cloak drops when the bank is down to its last one, so it never takes
 * the energy that keeps the ship alive. It is `LOW_ENERGY`'s own line.
 *
 * @rule cloak.minEnergy
 */
export const CLOAK_MIN_ENERGY = LOW_ENERGY;
