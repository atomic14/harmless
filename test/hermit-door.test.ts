// The rock hermit's door: who gets in, and what they hear if they do not.
//
// The price half of the rule is pure and lives in test/economy.test.ts with the
// rest of the market. This is the half no pure test can reach: whether the
// encounter in `world-step.ts` actually opens the market, said in the world,
// through a real `WorldStep` frame and a real hermit in the sky. It is here
// rather than in economy.test.ts because it needs a built World and three.js,
// and that file is deliberately free of both.
//
// The refusal also has to be quiet the second time. A message pushed every
// frame while the player sits parked at the tunnel mouth would be a bug the
// unit test above it could never see, so the rig steps a hundred frames and
// counts.

import * as THREE from 'three';
import { newCommander } from '../src/game/commander.ts';
import { Ordnance } from '../src/game/ordnance.ts';
import { restoreRng, rngState, seedWorld } from '../src/game/rng.ts';
import { freshState } from '../src/game/state.ts';
import { WorldStep, type StepHost } from '../src/game/world-step.ts';
import { hermitRefuses } from '../src/game/market.ts';
import { DISREPUTE_HERMIT_KILL } from '../src/constants/character.ts';
import { HERMIT_REFUSES_AT } from '../src/constants/hermit-market.ts';
import { check, eq } from './harness.ts';

console.log('\nthe rock hermit\'s door');

const borrowed = rngState();
seedWorld(20_260_810);

/**
 * A commander parked alongside a hermit, slow enough to trade, and the frames
 * that follow. `frames` is deliberately more than one: the encounter rule is
 * re-run every frame and the interesting failure is a message that repeats.
 */
const alongsideAHermit = (disrepute: number, frames = 100) => {
  const state = freshState(newCommander());
  state.world.build(state.systems[state.commander.systemIndex]);
  state.commander.disrepute = disrepute;

  let opened = 0;
  const host: StepHost = {
    inFlight: () => true,
    applyPlayerDamage: () => {}, destroyNpc: () => {}, wreckNpc: () => {},
    fireLaser: () => {}, raiseLegal: () => {}, die: () => {},
    dock: () => {}, completeHyperspace: () => {}, completeRescue: () => {},
    openHermitTrade: () => { opened += 1; }, autoSave: () => {},
  };
  const step = new WorldStep(state, new Ordnance(state.world), host);

  // Out at the witchpoint, clear of the planet, the sun and the station, so
  // the frame is about the hermit and nothing else.
  state.player.position.copy(state.world.station.position).normalize()
    .multiplyScalar(state.world.planetRadius * 16);
  state.player.speed = 0;
  // ...with the hermit 200 units off the nose: inside the 320 the rule wants,
  // outside anything that would count as a collision.
  state.world.spawn('hermit', state.player.position.clone()
    .add(new THREE.Vector3(0, 0, 200)), 1);

  const said: string[] = [];
  for (let i = 0; i < frames; i += 1) {
    for (const e of step.step(1 / 60, 1,
      { demand: { rollRate: 0, pitchRate: 0, throttle: 0, fire: false }, handsOn: false })) {
      if (e.kind === 'message') said.push(e.text);
    }
  }
  return { opened, said, state };
};

// --- an honest pilot is let in ----------------------------------------------
{
  const honest = alongsideAHermit(0);
  check(`an honest pilot gets the market (${honest.opened} opens)`, honest.opened > 0);
  check('...and is never told otherwise',
    !honest.said.some((t) => t.includes('WE KNOW WHAT YOU DID')));
}

// --- a hermit-killer is not ---------------------------------------------------
//
// One cracked rock is the case that matters: `DISREPUTE_HERMIT_KILL` clears
// `HERMIT_REFUSES_AT` on its own, so the deed and its punishment are tied
// together by the two constants rather than by a number typed here.
{
  check('one hermit kill is on its own enough to close the door',
    hermitRefuses(DISREPUTE_HERMIT_KILL) && DISREPUTE_HERMIT_KILL >= HERMIT_REFUSES_AT);

  const killer = alongsideAHermit(DISREPUTE_HERMIT_KILL);
  eq('a hermit-killer gets no market at all', killer.opened, 0);
  const refusals = killer.said.filter((t) => t.includes('WE KNOW WHAT YOU DID'));
  eq('...and is told why exactly once, however long they sit there', refusals.length, 1);
  // The beacon still calls you in — that is the beat: you are hailed, you close,
  // and the door shuts. What must not happen is being called in over and over.
  eq('...and the approach hail is heard once, not every frame',
    killer.said.filter((t) => t.includes('SLOW TO 20')).length, 1);
  check('...the cooldown is what silences it, as leaving the market does',
    killer.state.session.hermitCooldown);
}

restoreRng(borrowed);
