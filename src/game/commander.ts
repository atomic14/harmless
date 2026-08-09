import { COMMODITIES } from '../galaxy/galaxy.ts';
import type { GalaxyStateSave } from '../galaxy/living.ts';
import { COBRA_MK_3_HULL_ID, type PlayerHullId } from './ship-identity.ts';
import {
  DEFAULT_NAME, HOLD_TONNES, LARGE_BAY_TONNES, MAX_FUEL, STARTING_CREDITS,
} from '../constants/commander.ts';

// Commander Jameson: who you are, what you are carrying, and how you rank.
//
// PURE. No localStorage, no document, no window — it describes a commander as
// plain data, so Node can build one, the headless campaign can run thousands,
// and a test can assert against one. Reading and writing saves is storage.ts;
// what things cost is shop.ts.
//
// Imports carry explicit .ts extensions because Node loads this module
// directly for the headless campaign simulator (test/campaign.ts).
//
// The commander's own numbers — the name, the grubstake, the tank, the rails
// and the two hold sizes — are constants/commander.ts.

export type LaserType = 'pulse' | 'beam' | 'military';

export interface Equipment {
  largeBay: boolean;
  ecm: boolean;
  laser: LaserType;
  rearLaser: boolean;
  leftLaser: boolean;
  rightLaser: boolean;
  scoops: boolean;
  escapePod: boolean;
  energyUnit: boolean;
  dockingComputer: boolean;
  galacticDrive: boolean;
  energyBomb: boolean;
  miningLaser: boolean;
  combatComputer: boolean;
}

/** Trumbles: cute, cheap, and a catastrophe. Kept outside Equipment
 *  because they are a quantity, not a fitting. */

export function defaultEquipment(): Equipment {
  return {
    largeBay: false,
    ecm: false,
    laser: 'pulse',
    rearLaser: false,
    leftLaser: false,
    rightLaser: false,
    scoops: false,
    escapePod: false,
    energyUnit: false,
    dockingComputer: false,
    galacticDrive: false,
    energyBomb: false,
    miningLaser: false,
    combatComputer: false,
  };
}


/**
 * A job from a station's bulletin board. Available from your first landing, so
 * a new commander always has something to chase (the original made you earn the
 * first mission with 16 kills).
 */
export interface Contract {
  kind: 'cargo' | 'bounty' | 'courier';
  destination: number; // system index
  commodity: number; // cargo runs only
  qty: number;
  reward: number; // tenths of a credit
  deadlineDay: number;
  progress: number; // bounty kills so far
}

export interface MissionState {
  /** 0 none · 1 constrictor hunt · 2 constrictor done · 3 courier run · 4 all done */
  stage: number;
  targetIndex: number | null;
}

export function cargoCapacity(c: CommanderData): number {
  return c.equipment.largeBay ? LARGE_BAY_TONNES : HOLD_TONNES;
}

