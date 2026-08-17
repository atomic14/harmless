// The shop: what a purchase costs right now, and what you already own.
//
// The price list itself is constants/shop.ts. This is the arithmetic over it:
// nothing here reads or writes a save. It takes a commander, and answers a
// question about money.
//
// (The rules lived in commander.ts once. So the file about who the player is
// answered "what does fuel cost?". A price list does not persist between
// sessions.)

import type { CommanderData } from './commander.ts';
import { MAX_FUEL, MAX_MISSILES } from '../constants/commander.ts';
import { BEAM_LASER_PRICE, FUEL_PRICE, PULSE_LASER_PRICE } from '../constants/shop.ts';

/** Tenths of a LY needed to fill the tank. */
export function fuelNeeded(c: { fuel: number }): number {
  return MAX_FUEL - c.fuel;
}

/** What filling the tank costs right now, in tenths of a credit. */
export function refuelCost(c: { fuel: number }): number {
  return Math.round(fuelNeeded(c) * FUEL_PRICE);
}

/** Everything a screen has to say about buying fuel. Money in tenths of a
 *  credit, fuel in tenths of a LY, as everywhere else. */
export interface FuelQuote {
  /** the shelf price: one light year, in tenths of a credit */
  perLightYear: number;
  /** tenths of a LY the tank is short */
  needed: number;
  /** tenths of a credit to fill it */
  cost: number;
  /** nothing to sell you */
  full: boolean;
}

/**
 * The refuelling quote, for any screen that wants to show it.
 *
 * It exists because two places now quote the price: the outfitters and the
 * market. The per-LIGHT-YEAR figure a shopper reads is a unit conversion of
 * `FUEL_PRICE`, which is per tenth of a LY.
 *
 * That conversion is a pricing rule, so it lives here rather than as a `* 10`
 * in the renderer. The comment above records what happened the last time a fuel
 * sum went into the render layer.
 */
export function fuelQuote(c: { fuel: number }): FuelQuote {
  const needed = fuelNeeded(c);
  return {
    perLightYear: Math.round(FUEL_PRICE * 10),
    needed,
    cost: refuelCost(c),
    full: needed <= 0,
  };
}

export function equipmentOwned(id: string, c: CommanderData): boolean {
  const e = c.equipment;
  switch (id) {
    case 'missile': return c.missiles >= MAX_MISSILES;
    case 'largeBay': return e.largeBay;
    case 'ecm': return e.ecm;
    case 'rearLaser': return e.rearLaser;
    case 'leftLaser': return e.leftLaser;
    case 'rightLaser': return e.rightLaser;
    case 'beam': return e.laser !== 'pulse';
    case 'scoops': return e.scoops;
    case 'escapePod': return e.escapePod;
    case 'energyBomb': return e.energyBomb;
    case 'energyUnit': return e.energyUnit;
    case 'dockingComputer': return e.dockingComputer;
    case 'miningLaser': return e.miningLaser;
    case 'combatComputer': return e.combatComputer;
    case 'trumble': return c.trumbles > 0;
    case 'military': return e.laser === 'military';
    case 'galacticDrive': return e.galacticDrive;
    default: return false;
  }
}

/**
 * Apply a purchase. The caller pays for it first.
 *
 * The other half of `equipmentOwned` above. That one READS a flag, and this one
 * writes it. Both switch over the catalogue's ids, so both belong to the module
 * that owns the arithmetic over a price list.
 *
 * IT DOES NOT DEDUCT THE PRICE, and that is deliberate. Each caller decides
 * whether a purchase is allowed at all, and each decides on different grounds.
 * The station screen refuses on the row's status and on the credits. The
 * campaign's buyer works down a priority list. What they agree on is what a
 * purchase DOES.
 *
 * THE REFUND IS HERE, because it is the one part that moves money. The old gun
 * is refunded at what it cost, as the manual says, and the prices are the
 * catalogue's own.
 *
 * IT SETS STATE AND SAYS NOTHING. A trumble earns a line in the cockpit, and
 * that line is `screens/trade.ts`'s.
 *
 * TWO CALLERS SHARE IT (invariant 10). `screens/trade.ts` is the shop a player
 * uses. `test/campaign.ts` is the headless balance playtest, which kept a copy
 * of this switch until docs/TODO/178. That copy hardcoded the missile cap and
 * both refunds.
 */
export function applyPurchase(c: CommanderData, id: string): void {
  const e = c.equipment;
  switch (id) {
    case 'fuel': c.fuel = MAX_FUEL; break;
    case 'missile': c.missiles = Math.min(MAX_MISSILES, c.missiles + 1); break;
    case 'largeBay': e.largeBay = true; break;
    case 'ecm': e.ecm = true; break;
    case 'rearLaser': e.rearLaser = true; break;
    case 'leftLaser': e.leftLaser = true; break;
    case 'rightLaser': e.rightLaser = true; break;
    case 'beam':
      c.credits += PULSE_LASER_PRICE;
      e.laser = 'beam';
      break;
    case 'military':
      c.credits += e.laser === 'beam' ? BEAM_LASER_PRICE : PULSE_LASER_PRICE;
      e.laser = 'military';
      break;
    case 'scoops': e.scoops = true; break;
    case 'escapePod': e.escapePod = true; break;
    case 'energyBomb': e.energyBomb = true; break;
    case 'energyUnit': e.energyUnit = true; break;
    case 'dockingComputer': e.dockingComputer = true; break;
    case 'miningLaser': e.miningLaser = true; break;
    case 'combatComputer': e.combatComputer = true; break;
    case 'trumble': c.trumbles = 1; break;
    case 'galacticDrive': e.galacticDrive = true; break;
  }
}
