// What the flight readout SAYS, for ships flown by the real `update()`.
//
// `break-off.test.ts` pins `describeFlight` as a function: give it a flight and
// a phase and it returns a phrase. This file asks the other half of the
// question — does a live ship arrive at that function carrying the truth? — and
// it is its own file because the two halves have failed independently twice.
// The function was right and the fields were stale both times (docs/TODO/77's
// latched `underFire`, docs/TODO/88's two below), so a test that only called
// the function went green while the trainer's SPENT ITS TIME column and the
// cockpit strip printed a word about a flight nothing was flying.
//
// The rule these assert, from docs/TODO/88: the readout names the flight that
// MOVED the ship this step. Not the branch it entered, and never a field the
// flight never wrote.

import * as THREE from 'three';

import { seedWorld } from '../src/game/rng.ts';
import { NpcShip } from '../src/game/npc.ts';
import { describeFlight } from '../src/game/break-off.ts';
import { npcImpactDamage } from '../src/game/impact-damage.ts';
import { IMPACT } from '../src/constants/impact.ts';
import { SHIPPED_BRAINS, type BrainSelection } from '../src/game/brain-names.ts';
import { SPECS } from '../src/game/ship-specs.ts';
import { PLAYER_INTEREST_RANGE } from '../src/constants/player-interest.ts';
import { check } from './harness.ts';

const FRAME = 1 / 60;
const origin = new THREE.Vector3();
const level = new THREE.Quaternion();
const station = new THREE.Object3D();
station.position.set(0, 0, 30_000);
const player = { position: origin, quaternion: level, speed: 200 };

/** The strip's own phrase for this ship, off the fields it actually carries. */
const doing = (n: NpcShip): string => describeFlight(
  n.state.flownBy, n.state.attackPhase, n.state.underFire, n.state.tactic, n.breakingOff);

/** The words the attack run may end on — the ones that quote `attackPhase`. */
const PHASE_WORDS = ['closing', 'passing', 'extending', 'evading'];
const namesAPhase = (s: string): boolean => PHASE_WORDS.some((w) => s.endsWith(w));

const fly = (npc: NpcShip, brains: BrainSelection, seconds: number): NpcShip => {
  const view = {
    station, dockZ: 160, fleet: [npc], playerLegal: 2, missileInbound: false, brains,
  };
  for (let i = 0; i < Math.round(seconds * 60); i += 1) {
    npc.update(FRAME, player as never, view as never);
  }
  return npc;
};

/** A trader of the given armament, shot by the commander from where he sits. */
const shotTrader = (seed: number, armed: boolean): NpcShip => {
  seedWorld(seed);
  const npc = new NpcShip('trader', new THREE.Vector3(0, 0, 2500), seed,
    SPECS.trader.find((s) => (s.armed ?? false) === armed));
  npc.takeDamage(npcImpactDamage(IMPACT.ram), origin, true);
  return npc;
};

// --- the branch is not the flight -------------------------------------------
//
// `takeDamage` sets `state.fleeing` for ANY trader that is hit, and the fleeing
// branch of `update()` is where an ARMED one turns and fights: in a shipped
// build it flies the scripted attack run back at whoever is hunting it
// (`defenceBrainNameFor` returns `attack-run`). So for the whole engagement the
// readout said `fleeing` about a ship flying attack runs — the word was the
// branch it took, not what it was doing.

console.log('\nflight readout: an armed trader fights, and says so');
{
  const armed = fly(shotTrader(88_001, true), SHIPPED_BRAINS, 3);
  const unarmed = fly(shotTrader(88_002, false), SHIPPED_BRAINS, 3);

  check(`the armed trader flies the attack run ("${doing(armed)}")`,
    armed.state.flownBy === 'scripted' && namesAPhase(doing(armed)));
  check('...so it does not report fleeing, whatever branch it entered',
    doing(armed) !== 'fleeing' && armed.state.fleeing);

  // ...and the word still belongs to the ship it was always true of. An unarmed
  // trader in the same branch, hit by the same ram, really is running: it
  // reaches the steer-away at the bottom and nothing else.
  check(`the unarmed trader in the same branch is still fleeing ("${doing(unarmed)}")`,
    unarmed.state.flownBy === 'fleeing' && doing(unarmed) === 'fleeing');
  check('...so the two traders read differently, which is the whole point',
    doing(armed) !== doing(unarmed));
}

// --- a ship that flew nothing quotes no phase --------------------------------
//
// `attackPhase` initialises to `closing` and only `attack()` ever writes it, so
// a ship that has never run the phase machine used to read `slash closing` off
// the constructor. Two ships that never fight: a pirate parked well outside
// interest range, which ambles between waypoints, and a trader working the lane
// between planet and station.

console.log('\nflight readout: a ship flying nothing names nothing');
{
  seedWorld(88_003);
  const idle = new NpcShip('pirate', new THREE.Vector3(0, 0, 4 * PLAYER_INTEREST_RANGE), 88_003);
  idle.state.threatTier = 1;
  fly(idle, SHIPPED_BRAINS, 3);

  seedWorld(88_004);
  const trader = new NpcShip('trader', new THREE.Vector3(0, 0, 20_000), 88_004);
  fly(trader, SHIPPED_BRAINS, 3);

  check(`the ambling pirate reports no phase ("${doing(idle)}")`,
    idle.state.flownBy === 'none' && !namesAPhase(doing(idle)));
  check(`...and neither does a trader going about its business ("${doing(trader)}")`,
    trader.state.flownBy === 'none' && !namesAPhase(doing(trader)));
  // The stale value is still sitting in the field: what changed is that nothing
  // reaches it. If this ever fails because `attackPhase` stopped being
  // `closing` at rest, the check above stopped proving anything.
  check('...while `attackPhase` still holds the initial word nobody may quote',
    idle.state.attackPhase === 'closing' && trader.state.attackPhase === 'closing');
}

// --- and a ship that flies again says so at once ------------------------------
//
// The clear-and-stamp in `update()` cuts both ways: a word that is never
// cleared goes stale, and a word cleared without being re-stamped would report
// `not fighting` for a ship in a knife fight. One pirate, flown through both.

console.log('\nflight readout: the word follows the ship in and out of the fight');
{
  seedWorld(88_005);
  const pirate = new NpcShip('pirate', new THREE.Vector3(0, 0, 2000), 88_005);
  pirate.state.threatTier = 0;
  fly(pirate, { scripted: true } as BrainSelection, 2);
  const fighting = doing(pirate);
  // Out of the commander's business: the same ship, moved past interest range.
  pirate.object.position.set(0, 0, 4 * PLAYER_INTEREST_RANGE);
  fly(pirate, { scripted: true } as BrainSelection, 1);

  check(`in range it names its run ("${fighting}")`, namesAPhase(fighting));
  check(`...and out of it, the run it is no longer flying ("${doing(pirate)}")`,
    doing(pirate) === 'not fighting');
}
