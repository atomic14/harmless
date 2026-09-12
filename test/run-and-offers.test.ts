// The ways out of a fight (docs/TODO/206 M5).
//
// Chris's words of 2026-09-11: a fight can be left. The run, the bribe and
// the cargo dump are all options. The run is a course. The bribe and the dump
// were offers on a line of text, and they are buttons now, with the key named
// under the words for a pilot at a keyboard.

import * as THREE from 'three';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { COURSE_KEYS } from '../src/game/bindings.ts';
import { MASS_LOCK_SHIP } from '../src/constants/torus.ts';
import { check, dismissBriefing, eq } from './harness.ts';

console.log('\nthe ways out of a fight');

/** A wanted commander in open space, with a police Viper behind the ship. */
function chased(seed: number): { g: Game; viper: ReturnType<Game['state']['world']['spawn']> } {
  const g = withoutSaving(() => {
    seedWorld(seed);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    game.launch();
    return game;
  }).value;
  withoutSaving(() => { for (let f = 0, at = 0; f < 400; f++) g.step(1 / 60, at += 1 / 60); });
  g.state.world.clearNpcs();
  g.state.player.position.add(new THREE.Vector3(0, 60_000, 0));
  g.state.commander.legalStatus = 2;   // a fugitive: the police attack
  const behind = new THREE.Vector3(0, 0, 2500).applyQuaternion(g.state.player.quaternion);
  const viper = g.state.world.spawn('police', g.state.player.position.clone().add(behind), 1);
  return { g, viper };
}

function press(g: Game, code: string): void {
  g.input.injectPress(code);
  withoutSaving(() => g.step(1 / 60, 30));
}

{
  const { g, viper } = chased(20_260_930);
  withoutSaving(() => g.step(1 / 60, 29));
  const labels = g.hudButtons().courses.map((b) => b.label);
  check('with a hostile ship on the scanner, the list offers a run', labels[0]?.startsWith('RUN FOR IT'),
    labels.join(' | '));
  eq('...and says the ship outruns a police Viper', labels[0], 'RUN FOR IT — YOU ARE FASTER');

  press(g, COURSE_KEYS.run);
  eq('the run button sets the ship running', g.state.session.course, 'run');
  check('...and the computer does not turn to fight', !g.state.session.ccEngaged);
  let torus = false;
  let widest = 0;
  withoutSaving(() => {
    for (let f = 0; f < 60 * 90 && g.state.session.course === 'run'; f++) {
      g.step(1 / 60, 31 + f / 60);
      if (g.state.session.torusEngaged) torus = true;
      widest = Math.max(widest, g.state.player.position.distanceTo(viper.object.position));
    }
  });
  check('the range opens past the mass lock', widest > MASS_LOCK_SHIP, `${Math.round(widest)} units`);
  check('...where the torus drive takes the ship away', torus);
  eq('...and the run ends once no hostile ship is on the scanner', g.state.session.course, null);
  eq('...and the console says so', g.state.session.messageText, 'YOU GOT AWAY');
}

{
  const { g } = chased(20_260_931);
  g.state.session.handFlown = true;   // no aim, so the Viper closes as it likes
  withoutSaving(() => { for (let f = 0; f < 240; f++) g.step(1 / 60, 29 + f / 60); });
  const offer = g.hudButtons().courses.find((b) => b.label.startsWith('PAY'));
  check('a police ship with its guns up raises the bribe, as a button', offer !== undefined,
    g.hudButtons().courses.map((b) => b.label).join(' | '));
  eq('...that sends the bribe\'s own key', offer?.code, 'KeyL');
  eq('...and names that key under the words', offer?.hint, 'OR PRESS L');
  // Every offer moves the commander's name, whether the policeman takes the
  // money or turns it down (law.ts). So that is what proves the offer.
  g.state.commander.credits = 1_000_000;
  const before = g.state.commander.disrepute ?? 0;
  press(g, offer!.code);
  check('...and a press makes the offer', (g.state.commander.disrepute ?? 0) > before,
    `said: ${g.state.session.messageText}`);
}
