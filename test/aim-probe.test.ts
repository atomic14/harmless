// What `train/aim-probe.ts` may never report — docs/TODO/139 M1.
//
// The probe exists because a comment in `constants/npc-gun.ts` stated a figure
// nothing measured, and 139's whole ordering rests on what it prints. So the
// risk it carries is the one docs/TODO/134 names: a measuring tool that is
// quietly wrong scores the fix by a column that cannot see it. These are the
// bounds a row cannot cross whatever the fight does — not a snapshot of the
// numbers, which move with every constant the item is about to retune.
//
//   - NOTHING BEATS ITS OWN BEST CASE. The best case is point blank, the capped
//     hit chance and never out of the gate, so a measured rate above it means
//     the denominator is wrong (the episode's clock rather than the ship's) or
//     the numerator has picked up a warhead the aim columns do not describe.
//   - NOBODY OUTRUNS THE RELOAD. `npcTriggerPull` starts a cooldown of at least
//     `NPC_COOLDOWN_LO`, so shots a second has a hard ceiling that no aim can
//     lift. It is the check that the shots column counts DISCHARGES and not
//     trigger polls — the mistake `CombatSimRecorder.playerShot` documents on
//     the player's side.
//   - THE SHARES HAVE THEIR OWN DENOMINATOR. Lined-up frames come back out of a
//     share the recorder states; more of them than were sampled would mean the
//     probe and the recorder disagree about which frames they cover.
//
// And one claim about WHAT is flown: the probe's headline pilot is the pilot
// the game gives a pirate. That is `game/brain-names.ts`'s decision, and a
// probe measuring the A/B control while the game ships something else would be
// honest arithmetic about the wrong fight.

import { check } from './harness.ts';
import { PILOTS, TARGETS, flyAimFight } from '../train/aim-fight.ts';
import { bestCase } from '../train/aim-probe.ts';
import { pirateBrainNameFor } from '../src/game/brain-names.ts';
import { NPC_COOLDOWN_LO } from '../src/constants/npc-gun.ts';

console.log('\nthe aim probe (docs/TODO/139 M1)');

check('the headline pilot is the one the game gives a pirate',
  PILOTS[0] === pirateBrainNameFor(0, true) && PILOTS[0] === pirateBrainNameFor(2, false));

// Three seeds and both fights: enough for every bound below to have been
// exercised by a gang that closes and one that never gets in range.
const fights = TARGETS.flatMap(
  (target) => [7, 8, 9].map((n) => flyAimFight('pursuit', target, 2, 50_000_017 + n * 7919)));

const attackers = fights
  .flatMap((fight) => fight.attackers)
  // A pirate destroyed in the first frames has no rates to bound.
  .filter((a) => a.aliveSeconds > 1);

check('the fights measured something', attackers.length >= 6
  && attackers.some((a) => a.shots > 0));

check('no attacker does more damage a second than its own best case',
  attackers.every((a) => a.damage / a.aliveSeconds <= bestCase(a.damagePerHit)));

check('no attacker fires faster than the shortest reload',
  attackers.every((a) => a.shots / a.aliveSeconds <= 1 / NPC_COOLDOWN_LO));

check('no attacker hits more often than it fires',
  attackers.every((a) => a.hits <= a.shots));

check('no attacker is lined up in more frames than it was sampled in',
  attackers.every((a) => a.linedUp <= a.frames + 1 && a.inRange <= a.frames + 1));

// ...and the leg split (docs/TODO/139 M3), which is the same frames a second
// time. It carries one risk of its own, and it is the risk that decided the
// milestone: a share read against the wrong denominator would say that a leg
// which points the nose away is a smaller part of the fight than it is.
check('the leg split covers exactly the frames the fight sampled',
  fights.every((f) => {
    const legFrames = [...f.doing.values()].reduce((a, s) => a + s.frames, 0);
    const sampled = f.attackers.reduce((a, at) => a + at.frames, 0);
    return legFrames === sampled;
  }));

// A bearing error is an angle between two directions, so it cannot leave
// [0, pi]. The bound is on the SUM against the frames, because that is how the
// tables divide it — and it is what catches a slice summed in degrees.
check('no leg reports a bearing error outside half a turn',
  fights.every((f) => [...f.doing.values()].every(
    (s) => s.aimError >= 0 && s.aimError <= s.frames * Math.PI)));
