// Who came close, and was not announced yet (docs/TODO/209).
//
// Chris flew a trip to the station and reported that a neutral trader did not
// stop the ship. The mass lock rule did fire when the torus drive ran. It did
// nothing when the drive was already off, and the drive is off for most of a
// trip. So a trader could pass at 1,000 units and say nothing at all.
//
// His own words about the sky, of 2026-09-11: "When anything is in range we
// should show a list of objects that can be engaged - these can be outright
// hostiles or neutral ships that we want to pirate." The target list already
// holds every ship in scanner range. The pilot had no reason to open it.
//
// THIS FILE ONLY SPEAKS. It never stops the ship, and it never picks a target.
// A neutral ship must not interrupt a course, because the pilot chose that
// course. The line tells the pilot that the chance is there.
//
// IT NAMES A TRADER, AND NOTHING ELSE. A hostile ship announces itself: it
// shoots, it raises the condition light, and the course offers a way out. The
// law's ships are a risk rather than a chance. A line that invites an attack
// on a Viper beside the station is bad advice. A trader is the ship
// Chris named, and a trader carries the cargo.
//
// It also says nothing inside the station's own mass lock. The pilot is on
// the approach there, and traffic is thick.
//
// THE FLAG IS ON THE SHIP, as the target pick is (`targets.ts`). A ship has no
// stable id, and its state is saved with it. The flag clears when the ship
// opens back out past `CLOSE_PASS_CLEAR`, so a second approach speaks again.

import type * as THREE from 'three';
import type { NpcShip } from './npc.ts';
import { isHostileToPlayer } from './hostility.ts';
import { shipArticle } from './targets.ts';
import { CLOSE_PASS_CLEAR, MASS_LOCK_SHIP, MASS_LOCK_STATION } from '../constants/torus.ts';

/** Everything the rule reads. */
export interface CloseView {
  readonly npcs: readonly NpcShip[];
  readonly playerPos: THREE.Vector3;
  readonly legalStatus: number;
  /** how far the commander is from the station, for the truce */
  readonly playerToStation: number;
}

/**
 * The lines to show for the ships that came close since the last step.
 *
 * It sets `announcedClose` on each ship it names. It clears the flag on a ship
 * that opened back out.
 */
export function closePassLines(v: CloseView): string[] {
  const out: string[] = [];
  if (v.playerToStation < MASS_LOCK_STATION) return out;
  for (const npc of v.npcs) {
    if (npc.role !== 'trader') continue;
    const range = npc.object.position.distanceTo(v.playerPos);
    if (range > CLOSE_PASS_CLEAR) { npc.state.announcedClose = false; continue; }
    if (range > MASS_LOCK_SHIP) continue;
    if (!npc.state.alive || npc.state.docked) continue;
    if (npc.state.announcedClose) continue;
    if (isHostileToPlayer(npc, v.legalStatus, v.playerToStation)) continue;
    // A ship the pilot already picked, or already shot at, is not an offer.
    // The pilot made the choice. The line would be an answer to nobody.
    if (npc.state.targeted || npc.state.provokedByPlayer) continue;
    npc.state.announcedClose = true;
    out.push(`${shipArticle(npc)} IS CLOSE — OPEN TARGETS TO ATTACK IT`);
  }
  return out;
}
