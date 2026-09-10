// What a dock says about missions beyond the legs it moved: the offers here,
// and then at most one hint about a lead (docs/TODO/203). It was a function
// inside machine.ts until that file crossed the size ceiling. It is the one
// part of a dock that is words alone.

import type { MissionContext } from './machine.ts';
import { dockHint } from './hints.ts';
import type { MissionEffect, MissionState } from './model.ts';
import { offersFor } from './offers.ts';

/**
 * Say the offers here, and then at most one hint about a lead (hints.ts).
 * `moved` is whether this dock advanced any journal entry, which resets the
 * idle count.
 */
export function hail(
  st: MissionState, ctx: MissionContext, effects: MissionEffect[], moved: boolean,
): void {
  st.idleDocks = moved ? 0 : st.idleDocks + 1;
  const offers = offersFor(st, ctx);
  // ONE CONSOLE LINE PER KIND. An arc hails by name, because a patron who
  // briefs a commander one time deserves the console. A second arc at the
  // same dock waits behind the first, since docs/TODO/192 put the governor
  // of Lave beside the Navy there. The side jobs on the board are one
  // count, said behind an arc's hail when there is one. So a dock with four
  // offers cannot say four lines into one frame and show the last of them.
  const arcs = offers.filter((s) => s.kind !== 'side');
  const side = offers.length - arcs.length;
  arcs.forEach((s, i) => effects.push(i === 0
    ? { kind: 'say', text: s.hail, command: 'openMissions' }
    : { kind: 'later', text: s.hail }));
  if (side > 0) {
    const text = side === 1
      ? 'THERE IS ONE SIDE JOB ON THE STATION BOARD.'
      : `THERE ARE ${side} SIDE JOBS ON THE STATION BOARD.`;
    if (arcs.length === 0) effects.push({ kind: 'say', text, command: 'openMissions' });
    else effects.push({ kind: 'later', text });
  }
  const hint = dockHint(st, ctx.commander, ctx.systems, offers.length > 0, st.idleDocks);
  if (hint) effects.push({ kind: 'later', ...hint });
}

