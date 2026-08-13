// A sound that happens out in the world must arrive from out in the world.
//
// docs/TODO/142. Before it, every sound played at the gain it was written with:
// a ship going up on the hull and one going up at the edge of the scanner were
// the same noise. Three claims are pinned here, and they are separable on
// purpose, because they are three decisions Chris can move one at a time.
//
//   1. THE SEAM — an event that happens somewhere carries where.
//   2. THE CURVE — how much of it survives the trip.
//   3. THE PLACE — which ear it arrives in, and which way is "right".
//
// The fake AudioContext is test/audio-fixtures.ts, shared with test/audio.test.ts
// and test/music.test.ts. It follows the graph rather than guessing, which is
// what lets `peak` read a level through a panner that was not there before.
//
// WHAT IS NOT ASSERTED HERE, and deliberately: how the whole chain SOUNDS. That
// is a pilot's answer, and the two numbers it moves are `AUDIBLE_RANGE` and
// `STEREO_WIDTH`. Both are in src/constants/audio.ts with their reasoning beside
// them.

import * as THREE from 'three';

import { AUDIBLE_RANGE, STEREO_WIDTH } from '../src/constants/audio.ts';
import { Combat } from '../src/game/combat.ts';
import { World } from '../src/game/world.ts';
import { seedWorld } from '../src/game/rng.ts';
import { viewDirection, viewRight } from '../src/game/views.ts';
import { panners, peak, tones } from './audio-fixtures.ts';
import { check, eq } from './harness.ts';

const { sfx } = await import('../src/audio.ts');

console.log('\nsound placement');

/** Play one sound with a clean slate, and hand back what the synth built. */
const played = (play: () => void): { tone: typeof tones[0] | undefined; pan: number | null } => {
  tones.length = 0;
  panners.length = 0;
  play();
  return { tone: tones[0], pan: panners.length ? panners[0].pan.value : null };
};

const at = (distance: number, side = 0) => ({ distance, side });

// --- 1. the seam -------------------------------------------------------------
//
// The rule modules report; game.ts plays. So the only thing a rule module can
// get wrong is failing to say WHERE, and `Combat.wreck` is the case that can
// get it wrong invisibly: it despawns the ship two lines after it reports, so a
// held reference would read a position that has already been recycled.
{
  seedWorld(31_415_926);
  const world = new World();
  const combat = new Combat(world);
  const where = new THREE.Vector3(120, -40, -900);
  const pirate = world.spawn('pirate', where.clone(), 1);

  const events = combat.wreck(pirate);
  const bang = events.find((e) => e.kind === 'sound');

  check('a wreck reports its explosion with a place',
    bang?.kind === 'sound' && bang.at !== undefined);
  check('...and the place is where the ship was',
    bang?.kind === 'sound' && bang.at !== undefined
      && bang.at.distanceTo(where) < 1e-9);
  check('...taken before the despawn, so it survives the ship',
    world.npcs.length === 0
      && bang?.kind === 'sound' && bang.at !== undefined
      && bang.at.distanceTo(where) < 1e-9);
}
{
  // The other half of the seam, and the half a wide change breaks quietly: a
  // sound that happens in the cockpit must carry NO place, or every beep starts
  // fading with the pilot's distance from a thing it has nothing to do with.
  tones.length = 0;
  panners.length = 0;
  sfx.refused();
  eq('a cockpit beep builds no panner', panners.length, 0);
  eq('...and keeps the level it always had', peak(tones[0]), 0.08);
}

// --- 2. the curve ------------------------------------------------------------
//
// Asserted as CLAIMS about the shape, not as the arithmetic. Restating
// `(1 - d / AUDIBLE_RANGE)²` here would pass whatever audio.ts said.
{
  const near = played(() => sfx.explosion(at(0)));
  const unplaced = played(() => sfx.explosion());
  const half = played(() => sfx.explosion(at(AUDIBLE_RANGE / 2)));
  const edge = played(() => sfx.explosion(at(AUDIBLE_RANGE)));
  const beyond = played(() => sfx.explosion(at(AUDIBLE_RANGE * 3)));

  check('a bang on the hull is as loud as it ever was',
    near.tone !== undefined && peak(near.tone) === 0.25);
  check('...and so is one with no place at all, which is every sound that came'
    + ' before this item',
  unplaced.tone !== undefined && peak(unplaced.tone) === peak(near.tone!));

  check('a bang at half the audible range is a QUARTER of the near one'
    + ` (${peak(half.tone!)} against ${peak(near.tone!)})`,
  half.tone !== undefined
      && Math.abs(peak(half.tone) - peak(near.tone!) / 4) < 1e-9);

  check('a bang at the audible edge builds no voice at all',
    edge.tone === undefined);
  check('...and neither does one well beyond it', beyond.tone === undefined);
}
{
  // The third category, and the one the code answered rather than the plan.
  // `enemyLaser` is pushed only where the shot is AT the player, so the beam
  // ends on the hull whatever the range. It takes a side and ignores the
  // distance — and if that ever stops being true, this is where it shows.
  const close = played(() => sfx.enemyLaser(at(10, 0)));
  const far = played(() => sfx.enemyLaser(at(AUDIBLE_RANGE * 0.99, 0)));
  const beyond = played(() => sfx.enemyLaser(at(AUDIBLE_RANGE * 5, 0)));

  check('a bolt fired at you is full volume from across the system',
    close.tone !== undefined && far.tone !== undefined
      && peak(close.tone) === 0.08 && peak(far.tone) === 0.08);
  check('...even from beyond the range a bang would carry',
    beyond.tone !== undefined && peak(beyond.tone) === 0.08);
}

