// Buying the law: what an offer costs, what it buys, and what it never buys.
//
// The pirate half of this idea is `test/combat.test.ts` (cargo, and an appetite
// sized off your hold) and `test/jettison.test.ts` (the tonne actually leaving).
// This is the half that spends CREDITS on a policeman — docs/TODO/123 — and the
// claims it has to hold are as much about what does NOT move as what does:
//
//   - the record never clears, and never rises either: an inspection bought off
//     is an inspection that did not happen;
//   - the NAME always pays, whichever half of the feature you used;
//   - an offer you cannot cover buys nothing and spends nothing. A bribe that
//     half-works is the worst of the three outcomes.
//
// The prices are asserted from the constants and `VALUE_PER_TONNE` rather than
// from literals, so retuning the numbers does not silently retune the rules.

import * as THREE from 'three';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import {
  bribeOffered, fineFor, inspectionPrice, patrolPrice, patrolReach,
} from '../src/game/law.ts';
import { isHostileToPlayer, type NpcShip } from '../src/game/npc.ts';
import {
  BRIBE_FLOOR, BRIBE_SHARE, CLEAN, CONTRABAND, FUGITIVE, FUGITIVE_FINE,
  OFFENDER, PATROL_BRIBE_FINES, SCAN_RANGE, SCAN_WARN_RANGE,
} from '../src/constants/law.ts';
import { DISREPUTE_BRIBE } from '../src/constants/character.ts';
import { VALUE_PER_TONNE } from '../src/constants/jettison.ts';
import { COMMODITIES } from '../src/galaxy/galaxy.ts';
import { NOT_IN_THE_SIMULATOR } from '../src/game/controls.ts';
import { COMMAND_HELP } from '../src/game/command-help.ts';
import { check, cmds, dismissBriefing, eq, eqc } from './harness.ts';

const NARCOTICS = CONTRABAND[1];

// --- the key -----------------------------------------------------------------

console.log('\nL offers the law money — and never in the simulator');
{
  eqc('L in the cockpit makes the offer', cmds('flight', ['KeyL']), ['bribePolice']);
  eqc('...and the arena has no law to buy, so it answers nothing',
    cmds('simulator', ['KeyL']), []);
  check('...which is what NOT_IN_THE_SIMULATOR is doing',
    NOT_IN_THE_SIMULATOR.includes('bribePolice'));
  eqc('L at the station is still LAUNCH', cmds('docked', ['KeyL']), ['launch']);
  check('the guide says what it never buys',
    COMMAND_HELP.bribePolice.what.includes('never clears your record')
    && COMMAND_HELP.bribePolice.what.includes('costs your name'));
}

// --- the price ---------------------------------------------------------------

console.log('\nwhat a policeman charges to not read your hold');
{
  const hold = (tonnes: number): number[] => {
    const cargo = COMMODITIES.map(() => 0);
    cargo[NARCOTICS] = tonnes;
    return cargo;
  };
  // The rule, not the number: his cut of what the market pays for the evidence.
  const worth = (tonnes: number): number =>
    tonnes * COMMODITIES[NARCOTICS].basePrice * VALUE_PER_TONNE;

  eq('ten tonnes of narcotics cost his share of what they are worth',
    inspectionPrice(hold(10)), Math.round(worth(10) * BRIBE_SHARE));
  check('...and a fatter hold costs more than a thin one',
    inspectionPrice(hold(10)) > inspectionPrice(hold(4))
    && inspectionPrice(hold(4)) > inspectionPrice(hold(2)));
  check('...but never less than the floor, whatever you are carrying',
    inspectionPrice(hold(1)) === BRIBE_FLOOR
    && inspectionPrice(hold(0)) === BRIBE_FLOOR
    && worth(1) * BRIBE_SHARE < BRIBE_FLOOR);
  // Money is integer tenths (invariant 8): a price with a fraction in it would
  // leave a commander holding 0.03 of a credit for the rest of the career.
  check('every price is a whole number of tenths',
    [0, 1, 3, 7, 13, 35].every((t) => Number.isInteger(inspectionPrice(hold(t)))));
  // Legal cargo is not evidence: the sum is over CONTRABAND and nothing else,
  // so a hold of platinum does not raise the price of hiding one tonne of
  // slaves. Priced off the whole hold, the key would ask a fortune of a trader
  // running one crate.
  const withFurs = hold(3);
  withFurs[9] = 20;
  eq('a legal cargo alongside it changes nothing',
    inspectionPrice(withFurs), inspectionPrice(hold(3)));
}

