// What a settlement does to the record, and what the game must do for it.
//
// A branch taken settles once (machine.ts). This file applies the
// settlement. That is the pay, the deed, the legal change, the flags and
// the standing with the patron. It is also a change to a world, a standing
// spawn, and the word the console says. It returns the flags it newly set,
// and the machine fires those on every live leg that names one. It came out of `machine.ts` for
// the size gate (docs/TODO/217 M1).
//
// PURE, as the machine is. It pushes effects, and the caller applies them.

import type { MissionContext } from './machine.ts';
import type { DossierWord, MissionEffect, MissionState, Settlement, Skeleton } from './model.ts';
import { patronId } from './lookups.ts';
import { acceptedAt } from './queries.ts';
import { fillSlots, lineSlots } from './text.ts';

/**
 * Apply a settlement, and say its word. A silent settlement with a dossier
 * word still says an empty line. The bridge puts the dossier's line in its
 * place, or drops it.
 *
 * @param sayTarget the world the words name, when it is not the world a
 * change lands on.
 * @returns the flags this settlement newly set.
 */
export function applySettlement(
  st: MissionState, skeleton: Skeleton, s: Settlement | undefined,
  target: number | null, ctx: MissionContext, effects: MissionEffect[], word?: DossierWord,
  sayTarget: number | null = target,
): string[] {
  const added: string[] = [];
  if (s) {
    if (s.pay > 0) effects.push({ kind: 'pay', tenths: s.pay });
    if (s.deed) effects.push({ kind: 'deed', deed: s.deed });
    if (s.legal) effects.push({ kind: 'legal', delta: s.legal });
    if (s.grant) effects.push({ kind: 'grant', fit: s.grant });
    for (const f of s.setFlags ?? []) {
      if (!st.flags.includes(f)) { st.flags.push(f); added.push(f); }
    }
    if (s.standing) {
      const id = patronId(skeleton, ctx.commander, acceptedAt(st, skeleton.id));
      st.standing[id] = (st.standing[id] ?? 0) + s.standing;
    }
    // A change to a world is the game's to keep (mission-bridge.ts), at the
    // branch's world, through its last day.
    const world = target ?? ctx.commander.systemIndex;
    if (s.override) {
      effects.push({ kind: 'worldOverride', world, until: ctx.commander.day + s.override.days, change: { override: s.override.set } });
    }
    if (s.spawn) {
      effects.push({ kind: 'standingSpawn', world, until: ctx.commander.day + s.spawn.days, ships: s.spawn.ships });
    }
  }
  const text = s?.say ? fillSlots(s.say, lineSlots(ctx.systems, sayTarget, s.pay)) : '';
  if (text || word) effects.push({ kind: 'say', text, word });
  return added;
}
