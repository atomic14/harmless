// What combat REPORTS, and the three helpers that build one report.
//
// A module decides and returns an event; an orchestrator applies the
// consequence (invariant 15). This file is the first half of that contract for
// the fight: the vocabulary itself. `combat.ts` is the only module that BUILDS
// a `CombatEvent`. Six modules READ one — `combat-player.ts`,
// `flight-weapons.ts`, `combat-sim.ts`, `law-actions.ts`, `world-step.ts` and
// two harnesses — and none of them fires a gun.
//
// That is why the vocabulary is not in `combat.ts`. A module that applies a
// combat event must not need the module that resolves a hit.
// `sounds.ts` already states the same argument for `SoundEvent`, which is a
// member of this union.

import type * as THREE from 'three';
import type { NpcShip } from './npc.ts';
import type { SoundEvent, SoundName } from './sounds.ts';

export type CombatEvent =
  | SoundEvent
  /**
   * Something to say. `queued` holds it back until the console is free
   * (session.ts). A kill says several things at once: the bounty, the contract,
   * and what it did to your reputation. A line that EXPLAINS another cannot be
   * the one that erases it.
   */
  | { kind: 'message'; text: string; seconds: number; queued?: boolean }
  /** raise the legal status — see combat.ts's header for why the Game does it */
  | { kind: 'offence'; level: number }
  /**
   * A ship the law is glad to see the back of went down, credited to the
   * commander. `recordWorkedOff` (law.ts) decides what that pays off, and the
   * role travels rather than the answer, so the rule stays in one file.
   */
  | { kind: 'atonement'; role: string }
  /** this ship is out of the sky; drop any missile lock on it */
  | { kind: 'wrecked'; npc: NpcShip }
  /** point the cockpit beams here, or straight ahead when null */
  | { kind: 'beam'; at: THREE.Vector3 | null }
  /** the gun actually went off */
  | { kind: 'fired' }
  /** a hull breach cost the commander cargo or a fitting */
  | { kind: 'breach' }
  | { kind: 'died'; reason: string };

export const say = (text: string, seconds: number): CombatEvent =>
  ({ kind: 'message', text, seconds });

/** ...once the console is free of the line this one explains. */
export const later = (text: string, seconds: number): CombatEvent =>
  ({ kind: 'message', text, seconds, queued: true });

/**
 * @param at where in the world it happened, for a sound that did not happen in
 * the cockpit (docs/TODO/142). Clone it: the caller may despawn what it belongs
 * to before the Game reads it.
 */
export const heard = (name: SoundName, at?: THREE.Vector3): CombatEvent =>
  ({ kind: 'sound', name, at });
