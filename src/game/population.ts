// How busy a system is when you arrive in it.
//
// Who is already here is four things: traders on their runs, police on patrol,
// rocks, and the reception that waits for you. Three inputs decide it:
//
//   1. the government;
//   2. what the galaxy recorded around here lately;
//   3. what you are visibly worth.
//
// Those three are rules. A ship placed in the scene is not.
//
// So this file returns a PLAN, and the Game builds it. That is the same split
// encounters.ts uses for the arrivals that happen while you fly.
//
// The counts and the chances are constants/population.ts. Two things stayed
// here. `policeFor` holds two thresholds, and they are branches of the ladder
// rather than values anything outside this file can act on. The coin between
// one trader and two, where no convoy is due, is a tie-break inside an
// expression whose real rule is MIN_TRADERS/MAX_TRADERS.

import type { StarSystem } from '../galaxy/galaxy.ts';
import { random } from './rng.ts';
import type { PirateThreat } from './threat.ts';
import {
  ASTEROIDS_MIN, ASTEROIDS_VARIATION, GENERATION_SHIP_CHANCE, HERMIT_CHANCE,
  HUNTER_CHANCE_ARRIVAL, HUNTER_CHANCE_LAUNCH, MAX_TRADERS, MIN_TRADERS,
} from '../constants/population.ts';

export interface PopulationPlan {
  traders: number;
  police: number;
  asteroids: number;
  /** the reception committee — arrivals only. A launch from a station is safe. */
  pirates: number;
  /** a lone bounty hunter at work in the system */
  hunter: boolean;
  /** a hollowed-out rock that trades ore and asks no questions */
  hermit: boolean;
  /** centuries under way, and it still sheds cargo — arrivals only */
  generationShip: boolean;
  /** null on a launch, because nobody organised anything for you */
  threat: PirateThreat | null;
}

/**
 * Police presence by government. An anarchy (0) has none at all, which is what
 * makes it worth the risk and dangerous to stay in. A feudal or multi-gov
 * system (1) manages a single patrol. Anything more organised runs two.
 */
export function policeFor(government: number): number {
  if (government >= 2) return 2;
  if (government >= 1) return 1;
  return 0;
}

/**
 * @param arrivalCount convoys the galaxy says are due here. It is the level-1
 * simulation, arrived as traffic a pilot can really see.
 * @param threat the reception, already computed by contracts.ts (it is a
 * shared rule: the headless campaign runs the same function).
 */
export function planPopulation(
  sys: StarSystem,
  situation: 'launch' | 'arrival',
  arrivalCount: number,
  threat: PirateThreat | null,
  rng: () => number = random,
): PopulationPlan {
  return {
    traders: Math.max(MIN_TRADERS,
      Math.min(MAX_TRADERS, arrivalCount || (rng() < 0.5 ? 2 : 1))),
    police: policeFor(sys.government),
    asteroids: ASTEROIDS_MIN + Math.floor(rng() * ASTEROIDS_VARIATION),
    pirates: situation === 'arrival' && threat ? threat.count : 0,
    threat: situation === 'arrival' ? threat : null,
    // These three were rolled inline in game.ts, outside the plan. So the
    // headless campaign measured a galaxy with no bounty hunters and no
    // hermits, while the game spawned both. A hunter is hostile to any
    // offender, so that was not cosmetic.
    hunter: rng() < (situation === 'arrival' ? HUNTER_CHANCE_ARRIVAL : HUNTER_CHANCE_LAUNCH),
    hermit: rng() < HERMIT_CHANCE,
    generationShip: situation === 'arrival' && rng() < GENERATION_SHIP_CHANCE,
  };
}
