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
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { World } from '../src/game/world.ts';
import { newCommander } from '../src/game/commander.ts';
import type { NpcRole } from '../src/game/ship-roles.ts';
import { flightPrompts, type PromptWorld } from '../src/game/prompts.ts';
import { inspectionPrice, patrolPrice } from '../src/game/law.ts';
import { formatCredits } from '../src/game/commander.ts';
import { keyIfBound } from '../src/ui/key-help.ts';
import { BINDINGS } from '../src/game/controls.ts';
import { CONTRABAND, SCAN_RANGE, SCAN_WARN_RANGE } from '../src/constants/law.ts';
import { PROMPT_LIMIT } from '../src/constants/console.ts';
import { DISREPUTE_BRIBE } from '../src/constants/character.ts';
import { DOCK_COMPUTER_RANGE } from '../src/constants/docking-computer.ts';
import { WITCHSPACE_ESCAPE_COST } from '../src/constants/jump.ts';
import { ECM_ENERGY_COST } from '../src/constants/ordnance.ts';
import { MAX_ENERGY } from '../src/constants/pools.ts';
import { seedWorld } from '../src/game/rng.ts';
import { check, dismissBriefing, eq } from './harness.ts';

const NARCOTICS = CONTRABAND[1];
const FOOD = 0;
const ORIGIN = new THREE.Vector3();

/**
 * A situation: `tonnes` of narcotics aboard and one ship of `role` `d` away.
 *
 * A real `World` and a real `NpcShip`, because `nearestEngaging` reads
 * `isHostileToPlayer`, which reads NPC state — a hand-made object would be a
 * second opinion about what a hostile ship is.
 *
 * Everything the rule can read is set to "nothing to say" here, so each block
 * below turns on exactly the one thing it is about: a full bank with no warhead
 * in it, no beacon, and a station banished the way witch-space banishes it.
 */
function situation(
  tonnes: number, d: number | null, role: NpcRole = 'police',
): PromptWorld & { world: World } {
  seedWorld(4_301);
  const world = new World();
  const commander = newCommander();
  commander.cargo = commander.cargo.map(() => 0);
  commander.cargo[NARCOTICS] = tonnes;
  if (d !== null) {
    const npc = world.spawn(role, new THREE.Vector3(0, 0, -d), 5);
    npc.object.updateMatrixWorld(true);
  }
  return {
    world,
    commander,
    playerPos: ORIGIN,
    npcs: world.npcs,
    policeScanned: false,
    witchspace: false,
    energy: MAX_ENERGY,
    missileInbound: false,
    beaconSent: false,
    stationDistance: Infinity,
    dcEngaged: false,
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
    words(w).startsWith(`PAY ${formatCredits(patrolPrice(w.commander.legalStatus))}`)
    && words(w).endsWith('TO BREAK OFF'));
  check('...which is a different price from the inspection\'s',
    patrolPrice(w.commander.legalStatus) !== inspectionPrice(w.commander.cargo));
}

console.log('\n...and every bribe names the OTHER thing it spends');
{
  // The half the console only admitted after the key was pressed. The claim is
  // read off `DISREPUTE_BRIBE`, not off the phrase: retune the deed to nothing
  // and this demands the prompt stop saying it, which is the only way a fixed
  // string could not quietly outlive the rule it describes.
  const window = words(situation(3, SCAN_WARN_RANGE * 0.9));
  const fight = situation(3, SCAN_WARN_RANGE * 0.9);
  fight.npcs[0].state.provokedByPlayer = true;

  const named = (s: string): boolean => s.includes('AND YOUR NAME');
  check(`the inspection offer says so before it is taken (${window})`,
    named(window) === (DISREPUTE_BRIBE > 0));
  check(`...and so does the one that buys a Viper off (${words(fight)})`,
    named(words(fight)) === (DISREPUTE_BRIBE > 0));
  check('...and the deed really does cost a name', DISREPUTE_BRIBE > 0);
}