console.log('\nan offer is taken, or it is short — never half of each');
{
  const price = inspectionPrice([]);
  const rich = bribeOffered(price, price * 4, 0);
  check('a commander who can cover it pays exactly the price',
    rich.bought && rich.creditsLeft === price * 3);
  check('...and it costs the name DISREPUTE_BRIBE, every time',
    rich.bought && rich.disrepute === DISREPUTE_BRIBE);

  const broke = bribeOffered(price, price - 1, 40);
  check('a commander one tenth short buys nothing', !broke.bought);
  check('...and is told what the shortfall is', !broke.bought && broke.short === 1);
  // The one thing the failure must not do is take the money anyway — there is
  // no `creditsLeft` on that branch of the type at all, so this is the type
  // system's claim as much as the test's.
  check('...and the refusal carries nothing to spend',
    !('creditsLeft' in broke) && !('disrepute' in broke));

  // Exactly affordable is affordable: the boundary belongs to the commander.
  const exact = bribeOffered(price, price, 0);
  check('the last tenth in the account still buys it',
    exact.bought && exact.creditsLeft === 0);
}

console.log('\nwhat a Viper already shooting charges to break off');
{
  check('a Fugitive is asked for more than an Offender',
    patrolPrice(FUGITIVE) > patrolPrice(OFFENDER));
  // THE RULE THAT MATTERS: a bribe that undercut the fine would delete the
  // fine. Docking and paying is always the cheaper way to deal with a record.
  check('...and both are worse than docking and paying the fine at that rung',
    patrolPrice(FUGITIVE) > fineFor(FUGITIVE, Infinity)
    && patrolPrice(OFFENDER) > fineFor(OFFENDER, Infinity));
  eq('...by the multiple the constant states, not a number of its own',
    patrolPrice(FUGITIVE), PATROL_BRIBE_FINES * FUGITIVE_FINE);
  // A clean commander can only be shot at by the law for something he did, and
  // the deed is the same deed: he pays the bottom rung's rate rather than the
  // nothing `fineFor` would return.
  eq('a Clean commander pays the Offender rate rather than nothing',
    patrolPrice(CLEAN), patrolPrice(OFFENDER));
  check('...and that is not nothing', patrolPrice(CLEAN) > 0);
}

console.log('\nthe window an offer fits in is the window the warning names');
{
  eq('inside scan range he is reading you', patrolReach(SCAN_RANGE * 0.5), 'scan');
  eq('...between the two ranges he is closing', patrolReach(SCAN_RANGE + 1), 'warn');
  eq('...just inside the band, still closing', patrolReach(SCAN_WARN_RANGE - 1), 'warn');
  eq('...and beyond it there is nobody to talk to', patrolReach(SCAN_WARN_RANGE), 'none');
  eq('...nor at the far side of the system', patrolReach(Infinity), 'none');
}

// --- the sky ------------------------------------------------------------------
//
// The prices above are arithmetic. What the milestone CLAIMS is that a patrol
// which would have read your hold does not, so the rest of this file flies it:
// a real Game, a real police ship, and the real step running afterwards.

/**
 * A commander in flight with `tonnes` of narcotics and one cop at `d` off the
 * nose. `fly(steps, closeTo)` runs the real step with the cop pinned — at `d`,
 * or at whatever range the caller wants him to close to.
 */
function smuggling(seed: number, tonnes: number, d: number): {
  g: Game; cop: NpcShip; fly: (steps: number, closeTo?: number) => string[];
} {
  const g = withoutSaving(() => {
    seedWorld(seed);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    game.launch();
    return game;
  }).value;
  let at = 0;
  const step = (): void => { g.step(1 / 60, at += 1 / 60); };
  for (let f = 0; f < 400; f++) step();      // past the launch tunnel

  // Clear the sky the fixture spawns: a pirate alongside is a fight, and a
  // fight in the same frames as a scan makes the console ambiguous.
  g.state.world.clearNpcs();
  g.state.commander.cargo = g.state.commander.cargo.map(() => 0);
  g.state.commander.cargo[NARCOTICS] = tonnes;
  const cop = g.state.world.spawn('police',
    g.state.player.position.clone().add(new THREE.Vector3(0, 0, -d)), 5);
  cop.object.updateMatrixWorld(true);

  // Both ships fly during a step, so the cop is pinned back to `d` before each
  // one: what is being measured is the RULE, not two hulls drifting apart.
  const said: string[] = [];
  const fly = (steps: number, closeTo = d): string[] => {
    said.length = 0;
    g.state.player.speed = 0;
    for (let f = 0; f < steps; f++) {
      cop.object.position.copy(g.state.player.position)
        .add(new THREE.Vector3(0, 0, -closeTo));
      cop.object.updateMatrixWorld(true);
      step();
      if (g.state.session.messageText) said.push(g.state.session.messageText);
    }
    return said;
  };
  return { g, cop, fly };
}

