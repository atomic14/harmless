// The five arcs of the tour, in tour order (docs/TODO/192 M2).
//
// Each arc's patron is the world patron of its start world. The start
// worlds are the ones `missions/tour.ts` places from the seed: Lave,
// Rabedira, Vetitice, Xeer and Edle. Each arc's final leg hands over toward
// the next arc's world, and both of its outcomes lead there. The last arc
// leads nowhere, and the log tells the end of the tour.
//
// Each file names its theme in a comment. The words a player reads are the
// dossier's (docs/TODO/191), and the lines here are the plain fallback.

import type { Skeleton } from '../../model.ts';
import { ARC_EDLE } from './edle.ts';
import { ARC_LAVE } from './lave.ts';
import { ARC_RABEDIRA } from './rabedira.ts';
import { ARC_VETITICE } from './vetitice.ts';
import { ARC_XEER } from './xeer.ts';

export const ARCS: readonly Skeleton[] = [ARC_LAVE, ARC_RABEDIRA, ARC_VETITICE, ARC_XEER, ARC_EDLE];
