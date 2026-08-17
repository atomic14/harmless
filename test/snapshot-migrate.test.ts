// A save from an older build is RAISED at the door, not refused there.
//
// `SNAPSHOT_VERSION` moved twice on 2026-08-15 — docs/TODO/156 took it to 2 and
// docs/TODO/160 took it to 3 — and the door refused anything that was not the
// current number. The refusal was silent in the worst way: `SAVE_RECORD_VERSION`
// did not move, so a version 2 record is on the shelf and IS listed. A player
// picked it and it threw.
//
// Chris settled it on 2026-08-16: *"We should migrate snapshot v2 to v3."* A
// save that will not load costs a career; an empty ledger costs a few minutes.
//
// EVERY FIXTURE HERE IS A REAL CAPTURED SNAPSHOT, walked down to an older
// version by removing what the newer one added. A hand-written version 2 object
// would rot the day the shape moves, and would prove nothing about the save a
// player is actually holding.
//
// test/snapshot-parse.test.ts owns the other half — what is still refused — and
// this file must not need to change it.

import * as THREE from 'three';
import { Game } from '../src/game/game.ts';
import { headlessShell } from '../src/engine/shell.ts';
import { withoutSaving } from '../src/game/storage.ts';
import { seedWorld } from '../src/game/rng.ts';
import { SNAPSHOT_VERSION } from '../src/game/snapshot.ts';
import { parseSnapshot } from '../src/game/snapshot-parse.ts';
import { KILLS_PER_RUNG, FUGITIVE, OFFENDER } from '../src/constants/law.ts';
import { WRECK_BURST_GRACE } from '../src/constants/wreck.ts';
import { check, dismissBriefing, eq } from './harness.ts';

console.log('\na stored snapshot climbs to the current version');

const refuses = (fn: () => unknown): boolean => {
  try { fn(); return false; } catch { return true; }
};

/**
 * Parse, or null if the door refused.
 *
 * Every raise below goes through this rather than calling `parseSnapshot`
 * bare. A gate that dies on an uncaught throw reports nothing and counts
 * nothing, and proving that this gate can fail is how that was found.
 */
const raise = (snap: unknown): Record<string, unknown> | null => {
  try {
    return parseSnapshot(snap) as unknown as Record<string, unknown>;
  } catch {
    return null;
  }
};

/** A real snapshot, flown for two seconds, as plain JSON. */
function captured(seed: number): Record<string, unknown> {
  seedWorld(seed);
  const g = new Game(() => headlessShell());
  dismissBriefing(g);
  g.launch();
  for (let i = 0; i < 120; i++) g.update(1 / 60, i / 60);
  return JSON.parse(JSON.stringify(g.captureSnapshot())) as Record<string, unknown>;
}

/** ...walked back to version 2: everything docs/TODO/160 added, removed. */
function asVersion2(snap: Record<string, unknown>): Record<string, unknown> {
  const old = structuredClone(snap);
  old.version = 2;
  delete (old.commander as Record<string, unknown>).atonement;
  return old;
}

withoutSaving(() => {
  const current = captured(20_260_816);

  // --- the raise itself ------------------------------------------------------
  {
    const old = asVersion2(current);
    const raised = raise(structuredClone(old));
    eq('a version 2 snapshot loads', raised?.version, SNAPSHOT_VERSION);
    eq('...and its commander has an empty ledger',
      (raised?.commander as Record<string, unknown> | undefined)?.atonement, 0);

    // TWO FIELDS AND NO OTHERS. Stamping the version back down and taking the
    // ledger back off must give the bytes we started from, so the migration is
    // proved not to have touched anything else in the world.
    const back = structuredClone(raised ?? {});
    back.version = 2;
    delete (back.commander as Record<string, unknown> | undefined)?.atonement;
    eq('...and nothing else in the save moved',
      JSON.stringify(back), JSON.stringify(old));
  }

  // --- the caller's own bytes ------------------------------------------------
  {
    const old = asVersion2(current);
    const before = JSON.stringify(old);
    raise(old);
    eq('the door does not write on what it was handed', JSON.stringify(old), before);
  }

  // --- a hand-edited file that already carries the field ---------------------
  {
    const old = asVersion2(current);
    (old.commander as Record<string, unknown>).atonement = KILLS_PER_RUNG - 1;
    const raised = raise(old);
    eq('a version 2 commander that already has a ledger keeps it',
      (raised?.commander as Record<string, unknown> | undefined)?.atonement,
      KILLS_PER_RUNG - 1);
  }

  // --- what is still refused -------------------------------------------------
  //
  // The table is keyed by strict equality on a number. Anything it does not
  // know falls through to the check that was there before.
  {
    const wrong = (version: unknown): boolean => {
      const b = asVersion2(current);
      b.version = version;
      return refuses(() => parseSnapshot(b));
    };
    check('version 1 is still refused', wrong(1));
    check('...and version 0', wrong(0));
    check('...and a version NEWER than this build', wrong(SNAPSHOT_VERSION + 1));
    check('...and the string "2", which is not the number 2', wrong('2'));
    check('...and no version at all', wrong(undefined));
  }
});

// --- and the raised save flies ------------------------------------------------
//
// The reason the field is WRITTEN rather than permitted to be absent.
// `Persistence.restore` clones the commander straight in, so an absent
// `atonement` reaches `recordWorkedOff` as `undefined`. That does not stall the
// ledger; it empties it. `NaN < KILLS_PER_RUNG` is false, so the first pirate
// kill takes a whole rung. `test/atonement.test.ts` pins that arithmetic, and
// docs/TODO/167 is where this paragraph was corrected.
//
// This asserts the behaviour rather than the field: a raised commander works a
// record off in five kills, and not in one.

console.log('...and the commander it restores can still work a record off');
withoutSaving(() => {
  const old = asVersion2(captured(20_260_817));

  seedWorld(20_260_818);
  const g = new Game(() => headlessShell());
  dismissBriefing(g);
  g.launch();
  const raised = raise(old);
  check('the version 2 save was raised at the door', raised !== null);
  g.restoreSnapshot(raised as never);
  // The restored world is the one the save was taken in, mid-launch. Clear it
  // and hold still: this block is about the LEDGER, and a fight it inherited
  // would decide the record for it.
  g.state.world.clearNpcs();
  g.state.player.speed = 0;

  const c = g.state.commander;
  eq('the restored ledger is a number', typeof c.atonement, 'number');
  c.legalStatus = FUGITIVE;
  let at = 0;
  for (let i = 0; i < KILLS_PER_RUNG; i++) {
    const nose = new THREE.Vector3(0, 0, -1).applyQuaternion(g.state.player.quaternion);
    const npc = g.spawnNpc('pirate',
      g.state.player.position.clone().addScaledVector(nose, 400), 3);
    npc.state.energy = 1;
    npc.object.updateMatrixWorld(true);
    g.fireLaser();
    check(`pirate ${i + 1} went down`, !npc.state.alive);
    // PAST THE WRECK GRACE, and that is docs/TODO/173 rather than padding. The
    // commander sits inside `STATION_TRUCE`, where an unprovoked pirate is not
    // hostile. So it is a bystander, and her beam registers nothing on it for
    // `WRECK_BURST_GRACE` seconds after her own kill. The rule this block pins
    // is that five kills take a rung. It is not the cadence they arrive at.
    const between = Math.ceil(WRECK_BURST_GRACE * 60) + 30;
    for (let f = 0; f < between; f++) g.step(1 / 60, at += 1 / 60);
  }
  eq(`${KILLS_PER_RUNG} pirates still take a rung off a raised save`,
    c.legalStatus, OFFENDER);
});
