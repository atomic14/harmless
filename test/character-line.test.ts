// Your name changing, flown: the console actually says it, and says it behind
// the deed that caused it (docs/TODO/129).
//
// `test/character.test.ts` owns the arithmetic — which moves are crossings and
// what each one is called. This is the half that needs a real Game, because the
// defect being fixed was never in the rule: disrepute moved correctly and
// invisibly, and "invisibly" is only observable through the console a player
// reads. So every check here reads `session.messageText` as it changes, frame
// by frame, exactly as a pilot would.
//
// One deed per family, and the control that stops the whole thing being a
// machine that says CHARACTER at every opportunity.

import * as THREE from 'three';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { random, seedWorld } from '../src/game/rng.ts';
import { refusalChance } from '../src/game/law.ts';
import { characterName } from '../src/game/character.ts';
import { distanceTenths, daysForJump } from '../src/galaxy/navigation.ts';
import {
  CHARACTER, CHARACTER_LINE_SECONDS, DISREPUTE_BRIBE, DISREPUTE_MURDER,
} from '../src/constants/character.ts';
import { FUGITIVE } from '../src/constants/law.ts';
import { check, consoleWatcher, dismissBriefing, eq } from './harness.ts';

/**
 * A commander in flight with an empty sky, and a way to watch the console.
 *
 * The watcher is `consoleWatcher` (harness.ts), shared with
 * test/record-line.test.ts: both files are about the ORDER lines reach a pilot
 * in, so both have to agree on what "a pilot saw this" means.
 */
function flying(seed: number): { g: Game; fly: (steps: number) => string[] } {
  const g = withoutSaving(() => {
    seedWorld(seed);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    game.launch();
    return game;
  }).value;
  const fly = consoleWatcher(g);
  fly(400);                                  // past the launch tunnel
  // An empty sky and a ship at rest: a fight in the same seconds as the deed
  // would put its own lines on the console and make the ORDER ambiguous, which
  // is the one thing every block below is about.
  g.state.world.clearNpcs();
  g.state.player.speed = 0;
  return { g, fly };
}

/** Seconds of frames — long enough for a queued line to reach the console. */
const SETTLE = Math.ceil((CHARACTER_LINE_SECONDS + 6) * 60);

/** The first CHARACTER line in a run of console lines, and where it fell. */
const named = (said: string[]): { line: string | undefined; at: number } => {
  const at = said.findIndex((t) => t.startsWith('CHARACTER:'));
  return { line: said[at], at };
};

/**
 * Set the stream so the next draw decides an offer this way — bribe-flight's
 * rule, for the same reason: the refusal roll is real and comes off the seeded
 * stream (invariant 11), so a test about a MESSAGE must not also be a test
 * about luck.
 */
function nextOffer(want: 'taken' | 'refused', disrepute = 0): void {
  const chance = refusalChance(disrepute);
  for (let seed = 1; seed < 10_000; seed++) {
    seedWorld(seed);
    if ((random() < chance) === (want === 'refused')) { seedWorld(seed); return; }
  }
  throw new Error(`no seed makes an offer ${want} at disrepute ${disrepute}`);
}

/** A Viper on you, which is the half of the bribe key that needs no contraband. */
function provokedCop(g: Game) {
  const cop = g.spawnNpc('police',
    g.state.player.position.clone().add(new THREE.Vector3(0, 0, -800)), 5);
  cop.object.updateMatrixWorld(true);
  cop.state.provokedByPlayer = true;
  return cop;
}

console.log('\nthe console says when a bribe changes your name');
{
  const { g, fly } = flying(20_290_810);
  const c = g.state.commander;
  c.credits = 100_000;
  provokedCop(g);

  nextOffer('taken');
  g.bribePolice();
  const said = fly(SETTLE);
  const rung = characterName(c.disrepute ?? 0);
  eq('one bribe takes an Honest commander off Honest', rung, 'Dubious');

  const bribe = said.findIndex((t) => t.startsWith('PATROL BREAKS OFF'));
  const { line, at } = named(said);
  check(`the bribe is on the console (${said[bribe] ?? 'nothing'})`, bribe >= 0);
  eq(`...and the name it cost follows it (${said.join(' / ')})`, line, 'CHARACTER: DUBIOUS');
  check('...AFTER it, not instead of it', at > bribe);
  check('...and it is said once, not on a timer that re-arms',
    fly(SETTLE * 2).filter((t) => t.startsWith('CHARACTER:')).length === 0);
}