const SCAN = 'POLICE SCAN: CONTRABAND DETECTED';

console.log('\na patrol paid off never reads the hold');
{
  const { g, fly } = smuggling(20_260_810, 3, SCAN_WARN_RANGE * 0.9);
  const c = g.state.commander;
  c.credits = 100_000;
  const price = inspectionPrice(c.cargo);
  check('the console has warned him it is coming',
    fly(1).includes('POLICE PATROL CLOSING'));

  g.bribePolice();
  check(`the offer is taken, and named on the console (${g.state.session.messageText})`,
    g.state.session.messageText.startsWith('PATROL LOOKS THE OTHER WAY'));
  eq('...and it costs exactly the price the rule set', c.credits, 100_000 - price);
  eq('...and DISREPUTE_BRIBE off the name', c.disrepute ?? 0, DISREPUTE_BRIBE);

  // THE CLAIM. Not "the scan is deferred" — it does not happen, however long he
  // stays alongside, and it never happens at knife range either.
  eq('the record is exactly where it was', c.legalStatus, CLEAN);
  // ...and the range that would have read him is the one that proves it: the
  // cop closes to half of SCAN_RANGE and stays there for ten seconds. Without
  // the latch this is where the scan fires.
  check('...and stays clean with the patrol at knife range for ten seconds',
    !fly(600, SCAN_RANGE * 0.5).includes(SCAN) && c.legalStatus === CLEAN);
  check('...and the hold is still aboard, which is what the money bought',
    c.cargo[NARCOTICS] === 3);
}

console.log('...and one nobody paid still reads it');
{
  // The control that makes the block above mean anything: the same fixture, no
  // offer, the cop closing to the range that reads a hold.
  const { g, fly } = smuggling(20_260_811, 3, SCAN_RANGE * 0.5);
  g.state.commander.credits = 100_000;
  check('an unbribed patrol scans, and the record moves',
    fly(2).includes(SCAN) && g.state.commander.legalStatus !== CLEAN
    && g.state.session.policeScanned);
  eq('...and nothing was spent, because nothing was offered',
    g.state.commander.credits, 100_000);
}

console.log('\na bribe you cannot afford does not half-work');
{
  const { g, fly } = smuggling(20_260_812, 3, SCAN_WARN_RANGE * 0.9);
  const c = g.state.commander;
  c.credits = inspectionPrice(c.cargo) - 1;
  const was = c.credits;
  fly(1);
  g.bribePolice();
  check(`the console names the shortfall (${g.state.session.messageText})`,
    g.state.session.messageText.startsWith('THEY WANT MORE'));
  eq('...and not a tenth is spent', c.credits, was);
  eq('...and the name is untouched', c.disrepute ?? 0, 0);
  check('...and nothing is latched', !g.state.session.policeScanned);

  // ...so the scan still happens when he closes, which is the whole point of
  // the control: an offer that failed must leave the world exactly as it was.
  const near = smuggling(20_260_813, 3, SCAN_RANGE * 0.5);
  near.g.state.commander.credits = 0;
  near.g.bribePolice();
  check('a broke commander is still scanned', near.fly(2).includes(SCAN)
    && near.g.state.commander.legalStatus !== CLEAN);
}

