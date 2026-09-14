// TRACKING: does the co-pilot's nose stay on a target that moves?
//
// Split from `scripted-co-pilot.test.ts` on 2026-09-12, when that file passed
// the 400-line ceiling. It is a different question from the one next door.
// That file pins the co-pilot's CONTRACT: what it engages, when it asks for the
// trigger, when it answers a warhead, and when it hands back. This one flies
// the controller against prescribed target paths and measures the GEOMETRY.
//
// The review of 2026-09-12 is the reason it exists in this shape
// (`docs/COMBAT-COMPUTER-REVIEW.md`). Its own probe is the model for the four
// measures, and `npm run combat-aim` is the third check, in real fights.

import * as THREE from 'three';
import { ScriptedCoPilot } from '../src/game/scripted-co-pilot.ts';
import { hitCone } from '../src/game/gunnery.ts';
import { LASER_RANGE } from '../src/constants/player-gun.ts';
import { freshState } from '../src/game/state.ts';
import { newCommander } from '../src/game/commander.ts';
import { seedWorld } from '../src/game/rng.ts';
import { check } from './harness.ts';

// --- TRACKING: DOES THE NOSE STAY ON A TARGET THAT MOVES? ------------------
//
// This replaces two weaker tests, on the review of 2026-09-12
// (`docs/COMBAT-COMPUTER-REVIEW.md`). One accepted 20% of frames inside the gun
// cone and passed at 29%. The other measured a fixed 0.1 rad rather than the
// real cone, ran 20 seconds, and flew a target sideways while its nose pointed
// somewhere else. The co-pilot reads that nose for the target's velocity, so
// the fixture asked for a lead it then called wrong.
//
// The rules this fixture keeps:
//
//   - Position, orientation and speed all come from ONE path. A fixture that
//     disagrees with itself measures nothing.
//   - The gun cone is `hitCone`, the gun's own. A fixed angle is not the test
//     the trigger applies.
//   - Four numbers, not one. A high average hides a target lost for 40 seconds,
//     so the longest gap is its own limit. Acquisition and roll travel are the
//     two costs a tracking gain can be paid for with.
//   - Horizontal, vertical and tilted paths. A vertical orbit needs pitch
//     alone and always tracked well. The coupled axes are where it broke.
console.log('\nthe co-pilot tracks a target that moves');
{
  const DT = 1 / 60;
  const UP = new THREE.Vector3(0, 1, 0);

  interface Track {
    onGun: number; firstLock: number | null; longestGap: number; rollTurns: number;
  }
  /**
   * Fly `path` for `seconds` and report the four measures.
   *
   * @param path writes the target's position and velocity at time t.
   */
  const track = (path: (t: number, pos: THREE.Vector3, vel: THREE.Vector3) => void,
    seconds: number): Track => {
    seedWorld(4245);
    const st = freshState(newCommander());
    st.world.build(st.systems[st.commander.systemIndex]);
    st.world.clearNpcs();
    st.player.position.set(0, 0, 0);
    st.player.quaternion.identity();
    st.player.speed = 200;
    const pirate = st.world.spawn('pirate', new THREE.Vector3(0, 0, -1000), 1);
    const cp = new ScriptedCoPilot();
    const pos = new THREE.Vector3();
    const vel = new THREE.Vector3();
    const look = new THREE.Matrix4();
    const ahead = new THREE.Vector3();
    const nose = new THREE.Vector3();
    const to = new THREE.Vector3();
    let onGun = 0; let late = 0; let rollTravel = 0;
    let firstLock: number | null = null;
    let gap = 0; let longestGap = 0;
    for (let i = 0; i < seconds / DT; i++) {
      const t = i * DT;
      path(t, pos, vel);
      pirate.object.position.copy(pos);
      pirate.state.speed = vel.length();
      // ONE path: the nose points along the velocity the same path gives, which
      // is what `velocityOf` reads back out of it.
      if (pirate.state.speed > 1e-6) {
        look.lookAt(pos, ahead.copy(pos).add(vel), UP);
        pirate.object.quaternion.setFromRotationMatrix(look);
      }
      const step = cp.step(DT, st.player, st.world.npcs, st.commander.legalStatus,
        false, null, Infinity, pirate);
      if (step.kind !== 'fly') throw new Error('should be flying a live threat');
      st.player.update(DT, step.demand);
      rollTravel += Math.abs(step.demand.rollRate) * DT;

      nose.set(0, 0, -1).applyQuaternion(st.player.quaternion);
      to.copy(pirate.object.position).sub(st.player.position);
      const lock = nose.angleTo(to) < hitCone(pirate.radius, to.length())
        && to.length() <= LASER_RANGE;
      if (lock && firstLock === null) firstLock = t;
      // the gap, and the window, both skip the first ten seconds of the swing on
      if (t >= 10) {
        late += 1;
        if (lock) { onGun += 1; gap = 0; } else { gap += DT; longestGap = Math.max(longestGap, gap); }
      }
    }
    return {
      onGun: onGun / late,
      firstLock,
      longestGap,
      rollTurns: rollTravel / (2 * Math.PI) / (seconds / 60),
    };
  };

  /** An orbit of a fixed centre, in one of the three planes. */
  const orbit = (radius: number, speed: number, plane: 'horizontal' | 'vertical' | 'tilted') =>
    (t: number, pos: THREE.Vector3, vel: THREE.Vector3): void => {
      const a = (speed / radius) * t;
      const x = Math.cos(a) * radius; const y = Math.sin(a) * radius;
      const vx = -Math.sin(a) * speed; const vy = Math.cos(a) * speed;
      if (plane === 'horizontal') { pos.set(x, 0, y); vel.set(vx, 0, vy); return; }
      if (plane === 'vertical') { pos.set(0, x, y); vel.set(0, vx, vy); return; }
      pos.set(x, y / Math.SQRT2, y / Math.SQRT2);
      vel.set(vx, vy / Math.SQRT2, vy / Math.SQRT2);
    };

  // The limits are per case, and each one has room under the measured figure.
  // The UNGATED controller is in the last column, so no limit here is vacuous:
  // it fails every coupled case. See `COMBAT_ROLL_GATE`.
  const CASES: {
    name: string; seconds: number; minOnGun: number; maxLock: number;
    maxGap: number; maxTurns: number;
    path: (t: number, p: THREE.Vector3, v: THREE.Vector3) => void;
  }[] = [
    { name: 'a horizontal orbit, 400 units at 300', seconds: 60, minOnGun: 0.80,
      maxLock: 5, maxGap: 3, maxTurns: 6, path: orbit(400, 300, 'horizontal') },
    { name: 'a vertical orbit, 400 units at 300', seconds: 60, minOnGun: 0.95,
      maxLock: 5, maxGap: 1, maxTurns: 1, path: orbit(400, 300, 'vertical') },
    { name: 'a tilted orbit, 800 units at 300', seconds: 60, minOnGun: 0.90,
      maxLock: 5, maxGap: 2, maxTurns: 3, path: orbit(800, 300, 'tilted') },
    { name: 'a target crossing the front at 150', seconds: 60, minOnGun: 0.60,
      maxLock: 5, maxGap: 12, maxTurns: 3,
      path: (t, p, v) => { p.set(-900 + 150 * t, 0, -700); v.set(150, 0, 0); } },
    { name: 'a target weaving away', seconds: 60, minOnGun: 0.90,
      maxLock: 5, maxGap: 2, maxTurns: 3,
      path: (t, p, v) => {
        p.set(350 * Math.sin(0.8 * t), 0, -1200 - 180 * t);
        v.set(280 * Math.cos(0.8 * t), 0, -180);
      } },
    { name: 'a target running straight away', seconds: 60, minOnGun: 0.99,
      maxLock: 1, maxGap: 0.5, maxTurns: 0.5,
      path: (t, p, v) => { p.set(0, 0, -1800 - 280 * t); v.set(0, 0, -280); } },
  ];

  for (const c of CASES) {
    const r = track(c.path, c.seconds);
    const said = `${(r.onGun * 100).toFixed(0)}% on the gun, `
      + `lock ${r.firstLock === null ? 'never' : r.firstLock.toFixed(2) + 's'}, `
      + `worst gap ${r.longestGap.toFixed(2)}s, ${r.rollTurns.toFixed(1)} turns a minute`;
    check(`it tracks ${c.name} (${said})`,
      r.onGun >= c.minOnGun
      && r.firstLock !== null && r.firstLock <= c.maxLock
      && r.longestGap <= c.maxGap
      && r.rollTurns <= c.maxTurns, said);
  }
}
