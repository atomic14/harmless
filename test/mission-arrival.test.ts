// What the console says about a mission on arrival (docs/TODO/203 M4).
//
// The machine says what a leg is for. This says where the target is, in the
// ship's own words, and how far a job at another world is. Every line is a
// full sentence, because that is what Chris asked for on 2026-09-10.

import * as THREE from 'three';
import { arrivalLines, bearingWords, roundDistance } from '../src/game/mission-arrival.ts';
import { emptyMissionState } from '../src/missions/state.ts';
import { SIDE_RECOVER, SIDE_SCAN, SIDE_DELIVER, SIDE_AMBUSH } from '../src/missions/skeletons/side.ts';
import { g1 } from './fixtures.ts';
import { check, eq } from './harness.ts';

console.log('\nthe arrival says where the target is, in words');
{
  eq('ahead is ahead', bearingWords({ x: 0, y: 0, z: -1000 }), 'AHEAD');
  eq('behind and to port', bearingWords({ x: -800, y: 0, z: 600 }), 'TO PORT AND BEHIND');
  eq('a small sideways offset is not worth a word', bearingWords({ x: 100, y: 0, z: -1000 }), 'AHEAD');
  eq('above and to starboard', bearingWords({ x: 700, y: 900, z: -100 }), 'ABOVE AND TO STARBOARD');
  eq('a distance rounds to the hundred, with a thousands separator', roundDistance(3_249), '3,200');
  eq('...and never reads as nothing', roundDistance(20), '100');
}

console.log('\n...for every kind of leg, and for a job at another world');
{
  const here = 7;
  const there = g1.findIndex((s, i) => i !== here && Math.hypot(s.x - g1[here].x, s.y - g1[here].y) < 30);
  const nose = new THREE.Quaternion();   // -z ahead, x right, y up
  const at = new THREE.Vector3(0, 0, 0);
  const st = {
    ...emptyMissionState(),
    live: [
      { skeleton: SIDE_RECOVER.id, leg: 'find', target: here, tag: 'find#1', progress: 0, deadlineDay: null },
      { skeleton: SIDE_SCAN.id, leg: 'watch', target: here, tag: 'watch#1', progress: 0, deadlineDay: null },
      { skeleton: SIDE_DELIVER.id, leg: 'run', target: here, tag: null, progress: 0, deadlineDay: null },
      { skeleton: SIDE_AMBUSH.id, leg: 'lane', target: there, tag: null, progress: 0, deadlineDay: null },
    ],
  };
  const sightings = [
    { tag: 'find#1', name: 'CANISTER', position: new THREE.Vector3(0, 0, -3_180) },
    { tag: 'watch#1', name: 'ANACONDA', position: new THREE.Vector3(2_000, 0, 2_000) },
  ];
  const lines = arrivalLines(st, g1, here, sightings, at, nose, [SIDE_RECOVER, SIDE_SCAN, SIDE_DELIVER, SIDE_AMBUSH]);
  eq('the canister, with its distance and its bearing',
    lines[0], 'THE CANISTER YOU WERE SENT FOR IS ADRIFT 3,200 AWAY, AHEAD.');
  eq('the scan subject, and what to do with it',
    lines[1], 'THE ANACONDA YOU WERE SENT TO WATCH IS 2,800 AWAY, BEHIND AND TO STARBOARD. KEEP IT IN VIEW.');
  eq('a delivery says to dock', lines[2], `THIS IS ${g1[here].name.toUpperCase()}. DOCK AT THE STATION TO DELIVER.`);
  check('a job at another world says how far it is',
    /^YOUR JOB AT [A-Z]+ IS \d+ JUMPS? AWAY\.$/.test(lines[3]), lines[3]);
  eq('four lines for four jobs, and nothing for a target already gone',
    arrivalLines({ ...st, live: st.live.slice(0, 1) }, g1, here, [], at, nose, [SIDE_RECOVER]).length, 0);
}
