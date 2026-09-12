// Does the co-pilot's aim hold up in a REAL fight? — the third measure.
//
//   npm run combat-aim
//
// The review of 2026-09-12 (`docs/COMBAT-COMPUTER-REVIEW.md`) measured the
// co-pilot against PRESCRIBED target paths. That probe is exact and repeatable,
// and it carries no shots, no damage, and no opponent that fights back. Its own
// closing words ask for actual NPC fights before release. This is that check.
//
// It runs the combat exercise (`game/combat-sim.ts`), which is the live game
// with a different step behind it: real pirate brains, real guns, the real
// seeded stream. The commander is fitted with a combat computer, because that
// is what pulls the trigger, so the aim becomes shots.
//
// WHAT IT MEASURES, per fight:
//
//   - the share of engaged frames with a live hostile inside `hitCone` and
//     `LASER_RANGE`, which is the same question the prescribed probe asks;
//   - how long the fight took, and how many hostiles died.
//
// TIME TO CLEAR IS NOISY, and the share on the gun is not. A sweep of
// `COMBAT_ROLL_GATE` over 72 fights moved the share from 39.5% to about 58%,
// and moved the seconds around with no trend. Read the share.
//
// It is not a balance test. Nothing here says whether a fight is fun.
import * as THREE from 'three';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { dismissBriefing } from '../test/harness.ts';
import { hitCone } from '../src/game/gunnery.ts';
import { LASER_RANGE } from '../src/constants/player-gun.ts';
import type { ExerciseSpec, ScenarioId } from '../src/game/combat-sim-scenarios.ts';

const DT = 1 / 60;
const nose = new THREE.Vector3();
const to = new THREE.Vector3();

const fight = (scenario: ScenarioId, tier: number, seed: number) => {
  const g = withoutSaving(() => {
    seedWorld(seed);
    const game = new Game(() => headlessShell());
    dismissBriefing(game);
    return game;
  }).value;
  const spec: ExerciseSpec = { mode: 'scenario', scenario, tier, seed };
  if (!g.startExercise(spec, { equipment: { combatComputer: true } })) return null;
  const s = g.state;
  const start = s.world.npcs.filter((n) => n.state.alive).length;
  let frames = 0; let onGun = 0; let engaged = 0;
  withoutSaving(() => {
    let t = 0;
    for (let i = 0; i < 200 / DT; i++) {
      g.step(DT, t); t += DT; frames++;
      s.world.scene.updateMatrixWorld(true);
      if (g.coursePanel() !== null) break;   // the exercise ended
      const live = s.world.npcs.filter((n) => n.state.alive);
      if (live.length === 0) continue;
      engaged++;
      s.player.getForward(nose);
      // the easiest live hostile: the one nearest the nose, which is what the
      // gun would take
      let best = Infinity; let bestCone = 0; let bestDist = 0;
      for (const n of live) {
        to.copy(n.object.position).sub(s.player.position);
        const a = nose.angleTo(to);
        if (a < best) { best = a; bestCone = hitCone(n.radius, to.length()); bestDist = to.length(); }
      }
      if (best < bestCone && bestDist <= LASER_RANGE) onGun++;
    }
  });
  const left = s.world.npcs.filter((n) => n.state.alive).length;
  return { seconds: +(frames * DT).toFixed(1), killed: start - left, left,
    onGun: engaged ? +(100 * onGun / engaged).toFixed(1) : 0 };
};

let secs = 0; let killed = 0; let left = 0; let onGunSum = 0; let n = 0;
for (const scenario of ['single-pirate', 'pirate-pair', 'pirate-gang'] as ScenarioId[]) {
  for (const tier of [1, 3, 5]) {
    for (const seed of [4242, 777, 20260912, 31337, 99, 555, 12345, 6006]) {
      const r = fight(scenario, tier, seed);
      if (!r) continue;
      n++; secs += r.seconds; killed += r.killed; left += r.left; onGunSum += r.onGun;
    }
  }
}
// `left` is how many hostiles outlived the fight. Zero across the grid means
// the co-pilot cleared every one of them.
console.log(JSON.stringify({ fights: n, meanSeconds: +(secs / n).toFixed(1),
  killed, left, meanOnGun: +(onGunSum / n).toFixed(1) }));
