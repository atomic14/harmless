import { COMMODITIES } from '../galaxy/galaxy.ts';
import type { GalaxyStateSave } from '../galaxy/living.ts';
import { COBRA_MK_3_HULL_ID, type PlayerHullId } from './ship-identity.ts';
import {
  DEFAULT_NAME, HOLD_TONNES, LARGE_BAY_TONNES, MAX_FUEL, STARTING_CREDITS,
} from '../constants/commander.ts';
import { PASSENGER_BERTH_TONNES } from '../constants/contracts.ts';

// Commander Jameson: who you are, what you are carrying, and how you rank.
//
// PURE. No localStorage, no document and no window. It describes a commander as
// plain data. So Node builds one, the headless campaign runs thousands, and a
// test asserts against one. A save is read and written in storage.ts. What
// things cost is shop.ts.
//
// Imports carry explicit .ts extensions because Node loads this module
// directly for the headless campaign simulator (test/campaign.ts).
//
// The commander's own numbers — the name, the grubstake, the tank, the rails
// and the two hold sizes — are constants/commander.ts.

export type LaserType = 'pulse' | 'beam' | 'military';

/**
 * The front gun, worst to best — the order the outfitter's ladder climbs and
 * the order a picker walks.
 *
 * It is exported because two screens walk it: the trainer's fit-out rows and
 * test mode's. It was private to the first of them. The second then needed a
 * second copy of the same three words in the same order.
 */
export const LASER_TYPES: readonly LaserType[] = ['pulse', 'beam', 'military'];

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
  kind: 'cargo' | 'bounty' | 'courier' | 'passenger' | 'smuggle';
  destination: number; // system index
  commodity: number; // cargo and smuggling runs only
  /** tonnes on a cargo or smuggling run, kills on a bounty, heads on a passenger job */
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
   * It is the ONE piece of player identity a later shipyard changes. So it is
   * saved as an id rather than as a copied stat block. A save that does not name
   * one is refused rather than given the Cobra (`requirePlayerHullId`).
   */
  shipId: PlayerHullId;
  galaxy: number;
  systemIndex: number;
  credits: number; // in tenths of a credit, integer
  fuel: number; // tenths of a LY
  missiles: number;
  kills: number;
  /**
   * Combat fame. Ships destroyed weighted by how hard they were:
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
   * contraband), because a rescued survivor must not read as smuggling. They
   * are not stock and cannot be sold. They also cost NO HOLD SPACE. A survivor
   * rides in the crew spaces, so `cargoTonnes` does not count them, and a full
   * hold still takes one aboard (docs/TODO/108). Uncapped for the same reason —
   * they occupy
   * nothing, and docking hands them to station medical.
   */
  survivors: number;
  equipment: Equipment;
  legalStatus: number; // 0 clean, 1 offender, 2 fugitive
  /**
   * Atonement: pirate kills counted toward the record since it last ROSE.
   *
   * The record only ever went up, and the fine at a station was the only thing
   * that took it down. `recordWorkedOff` (game/law.ts) is the second way, and
   * this is its ledger (docs/TODO/160, GitHub #32). `KILLS_PER_RUNG` of them
   * take one rung off `legalStatus` and the ledger returns to 0.
   *
   * A Clean commander banks nothing, so a crime cannot be paid for in advance.
   * A fresh offence clears it, so nobody banks four kills and then commits one.
   *
   * It is the RECORD that a kill works off and never the reputation: `disrepute`
   * below is untouched by it. That is docs/TODO/156's split — what the
   * Government holds, against what people think of you — read from the other
   * side.
   */
  atonement: number;
  /**
   * Disrepute: the reputation for dirty dealing that clings after the fine is
   * paid. Shady deeds raise it, time erodes it; `game/character.ts` turns it
   * into a rung (Honest…Cutthroat). 0 is Honest.
   *
   * It is not just a label. `threat.ts` reads it as `infamy`, so a reputation
   * draws people who want to be the ones who killed you. A rock hermit also
   * refuses to trade with a commander who carries enough of it
   * (`hermitRefuses`).
   */
  disrepute: number;
  mission: MissionState;
  /** breeding stowaways; they eat cargo and hate heat */
  trumbles: number;
  /** elapsed days — advanced by hyperspace jumps, used for deadlines */
  day: number;
  /**
   * The briefing edition this commander saw (`BRIEFING_VERSION`), or 0 for
   * never.
   *
   * It is saved state rather than an ambient browser flag, so the
   * once-per-commander promise travels with the save. An export, an import and
   * an older record all answer it the same way (docs/TODO/106).
   */
  briefingSeen: number;
  /**
   * The furthest wave this commander has ever reached in the combat trainer.
   *
   * THE ONE THING AN EXERCISE MAY LEAVE BEHIND. It is state, so it is saved.
   *
   * It is deliberately NOT a rating, a kill or a credit, and nothing in the
   * career reads it. The trainer's own setup panel shows it, and nowhere else
   * does. So the room's promise that nothing in it leaves it holds.
   * `test/combat-sim-career.test.ts` pins that: after a run of waves, it is the
   * ONLY field of the career that moved.
   */
  furthestWave: number;
  /**
   * Somebody switched test mode on in this career, ever.
   *
   * A ONE-WAY LATCH, and the reason is a bug report. docs/TODO/96 closed on the
   * understanding that what plays wrong becomes a GitHub issue. A report from a
   * career that spent an afternoon with free equipment fitted is a different
   * report. `GameState.cheat` is live and switches off before a screenshot.
   * This one cannot, so the status screen says what happened.
   *
   * Read `?? false` the way `disrepute` is read `?? 0`. A save written before
   * this field existed has no key for it. `repairCommander` spreads
   * `newCommander()` under whatever it loaded, so an old career reads false
   * rather than undefined.
   */
  tested: boolean;
  contracts: Contract[];
  /** living-galaxy deltas (prices, danger, convoys in flight) */
  galaxyState?: GalaxyStateSave;
}

