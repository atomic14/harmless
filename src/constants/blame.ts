// Whether a hit is the commander's own deed, so the ship holds it against her.
//
// A ship's grudge is `provokedByPlayer` (game/npc-state.ts). It is a private
// quarrel, apart from the law's record, and `game/hostility.ts` reads it for a
// police ship and for a hunter. This file says which sources set it. The
// damage door in `game/damage-dealt.ts` reads this table and nothing else.

/**
 * Which of the commander's damage sources provoke the ship they hit.
 *
 * A warhead and the bomb are aimed, and so is the laser. A ram is CONTACT. The
 * geometry reads overlap only (`playerVsNpcs` in game/collisions.ts), so it
 * cannot say who moved. A guess against the commander was GitHub #42: a Viper
 * flew into her, and it was hostile for the rest of the flight. So contact
 * does not provoke (docs/TODO/194). The ram still costs the ship its points,
 * and the ledger still credits it to her line. Blame is the one thing it
 * withholds.
 *
 * The keys are `DealtSource` in game/damage-dealt.ts, and that file indexes
 * this table by that type. So a new source with no row here does not compile.
 */
export const PROVOKES: Readonly<Record<'laser' | 'missile' | 'bomb' | 'ram', boolean>> = {
  laser: true, missile: true, bomb: true, ram: false,
};