export interface CommanderData {
  /** what this commander is called — Elite's own default was Jameson */
  name: string;
  /**
   * Which hull you are flying, as a `PlayerHullId` (ship-identity.ts).
   *
   * The ONE piece of player identity a later shipyard changes, which is why it
   * is saved as an id rather than as a copied stat block. A save that does not
   * name one is refused rather than given the Cobra — `requirePlayerHullId`.
   */
  shipId: PlayerHullId;
  galaxy: number;
  systemIndex: number;
  credits: number; // in tenths of a credit, integer
  fuel: number; // tenths of a LY
  missiles: number;
  kills: number;
  /**
   * Combat reputation. Ships destroyed weighted by how hard they were:
   * a gang's Fer-de-Lance is worth five Sidewinders, because it is.
   * `kills` stays the literal body count for the status screen; this is what
   * the rating ladder reads.
   */
  combatScore: number;
  cargo: number[]; // quantity per commodity index
  /**
   * Pilots pulled out of escape capsules, awaiting delivery to a station.
   *
   * NOT cargo, and deliberately not `cargo[3]` (SLAVES, which law.ts lists as
   * contraband) — a rescued survivor must not read as smuggling. They take up a
   * bay (see cargoTonnes) but are not stock and cannot be sold.
   */
  survivors: number;
  equipment: Equipment;
  legalStatus: number; // 0 clean, 1 offender, 2 fugitive
  /**
   * Disrepute: the reputation for dirty dealing that clings after the fine is
   * paid. Shady deeds raise it, time erodes it; `game/character.ts` turns it
   * into a name (Honest…Cutthroat). Drives nothing in the world yet — the label
   * alone. 0 is Honest.
   */
  disrepute: number;
  mission: MissionState;
  /** breeding stowaways; they eat cargo and hate heat */
  trumbles: number;
  /** elapsed days — advanced by hyperspace jumps, used for deadlines */
  day: number;
  /**
   * The briefing edition this commander has been shown (`BRIEFING_VERSION`),
   * or 0 for never. Saved state rather than an ambient browser flag, so the
   * once-per-commander promise travels with the save: an export, an import or
   * an older record all answer it the same way (docs/TODO/106).
   */
  briefingSeen: number;
  /**
   * The furthest wave this commander has ever reached in the combat trainer.
   *
   * THE ONE THING AN EXERCISE IS ALLOWED TO LEAVE BEHIND. It is state, so it is
   * saved. Deliberately NOT a rating, a kill or a credit, and nothing in the
   * career reads it — it is shown on the trainer's own setup panel and nowhere
   * else, so the room's promise that nothing in it leaves it holds.
   * `test/combat-sim-career.test.ts` pins that: after a run of waves it is the
   * ONLY field of the career that has moved.
   */
  furthestWave: number;
  contracts: Contract[];
  /** living-galaxy deltas (prices, danger, convoys in flight) */
  galaxyState?: GalaxyStateSave;
}

export function newCommander(): CommanderData {
  return {
    name: DEFAULT_NAME,
    // Elite-A started you in an Adder; we deliberately do not, because switching
    // the starting hull is a balance change, not an identity one
    // (docs/TODO/completed/ELITE-A-COMBAT-PLAN.md defers it).
    shipId: COBRA_MK_3_HULL_ID,
    galaxy: 1,
    systemIndex: 7, // Lave
    credits: STARTING_CREDITS,
    fuel: MAX_FUEL,
    missiles: 3,
    kills: 0,
    combatScore: 0,
    cargo: COMMODITIES.map(() => 0),
    survivors: 0,
    equipment: defaultEquipment(),
    legalStatus: 0,
    disrepute: 0,
    mission: { stage: 0, targetIndex: null },
    trumbles: 0,
    day: 0,
    briefingSeen: 0,
    furthestWave: 0,
    contracts: [],
  };
}

/**
 * A run of waves ended at `wave`. Keep it if it is the best there has been.
 *
 * A rule rather than a `Math.max` at the call site because there are two call
 * sites — the Game and the harness that proves the Game is right — and a
 * monotonic record written out twice is a record that eventually goes backwards.
 * It only ever grows: a bad run does not cost you a good one.
 *
 * @returns whether it moved, so the caller knows whether there is anything to save.
 */
export function recordFurthestWave(c: CommanderData, wave: number): boolean {
  const best = Math.max(0, Math.floor(wave));
  if (!(best > (c.furthestWave ?? 0))) return false;
  c.furthestWave = best;
  return true;
}

/**
 * What destroying a pirate of this threat tier is worth toward your rating.
 *
 * Weighting by tier rewards taking on the fights that are actually dangerous,
 * rather than farming the weakest thing you can find as the original allowed.
 * (Deliberate deviation; see docs/GAP-ANALYSIS.md.)
 */
export function killValue(tier: number): number {
  return tier >= 2 ? 5 : tier === 1 ? 2 : 1;
}

/** Tonnes currently used (kg/g commodities don't count against the hold). */
export function cargoTonnes(c: CommanderData): number {
  return c.cargo.reduce((sum, qty, i) => sum + (COMMODITIES[i].unit === 't' ? qty : 0), 0)
    + (c.survivors ?? 0);   // a rescued pilot takes up a bay
}

export function formatCredits(tenths: number): string {
  return `${(tenths / 10).toFixed(1)} Cr`;
}