console.log('\na warhead in the air outranks every other trouble');
{
  const w = { ...situation(3, SCAN_WARN_RANGE * 0.9), missileInbound: true };
  w.commander.equipment.ecm = true;
  eq('the E.C.M. is offered first, and the patrol behind it',
    commands(w).join(','), 'fireEcm,bribePolice');
  eq('...and it says what the key does', flightPrompts(w)[0].what, 'FIRE E.C.M.');

  // Both of `triggerEcm`'s own refusals, because a prompt for a key that
  // answers NO E.C.M. FITTED is worse than silence.
  const unfitted = { ...situation(3, SCAN_WARN_RANGE * 0.9), missileInbound: true };
  check('a ship without the unit is not told to press E',
    !commands(unfitted).includes('fireEcm'));
  const flat = { ...w, energy: ECM_ENERGY_COST };
  check('...nor is one whose bank cannot pay for the burst',
    !commands(flat).includes('fireEcm'));
  check('...and a clear sky offers it to nobody',
    !commands({ ...w, missileInbound: false }).includes('fireEcm'));
}

console.log('\npirates came for the cargo, and the cockpit says which key gives them some');
{
  const w = situation(0, 900, 'pirate');
  w.commander.cargo[FOOD] = 4;
  eq('a tonne over the side is the offer', commands(w).join(','), 'jettison1');
  eq('...in the key\'s own words', flightPrompts(w)[0].what, 'JETTISON A TONNE');

  const empty = situation(0, 900, 'pirate');
  eq('an empty hold has nothing to throw', commands(empty).length, 0);
  const far = situation(0, 90_000, 'pirate');
  far.commander.cargo[FOOD] = 4;
  eq('...and a pirate too far off to be in the fight asks for nothing',
    commands(far).length, 0);
}

console.log('\nstranded in witch-space, the beacon is the only way out');
{
  const stranded = (fuel: number): PromptWorld => {
    const w = { ...situation(0, null), witchspace: true };
    w.commander.fuel = fuel;
    return w;
  };
  eq('a dry tank is offered the beacon', commands(stranded(0)).join(','), 'distressBeacon');
  check('...and the line says why, not just what',
    flightPrompts(stranded(0))[0].what === 'DISTRESS BEACON — NO FUEL TO JUMP');
  eq('...and a full one is offered nothing',
    commands(stranded(WITCHSPACE_ESCAPE_COST * 4)).length, 0);
  eq('a beacon already broadcasting is not offered again',
    commands({ ...stranded(0), beaconSent: true }).length, 0);
  eq('...and being stranded is a witch-space condition only',
    commands({ ...stranded(0), witchspace: false }).length, 0);

  // The threshold itself, bisected out of the rule rather than probed at the
  // constant — this claim used to live on the world step's deleted hint
  // (test/world-step.test.ts), and it is the reason the fuel check moved here
  // whole rather than being rewritten from memory.
  let lo = 0, hi = 40;
  while (hi - lo > 1e-3) {
    const mid = (lo + hi) / 2;
    if (commands(stranded(mid)).length > 0) lo = mid; else hi = mid;
  }
  check('the tank the beacon starts being offered below is exactly what an'
    + ` escape costs (measured ${hi.toFixed(3)})`,
  Math.abs(hi - WITCHSPACE_ESCAPE_COST) < 1e-2);
}

console.log('\nthe docking computer is offered where it would take the job');
{
  const approach = (d: number): PromptWorld => {
    const w = { ...situation(0, null), stationDistance: d };
    w.commander.equipment.dockingComputer = true;
    return w;
  };
  eq('inside its own range, the aid you paid for is offered',
    commands(approach(DOCK_COMPUTER_RANGE * 0.5)).join(','), 'toggleDockingComputer');
  eq('...and beyond it, where the key would refuse, nothing is',
    commands(approach(DOCK_COMPUTER_RANGE * 1.5)).length, 0);
  eq('one already flying is not asked to engage it again',
    commands({ ...approach(DOCK_COMPUTER_RANGE * 0.5), dcEngaged: true }).length, 0);

  const unfitted = { ...situation(0, null), stationDistance: DOCK_COMPUTER_RANGE * 0.5 };
  eq('...and a ship that never bought one is never told about it',
    commands(unfitted).length, 0);
}

