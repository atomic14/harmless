// The person in your crew spaces: the choice docking used to make for you.
//
// You scoop someone out of a capsule and docking filed them with station
// medical in the same breath as resetting your shields — no choice, no payment,
// no consequence, and the one genuinely moral act in the game cost nothing and
// meant nothing (docs/TODO/127). What is asserted here is the CHOICE: that it
// is asked, that it cannot be dodged, and that the answer is what resolves it.
//
// Three surfaces, three kinds of check: the rule (`game/survivors.ts`, pure),
// the screen's keyboard (a stub Input, the way quit.test.ts drives its
// confirmation), and a real Game docking with somebody aboard.

import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { newCommander } from '../src/game/commander.ts';
import { cargoTonnes, formatCredits } from '../src/game/commander.ts';
import {
  resolveSurvivors, survivorMessage, survivorOffers,
} from '../src/game/survivors.ts';
import { SurvivorsScreen, type SurvivorsContext } from '../src/game/screens/survivors.ts';
import { priceInTenths, saleFallout } from '../src/game/market.ts';
import { offenceFor, recordVerdict } from '../src/game/law.ts';
import { CLEAN, FUGITIVE, OFFENDER } from '../src/constants/law.ts';
import { characterName } from '../src/game/character.ts';
import { generateMarket } from '../src/galaxy/galaxy.ts';
import { SLAVES } from '../src/constants/commodities.ts';
import { SURVIVOR_RELEASE_SHARE } from '../src/constants/survivors.ts';
import {
  DISREPUTE_SLAVE_SALE, DISREPUTE_SURVIVOR_RELEASED,
} from '../src/constants/character.ts';
import type { Input } from '../src/engine/input.ts';
import { check, dismissBriefing, eq } from './harness.ts';
import { g1 } from './fixtures.ts';

/** A keyboard that has already been pressed, as `Input` — taps are consumed. */
function taps(): { press(code: string): void; input: Input } {
  const queued: string[] = [];
  return {
    press: (code) => { queued.push(code); },
    input: {
      pressed: (code: string) => {
        const at = queued.indexOf(code);
        if (at < 0) return false;
        queued.splice(at, 1);
        return true;
      },
      held: () => false,
    } as unknown as Input,
  };
}

// --- the rule ----------------------------------------------------------------

/** A commander with `people` aboard, and the offers a station would make. */
const aboard = (people: number, quote = 40.6) => {
  const c = newCommander();
  c.survivors = people;
  return { c, offers: survivorOffers(people, quote) };
};

console.log('\nhanding a survivor over costs nothing and pays nothing');
{
  const { c, offers } = aboard(2);
  const before = { credits: c.credits, disrepute: c.disrepute ?? 0, hold: cargoTonnes(c) };

  const e = resolveSurvivors(c, 'medical', offers);
  check('the rule reports what happened', e?.kind === 'handed' && e.people === 2);
  eq('...and the crew spaces are clear', c.survivors, 0);
  eq('...for nothing', c.credits, before.credits);
  eq('...and no mark on the name: being decent is not a trade',
    c.disrepute ?? 0, before.disrepute);
  eq('...and it is not a hold operation', cargoTonnes(c), before.hold);
  eq('the console line counts them', survivorMessage(e!), '2 SURVIVORS HANDED TO STATION MEDICAL');

  const one = aboard(1);
  eq('...and pluralises off the count',
    survivorMessage(resolveSurvivors(one.c, 'medical', one.offers)!),
    '1 SURVIVOR HANDED TO STATION MEDICAL');

  // A caller must not be able to announce a rescue that did not happen.
  eq('nobody aboard is not an answer',
    resolveSurvivors(newCommander(), 'medical', offers), null);
}