console.log('\na Viper takes credits to break off — and the record stays where it is');
{
  // Provoked rather than hunting a record, which is the case a CLEAN commander
  // can be in: shoot at the law and it is personal whatever your paperwork says.
  const { g, cop } = smuggling(20_260_816, 0, 800);
  const c = g.state.commander;
  c.credits = 100_000;
  cop.state.provokedByPlayer = true;
  check('the Viper is on you', isHostileToPlayer(cop, c.legalStatus));

  g.bribePolice();
  check(`the offer is taken, and named (${g.state.session.messageText})`,
    g.state.session.messageText.startsWith('PATROL BREAKS OFF'));
  eq('...at the price for the rung you are on', c.credits, 100_000 - patrolPrice(CLEAN));
  eq('...and DISREPUTE_BRIBE off the name', c.disrepute ?? 0, DISREPUTE_BRIBE);

  // THE CLAIM, and it is two claims that have to hold at once: the ship is done
  // with you and the record has not moved. The rule and the paperwork moving
  // independently is the point of the milestone.
  check('the same call that said he was hostile now says he is not',
    !isHostileToPlayer(cop, c.legalStatus));
  eq('...and the record is exactly where it was', c.legalStatus, CLEAN);
  check('...because the mechanism is the field a pirate takes cargo for',
    cop.state.satisfied);
  // He is bought, not gone: still provoked, still in the sky. What ended is his
  // interest in you.
  check('...and nothing pretended the provocation never happened',
    cop.state.provokedByPlayer && cop.state.alive);
}

console.log('...and a Fugitive pays the Fugitive rate, and is still a Fugitive');
{
  const { g, cop } = smuggling(20_260_817, 0, 800);
  const c = g.state.commander;
  c.credits = 100_000;
  c.legalStatus = FUGITIVE;
  check('police hunt Fugitives, so he is hostile on the record alone',
    isHostileToPlayer(cop, c.legalStatus) && !cop.state.provokedByPlayer);

  g.bribePolice();
  eq('the Fugitive rate is what it costs', c.credits, 100_000 - patrolPrice(FUGITIVE));
  check('...he breaks off', !isHostileToPlayer(cop, c.legalStatus));
  eq('...and you are still a Fugitive: the next patrol is a fresh problem',
    c.legalStatus, FUGITIVE);
}

console.log('...and a pair costs twice, one press at a time');
{
  const { g, cop } = smuggling(20_260_818, 0, 800);
  const c = g.state.commander;
  c.credits = 100_000;
  c.legalStatus = FUGITIVE;
  const second = g.state.world.spawn('police',
    g.state.player.position.clone().add(new THREE.Vector3(0, 0, -2000)), 6);
  second.object.updateMatrixWorld(true);

  g.bribePolice();
  check('the nearer of the two breaks off first',
    cop.state.satisfied && !second.state.satisfied);
  check('...and the far one is still coming',
    isHostileToPlayer(second, c.legalStatus));

  g.bribePolice();
  check('a second press buys the second ship', second.state.satisfied);
  eq('...for twice the money, exactly as a gang of pirates costs',
    c.credits, 100_000 - 2 * patrolPrice(FUGITIVE));
  eq('...and the name paid twice too', c.disrepute ?? 0, 2 * DISREPUTE_BRIBE);
}

console.log('...and an escort you cannot pay for keeps shooting');
{
  const { g, cop } = smuggling(20_260_819, 0, 800);
  const c = g.state.commander;
  c.legalStatus = FUGITIVE;
  c.credits = patrolPrice(FUGITIVE) - 1;
  const was = c.credits;
  g.bribePolice();
  check(`the console names the shortfall (${g.state.session.messageText})`,
    g.state.session.messageText.startsWith('THEY WANT MORE'));
  eq('...and not a tenth is spent', c.credits, was);
  check('...and he is still hostile', isHostileToPlayer(cop, c.legalStatus)
    && !cop.state.satisfied);
}

console.log('\nthere is nothing to buy when nobody is there');
{
  // A clean hold, a cop alongside: he has no reason to look away and the key
  // says so rather than spending money into the void.
  const { g, fly } = smuggling(20_260_814, 0, SCAN_WARN_RANGE * 0.9);
  g.state.commander.credits = 100_000;
  fly(1);
  g.bribePolice();
  eq('a clean hold has nothing to pay for', g.state.session.messageText, 'NOBODY TO PAY OFF');
  eq('...and pays nothing', g.state.commander.credits, 100_000);

  // Contraband, but the nearest cop is beyond the band: the same refusal.
  const far = smuggling(20_260_815, 3, SCAN_WARN_RANGE * 1.5);
  far.g.state.commander.credits = 100_000;
  far.fly(1);
  far.g.bribePolice();
  eq('a patrol out of reach is nobody to pay',
    far.g.state.session.messageText, 'NOBODY TO PAY OFF');
  eq('...and that costs nothing either', far.g.state.commander.credits, 100_000);
}
