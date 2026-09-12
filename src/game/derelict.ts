// What the scan finds when a ship reaches a derelict (docs/TODO/208 M5).
//
// A generation ship crosses on 8% of arrivals. It said one line and offered
// nothing else. The derelict course now flies to it, so the arrival is a
// place a player chose to go, and it says what is there.
//
// THE WORDS COME FROM THE SEED, and no draw from the world's stream. The same
// derelict at the same world tells the same story on every visit, and two
// worlds tell different ones. A draw would move every seeded outcome after
// it, which is `game/rng.ts`'s rule.
//
// They are the encounter's words, so they live beside the game rather than in
// a mission. A mission that wants a derelict can still use one: 208's plan
// leaves that to a later arc.

import type { StarSystem } from '../galaxy/galaxy.ts';

/**
 * What a scan of the hull reports. One line, in the game's voice, and no
 * fiction beyond what a scan can see.
 */
const REPORTS: readonly string[] = [
  'THE DRUM STOPPED TURNING LONG AGO. THE CROP DECKS ARE BARE ROCK.',
  'A HULL BREACH RUNS THE LENGTH OF THE SPINE. NOTHING INSIDE HOLDS AIR.',
  'THE REACTOR IS COLD. THE COLONY LIVED AND DIED ON STORED POWER.',
  'EVERY LOCK STANDS OPEN. WHOEVER LEFT, LEFT IN ORDER.',
  'THE BEACON STILL TRANSMITS A COURSE THIS SHIP CANNOT FLY.',
  'THE CARGO BAYS WERE EMPTIED FROM INSIDE. SOMEBODY PACKED.',
  'THE NAME ON THE BOW IS WORN AWAY. THE REGISTRY IS OLDER THAN THE CHARTS.',
  'A RESCUE CUT THROUGH THE FORWARD FRAMES. IT CAME TOO LATE TO MATTER.',
];

/**
 * The derelict's report at this world. It is the same on every visit, because
 * it is read off the world's own seed rather than drawn.
 */
export function derelictReport(system: StarSystem): string {
  const seed = system.seed;
  const at = Math.abs(seed[0] + seed[1] * 7 + system.index) % REPORTS.length;
  return REPORTS[at] as string;
}