console.log('\n...and the two that do not');
{
  // SELL: the station's own Slaves quote, per person, and a career-marking
  // deed. The price is read off `generateMarket` rather than written down, so
  // this is the rule and not a copy of it.
  const quote = generateMarket(g1[7], 0)[SLAVES].price;
  const { c, offers } = aboard(2, quote);
  const before = { credits: c.credits, hold: cargoTonnes(c) };

  const e = resolveSurvivors(c, 'sold', offers);
  eq('selling pays the station\'s own Slaves price, per person',
    c.credits - before.credits, 2 * priceInTenths(quote));
  check('the event says what was paid', e?.kind === 'sold' && e.paid === offers.sale);

  // --- the law's half (M3) ---------------------------------------------------
  //
  // Asserted against the rules themselves rather than against copies: the heat
  // is what `saleFallout` says a contraband sale of that size does, and the
  // record is the rung `offenceFor` gives a shot fired at a lawful ship — one
  // BELOW the rung it gives a kill, because a sale over a counter must not
  // outrank killing somebody.
  check('the sale is a CONTRABAND SALE to the region, at the shared rule\'s own figure',
    e?.kind === 'sold' && e.heat === saleFallout(SLAVES, 2, offers.sale).notoriety
    && e.heat > 0);
  check('...and it files you as an Offender, not a Fugitive',
    e?.kind === 'sold' && e.offence === OFFENDER
    && e.offence === offenceFor('trader', false) && e.offence < FUGITIVE);
  // ...and the name is marked ONCE. `saleFallout` prices a tonne of narcotics;
  // this deed has a constant of its own, and charging both would price it twice.
  eq('the name pays the person\'s weight and not also the cargo\'s',
    c.disrepute ?? 0, DISREPUTE_SLAVE_SALE);
  eq('...and it marks the name at the career-marking weight',
    c.disrepute ?? 0, DISREPUTE_SLAVE_SALE);
  eq('one sale takes an Honest commander to Dodgy', characterName(c.disrepute ?? 0), 'Dodgy');
  // THE THING THAT MUST NOT HAPPEN (docs/TODO/108): a person is not stock. A
  // sale that routed through the hold would let a full ship refuse it.
  eq('...and nothing went through the hold', cargoTonnes(c), before.hold);
  eq('...and the crew spaces are clear', c.survivors, 0);

  // LET THEM GO: less money, less of your name. You are not selling a person;
  // you are declining to file one.
  const go = aboard(2, quote);
  const paid = resolveSurvivors(go.c, 'released', go.offers)!;
  check('a release pays less than the sale', paid.kind === 'released'
    && paid.paid === go.offers.release && paid.paid < go.offers.sale);
  // ...and it is not a sale, so the law has nothing to file and the region has
  // nothing to talk about. Only the name knows.
  check('...and there is no record and no heat in it', paid.kind === 'released'
    && !('offence' in paid) && !('heat' in paid));
  eq('...at the share the rule sets',
    go.offers.release, Math.round(go.offers.sale * SURVIVOR_RELEASE_SHARE));
  eq('...and costs less of the name', go.c.disrepute ?? 0, DISREPUTE_SURVIVOR_RELEASED);
  check('...which is a nudge and not a career',
    DISREPUTE_SURVIVOR_RELEASED < DISREPUTE_SLAVE_SALE
    && characterName(go.c.disrepute ?? 0) !== 'Dodgy');
  eq('...and it too clears the crew spaces', go.c.survivors, 0);

  // The market is the price, so a system that pays differently for people
  // pays differently for this — which is the reason for reading the quote.
  const dear = g1.reduce((best, sys) =>
    (generateMarket(sys, 0)[SLAVES].price > generateMarket(best, 0)[SLAVES].price ? sys : best));
  check(`the quote is the market's, and it varies (${g1[7].name} ${quote}`
    + ` vs ${dear.name} ${generateMarket(dear, 0)[SLAVES].price})`,
    survivorOffers(1, generateMarket(dear, 0)[SLAVES].price).sale > survivorOffers(1, quote).sale);
}

// --- the keyboard ------------------------------------------------------------

console.log('\nthe prompt cannot be escaped');
{
  const answered: string[] = [];
  const screen = new SurvivorsScreen(() => ({
    people: 1,
    offers: { sale: 400, release: 200 },
    handOver: () => { answered.push('medical'); },
    sell: () => { answered.push('sold'); },
    release: () => { answered.push('released'); },
  } satisfies SurvivorsContext));
  const kb = taps();
  screen.open();

  // THE CLAIM OF THE MILESTONE. Escape is how every other overlay in the game
  // closes; here it is refused, because "do nothing" would resolve the choice
  // in the decent direction for free and put the old bug straight back.
  kb.press('Escape');
  eq('ESC does not dismiss it', screen.input(kb.input), 'stay');
  eq('...and nothing was decided', answered.length, 0);

  for (const key of ['Enter', 'KeyQ', 'KeyY', 'Space']) {
    kb.press(key);
    eq(`...and neither does ${key}`, screen.input(kb.input), 'stay');
  }
  eq('...still nothing decided', answered.length, 0);

  kb.press('KeyM');
  eq('M hands them over, and closes the prompt', screen.input(kb.input), 'back');
  eq('...having answered exactly once', answered.join(','), 'medical');

  // ...and the two dirty answers are the other two letters, each its own act
  kb.press('KeyV');
  eq('V sells them', screen.input(kb.input), 'back');
  kb.press('KeyL');
  eq('L takes the money to let them go', screen.input(kb.input), 'back');
  eq('...three answers, three keys, no default',
    answered.join(','), 'medical,sold,released');
}