// --- 3. the place ------------------------------------------------------------
{
  const starboard = played(() => sfx.explosion(at(0, 1)));
  const port = played(() => sfx.explosion(at(0, -1)));
  const ahead = played(() => sfx.explosion(at(0, 0)));

  check('a bang to starboard arrives in the right ear', starboard.pan === STEREO_WIDTH);
  check('...one to port in the left', port.pan === -STEREO_WIDTH);
  check('...and one dead ahead in both', ahead.pan === 0);

  check('nothing is ever hard-panned into one ear only'
    + ' — a mono speaker would lose it',
  [starboard.pan, port.pan, ahead.pan].every((p) => p !== null && Math.abs(p) < 1));

  const bolt = played(() => sfx.enemyLaser(at(AUDIBLE_RANGE * 0.9, -1)));
  check('a bolt says which side it came from even though it ignores how far',
    bolt.pan === -STEREO_WIDTH);
}
{
  // `hit` is the third placed sound, and it is pure noise — no oscillator, so
  // nothing lands in `tones`. Its envelope still builds a panner, and that is
  // the observable: a placed hit has one, and a hit beyond earshot builds no
  // envelope at all, so it has none.
  const near = played(() => sfx.hit(at(100, 1)));
  const far = played(() => sfx.hit(at(AUDIBLE_RANGE * 2, 1)));
  eq('your bolt striking a hull is placed where the hull is', near.pan, STEREO_WIDTH);
  eq('...and a hit beyond earshot builds nothing at all', far.pan, null);
}
{
  // The fallback the waltz already needed, tested the way the fixture's own
  // comment says it must be: by taking the node away. A browser without
  // StereoPannerNode must lose the PLACEMENT and keep the sound.
  const ctor = (globalThis as unknown as { AudioContext: new () => AudioContext }).AudioContext;
  const proto = ctor.prototype as unknown as Record<string, unknown>;
  const saved = proto.createStereoPanner;
  delete proto.createStereoPanner;
  try {
    const deaf = played(() => sfx.explosion(at(0, 1)));
    check('no StereoPannerNode still makes the sound',
      deaf.tone !== undefined && peak(deaf.tone) === 0.25);
    eq('...and simply places nothing', deaf.pan, null);
  } finally {
    // Restore what was found. docs/TODO/140 M1 learned this the hard way: a
    // fixture left installed killed a suite two files later.
    proto.createStereoPanner = saved;
  }
  const restored = played(() => sfx.explosion(at(0, 1)));
  eq('the fake is put back as it was found', restored.pan, STEREO_WIDTH);
}

// --- which way is "right" ----------------------------------------------------
//
// The decision Chris took on 2026-08-13: the ear turns with the VIEW, not with
// the hull. This is the half of it that can be asserted. What it composes into —
// a pirate on your six announcing itself in the correct ear — is the flight.
{
  const q = new THREE.Quaternion();
  const out = new THREE.Vector3();
  const right = (view: number) => viewRight(q, view, out).clone();

  check('the front view\'s right is to starboard',
    right(0).distanceTo(new THREE.Vector3(1, 0, 0)) < 1e-9);
  check('REAR VIEW FLIPS IT — this is the whole decision',
    right(1).distanceTo(new THREE.Vector3(-1, 0, 0)) < 1e-9);
  check('...and the side views are square to both',
    Math.abs(right(2).dot(right(0))) < 1e-9 && Math.abs(right(3).dot(right(0))) < 1e-9);

  // Right, forward and up must make a right-handed set in every view, or a
  // sound placed by the dot lands on the wrong side in one window and nobody
  // notices until they fly it. `right × forward` is up, and up is +Y.
  const forward = new THREE.Vector3();
  for (let view = 0; view < 4; view++) {
    viewDirection(q, view, forward);
    const up = right(view).cross(forward);
    check(`view ${view} keeps right, forward and up a right-handed set`,
      up.distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-9);
  }

  // A turn of the ship carries the ear with it. Rolled 90 degrees to starboard,
  // the view's right points DOWN the world, so a bang overhead is now to port.
  const rolled = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, -1), Math.PI / 2);
  check('a rolled ship hears a rolled sky',
    viewRight(rolled, 0, out).distanceTo(new THREE.Vector3(0, -1, 0)) < 1e-9);
}
