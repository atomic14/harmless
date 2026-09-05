// Buying and selling: the market prices, and the shipyard.
//
// Split out of `ui/screens.ts` by docs/TODO/149. Two screens, one consumer
// (`game/screens/trade.ts`), and one subject — what a station will sell you and
// what it will pay.
//
// `equipRows` is exported beside the painter it feeds, and that is deliberate.
// What is on the shelf, what it costs, and whether she can afford it are one
// question. `test/trade.test.ts` and `test/economy.test.ts` both ask it, and
// neither paints anything.

import { type StarSystem, type MarketEntry, COMMODITIES } from '../galaxy/galaxy.ts';
import { type CommanderData, cargoTonnes, consignedTonnes, formatCredits, cargoCapacity } from '../game/commander.ts';
import { MAX_FUEL } from '../constants/commander.ts';
import {
  equipmentOwned, equipmentSuperseded, fuelQuote, type FuelQuote,
} from '../game/shop.ts';
import { EQUIPMENT_CATALOGUE } from '../constants/shop.ts';
import { show } from './screen-shell.ts';

/**
 * @param fuel what the station charges for fuel, or null where none is sold.
 *   A rock hermit trades cargo, and cannot fill your tank. A price on something
 *   nobody will sell is worse than no price. The caller decides which.
 */
export function renderMarket(
  sys: StarSystem,
  market: MarketEntry[],
  c: CommanderData,
  selected: number,
  fuel: FuelQuote | null = null,
): void {
  // Which tonnes are spoken for (docs/TODO/143). The sale of a consignment is
  // legal and stays legal, and the measurement says it never pays. The hold
  // kept that answer to itself, and the one market with no bulletin board
  // beside it is a rock hermit. So the row carries it. `--hud-amber` is the
  // colour renderContracts already spends on a flagged job below, for the same
  // reason: flagged, not disguised.
  //
  // The suffix reports the JOB and not a share of the hold, which is what
  // `consignedTonnes` reports. 15t of Food against a 5t consignment reads
  // `15t · 5 CONSIGNED`, because 10 of those tonnes are hers.
  const consigned = (i: number): string => {
    const tonnes = consignedTonnes(c, i);
    return tonnes > 0
      ? ` <span style="color:var(--hud-amber)">&middot; ${tonnes} CONSIGNED</span>` : '';
  };
  const rows = market
    .map((m, i) => `
      <tr class="${i === selected ? 'sel' : ''} pick" data-row="${i}">
        <td>${m.name.toUpperCase()}</td>
        <td class="num">${m.price.toFixed(1)}</td>
        <td class="num">${m.quantity}${m.unit}</td>
        <td class="num">${c.cargo[i] > 0 ? c.cargo[i] + COMMODITIES[i].unit : '-'}${consigned(i)}</td>
      </tr>`)
    .join('');
  show(`
    <h2>${sys.name.toUpperCase()} MARKET</h2>
    <div class="rule"></div>
    <table>
      <tr><th>PRODUCT</th><th class="num">PRICE (Cr)</th><th class="num">FOR SALE</th><th class="num">IN HOLD</th></tr>
      ${rows}
    </table>
    ${fuel ? `<div class="keyline">
      FUEL ${formatCredits(fuel.perLightYear)}/LY &middot; ${fuel.full ? 'TANK FULL'
        : `TANK ${(c.fuel / 10).toFixed(1)}/${(MAX_FUEL / 10).toFixed(1)} LY &middot; ${formatCredits(fuel.cost)} TO FILL AT EQUIP SHIP`}
    </div>` : ''}
    <div class="buttons">
      <button data-key="KeyB">BUY 1</button>
      <button data-key="VirtBuyMax">BUY MAX</button>
      <button data-key="KeyV">SELL 1</button>
      <button data-key="VirtSellAll">SELL ALL</button>
      <button data-key="Escape">DONE</button>
    </div>
    <div class="keyline">
      CASH ${formatCredits(c.credits)} &middot; HOLD ${cargoTonnes(c)}/${cargoCapacity(c)}t
      &nbsp;&mdash;&nbsp; CLICK A ROW &middot; &uarr;&darr; SELECT &middot; B BUY (&#8679;B MAX) &middot; V SELL (&#8679;V ALL) &middot; ESC EXIT
    </div>
  `);
}

// --- Equip Ship ------------------------------------------------------------
export interface EquipRow {
  id: string;
  label: string;
  price: number; // tenths; 0 = nothing to buy
  /**
   * Why the row is not for sale, or empty when it is. `SUPERSEDED` is a beam
   * laser under a military laser: not the fit, and not on sale either
   * (docs/TODO/186). It read OWNED until then.
   */
  status: '' | 'OWNED' | 'SUPERSEDED' | 'TL-LOCKED';
}
/** Purchasable rows for this station, shared by renderer and purchase logic. */
/**
 * @param cheat playtesting only — lifts the tech-level lock so anything in the
 *   catalogue can be fitted anywhere. See `GameState.cheat` in state.ts.
 */
export function equipRows(sys: StarSystem, c: CommanderData, cheat = false): EquipRow[] {
  const fuel = fuelQuote(c);
  const rows: EquipRow[] = [{
    id: 'fuel',
    label: `Fuel (${(fuel.needed / 10).toFixed(1)} LY needed)`,
    price: fuel.cost,
    status: fuel.full ? 'OWNED' : '',
  }];
  for (const item of EQUIPMENT_CATALOGUE) {
    const owned = equipmentOwned(item.id, c);
    const superseded = equipmentSuperseded(item.id, c);
    const locked = !cheat && sys.techLevel + 1 < item.minTL;
    rows.push({
      id: item.id,
      label: item.name,
      price: item.price,
      status: owned ? 'OWNED' : superseded ? 'SUPERSEDED' : locked ? 'TL-LOCKED' : '',
    });
  }
  return rows;
}
export function renderEquip(
  sys: StarSystem, c: CommanderData, selected: number, cheat = false,
): void {
  const rows = equipRows(sys, c, cheat)
    .map((r, i) => `
      <tr class="${i === selected ? 'sel' : ''} pick" data-row="${i}">
        <td>${r.label.toUpperCase()}</td>
        <td class="num">${r.price > 0 ? (r.price / 10).toFixed(1) : '-'}</td>
        <td class="num">${
          r.status === 'OWNED' ? 'OWNED'
          : r.status === 'SUPERSEDED' ? 'SUPERSEDED'
          : r.status === 'TL-LOCKED' ? 'NOT AVAILABLE HERE'
          : cheat ? 'FREE'
          : ''
        }</td>
      </tr>`)
    .join('');
  show(`
    <h2>EQUIP SHIP &mdash; ${sys.name.toUpperCase()}</h2>
    <div class="rule"></div>
    ${cheat ? '<div class="info" style="text-align:center;color:var(--hud-amber)">CHEAT MODE &mdash; EVERYTHING FITTED FREE, ANY TECH LEVEL</div>' : ''}
    <table>
      <tr><th>ITEM</th><th class="num">PRICE (Cr)</th><th class="num"></th></tr>
      ${rows}
    </table>
    <div class="buttons">
      <button data-key="KeyB">BUY SELECTED</button>
      <button data-key="Escape">DONE</button>
    </div>
    <div class="keyline">
      CASH ${formatCredits(c.credits)} &middot; MISSILES ${c.missiles}
      &nbsp;&mdash;&nbsp; CLICK AN ITEM TO SELECT &middot; B / ENTER BUY &middot; ESC EXIT
    </div>
  `);
}