// --- and the real docking ----------------------------------------------------

console.log('\ndocking with somebody aboard asks before it resolves');
{
  const g = withoutSaving(() => {
    seedWorld(20_270_810);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    return game;
  }).value;
  const c = g.state.commander;
  c.survivors = 1;

  withoutSaving(() => { g.enterDocked('resumed'); });
  eq('the prompt is what is on screen', g.screens.topId, 'survivors');
  // THE OTHER HALF: `Station.dock` no longer resolves them. If it did, the
  // screen would be asking about somebody who had already been handed over.
  eq('...and nobody has been handed over yet', c.survivors, 1);

  // ...and the station's own business is finished underneath it: the prompt is
  // on TOP of a docked game, not instead of docking.
  eq('the ship is docked behind it', g.state.session.hyperCountdown, -1);

  const kb = taps();
  kb.press('KeyM');
  g.screens.update(kb.input);
  eq('the answer clears the crew spaces', c.survivors, 0);
  eq('...and the console says so', g.state.session.messageText,
    '1 SURVIVOR HANDED TO STATION MEDICAL');
}

console.log('...and the sale is priced off the market that station rolled');
{
  const g = withoutSaving(() => {
    seedWorld(20_270_811);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    return game;
  }).value;
  const c = g.state.commander;
  c.survivors = 1;
  withoutSaving(() => { g.enterDocked('resumed'); });

  const quote = g.state.market[SLAVES].price;
  const before = c.credits;
  const kb = taps();
  kb.press('KeyV');
  g.screens.update(kb.input);

  eq('the money is this station\'s Slaves quote', c.credits - before, priceInTenths(quote));
  eq('...and the console says what was done and what it paid',
    g.state.session.messageText,
    `1 SOLD ON THE SLAVE ROW — ${formatCredits(priceInTenths(quote))}`);
  eq('...and the name pays the career-marking weight', c.disrepute ?? 0, DISREPUTE_SLAVE_SALE);
  // The name's own line is QUEUED behind the receipt (docs/TODO/129), so the
  // rung it crossed is waiting rather than shouting over it.
  const queued = g.state.session.queued.map((q) => q.text);
  check(`the crossing is queued behind it (${queued.join(' / ')})`,
    queued.includes('CHARACTER: DODGY'));
  eq('...and the prompt is gone', g.screens.topId, null);

  // --- and the law, through the real Game (M3) -------------------------------
  eq('the sale filed a record', c.legalStatus, OFFENDER);
  check(`...and the region heard about it (heat ${g.state.living.state(c.systemIndex).heat})`,
    g.state.living.state(c.systemIndex).heat > 0);
  // Police hunt Fugitives, so an Offender walks out unmolested and the console
  // has to say who DOES come — the same line a scan leaves behind (TODO/122).
  check(`...and the console says what the record means (${queued.join(' / ')})`,
    queued.includes(recordVerdict(OFFENDER)) && recordVerdict(OFFENDER).includes('HUNTER'));
  // The station does not scramble Vipers at a docked ship: the record moved,
  // the fleet waits until there is something to launch at.
  check('...and no defence launched at a ship on the pad',
    !g.state.session.defenceLaunched && g.state.world.npcs.length === 0);

  // THE CONTROL: the decent answer files nothing at all.
  const good = withoutSaving(() => {
    seedWorld(20_270_812);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    return game;
  }).value;
  good.state.commander.survivors = 1;
  withoutSaving(() => { good.enterDocked('resumed'); });
  const heatBefore = good.state.living.state(good.state.commander.systemIndex).heat;
  const kb2 = taps();
  kb2.press('KeyM');
  good.screens.update(kb2.input);
  eq('handing them over is nobody\'s business legally',
    good.state.commander.legalStatus, CLEAN);
  eq('...and nothing was said about you here',
    good.state.living.state(good.state.commander.systemIndex).heat, heatBefore);
}
