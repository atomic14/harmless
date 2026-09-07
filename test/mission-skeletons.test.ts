// Every skeleton the game ships, held to the rules a skeleton must keep.
//
// `lintSkeleton` (src/missions/lint.ts) is the gate. The first block runs it
// over `SKELETONS`, and a shipped skeleton must come back clean. The second
// block hands it fixtures with one fault each, and the gate must name the
// fault. That is how docs/TODO/190 proves the gate can fail without anybody
// breaking the Constrictor by hand.

import { SKELETONS } from '../src/missions/skeletons/index.ts';
import { lintSkeleton } from '../src/missions/lint.ts';
import type { Skeleton } from '../src/missions/model.ts';
import { g1 } from './fixtures.ts';
import { check, eq } from './harness.ts';

console.log('\nmission skeletons');
for (const s of SKELETONS) {
  const problems = lintSkeleton(s, SKELETONS, g1);
  eq(`${s.id} is clean`, problems.join('; '), '');
}
check('the Constrictor ships', SKELETONS.some((s) => s.id === 'constrictor'));

// --- the gate can fail ------------------------------------------------------

/** A clean two-leg arc, with a lead, to break one way at a time. */
function arc(over: Partial<Skeleton> = {}): Skeleton {
  return {
    id: 'a', kind: 'arc', anchor: 'local', patron: { kind: 'world', seedSlot: 7 },
    hail: 'HAIL', pitch: 'GO', offer: {},
    legs: [
      {
        id: 'one', verb: { kind: 'deliver' }, place: { kind: 'band', min: 30, max: 80 }, line: 'ONE',
        next: [{ on: 'success', to: 'two' }, { on: 'failed', to: 'fail' }],
      },
      {
        id: 'two', verb: { kind: 'deliver' }, place: { kind: 'here' }, line: 'TWO',
        next: [{ on: 'success', to: 'complete' }, { on: 'failed', to: 'fail' }],
      },
    ],
    complete: { pay: 0, lead: 'b' },
    fail: { pay: 0, lead: 'b' },
    ...over,
  };
}
const b: Skeleton = { ...arc(), id: 'b', complete: { pay: 0 }, fail: { pay: 0 } };
const legs = () => arc().legs;

eq('the fixture itself is clean', lintSkeleton(arc(), [arc(), b], g1).join('; '), '');

const faults: [string, Skeleton, readonly Skeleton[], string][] = [
  ['a leg with no failure branch',
    arc({ legs: [{ ...legs()[0], next: [{ on: 'success', to: 'two' }] }, legs()[1]] }),
    [b], 'no failed branch'],
  ['a failure outcome with a different lead',
    arc({ fail: { pay: 0 } }), [b], 'different arcs'],
  ['a lead to a skeleton that does not exist',
    arc(), [], 'unknown skeleton'],
  ['a lead to an arc this one excludes',
    arc({ excludes: ['b'] }), [b], 'excludes it'],
  ['a lead to an arc that must finish first',
    arc({ offer: { done: ['b'] } }), [b], 'needs it finished first'],
  ['a lead to an arc that excludes this one',
    arc(), [{ ...b, excludes: ['a'] }], 'which excludes it'],
  ['a branch to a leg that does not exist',
    arc({ legs: [{ ...legs()[0], next: [{ on: 'success', to: 'three' }, { on: 'failed', to: 'fail' }] }, legs()[1]] }),
    [b], 'unknown leg'],
  ['a leg that can never end',
    arc({ legs: [{ ...legs()[0], next: [{ on: 'success', to: 'one' }, { on: 'failed', to: 'one' }] }, legs()[1]] }),
    [b], 'no path'],
  ['a band with no candidate from some world',
    arc({ legs: [{ ...legs()[0], place: { kind: 'band', min: 1, max: 2 } }, legs()[1]] }),
    [b], 'no candidate'],
  ['a verb with no module',
    arc({ legs: [{ ...legs()[0], verb: { kind: 'teleport' } as never }, legs()[1]] }),
    [b], 'no module'],
  ['a handover toward a skeleton that does not exist',
    arc({ legs: [{ ...legs()[0], place: { kind: 'handover', toward: 'ghost', min: 2, max: 4 } }, legs()[1]] }),
    [b], 'unknown skeleton ghost'],
];
for (const [name, s, others, word] of faults) {
  const problems = lintSkeleton(s, [s, ...others], g1);
  check(`the gate names ${name}`, problems.some((p) => p.includes(word)), problems.join('; '));
}
