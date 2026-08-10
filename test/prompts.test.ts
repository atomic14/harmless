// What the cockpit offers to do about what is happening.
//
// docs/TODO/128. Two claims, and the second is the one that rots if nobody
// holds it:
//
//   1. the right prompt is raised by the right situation, priced honestly, and
//      goes quiet the moment the situation does;
//   2. **the key in front of it comes from the binding table.** Rebind the
//      command and the prompt rewrites itself. A letter written into the words
//      would be a sixth help surface free to lie, which is the defect this
//      feature was built alongside — `PRESS B FOR THE DISTRESS BEACON` had a
//      hard-coded B in it.
//
// The rule is pure, so most of this needs no world: a hold, a record, and a sky
// with one ship in it. The join to the real Game is asserted at the end,
// through the same `keyIfBound` the cockpit spends.

import * as THREE from 'three';
import { World } from '../src/game/world.ts';
import { newCommander } from '../src/game/commander.ts';
import { flightPrompts, type PromptWorld } from '../src/game/prompts.ts';
import { inspectionPrice, patrolPrice } from '../src/game/law.ts';
import { formatCredits } from '../src/game/commander.ts';
import { keyIfBound } from '../src/ui/key-help.ts';
import { BINDINGS } from '../src/game/controls.ts';
import { CONTRABAND, SCAN_RANGE, SCAN_WARN_RANGE } from '../src/constants/law.ts';
import { PROMPT_LIMIT } from '../src/constants/console.ts';
import { seedWorld } from '../src/game/rng.ts';
import { check, eq } from './harness.ts';

const NARCOTICS = CONTRABAND[1];
const ORIGIN = new THREE.Vector3();

/**
 * A situation: `tonnes` of narcotics aboard and one police ship `d` away.
 *
 * A real `World` and a real `NpcShip`, because `nearestEngaging` reads
 * `isHostileToPlayer`, which reads NPC state — a hand-made object would be a
 * second opinion about what a hostile ship is.
 */
function situation(tonnes: number, d: number | null): PromptWorld & { world: World } {
  seedWorld(4_301);
  const world = new World();
  const commander = newCommander();
  commander.cargo = commander.cargo.map(() => 0);
  commander.cargo[NARCOTICS] = tonnes;
  if (d !== null) {
    const cop = world.spawn('police', new THREE.Vector3(0, 0, -d), 5);
    cop.object.updateMatrixWorld(true);
  }
  return {
    world,
    commander,
    playerPos: ORIGIN,
    npcs: world.npcs,
    policeScanned: false,
    witchspace: false,
  };
}

const commands = (w: PromptWorld): string[] => flightPrompts(w).map((p) => p.command);
const words = (w: PromptWorld): string => flightPrompts(w).map((p) => p.what).join(' | ');

console.log('\nthe patrol closing on a dirty hold is offered two answers');
{
  const w = situation(3, SCAN_WARN_RANGE * 0.9);
  eq('both keys are offered, the money first',
    commands(w).join(','), 'bribePolice,jettisonContraband');
  check(`...and the bribe carries what it will actually cost (${words(w)})`,
    words(w).startsWith(`PAY ${formatCredits(inspectionPrice(w.commander.cargo))}`));
  // The price is the rule's, not a copy: a fatter hold is a dearer prompt.
  const rich = situation(9, SCAN_WARN_RANGE * 0.9);
  check('...and it moves with the hold, because it IS inspectionPrice',
    words(rich) !== words(w)
    && words(rich).includes(formatCredits(inspectionPrice(rich.commander.cargo))));
}

console.log('...and nothing at all when there is nothing to answer');
{
  eq('a clean hold is offered nothing', commands(situation(0, SCAN_WARN_RANGE * 0.9)).length, 0);
  eq('...nor is a dirty one with the law out of reach',
    commands(situation(3, SCAN_WARN_RANGE * 1.5)).length, 0);
  eq('...nor with no law in the sky at all', commands(situation(3, null)).length, 0);

  // THE ONE THAT MATTERS: once he has read your hold there is nothing left to
  // buy, and a prompt still offering it would be an instruction to waste money.
  const scanned = { ...situation(3, SCAN_RANGE * 0.5), policeScanned: true };
  eq('a hold already read is offered nothing', commands(scanned).length, 0);
  // ...and in witch-space there is no law to pay.
  const away = { ...situation(3, SCAN_WARN_RANGE * 0.9), witchspace: true };
  eq('witch-space is offered nothing', commands(away).length, 0);
}

console.log('\na Viper already shooting outranks one that is only close');
{
  const w = situation(3, SCAN_WARN_RANGE * 0.9);
  w.npcs[0].state.provokedByPlayer = true;
  w.npcs[0].object.position.set(0, 0, -800);
  w.npcs[0].object.updateMatrixWorld(true);

  eq('the fight is the only offer', commands(w).join(','), 'bribePolice');
  check(`...priced off the rung you are on (${words(w)})`,
    words(w) === `PAY ${formatCredits(patrolPrice(w.commander.legalStatus))} TO BREAK OFF`);
  check('...which is a different price from the inspection\'s',
    patrolPrice(w.commander.legalStatus) !== inspectionPrice(w.commander.cargo));
}

console.log('\nthe cockpit is never a menu');
{
  const w = situation(3, SCAN_WARN_RANGE * 0.9);
  check(`never more than PROMPT_LIMIT (${PROMPT_LIMIT}) at once`,
    flightPrompts(w).length <= PROMPT_LIMIT);
  // The control: the cap is doing nothing yet, because the most any situation
  // raises today is exactly two. This says so out loud, so the day a third is
  // added the assertion above starts meaning something.
  eq('...and today the busiest situation raises exactly two', flightPrompts(w).length, 2);
}

console.log('\nthe key in front of a prompt comes from the binding table');
{
  const w = situation(3, SCAN_WARN_RANGE * 0.9);
  const rendered = flightPrompts(w)
    .map((p) => `${keyIfBound('flight', p.command)} ${p.what}`);
  check(`the cockpit reads "${rendered.join(' · ')}"`,
    rendered[0].startsWith('L ') && rendered[1].startsWith('O '));

  // ...and it is a LOOKUP, not a coincidence: the same command asked for in a
  // table that does not bind it answers null, which is how the arena gets no
  // prompt for a key it does not have.
  eq('the arena does not bind the bribe', keyIfBound('simulator', 'bribePolice'), null);
  check('...and the cockpit does', keyIfBound('flight', 'bribePolice') === 'L');

  // THE REAL CLAIM, and the reason none of the words above contain a letter:
  // move the binding and the prompt moves with it. `BINDINGS` is the table the
  // game reads every frame, so this is the shipped path with one entry swapped.
  const table = BINDINGS.flight as { key: string; command: string }[];
  const entry = table.find((b) => b.command === 'bribePolice')!;
  const was = entry.key;
  entry.key = 'KeyZ';
  try {
    eq('rebinding the command rewrites the prompt',
      `${keyIfBound('flight', 'bribePolice')} ${flightPrompts(w)[0].what}`,
      `Z ${flightPrompts(w)[0].what}`);
  } finally {
    entry.key = was;
  }
  eq('...and the table is put back', keyIfBound('flight', 'bribePolice'), 'L');
}