console.log('...and when a REFUSED one does');
{
  // The case that reads like a bug if you have not read docs/TODO/123: the deed
  // is the ASKING, so the name is marked on a frame where no money moved.
  const { g, fly } = flying(20_290_811);
  const c = g.state.commander;
  c.credits = 100_000;
  provokedCop(g);

  nextOffer('refused');
  g.bribePolice();
  const said = fly(SETTLE);
  eq('not a tenth was spent', c.credits, 100_000);
  eq('...but the name was', c.disrepute ?? 0, DISREPUTE_BRIBE);

  const refused = said.indexOf('THE OFFER IS REFUSED — AND REPORTED');
  const { line, at } = named(said);
  check(`the refusal is on the console (${said.join(' / ')})`, refused >= 0);
  eq('...and the name it cost follows it', line, 'CHARACTER: DUBIOUS');
  check('...AFTER it', at > refused);
}

console.log('...and a deed that crosses nothing says nothing');
{
  // THE CONTROL. A second bribe moves the score by exactly as much as the first
  // and crosses no rung, so the console must be silent about it — counted in
  // lines, not read off the score, because the score is not the claim.
  const { g, fly } = flying(20_290_812);
  const c = g.state.commander;
  c.credits = 100_000;
  c.disrepute = DISREPUTE_BRIBE;             // already Dubious, from an earlier one
  provokedCop(g);

  nextOffer('taken', c.disrepute);
  g.bribePolice();
  const said = fly(SETTLE);
  check(`the score really did move (${c.disrepute})`,
    (c.disrepute ?? 0) === DISREPUTE_BRIBE * 2);
  eq('...and it is still the same rung', characterName(c.disrepute ?? 0), 'Dubious');
  check(`...so the console said nothing about it (${said.join(' / ')})`,
    said.every((t) => !t.startsWith('CHARACTER:')));
}

console.log('\na kill names the rung it landed on, not each one it passed');
{
  const { g, fly } = flying(20_290_813);
  const c = g.state.commander;
  const trader = g.spawnNpc('trader',
    g.state.player.position.clone().add(new THREE.Vector3(0, 0, -1200)), 7);
  trader.object.updateMatrixWorld(true);

  g.destroyNpc(trader);
  const said = fly(SETTLE);
  const rung = characterName(c.disrepute ?? 0);
  check(`murder is worth two rungs at once (${DISREPUTE_MURDER} → ${rung})`, rung === 'Dodgy');

  const { line } = named(said);
  eq(`the console names where you ARE (${said.join(' / ')})`, line, 'CHARACTER: DODGY');
  check('...and never names the rung it passed through',
    !said.includes('CHARACTER: DUBIOUS'));
  // ...and it did not take the console away from the kill's own lines. Which of
  // those a player reads was NOT this plan's business and is docs/TODO/130's:
  // `raiseLegal`'s line was itself overwritten by STATION DEFENCE LAUNCHED in
  // the same frame, the same defect one rung up, and test/record-line.test.ts
  // is the file that holds the order those two arrive in. The claim here stays
  // what it always was — the name waited its turn.
  eq('the kill made you a Fugitive', c.legalStatus, FUGITIVE);
  check(`...and something else had the console first (${said[0]})`,
    named(said).at > 0);
}

console.log('\nand the good news half: a name fading says so too');
{
  const { g, fly } = flying(20_290_814);
  const c = g.state.commander;
  const { systems } = g.state;
  const here = c.systemIndex;
  // The cheapest neighbour inside the tank, off the metric rather than written
  // down, so a regenerated galaxy does not decide whether this test runs.
  let target = -1;
  for (let i = 0; i < systems.length; i++) {
    if (i === here) continue;
    const cost = distanceTenths(systems[here], systems[i]);
    if (cost <= c.fuel && (target < 0 || cost < distanceTenths(systems[here], systems[target]))) {
      target = i;
    }
  }
  check('there is a jump the rules allow', target >= 0);
  const days = daysForJump(distanceTenths(systems[here], systems[target]));

  // Just inside Dodgy, by less than the trip forgets: the decay is the only
  // thing that moves the score here, and it moves it DOWN through a threshold.
  const DODGY = CHARACTER.find(([, n]) => n === 'Dodgy')![0];
  c.disrepute = DODGY + 0.5;
  eq('the pilot leaves as a Dodgy character', characterName(c.disrepute), 'Dodgy');

  g.state.chart.targetIndex = target;
  g.startHyperspace();
  const said = fly(Math.ceil(12 * 60) + SETTLE);
  check(`the jump took ${days} days off a name worth ${DODGY + 0.5}`,
    (c.disrepute ?? 0) < DODGY);
  const { line, at } = named(said);
  eq(`the console says the name it fell back to (${said.join(' / ')})`,
    line, 'CHARACTER: DUBIOUS');
  check('...behind the arrival that caused it',
    at > said.findIndex((t) => t.startsWith('ARRIVED:')));
}