export function newCommander(): CommanderData {
  return {
    name: DEFAULT_NAME,
    // Elite-A started you in an Adder. We deliberately do not. To switch the
    // starting hull is a balance change rather than an identity one
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
    atonement: 0,
    disrepute: 0,
    mission: { stage: 0, targetIndex: null },
    trumbles: 0,
    day: 0,
    briefingSeen: 0,
    furthestWave: 0,
    tested: false,
    contracts: [],
  };
}

/**
 * A run of waves ended at `wave`. Keep it if it is the best so far.
 *
 * It is a rule rather than a `Math.max` at the call site. There are two call
 * sites: the Game, and the harness that proves the Game is right. A monotonic
 * record written out twice is a record that eventually goes backwards.
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
 * Test mode was switched on. Mark the career, for good.
 *
 * It is a rule rather than an assignment at the call site, for
 * `recordFurthestWave`'s reason. It is a MONOTONIC record, and a monotonic
 * record written out twice is one that eventually goes backwards.
 *
 * There is no second call to make, because there is no unmark. So the one-way
 * rule is stated here, once, and every caller gets it.
 *
 * @returns whether it moved, so a caller with somewhere to write it knows there
 * is something new to write.
 */
export function markTested(c: CommanderData): boolean {
  if (c.tested ?? false) return false;
  c.tested = true;
  return true;
}

/**
 * What destroying a pirate of this threat tier is worth toward your rating.
 *
 * Weighting by tier rewards taking on the fights that are actually dangerous,
 * rather than farming the weakest thing you can find as the original allowed.
 * (A deliberate deviation from the original, which scored every kill the same.
 * `kills` is still the literal body count. `combatScore` is what the ladder
 * reads, and the iconic 25,600 is untouched.)
 */
export function killValue(tier: number): number {
  return tier >= 2 ? 5 : tier === 1 ? 2 : 1;
}

/**
 * Tonnes currently used: stock in the bays, plus a berth for every passenger
 * under contract (kg/g commodities don't count against the hold).
 *
 * A PAYING PASSENGER IS NOT A SURVIVOR. `survivors` was counted here once, and
 * it is deliberately gone again. A rescued pilot is a person in the crew
 * spaces. So a rescue neither fills a bay nor is refused with the bays full.
 * Someone who bought a ticket gets a berth struck out of the hold — that
 * competition with freight is the whole of passenger work (docs/TODO/109).
 *
 * Berths are DERIVED from the contracts the commander already carries, rather
 * than stored. So the buy cap, the board's footer and `acceptContract`'s
 * refusal cannot disagree about how full the hold is.
 */
export function cargoTonnes(c: CommanderData): number {
  const stock = c.cargo.reduce(
    (sum, qty, i) => sum + (COMMODITIES[i].unit === 't' ? qty : 0), 0);
  return stock + berthTonnes(c.contracts);
}

/** Hold given over to berths by these contracts. */
function berthTonnes(contracts: Contract[]): number {
  return contracts.reduce(
    (sum, k) => sum + (k.kind === 'passenger' ? k.qty * PASSENGER_BERTH_TONNES : 0), 0);
}

/**
 * Tonnes of one commodity that a contract has a claim on.
 *
 * DERIVED from the contract list and never stored, for the reason `berthTonnes`
 * gives above. A stored copy can disagree with the list. The market screen, the
 * sale and `settleContracts` must not be able to hold three answers
 * (docs/TODO/143).
 *
 * Only a `cargo` or a `smuggle` job carries goods. A passenger job takes a
 * berth, which is `berthTonnes`. A bounty and a courier run carry nothing, and
 * their `commodity` field is unread. So a bounty on commodity 0 must not mark
 * the Food row.
 *
 * It reports the JOB, not the hold. A commander who sold two tonnes of a five
 * tonne consignment still owes five, so the answer stays 5 while the hold reads
 * 3. That shortfall is what `settleContracts` bills at the door.
 */
export function consignedTonnes(c: CommanderData, commodity: number): number {
  return c.contracts.reduce((sum, k) => sum
    + ((k.kind === 'cargo' || k.kind === 'smuggle') && k.commodity === commodity
      ? k.qty : 0), 0);
}

export function formatCredits(tenths: number): string {
  return `${(tenths / 10).toFixed(1)} Cr`;
}

/**
 * A count of days in the game's voice: `3 DAYS`, and `1 DAY`.
 *
 * Beside `formatCredits` because the two are the same kind of thing. This
 * commander owns a day count and a purse, and each one has one spelling.
 *
 * The singular is a rule and not decoration. Galaxies 4, 5 and 8 each put a
 * pair of systems on one chart point, so the shortest jump in the game costs
 * `JUMP_DAYS_BASE` alone. The charts and the contract verdict both print it.
 */
export function dayWord(days: number): string {
  return `${days} DAY${days === 1 ? '' : 'S'}`;
}
