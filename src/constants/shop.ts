// The shop: what things cost.
//
// Prices in tenths of a credit (invariant 8). The rules that spend them are
// game/shop.ts and game/screens/trade.ts. Most rows carry the 1984 outfitter's
// figures; the mining laser, combat computer and trumble are this game's own.

import { LARGE_BAY_TONNES } from './commander.ts';

/**
 * What refuelling costs, in tenths of a credit per tenth of a LY. The single
 * home for the rule. Deliberately 2x the 1984 manual's implied 0.2 — see
 * docs/GAP-ANALYSIS.md.
 *
 * Its own rule id: 0.4 also spells a missile's last stand and a danger
 * threshold, and the price of fuel follows neither.
 *
 * @rule shop.fuelPrice
 */
export const FUEL_PRICE = 0.4;

/**
 * What a pulse laser costs, wherever it is mounted — and therefore its trade-in
 * value: the laser upgrade path refunds the old gun at what it cost. The Large
 * Cargo Bay is also 4000 but is not this rule, left a literal in its row.
 */
export const PULSE_LASER_PRICE = 4000;

/**
 * The beam laser's price — named beside `PULSE_LASER_PRICE` because the trade-in
 * reads it too: upgrading beam-to-military refunds what the beam cost.
 */
export const BEAM_LASER_PRICE = 10000;

/** One row of the outfitter's shelf. */
export interface EquipItem {
  id: string;
  name: string;
  price: number; // tenths of a credit
  minTL: number; // displayed tech level required
}

/**
 * The outfitter's shelf, in the order the screen lists it. The Large Cargo Bay
 * label interpolates `LARGE_BAY_TONNES` so it cannot advertise a bay the game
 * does not fit.
 */
export const EQUIPMENT_CATALOGUE: EquipItem[] = [
  { id: 'missile', name: 'Missile', price: 300, minTL: 1 },
  { id: 'largeBay', name: `Large Cargo Bay (${LARGE_BAY_TONNES}t)`, price: 4000, minTL: 1 },
  { id: 'ecm', name: 'E.C.M. System', price: 6000, minTL: 2 },
  { id: 'rearLaser', name: 'Rear Pulse Laser', price: PULSE_LASER_PRICE, minTL: 3 },
  { id: 'leftLaser', name: 'Left Pulse Laser', price: PULSE_LASER_PRICE, minTL: 3 },
  { id: 'rightLaser', name: 'Right Pulse Laser', price: PULSE_LASER_PRICE, minTL: 3 },
  { id: 'beam', name: 'Beam Laser', price: BEAM_LASER_PRICE, minTL: 4 },
  { id: 'scoops', name: 'Fuel Scoops', price: 5250, minTL: 5 },
  { id: 'escapePod', name: 'Escape Pod', price: 10000, minTL: 6 },
  { id: 'energyBomb', name: 'Energy Bomb', price: 9000, minTL: 7 },
  { id: 'energyUnit', name: 'Extra Energy Unit', price: 15000, minTL: 8 },
  { id: 'dockingComputer', name: 'Docking Computer', price: 15000, minTL: 9 },
  { id: 'miningLaser', name: 'Mining Laser', price: 8000, minTL: 10 },
  { id: 'combatComputer', name: 'Combat Computer', price: 20000, minTL: 9 },
  { id: 'trumble', name: 'Trumble (adorable, harmless*)', price: 20, minTL: 1 },
  { id: 'military', name: 'Military Laser', price: 60000, minTL: 10 },
  { id: 'galacticDrive', name: 'Galactic Hyperdrive', price: 50000, minTL: 10 },
];
