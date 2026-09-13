// The Dark Wheel's trials, in order (docs/TODO/219). Not the tour: the tour
// is five arcs at five worlds, and the Wheel has no world. Each trial waits
// for the one before it through the flag it set.

import type { Skeleton } from '../../model.ts';
import { WHEEL_MARK } from './mark.ts';
import { WHEEL_BLOCKADE } from './blockade.ts';

export const WHEEL: readonly Skeleton[] = [WHEEL_MARK, WHEEL_BLOCKADE];
