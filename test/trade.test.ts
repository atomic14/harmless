// The outfitter: what a purchase costs you, and what it refuses.
//
// `buyEquipment` is the most complex function in src/ by cyclomatic complexity
// (CCN 27, `uvx lizard src --languages typescript -w`) and until this file it
// had never been executed by a test — the worst pair of numbers in the project,
// on the one code path that moves a player's money. It could always have been
// tested; nothing in it needs a browser. Nobody had.
//
// It writes the save on success, which is the whole reason this is careful:
// every case here runs inside `withoutSaving`, which refuses the write and
// hands back the keys it refused, so the tests assert the save WOULD have
// happened without ever touching a real commander. `test/harness.ts` has
// already put this whole process in the harness namespace, so there is no
// player key to reach in the first place (docs/INVARIANTS.md invariant 3).

import { buyEquipment, type TradeContext } from '../src/game/screens/trade.ts';
import { equipmentOwned, equipmentSuperseded } from '../src/game/shop.ts';
import {
  equipRows, type EquipRow,
} from '../src/ui/screens-trade.ts';
import {
  newCommander, type CommanderData,
} from '../src/game/commander.ts';
import { generateMarket } from '../src/galaxy/galaxy.ts';
import {
  BEAM_LASER_PRICE, EQUIPMENT_CATALOGUE, PULSE_LASER_PRICE,
} from '../src/constants/shop.ts';
import {
  LARGE_BAY_TONNES, MAX_FUEL, MAX_MISSILES,
} from '../src/constants/commander.ts';
import { withoutSaving, writeDockSave } from '../src/game/storage.ts';
import type { WorldSnapshot } from '../src/game/snapshot.ts';
import { readFileSync } from 'node:fs';
import { check, eq } from './harness.ts';
import { g1 } from './fixtures.ts';