console.log('\nthe cockpit is never a menu');
{
  // Three true at once, and they are deliberately the three ENDS of the
  // ranking: a warhead in the air, a Viper shooting, and the docking computer
  // sitting there the whole time. The cap has to drop the leisurely one.
  const w = { ...situation(0, 800), missileInbound: true, stationDistance: 0 };
  w.commander.equipment.ecm = true;
  w.commander.equipment.dockingComputer = true;
  w.npcs[0].state.provokedByPlayer = true;

  eq(`exactly PROMPT_LIMIT (${PROMPT_LIMIT}) survive`, flightPrompts(w).length, PROMPT_LIMIT);
  eq('...and they are the two most urgent, in that order',
    commands(w).join(','), 'fireEcm,bribePolice');
  // The control: without the cap this situation really does raise three, so the
  // assertion above is measuring the cap and not the situation.
  check('...out of three the situation raises',
    commands({ ...w, missileInbound: false }).join(',') === 'bribePolice,toggleDockingComputer');
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

  // ...which is the whole of the answer to "does the exercise get prompts?".
  // It has no hold, no law and no station, so every moment but the warhead is
  // impossible there by construction — and for the four keys that could only
  // mislead, the table itself is the filter (NOT_IN_THE_SIMULATOR, controls.ts).
  for (const c of ['bribePolice', 'jettisonContraband', 'jettison1',
    'distressBeacon', 'toggleDockingComputer'] as const) {
    eq(`...and no prompt can reach the arena's ${c}`, keyIfBound('simulator', c), null);
  }
  check('the E.C.M. is the one it keeps, because a warhead is real in there',
    keyIfBound('simulator', 'fireEcm') === 'E');

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

// --- ...and flown, through the real Game -------------------------------------
//
// The pure half above builds a `PromptWorld` by hand. This is the wiring: the
// Game is the only thing that knows where the station is, what is in the
// missile list and whether a beacon is already broadcasting, and a field it
// forgot to pass would leave every assertion above passing over a cockpit that
// says nothing. The police window is flown in test/bribe-flight.test.ts, where
// the Viper that raises it already lives.

/** A commander in flight, with the fixture's own sky thrown away. */
function launched(seed: number): Game {
  const g = withoutSaving(() => {
    seedWorld(seed);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    game.launch();
    return game;
  }).value;
  for (let f = 0, at = 0; f < 400; f++) g.step(1 / 60, at += 1 / 60);
  g.state.world.clearNpcs();
  return g;
}

console.log('\nthe stranded prompt replaces the message that hard-coded B');
{
  const g = launched(20_260_830);
  // What a mis-jump really leaves you in: no scenery within reach of any
  // distance check, and not enough in the tank to jump clear of it.
  g.state.session.witchspace = true;
  g.state.world.banishScenery();
  g.state.commander.fuel = 0;

  eq('the cockpit offers the beacon, in the key the table binds',
    g.keyPrompts().join(' · '), 'B DISTRESS BEACON — NO FUEL TO JUMP');

  g.sendDistressBeacon();
  check('...and stops the moment it is broadcasting',
    g.state.session.beaconTimer > 0 && g.keyPrompts().length === 0);
}

console.log('\n...and the docking prompt is measured against the real station');
{
  const g = launched(20_260_831);
  const station = g.state.world.station.position;
  g.state.commander.equipment.dockingComputer = true;

  g.state.player.position.copy(station).add(new THREE.Vector3(0, 0, DOCK_COMPUTER_RANGE * 0.5));
  eq('within the aid\'s own range it is offered',
    g.keyPrompts().join(' · '), 'C DOCKING COMPUTER');

  g.state.player.position.copy(station).add(new THREE.Vector3(0, 0, DOCK_COMPUTER_RANGE * 1.5));
  eq('...and out beyond it, where the key would refuse, it is not',
    g.keyPrompts().length, 0);
}
