// Buying the law, flown: the same rules with a real Viper around them.
//
// `test/bribe.test.ts` owns the arithmetic — what a policeman charges, what an
// offer leaves, how often he says no. This is the half that needs a world,
// because the milestone's claim is about what a PATROL DOES: a price nobody
// obeys is not a feature. A real Game, a real police ship spawned the way the
// world spawns one, and the shipped step running afterwards for as long as it
// takes to prove the scan never comes.
//
// The same division as the pirate bribe: pure in test/combat.test.ts, flown in
// test/jettison.test.ts.
//
// The refusal roll is real and comes off the world's seeded stream (invariant
// 11), so every block about a PRICE seeds the stream to hold the luck still —
// `nextOffer` — and the block about the refusal asks for the other side of the
// same coin.

import * as THREE from 'three';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { random, seedWorld } from '../src/game/rng.ts';
import {
  inspectionPrice, patrolPrice, refusalChance,
} from '../src/game/law.ts';
import { formatCredits } from '../src/game/commander.ts';
import { isHostileToPlayer, type NpcShip } from '../src/game/npc.ts';
import {
  CLEAN, CONTRABAND, FUGITIVE, SCAN_RANGE, SCAN_WARN_RANGE,
} from '../src/constants/law.ts';
import { DISREPUTE_BRIBE } from '../src/constants/character.ts';
import { check, dismissBriefing, eq } from './harness.ts';

const NARCOTICS = CONTRABAND[1];

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
const REFUSED = 'THE OFFER IS REFUSED — AND REPORTED';

/**
 * Set the world's stream so the NEXT draw off it decides the offer this way.
 *
 * The roll is real and it comes off the seeded stream (invariant 11), so a test
 * about a price cannot also be a test about luck. Seeding is how the game
 * itself makes a run repeatable; this searches for the seed whose first draw
 * falls the wanted side of `refusalChance` and leaves the stream on it.
 */
function nextOffer(want: 'taken' | 'refused', disrepute = 0): void {
  const chance = refusalChance(disrepute);
  for (let seed = 1; seed < 10_000; seed++) {
    seedWorld(seed);
    if ((random() < chance) === (want === 'refused')) { seedWorld(seed); return; }
  }
  throw new Error(`no seed makes an offer ${want} at disrepute ${disrepute}`);
}

console.log('\na patrol paid off never reads the hold');
{
  const { g, fly } = smuggling(20_260_810, 3, SCAN_WARN_RANGE * 0.9);
  const c = g.state.commander;
  c.credits = 100_000;
  const price = inspectionPrice(c.cargo);
  check('the console has warned him it is coming',
    fly(1).includes('POLICE PATROL CLOSING'));

  nextOffer('taken');
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
  check('the Viper is on you', isHostileToPlayer(cop, c.legalStatus, Infinity));

  nextOffer('taken');
  g.bribePolice();
  check(`the offer is taken, and named (${g.state.session.messageText})`,
    g.state.session.messageText.startsWith('PATROL BREAKS OFF'));
  eq('...at the price for the rung you are on', c.credits, 100_000 - patrolPrice(CLEAN));
  eq('...and DISREPUTE_BRIBE off the name', c.disrepute ?? 0, DISREPUTE_BRIBE);

  // THE CLAIM, and it is two claims that have to hold at once: the ship is done
  // with you and the record has not moved. The rule and the paperwork moving
  // independently is the point of the milestone.
  check('the same call that said he was hostile now says he is not',
    !isHostileToPlayer(cop, c.legalStatus, Infinity));
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
    isHostileToPlayer(cop, c.legalStatus, Infinity) && !cop.state.provokedByPlayer);

  nextOffer('taken');
  g.bribePolice();
  eq('the Fugitive rate is what it costs', c.credits, 100_000 - patrolPrice(FUGITIVE));
  check('...he breaks off', !isHostileToPlayer(cop, c.legalStatus, Infinity));
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

  nextOffer('taken');
  g.bribePolice();
  check('the nearer of the two breaks off first',
    cop.state.satisfied && !second.state.satisfied);
  check('...and the far one is still coming',
    isHostileToPlayer(second, c.legalStatus, Infinity));

  nextOffer('taken', c.disrepute ?? 0);
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
  check('...and he is still hostile', isHostileToPlayer(cop, c.legalStatus, Infinity)
    && !cop.state.satisfied);
}

console.log('\n...and the cockpit says so while the window is open');
{
  // docs/TODO/128: the offer is only a feature if a pilot knows it is there.
  // The prompt line is read straight off the Game, so this is the same list the
  // painter is handed — with the key the binding table gives it.
  const { g, fly } = smuggling(20_260_821, 3, SCAN_WARN_RANGE * 0.9);
  const c = g.state.commander;
  c.credits = 100_000;
  fly(1);
  const offered = g.keyPrompts();
  check(`the cockpit offers both answers (${offered.join(' \u00b7 ') || 'nothing'})`,
    offered.length === 2
    && offered[0].startsWith(`L PAY ${formatCredits(inspectionPrice(c.cargo))}`)
    && offered[1].startsWith('O '));
  // ...and the money is only half of what it will cost him \u2014 see
  // test/prompts.test.ts, which holds that claim against DISREPUTE_BRIBE.
  check('...and the offer names the name it will spend',
    offered[0].endsWith('AND YOUR NAME'));

  nextOffer('taken');
  g.bribePolice();
  eq('...and stops the moment there is nothing left to buy', g.keyPrompts().length, 0);
}

console.log('\na refused offer is an offence, and the scan still comes');
{
  const { g, cop, fly } = smuggling(20_260_820, 3, SCAN_WARN_RANGE * 0.9);
  const c = g.state.commander;
  c.credits = 100_000;
  fly(1);
  check('the patrol has done nothing to you yet',
    !isHostileToPlayer(cop, c.legalStatus, Infinity) && !cop.state.provokedByPlayer);

  nextOffer('refused');
  g.bribePolice();
  eq('he will not take it, and says so', g.state.session.messageText, REFUSED);
  eq('...and keeps his hands off the money', c.credits, 100_000);
  eq('...while the name pays for the asking', c.disrepute ?? 0, DISREPUTE_BRIBE);

  // The offence: you tried to buy an officer in front of him. `provokedByPlayer`
  // rather than `provoked`, so he engages under the rule that already exists.
  check('the Viper you tried to buy is now on you',
    cop.state.provokedByPlayer && isHostileToPlayer(cop, c.legalStatus, Infinity));
  check('...and he was NOT bought', !cop.state.satisfied);

  // ...and nothing was latched, so the hold is still his to read.
  check('the inspection is still ahead of you', !g.state.session.policeScanned);
  check('...and happens when he closes',
    fly(2, SCAN_RANGE * 0.5).includes(SCAN) && c.legalStatus !== CLEAN);
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