console.log('\noutfitting');
{
  const LAVE = g1[7];
  /** A rich system, so the tech level does not gate what we are testing. */
  const RICH = g1.find((s) => s.techLevel >= 10) ?? LAVE;

  /**
   * The write the outfitter triggers, as the Game wires it: a docked
   * checkpoint. It goes through the real storage write so `withoutSaving` has
   * something to refuse — a stub that wrote nothing would make every "the save
   * was suppressed" assertion below true for the wrong reason.
   */
  const saveCheckpoint = (c: CommanderData): void => {
    writeDockSave('TEST CAREER', { commander: c } as unknown as WorldSnapshot);
  };

  const ctxFor = (system = RICH, cheat = false) => {
    const commander = newCommander();
    const said: string[] = [];
    const ctx: TradeContext = {
      commander,
      system,
      market: generateMarket(system, 0),
      atHermit: false,
      cheat,
      leaveHermit: () => {},
      message: (t) => { said.push(t); },
      queueMessage: (t) => { said.push(t); },
      addNotoriety: () => {},
      checkpoint: () => { saveCheckpoint(ctx.commander); },
    };
    return { ctx, commander, said };
  };

  /** Buy with the save suspended; returns the keys the write would have hit. */
  const buy = (id: string, ctx: TradeContext): string[] =>
    withoutSaving(() => buyEquipment(id, ctx)).refused;

  // --- the happy path, and that it really does persist ----------------------
  {
    const { ctx, commander } = ctxFor();
    commander.credits = 100_000;
    const row = equipRows(ctx.system, commander, false).find((r: EquipRow) => r.id === 'ecm');
    check('the E.C.M. is on sale in a high-tech system', !!row && row.status === '');
    const refused = buy('ecm', ctx);
    check('buying the E.C.M. fits it', commander.equipment.ecm === true);
    eq('...and charges exactly its price', commander.credits, 100_000 - row!.price);
    check('...and the purchase would have been saved', refused.length > 0,
      'buyEquipment must write the commander — it is one of only two save points');
  }

  // --- refusals, and that a refusal costs nothing ---------------------------
  {
    const { ctx, commander } = ctxFor();
    commander.credits = 100_000;
    const before = commander.credits;
    const refused = buy('no-such-item', ctx);
    eq('an unknown id charges nothing', commander.credits, before);
    check('...and does not write the save', refused.length === 0);
    check('...and does not throw — it used to be a non-null assertion', true);
  }
  {
    const { ctx, commander, said } = ctxFor();
    commander.credits = 10;   // ten tenths of a credit: one credit
    const refused = buy('ecm', ctx);
    eq('too little money leaves the credits alone', commander.credits, 10);
    check('...leaves the equipment unfitted', commander.equipment.ecm !== true);
    check('...says so', said.includes('INSUFFICIENT CREDITS'));
    check('...and writes nothing', refused.length === 0);
  }
  {
    const { ctx, commander } = ctxFor();
    commander.credits = 100_000;
    buy('ecm', ctx);
    const after = commander.credits;
    buy('ecm', ctx);
    eq('buying what you already own is refused, not charged twice',
      commander.credits, after);
  }

  // --- the laser refunds, which are the fiddly half -------------------------
  //
  // A trade-in is worth WHAT THE OLD GUN COST, so the refund for a beam is the
  // beam's own catalogue price and nothing else. This used to be written down
  // here as `10000`, a copy of that price with nothing holding the two
  // together: raise the beam to 12,000 and the game would refund 10,000 for a
  // gun the player had just paid 12,000 for, with this test still green. The
  // pulse's price is `PULSE_LASER_PRICE` now (constants/shop.ts) — the same
  // number the three side-mount rows charge, which is what "refunded at what
  // it cost" has to mean for a gun the shop never sells forward.
  {
    const { ctx, commander } = ctxFor();
    commander.credits = 100_000;
    const priceOf = (id: string): number =>
      EQUIPMENT_CATALOGUE.find((e) => e.id === id)?.price ?? 0;
    const PULSE_TRADE_IN = PULSE_LASER_PRICE;
    check('the side pulse mounts sell the trade-in gun at its one price',
      ['rearLaser', 'leftLaser', 'rightLaser'].every((id) => priceOf(id) === PULSE_LASER_PRICE)
      && priceOf('beam') === BEAM_LASER_PRICE);
    const beamRow = equipRows(ctx.system, commander, false).find((r: EquipRow) => r.id === 'beam');
    if (beamRow && beamRow.status === '') {
      buy('beam', ctx);
      eq('a beam laser refunds the pulse laser it replaces',
        commander.credits, 100_000 - beamRow.price + PULSE_TRADE_IN);
      eq('...and is fitted', commander.equipment.laser, 'beam');

      const milRow = equipRows(ctx.system, commander, false).find((r: EquipRow) => r.id === 'military');
      if (milRow && milRow.status === '') {
        const before = commander.credits;
        buy('military', ctx);
        eq('a military laser refunds what the BEAM cost, not what a pulse cost',
          commander.credits, before - milRow.price + priceOf('beam'));
      }
      // ...and the two refunds are actually different, so the line above is
      // distinguishing them rather than passing on a coincidence.
      check('the beam is worth more as a trade-in than the pulse it replaced',
        priceOf('beam') > PULSE_TRADE_IN && priceOf('beam') > 0);
    }
  }

  // --- a better gun is not the beam laser owned (docs/TODO/186) --------------
  //
  // GitHub #38: *"I bought a military laser and that marked the beam laser as
  // "owned" as well."* The beam row answered "not a pulse laser", which was a
  // purchase guard in an ownership check. The guard holds, and the word is
  // SUPERSEDED. Every claim below drives the real rows and the real purchase.
  {
    const { ctx, commander } = ctxFor();
    commander.credits = 200_000;
    const rowFor = (id: string): EquipRow | undefined =>
      equipRows(ctx.system, commander, false).find((r: EquipRow) => r.id === id);
    buy('beam', ctx);
    eq('a beam laser fitted reads OWNED on its own row', rowFor('beam')?.status, 'OWNED');
    check('...and the beam is the fit', equipmentOwned('beam', commander));
    check('...and nothing supersedes it', !equipmentSuperseded('beam', commander));

    buy('military', ctx);
    eq('the military laser is fitted', commander.equipment.laser, 'military');
    eq('...and its row reads OWNED', rowFor('military')?.status, 'OWNED');
    eq('...and the beam row reads SUPERSEDED, not OWNED', rowFor('beam')?.status, 'SUPERSEDED');
    check('...because the beam is not the fit', !equipmentOwned('beam', commander));
    check('...and a better gun fills its mount', equipmentSuperseded('beam', commander));

    const before = commander.credits;
    const refused = buy('beam', ctx);
    eq('a purchase of the superseded row is refused, and no money moves',
      commander.credits, before);
    eq('...and the military laser stays fitted', commander.equipment.laser, 'military');
    check('...and nothing is written', refused.length === 0);

    // The status screen's own filter, minus the missile row it skips. It
    // listed Beam Laser and Military Laser together before this item.
    const fit = EQUIPMENT_CATALOGUE
      .filter((item) => item.id !== 'missile' && equipmentOwned(item.id, commander))
      .map((item) => item.id);
    eq('the fit lists one laser, and it is the military one',
      fit.filter((id) => id === 'beam' || id === 'military').join(','), 'military');
  }

  // --- the shelf cannot advertise a bay the game does not fit ---------------
  //
  // The survey's four-home cargo capacity: the label used to type the 35 into
  // a string. It interpolates LARGE_BAY_TONNES now, and this is what goes red
  // if someone types it back.
  {
    const bay = EQUIPMENT_CATALOGUE.find((e) => e.id === 'largeBay');
    check('the large bay\'s label states the bay the game fits',
      !!bay && bay.name.includes(`(${LARGE_BAY_TONNES}t)`));
  }

  // --- the two that are not equipment --------------------------------------
  {
    const { ctx, commander } = ctxFor();
    commander.credits = 100_000;
    commander.fuel = 0;
    buy('fuel', ctx);
    eq('fuel fills the tank to the maximum', commander.fuel, MAX_FUEL);
  }
  {
    const { ctx, commander } = ctxFor();
    commander.credits = 1_000_000;
    for (let i = 0; i < MAX_MISSILES + 3; i++) buy('missile', ctx);
    eq('the missile rack cannot be overfilled', commander.missiles, MAX_MISSILES);
  }

  // --- the cheat is free, and free means UNCHANGED --------------------------
  //
  // Letting credits go negative would break the save, the status screen and the
  // campaign's "credits never go negative" assertion — so this is not cosmetic.
  {
    const { ctx, commander } = ctxFor(LAVE, true);
    commander.credits = 0;
    buy('galacticDrive', ctx);
    check('the cheat fits a galactic drive with no money', commander.equipment.galacticDrive === true);
    eq('...and does not take the credits below zero', commander.credits, 0);
  }

  // --- every catalogue row is buyable, so none of them is dead data ---------
  {
    const { ctx, commander } = ctxFor(LAVE, true);
    commander.credits = 10_000_000;
    // Only rows that are actually FOR SALE. A fresh commander has a full tank,
    // so `fuel` reads OWNED and is refused — correctly, and it is the reason
    // this check filters rather than asserting over the whole catalogue.
    const ids = equipRows(ctx.system, commander, true)
      .filter((r: EquipRow) => r.status === '').map((r: EquipRow) => r.id);
    check(`the catalogue offers rows to buy (${ids.length})`, ids.length > 5);
    let handled = 0;
    for (const id of ids) {
      const fresh = ctxFor(LAVE, true);
      fresh.commander.credits = 10_000_000;
      const before = JSON.stringify(fresh.commander);
      withoutSaving(() => buyEquipment(id, fresh.ctx));
      if (JSON.stringify(fresh.commander) !== before) handled += 1;
    }
    check(`every catalogue id changes the commander when bought (${handled}/${ids.length})`,
      handled === ids.length,
      'an id with no case in the switch takes the money and does nothing');
  }

  // --- ...and the headless campaign is behind the same check ----------------
  //
  // THE CHECK ABOVE COULD NOT SEE THE CAMPAIGN UNTIL docs/TODO/178.
  // `test/campaign.ts` kept its own switch over the same ids, hardcoding the
  // missile cap and both laser refunds. So a new catalogue row could reach
  // every case here and none there, and the balance playtest would deduct the
  // price and fit nothing.
  //
  // Both callers spend `shop.ts`'s `applyPurchase` now, which is invariant 10:
  // an economic rule lives in a module the headless campaign shares. This scan
  // is what stops a second copy coming back.
  {
    const source = (path: string): string =>
      readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    // IT READS THE WRITE RATHER THAN THE SWITCH, and the first draft did not.
    // A scan for `case 'largeBay'` sees a switch and misses an if-chain, which
    // the break-it step demonstrated. Fitting a piece of kit is a write of
    // `true`, whatever shape the code around it takes.
    //
    // `test/campaign.ts` holds ONE equipment write of its own and it is
    // `escapePod = false`, where a pod is spent to survive an encounter. That
    // is a loss rather than a purchase, so `= true` is the honest pattern.
    const FITTED = [
      'largeBay', 'ecm', 'scoops', 'escapePod', 'energyBomb', 'energyUnit',
      'dockingComputer', 'miningLaser', 'combatComputer', 'galacticDrive',
      'rearLaser', 'leftLaser', 'rightLaser',
    ].join('|');
    const fits = (src: string): boolean =>
      new RegExp(`\\.\\s*(${FITTED})\\s*=\\s*true`).test(src);

    const campaign = source('test/campaign.ts');
    check('the campaign reaches for the shared purchase rule',
      campaign.includes('applyPurchase'));
    check('...and fits no equipment of its own', !fits(campaign));

    // The control. Without it, a scan that read the wrong file or a pattern
    // that matched nothing would report exactly the same green.
    check('...and the scan is not vacuous — src/game/shop.ts fits them',
      fits(source('src/game/shop.ts')));
  }
}
